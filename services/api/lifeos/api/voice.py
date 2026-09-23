from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.ai.voice import nvidia_speech_provider
from lifeos.ai.provider import nemotron_provider

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceRespondRequest(BaseModel):
    transcript: str
    context: Optional[str] = None


class VoiceRespondResponse(BaseModel):
    text_response: str
    provider_used: str
    audio_url: Optional[str] = None


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    audio_bytes = await file.read()
    result = await nvidia_speech_provider.transcribe(audio_bytes, content_type=file.content_type or "audio/wav")
    return result


@router.post("/respond", response_model=VoiceRespondResponse)
async def respond_to_voice(
    payload: VoiceRespondRequest,
    current_user: User = Depends(get_current_user)
):
    gen_result = await nemotron_provider.generate(
        prompt=payload.transcript,
        system_prompt=(
            "You are CONVIA, speaking to the user through their personal voice interface. "
            "Respond in 1-2 calm, concise, authoritative sentences. Never ramble. Acknowledge commitments, "
            "highlight what is watched, and state what comes next."
        )
    )
    synth_result = await nvidia_speech_provider.synthesize(gen_result["content"])

    return VoiceRespondResponse(
        text_response=gen_result["content"],
        provider_used=gen_result.get("model_used", "Nemotron"),
        audio_url=synth_result.get("audio_url")
    )

