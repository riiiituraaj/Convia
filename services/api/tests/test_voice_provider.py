import pytest

from lifeos.ai import voice


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class FakeAsyncClient:
    def __init__(self, response: FakeResponse, requests: list):
        self.response = response
        self.requests = requests

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return None

    async def post(self, url: str, **kwargs):
        self.requests.append((url, kwargs))
        return self.response


@pytest.mark.asyncio
async def test_nvidia_transcription_uses_server_key_and_returns_transcript(monkeypatch):
    requests = []
    monkeypatch.setattr(voice.settings, "NVIDIA_API_KEY", "test-nvidia-key")
    monkeypatch.setattr(
        voice.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(FakeResponse(200, {"text": "Transcript from audio."}), requests),
    )

    result = await voice.nvidia_speech_provider.transcribe(b"wav-data", "audio/wav")

    assert result["status"] == "COMPLETED"
    assert result["transcript"] == "Transcript from audio."
    url, request = requests[0]
    assert url == voice.NVIDIA_ASR_ENDPOINT
    assert request["headers"]["Authorization"] == "Bearer test-nvidia-key"
    assert request["data"]["language"] == "en-US"
    assert request["files"]["file"] == ("voice.wav", b"wav-data", "audio/wav")


@pytest.mark.asyncio
async def test_nvidia_transcription_preserves_uploaded_audio_format(monkeypatch):
    requests = []
    monkeypatch.setattr(voice.settings, "NVIDIA_API_KEY", "test-nvidia-key")
    monkeypatch.setattr(
        voice.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(FakeResponse(200, {"text": "Transcript from audio."}), requests),
    )

    await voice.nvidia_speech_provider.transcribe(b"webm-data", "audio/webm")

    assert requests[0][1]["files"]["file"] == ("voice.webm", b"webm-data", "audio/webm")


@pytest.mark.asyncio
async def test_nvidia_transcription_reports_missing_key_without_request(monkeypatch):
    requests = []
    monkeypatch.setattr(voice.settings, "NVIDIA_API_KEY", None)
    monkeypatch.setattr(
        voice.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(FakeResponse(200, {"text": "should not run"}), requests),
    )

    result = await voice.nvidia_speech_provider.transcribe(b"wav-data")

    assert result["status"] == "UNAVAILABLE"
    assert result["transcript"] == ""
    assert "NVIDIA_API_KEY" in result["message"]
    assert requests == []


@pytest.mark.asyncio
async def test_nvidia_transcription_does_not_expose_provider_response(monkeypatch):
    requests = []
    monkeypatch.setattr(voice.settings, "NVIDIA_API_KEY", "test-nvidia-key")
    monkeypatch.setattr(
        voice.httpx,
        "AsyncClient",
        lambda timeout: FakeAsyncClient(FakeResponse(403, {"detail": "private provider response"}), requests),
    )

    result = await voice.nvidia_speech_provider.transcribe(b"wav-data")

    assert result["status"] == "UNAVAILABLE"
    assert result["transcript"] == ""
    assert "private provider response" not in result["message"]
    assert "model access" in result["message"]
