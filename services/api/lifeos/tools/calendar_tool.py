from typing import Dict, Any, List
from lifeos.tools.base import BaseTool, ToolResult


class CalendarTool(BaseTool):
    name = "calendar_manager"
    description = "Checks schedule conflicts and schedules commitment work blocks."
    permission_level = 2 # Medium risk (calendar modification)
    risk_level = "MEDIUM"

    async def execute(self, action: str, title: str = "", start_time: str = "", duration_minutes: int = 60) -> ToolResult:
        # Honest: no calendar provider is wired. Never claim a fake event was booked.
        return ToolResult(
            success=False,
            data={"status": "COMING_SOON", "action": action},
            error=(
                "Calendar integration is Coming Soon — Google Calendar is not connected. "
                "No event was created. Connect credentials to enable schedule blocks."
            ),
            evidence=["Integrations status: Google Calendar NOT_CONNECTED"],
        )


class EmailTool(BaseTool):
    name = "email_dispatcher"
    description = "Drafts and sends emails/follow-ups to teammates and stakeholders."
    permission_level = 3 # External communication - requires approval
    risk_level = "HIGH"

    async def execute(self, action: str, recipient: str = "", subject: str = "", body: str = "") -> ToolResult:
        # Honest: no mail provider is wired. Never claim a message was sent.
        return ToolResult(
            success=False,
            data={"status": "COMING_SOON", "action": action, "recipient": recipient},
            error=(
                "Email integration is Coming Soon — Gmail is not connected. "
                "No draft or send occurred. Connect credentials to enable outbound mail."
            ),
            evidence=["Integrations status: Gmail NOT_CONNECTED"],
        )


calendar_tool = CalendarTool()
email_tool = EmailTool()

