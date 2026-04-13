from dataclasses import dataclass


@dataclass(frozen=True)
class IntervalsWriteGuard:
    enabled: bool = False
    reason: str = (
        "Remote Intervals plan writes are disabled until stronger authentication, "
        "authorization, and ownership checks are implemented."
    )


def assert_intervals_plan_write_allowed() -> None:
    guard = IntervalsWriteGuard()
    if not guard.enabled:
        raise PermissionError(guard.reason)
