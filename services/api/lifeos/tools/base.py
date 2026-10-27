from typing import Dict, Any
from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    success: bool
    data: Dict[str, Any]
    error: str = ""
    evidence: list[str] = Field(default_factory=list)


class BaseTool:
    name: str = "base_tool"
    description: str = "Base tool description"
    permission_level: int = 1 # 0: Read-only, 1: Low risk, 2: Sensitive, 3: External communication/financial
    risk_level: str = "LOW"   # LOW, MEDIUM, HIGH

    async def execute(self, **kwargs) -> ToolResult:
        raise NotImplementedError

