import logging
from typing import Dict, Any, Optional

import httpx

from lifeos.core.config import settings

logger = logging.getLogger("lifeos.ai.voice")

NVIDIA_ASR_ENDPOINT = (
    "https://1598d209-5e27-4d3c-8079-4751568b1081.invocation.api.nvcf.nvidia.com"
    "/v1/audio/transcriptions"
)
NVIDIA_ASR_FORMATS = {
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
}


class SpeechToTextProvider:
    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> Dict[str, Any]:
        raise NotImplementedError


class TextToSpeechProvider:
    async def synthesize(self, text: str, voice: Optional[str] = None) -> Dict[str, Any]:
        raise NotImplementedError


class NvidiaSpeechProvider(SpeechToTextProvider, TextToSpeechProvider):
    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> Dict[str, Any]:
        if not settings.NVIDIA_API_KEY:
            return {
                "transcript": "",
                "provider": "NVIDIA Parakeet ASR",
                "status": "UNAVAILABLE",
                "message": "NVIDIA server transcription needs NVIDIA_API_KEY in the API environment.",
            }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    NVIDIA_ASR_ENDPOINT,
                    headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"},
                    data={"language": "en-US"},
                    files={
                        "file": (
                            f"voice.{NVIDIA_ASR_FORMATS.get(content_type, 'wav')}",
                            audio_bytes,
                            content_type,
                        )
                    },
                )
        except httpx.TimeoutException:
            logger.warning("NVIDIA ASR request timed out")
            return {
                "transcript": "",
                "provider": "NVIDIA Parakeet ASR",
                "status": "UNAVAILABLE",
                "message": "NVIDIA transcription timed out. Check the API server's internet connection and retry.",
            }
        except httpx.RequestError as exc:
            logger.warning("NVIDIA ASR request failed (%s)", type(exc).__name__)
            return {
                "transcript": "",
                "provider": "NVIDIA Parakeet ASR",
                "status": "UNAVAILABLE",
                "message": "The API server could not reach NVIDIA transcription. Check its internet connection and retry.",
            }

        if response.status_code in (401, 403):
            message = "NVIDIA rejected the API key or ASR model access. Check the key and model access in NVIDIA Build."
        elif response.status_code == 429:
            message = "NVIDIA transcription rate limit or quota reached. Try again later."
        elif response.status_code >= 500:
            message = "NVIDIA transcription is temporarily unavailable. Try again later."
        elif response.status_code >= 400:
            message = f"NVIDIA transcription rejected the audio (HTTP {response.status_code}). Use a short, clear recording and retry."
        else:
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            transcript = payload.get("text", "") if isinstance(payload, dict) else ""
            if isinstance(transcript, str) and transcript.strip():
                return {
                    "transcript": transcript.strip(),
                    "provider": "NVIDIA Parakeet ASR",
                    "status": "COMPLETED",
                }
            message = "NVIDIA returned no transcript. Try a longer, clearer recording."

        logger.warning("NVIDIA ASR request returned HTTP %s", response.status_code)
        return {
            "transcript": "",
            "provider": "NVIDIA Parakeet ASR",
            "status": "UNAVAILABLE",
            "message": message,
        }

    async def synthesize(self, text: str, voice: Optional[str] = "en-US-Female-1") -> Dict[str, Any]:
        return {
            "audio_url": None,
            "provider": "Hanni browser voice",
            "status": "BROWSER_FALLBACK",
            "message": "Server-side speech synthesis is not configured; browser voice is used when available.",
        }


nvidia_speech_provider = NvidiaSpeechProvider()

