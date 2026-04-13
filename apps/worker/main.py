from dataclasses import dataclass
from typing import Literal

JobType = Literal[
    "intervals_initial_sync",
    "intervals_incremental_sync",
    "dashboard_rebuild",
    "workout_export",
]


@dataclass
class Job:
    job_type: JobType
    payload: dict


class WorkerApp:
    def run_job(self, job: Job) -> None:
        print(f"TODO: execute {job.job_type} with payload={job.payload}")


if __name__ == "__main__":
    WorkerApp().run_job(Job(job_type="dashboard_rebuild", payload={"status": "scaffold"}))
