import logging
from typing import Dict, Any, Optional
import httpx
from lifeos.core.config import settings

logger = logging.getLogger("lifeos.ai.voice")


class SpeechToTextProvider:
    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> Dict[str, Any]:
        raise NotImplementedError


class TextToSpeechProvider:
    async def synthesize(self, text: str, voice: Optional[str] = None) -> Dict[str, Any]:
        raise NotImplementedError


class NvidiaSpeechProvider(SpeechToTextProvider, TextToSpeechProvider):
    def __init__(self):
        self.api_key = settings.NVIDIA_API_KEY
        self.asr_url = settings.NVIDIA_NIM_ASR_URL
        self.tts_url = settings.NVIDIA_NIM_TTS_URL

    async def transcribe(self, audio_bytes: bytes, content_type: str = "audio/wav") -> Dict[str, Any]:
        if not self.api_key:
            return {
                "transcript": "",
                "provider": "NVIDIA Parakeet ASR",
                "status": "UNAVAILABLE",
                "message": "NVIDIA credentials missing. Use client-side Web Speech fallback."
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": content_type
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.asr_url}/audio/transcriptions",
                    headers=headers,
                    content=audio_bytes
                )
                response.raise_for_status()
                data = response.json()
                return {
                    "transcript": data.get("text", ""),
                    "provider": "NVIDIA Parakeet ASR",
                    "status": "SUCCESS"
                }
            except Exception as e:
                logger.error(f"NVIDIA ASR transcription failed: {e}")
                return {
                    "transcript": "",
                    "provider": "NVIDIA Parakeet ASR",
                    "status": "ERROR",
                    "error": str(e)
                }

    async def synthesize(self, text: str, voice: Optional[str] = "en-US-Female-1") -> Dict[str, Any]:
        if not self.api_key:
            return {
                "audio_url": None,
                "provider": "Hanni browser voice",
                "status": "UNAVAILABLE",
                "message": "Hanni uses the browser's soft speech voice."
            }

        # NVIDIA TTS audio delivery is not part of the current browser flow.
        # The frontend speaks Hanni's response with the selected soft system voice.
        return {
            "audio_url": None,
            "provider": "Hanni browser voice",
            "status": "BROWSER_FALLBACK",
            "message": "Hanni uses the browser's soft speech voice."
        }


nvidia_speech_provider = NvidiaSpeechProvider()

