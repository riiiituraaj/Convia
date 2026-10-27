from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from lifeos.api.deps import get_current_user
from lifeos.models.user import User
from lifeos.ai.voice import nvidia_speech_provider
from lifeos.ai.provider import nemotron_provider
from lifeos.ai.provider import AIProviderError

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceRespondRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=8000)
    context: Optional[str] = Field(default=None, max_length=2000)


class VoiceRespondResponse(BaseModel):
    text_response: str
    provider_used: str
    audio_url: Optional[str] = None


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    allowed_types = {"audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported audio content type")
    audio_bytes = await file.read(10 * 1024 * 1024 + 1)
    await file.close()
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio upload exceeds the 10 MB limit")
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="The audio recording is empty")
    result = await nvidia_speech_provider.transcribe(audio_bytes, content_type=file.content_type or "audio/wav")
    return result


@router.post("/respond", response_model=VoiceRespondResponse)
async def respond_to_voice(
    payload: VoiceRespondRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        gen_result = await nemotron_provider.generate(
            prompt=payload.transcript,
            system_prompt=(
                "You are CONVIA, speaking to the user through their personal voice interface. "
                "Respond in 1-2 calm, concise sentences. Do not claim you accessed saved workspace data, performed "
                "external research, ran actions, scheduled work, monitored changes, or verified results unless "
                "this request provides evidence. If asked about saved history that is not included in this request, "
                "say that you cannot access it in this answer. If information is missing, say so."
            )
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": "The configured inference provider could not complete this request."}) from None
    synth_result = await nvidia_speech_provider.synthesize(gen_result["content"])

    return VoiceRespondResponse(
        text_response=gen_result["content"],
        provider_used=gen_result.get("model_used", "Nemotron"),
        audio_url=synth_result.get("audio_url")
    )

