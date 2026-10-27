from typing import Dict, Any, List
from lifeos.tools.base import BaseTool, ToolResult


class CalendarTool(BaseTool):
    name = "calendar_manager"
    description = "Calendar event creation and editing require write-enabled authorization, which is not granted."
    permission_level = 2 # Medium risk (calendar modification)
    risk_level = "MEDIUM"

    async def execute(self, action: str, title: str = "", start_time: str = "", duration_minutes: int = 60) -> ToolResult:
        # The Google Workspace connection is intentionally read-only.
        return ToolResult(
            success=False,
            data={"status": "READ_ONLY", "action": action},
            error=(
                "Google Calendar is available for reading events, but this connection cannot create or edit them. "
                "No event was created or changed."
            ),
            evidence=["Google Workspace permissions are read-only"],
        )


class EmailTool(BaseTool):
    name = "email_dispatcher"
    description = "Sending or drafting email requires write-enabled authorization, which is not granted."
    permission_level = 3 # External communication - requires approval
    risk_level = "HIGH"

    async def execute(self, action: str, recipient: str = "", subject: str = "", body: str = "") -> ToolResult:
        # The Google Workspace connection is intentionally read-only.
        return ToolResult(
            success=False,
            data={"status": "READ_ONLY", "action": action, "recipient": recipient},
            error=(
                "Gmail is available for reading, but this connection cannot create drafts or send email. "
                "No draft or message was created or sent."
            ),
            evidence=["Google Workspace permissions are read-only"],
        )


calendar_tool = CalendarTool()
email_tool = EmailTool()

