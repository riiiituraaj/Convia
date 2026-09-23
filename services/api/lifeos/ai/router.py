from enum import Enum
from typing import Dict, Any
from lifeos.core.config import settings


class TaskComplexity(str, Enum):
    SIMPLE = "SIMPLE"       # Quick categorization, extraction, text parsing
    STANDARD = "STANDARD"   # Commitment breakdown, risk calculation, research summarization
    COMPLEX = "COMPLEX"     # Multi-step graph generation, critic evaluation, recovery trade-offs


class ModelRouter:
    @staticmethod
    def _models() -> tuple[str, str, str]:
        if settings.NVIDIA_API_KEY and not settings.NEBIUS_API_KEY:
            return (
                settings.NVIDIA_NIM_FAST_MODEL,
                settings.NVIDIA_NIM_MODEL,
                settings.NVIDIA_NIM_REASONING_MODEL,
            )
        return (
            settings.NEBIUS_FAST_MODEL,
            settings.NEBIUS_NEMOTRON_MODEL,
            settings.NEBIUS_REASONING_MODEL,
        )

    @staticmethod
    def select_model(complexity: TaskComplexity, task_name: str = "") -> str:
        """Selects the optimal configured Nemotron model based on complexity and task requirements."""
        fast_model, standard_model, reasoning_model = ModelRouter._models()
        if complexity == TaskComplexity.SIMPLE:
            return fast_model
        elif complexity == TaskComplexity.COMPLEX:
            return reasoning_model
        else:
            return standard_model

    @staticmethod
    def evaluate_task(task_type: str, input_payload: Dict[str, Any]) -> TaskComplexity:
        complex_tasks = {"critic_analysis", "multi_mission_planning", "recovery_tradeoff"}
        simple_tasks = {"intent_detection", "memory_extraction", "speech_cleanup"}

        if task_type in complex_tasks:
            return TaskComplexity.COMPLEX
        if task_type in simple_tasks:
            return TaskComplexity.SIMPLE
        return TaskComplexity.STANDARD

