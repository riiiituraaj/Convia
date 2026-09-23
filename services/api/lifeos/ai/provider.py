import json
import logging
import time
from typing import Dict, Any, Optional, AsyncGenerator
import httpx
from lifeos.core.config import settings
from lifeos.ai.router import ModelRouter, TaskComplexity

logger = logging.getLogger("lifeos.ai.provider")


class NemotronProvider:
    def __init__(self):
        self.using_nvidia = bool(settings.NVIDIA_API_KEY and not settings.NEBIUS_API_KEY)
        self.api_key = settings.NVIDIA_API_KEY if self.using_nvidia else settings.NEBIUS_API_KEY
        self.base_url = settings.NVIDIA_NIM_BASE_URL if self.using_nvidia else settings.NEBIUS_BASE_URL
        self.default_model = settings.NVIDIA_NIM_MODEL if self.using_nvidia else settings.NEBIUS_NEMOTRON_MODEL

    async def health_check(self) -> Dict[str, Any]:
        """Checks provider connectivity and configuration status."""
        configured = bool(self.api_key)
        return {
            "provider": "Nebius Token Factory / NVIDIA NIM",
            "configured": configured,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "status": "ONLINE" if configured else "LOCAL_DEV_FALLBACK"
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "You are CONVIA, the Personal Continuity Engine.",
        model: Optional[str] = None,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        start_time = time.time()
        selected_model = model or self.default_model

        if not self.api_key:
            # Deterministic local fallback — honest, useful, never fakes LLM output.
            latency = (time.time() - start_time) * 1000
            snippet = " ".join(prompt.split())[:160]
            return {
                "content": (
                    "I'm running in local mode (no NVIDIA/Nebius API key), so I can't "
                    f"reason with the language model over new prompts. I heard: \"{snippet}\". "
                    "Your continuity store — commitments, missions, risks and activity — "
                    "still works; add an API key to enable full CONVIA AI responses."
                ),
                "model_used": f"{selected_model} (local-deterministic)",
                "latency_ms": latency,
                "local_mode": True,
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": selected_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                if self.using_nvidia:
                    payload.update({
                        "top_p": 0.95,
                        "max_tokens": 4096,
                        "reasoning_budget": 0,
                        "chat_template_kwargs": {"enable_thinking": False},
                        "stream": True,
                    })
                    content_parts = []
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            chunk = line[5:].strip()
                            if chunk == "[DONE]":
                                break
                            try:
                                delta = json.loads(chunk).get("choices", [{}])[0].get("delta", {})
                            except (json.JSONDecodeError, IndexError, AttributeError):
                                continue
                            content_parts.append(delta.get("content", ""))
                    content = "".join(content_parts)
                else:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                latency = (time.time() - start_time) * 1000
                return {
                    "content": content,
                    "model_used": selected_model,
                    "latency_ms": latency
                }
            except Exception as e:
                provider_name = "NVIDIA NIM" if self.using_nvidia else "Nebius Nemotron"
                logger.error(f"{provider_name} call failed: {e}")
                latency = (time.time() - start_time) * 1000
                return {
                    "content": (
                        f"{provider_name} is unreachable right now ({e.__class__.__name__}). "
                        "Nothing was changed — your continuity store is intact. "
                        "Retry in a moment, or check the API key / network."
                    ),
                    "model_used": f"{selected_model} (fallback)",
                    "latency_ms": latency,
                    "error": str(e),
                    "local_mode": True,
                }

    async def structured_output(
        self,
        prompt: str,
        system_prompt: str,
        schema: Dict[str, Any],
        complexity: TaskComplexity = TaskComplexity.STANDARD
    ) -> Dict[str, Any]:
        """Requests structured JSON output matching the provided schema."""
        model = ModelRouter.select_model(complexity)
        enhanced_system = (
            f"{system_prompt}\n"
            f"You must return ONLY a valid, single JSON object adhering to this schema:\n"
            f"{json.dumps(schema, indent=2)}\n"
            f"Do not include any conversational preamble or markdown code blocks if possible. Output raw JSON."
        )

        result = await self.generate(
            prompt=prompt,
            system_prompt=enhanced_system,
            model=model,
            temperature=0.1
        )

        content = result.get("content", "{}").strip()
        # Clean any markdown code ticks if returned
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            parsed = json.loads(content)
            return {
                "data": parsed,
                "model_used": result.get("model_used"),
                "latency_ms": result.get("latency_ms")
            }
        except json.JSONDecodeError:
            return {
                "data": {},
                "raw": content,
                "model_used": result.get("model_used"),
                "latency_ms": result.get("latency_ms"),
                "error": "Failed to decode structured JSON"
            }


nemotron_provider = NemotronProvider()

