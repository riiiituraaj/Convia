from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from lifeos.core.event_bus import event_bus

router = APIRouter(tags=["activity"])


@router.get("/activity/stream")
async def activity_stream():
    """Server-Sent Events endpoint streaming real-time CONVIA events to frontend."""
    return StreamingResponse(
        event_bus.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

