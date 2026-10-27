import asyncio
import json
import logging
import random
import time
from typing import Any, Dict, Optional

import httpx

from lifeos.ai.router import ModelRouter, TaskComplexity
from lifeos.core.config import settings

logger = logging.getLogger("lifeos.ai.provider")


class AIProviderError(RuntimeError):
    """Safe provider failure carrying a stable code and HTTP status for API mapping."""

    def __init__(self, code: str, status_code: int = 503):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


class NemotronProvider:
    def __init__(self):
        self.refresh_configuration()

    def refresh_configuration(self) -> None:
        self.provider = settings.AI_PROVIDER
        if self.provider == "nvidia":
            self.api_key = settings.NVIDIA_API_KEY
            self.base_url = settings.NVIDIA_NIM_BASE_URL.rstrip("/")
            self.default_model = settings.NVIDIA_NIM_MODEL
        elif self.provider == "nebius":
            self.api_key = settings.NEBIUS_API_KEY
            self.base_url = settings.NEBIUS_BASE_URL.rstrip("/")
            self.default_model = settings.NEBIUS_NEMOTRON_MODEL
        else:
            self.api_key = None
            self.base_url = ""
            self.default_model = ""

    async def health_check(self) -> Dict[str, Any]:
        """Report configured state only; this method does not claim network reachability."""
        configured = self.provider == "disabled" or bool(self.api_key and self.default_model)
        return {
            "provider": self.provider,
            "configured": configured,
            "default_model": self.default_model or None,
            "status": "DISABLED" if self.provider == "disabled" else "CONFIGURED" if configured else "NOT_CONFIGURED",
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "You are CONVIA, the Personal Continuity Engine.",
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        self.refresh_configuration()
        start_time = time.perf_counter()
        selected_model = model or self.default_model

        if not self.api_key or self.provider == "disabled":
            return {
                "content": (
                    "No language model processed this request. Configure the selected inference provider "
                    "to enable generated answers. Use intent capture to save an objective."
                ),
                "model_used": "local-deterministic",
                "latency_ms": (time.perf_counter() - start_time) * 1000,
                "local_mode": True,
            }
        if not selected_model or selected_model == "local-deterministic":
            raise AIProviderError("model_not_configured")

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload: dict[str, Any] = {
            "model": selected_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
        }
        if self.provider == "nvidia":
            payload.update({
                "top_p": 0.95,
                "max_tokens": 2048,
                "chat_template_kwargs": {"enable_thinking": False},
                "stream": True,
            })

        last_status: Optional[int] = None
        for attempt in range(settings.AI_MAX_RETRIES + 1):
            try:
                timeout = httpx.Timeout(settings.AI_REQUEST_TIMEOUT_SECONDS)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    if self.provider == "nvidia":
                        parts: list[str] = []
                        async with client.stream(
                            "POST", f"{self.base_url}/chat/completions", headers=headers, json=payload
                        ) as response:
                            last_status = response.status_code
                            if response.status_code == 429 or response.status_code >= 500:
                                if attempt < settings.AI_MAX_RETRIES:
                                    await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                                    continue
                            response.raise_for_status()
                            async for line in response.aiter_lines():
                                if not line.startswith("data:"):
                                    continue
                                chunk = line[5:].strip()
                                if chunk == "[DONE]":
                                    break
                                try:
                                    delta = json.loads(chunk).get("choices", [{}])[0].get("delta", {})
                                except (json.JSONDecodeError, IndexError, AttributeError, TypeError):
                                    continue
                                parts.append(delta.get("content") or "")
                        content = "".join(parts)
                    else:
                        response = await client.post(
                            f"{self.base_url}/chat/completions", headers=headers, json=payload
                        )
                        last_status = response.status_code
                        if response.status_code == 429 or response.status_code >= 500:
                            if attempt < settings.AI_MAX_RETRIES:
                                await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                                continue
                        response.raise_for_status()
                        body = response.json()
                        content = body["choices"][0]["message"]["content"]
                if not isinstance(content, str) or not content.strip():
                    raise AIProviderError("empty_provider_response", 502)
                return {
                    "content": content,
                    "model_used": selected_model,
                    "provider": self.provider,
                    "latency_ms": (time.perf_counter() - start_time) * 1000,
                    "local_mode": False,
                }
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                logger.warning("Inference provider request failed (HTTP %s)", status_code)
                if status_code in {401, 403}:
                    raise AIProviderError("provider_authentication_failed", 502) from None
                if status_code == 429:
                    raise AIProviderError("provider_rate_limited", 503) from None
                if status_code >= 500 and attempt < settings.AI_MAX_RETRIES:
                    await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                    continue
                raise AIProviderError("provider_request_failed", 502) from None
            except (httpx.TimeoutException, httpx.NetworkError):
                logger.warning("Inference provider network request failed")
                if attempt < settings.AI_MAX_RETRIES:
                    await asyncio.sleep(0.4 * (2 ** attempt) + random.uniform(0, 0.2))
                    continue
                raise AIProviderError("provider_unavailable", 503) from None
            except AIProviderError:
                raise
            except (KeyError, ValueError, TypeError):
                logger.warning("Inference provider returned an invalid response payload")
                raise AIProviderError("invalid_provider_response", 502) from None

        raise AIProviderError("provider_unavailable" if last_status is None else "provider_request_failed", 503)

    async def structured_output(
        self,
        prompt: str,
        system_prompt: str,
        schema: Dict[str, Any],
        complexity: TaskComplexity = TaskComplexity.STANDARD,
    ) -> Dict[str, Any]:
        model = ModelRouter.select_model(complexity)
        enhanced_system = (
            f"{system_prompt}\nReturn only one valid JSON object matching this schema:\n"
            f"{json.dumps(schema, indent=2)}\nDo not include markdown or a preamble."
        )
        result = await self.generate(prompt, enhanced_system, model=model, temperature=0.1)
        if result.get("local_mode"):
            return {"data": {}, "model_used": result.get("model_used"), "error": "provider_not_configured"}

        content = result.get("content", "").strip()
        if content.startswith("```"):
            content = content.removeprefix("```json").removeprefix("```")
        if content.endswith("```"):
            content = content[:-3]
        try:
            parsed = json.loads(content.strip())
        except json.JSONDecodeError:
            return {
                "data": {},
                "model_used": result.get("model_used"),
                "latency_ms": result.get("latency_ms"),
                "error": "invalid_structured_output",
            }
        if not isinstance(parsed, dict):
            return {"data": {}, "model_used": result.get("model_used"), "error": "invalid_structured_output"}
        return {"data": parsed, "model_used": result.get("model_used"), "latency_ms": result.get("latency_ms")}


nemotron_provider = NemotronProvider()
