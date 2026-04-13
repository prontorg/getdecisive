from dataclasses import dataclass


@dataclass
class IntervalsSyncConfig:
    athlete_id: str
    api_key: str


def run_initial_sync(config: IntervalsSyncConfig) -> dict:
    return {
        "status": "scaffold",
        "athlete_id": config.athlete_id,
        "message": "Replace with extracted Intervals sync logic from current scripts.",
    }
