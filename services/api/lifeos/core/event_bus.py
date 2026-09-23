import asyncio
import json
from typing import AsyncGenerator, Dict, Any, Set
from datetime import datetime, timezone


class EventBus:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(queue)
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self._subscribers.remove(queue)

    async def publish(self, event_type: str, payload: Dict[str, Any]):
        message = json.dumps({
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload
        })
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass


event_bus = EventBus()

