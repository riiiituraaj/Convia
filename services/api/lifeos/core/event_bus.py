import asyncio
import json
from typing import AsyncGenerator, Dict, Any
from datetime import datetime, timezone


class EventBus:
    def __init__(self):
        self._subscribers: dict[asyncio.Queue, str] = {}

    async def subscribe(self, user_id: str) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subscribers[queue] = user_id
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self._subscribers.pop(queue, None)

    async def publish(self, event_type: str, payload: Dict[str, Any]):
        message = json.dumps({
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload
        })
        user_id = payload.get("user_id")
        if not user_id:
            return
        for queue, subscriber_user_id in list(self._subscribers.items()):
            if subscriber_user_id != user_id:
                continue
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # Drop the oldest event to keep slow clients bounded and current.
                try:
                    queue.get_nowait()
                    queue.put_nowait(message)
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    continue


event_bus = EventBus()

