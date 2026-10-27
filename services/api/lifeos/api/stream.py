from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from lifeos.api.deps import get_current_user
from lifeos.core.event_bus import event_bus
from lifeos.models.user import User

router = APIRouter(tags=["activity"])


@router.get("/activity/stream")
async def activity_stream(current_user: User = Depends(get_current_user)):
    """Stream events belonging only to the authenticated account."""
    return StreamingResponse(
        event_bus.subscribe(current_user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

