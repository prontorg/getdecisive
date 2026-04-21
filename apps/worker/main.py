from __future__ import annotations

import argparse
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Literal
from urllib.parse import parse_qsl

import requests

try:
    import psycopg
except Exception:  # pragma: no cover
    psycopg = None

JobType = Literal[
    "intervals_initial_sync",
    "intervals_incremental_sync",
    "dashboard_rebuild",
    "workout_export",
]

SYNC_JOB_TYPES = {"intervals_initial_sync", "intervals_incremental_sync"}
UTC = timezone.utc
API_BASE = "https://intervals.icu/api/v1"
DEFAULT_STORE_PATH = Path(__file__).resolve().parents[1] / "web" / ".decisive-dev-store.json"


@dataclass
class Job:
    job_type: JobType
    payload: dict


def now_iso() -> str:
    return datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")


def default_store_path() -> Path:
    return Path(os.environ.get("DECISIVE_PLATFORM_STORE_PATH") or DEFAULT_STORE_PATH)


def database_url() -> str | None:
    return os.environ.get("DATABASE_URL") or None


def read_state(store_path: Path) -> dict[str, Any]:
    payload = json.loads(store_path.read_text())
    payload.setdefault("invites", [])
    payload.setdefault("users", [])
    payload.setdefault("memberships", [])
    payload.setdefault("onboardingRuns", [])
    payload.setdefault("intervalsConnections", [])
    payload.setdefault("syncJobs", [])
    payload.setdefault("intervalsSnapshots", [])
    payload.setdefault("auditEvents", [])
    return payload


def write_state(store_path: Path, state: dict[str, Any]) -> None:
    store_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=store_path.parent, encoding="utf-8") as fh:
        json.dump(state, fh, indent=2)
        fh.write("\n")
        tmp_path = Path(fh.name)
    tmp_path.replace(store_path)
    backup_path = store_path.with_suffix(store_path.suffix + ".bak")
    backup_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def parse_credential_payload(payload: str) -> dict[str, str]:
    raw = (payload or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(key): str(value) for key, value in parsed.items() if value is not None}
    except json.JSONDecodeError:
        pass
    normalized = raw.replace("\n", "&")
    result = {key.strip(): value.strip() for key, value in parse_qsl(normalized, keep_blank_values=False)}
    if result:
        return result
    if "=" in raw:
        key, value = raw.split("=", 1)
        return {key.strip(): value.strip()}
    return {"api_key": raw}


class IntervalsApiClient:
    def __init__(self, athlete_id: str, api_key: str):
        self.athlete_id = athlete_id
        self.auth = ("API_KEY", api_key)

    def get(self, path: str, **params: Any) -> Any:
        response = requests.get(f"{API_BASE}{path}", auth=self.auth, params=params, timeout=60)
        response.raise_for_status()
        return response.json()

    def wellness(self, oldest: str, newest: str) -> list[dict[str, Any]]:
        return self.get(f"/athlete/{self.athlete_id}/wellness", oldest=oldest, newest=newest)

    def activities(self, oldest: str, newest: str, limit: int = 50) -> list[dict[str, Any]]:
        return self.get(f"/athlete/{self.athlete_id}/activities", oldest=oldest, newest=newest, limit=limit)

    def activity(self, activity_id: str) -> dict[str, Any]:
        return self.get(f"/activity/{activity_id}")


class WorkerApp:
    def __init__(self, store_path: Path | None = None, live_state_fetcher: Callable[[dict[str, Any], str], dict[str, Any]] | None = None):
        self.store_path = Path(store_path or default_store_path())
        self.live_state_fetcher = live_state_fetcher or self.fetch_live_state_for_connection

    def pick_next_sync_job(self, state: dict[str, Any]) -> dict[str, Any] | None:
        candidates = [
            job for job in state.get("syncJobs", [])
            if job.get("jobType") in SYNC_JOB_TYPES and job.get("status") in {"queued", "running"}
        ]
        candidates.sort(key=lambda item: item.get("updatedAt", ""))
        return candidates[0] if candidates else None

    def load_runtime_state(self) -> dict[str, Any]:
        state = read_state(self.store_path)
        if not database_url():
            return state
        if psycopg is None:
            raise RuntimeError("DATABASE_URL is set but psycopg is not installed")
        with psycopg.connect(database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("select id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, finished_at, last_error, updated_at from sync_jobs_runtime")
                state["syncJobs"] = [{
                    "id": row[0], "userId": row[1], "connectionId": row[2], "jobType": row[3], "status": row[4], "progressPct": row[5], "statusMessage": row[6],
                    "startedAt": row[7].isoformat().replace('+00:00', 'Z') if row[7] else None,
                    "finishedAt": row[8].isoformat().replace('+00:00', 'Z') if row[8] else None,
                    "lastError": row[9],
                    "updatedAt": row[10].isoformat().replace('+00:00', 'Z') if row[10] else now_iso(),
                } for row in cur.fetchall()]
                cur.execute("select id, user_id, connection_id, source_job_id, captured_at, live_state_json from intervals_snapshots_runtime")
                state["intervalsSnapshots"] = [{
                    "id": row[0], "userId": row[1], "connectionId": row[2], "sourceJobId": row[3],
                    "capturedAt": row[4].isoformat().replace('+00:00', 'Z') if row[4] else now_iso(),
                    "liveState": row[5],
                } for row in cur.fetchall()]
        return state

    def persist_runtime_state(self, state: dict[str, Any]) -> None:
        write_state(self.store_path, state)
        if not database_url():
            return
        if psycopg is None:
            raise RuntimeError("DATABASE_URL is set but psycopg is not installed")
        with psycopg.connect(database_url()) as conn:
            with conn.cursor() as cur:
                for job in state.get("syncJobs", []):
                    cur.execute(
                        """
                        insert into sync_jobs_runtime (id, user_id, connection_id, job_type, status, progress_pct, status_message, started_at, finished_at, last_error, updated_at)
                        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        on conflict (id) do update set
                          user_id = excluded.user_id,
                          connection_id = excluded.connection_id,
                          job_type = excluded.job_type,
                          status = excluded.status,
                          progress_pct = excluded.progress_pct,
                          status_message = excluded.status_message,
                          started_at = excluded.started_at,
                          finished_at = excluded.finished_at,
                          last_error = excluded.last_error,
                          updated_at = excluded.updated_at
                        """,
                        (job.get("id"), job.get("userId"), job.get("connectionId"), job.get("jobType"), job.get("status"), job.get("progressPct"), job.get("statusMessage"), job.get("startedAt"), job.get("finishedAt"), job.get("lastError"), job.get("updatedAt")),
                    )
                for snapshot in state.get("intervalsSnapshots", []):
                    cur.execute(
                        """
                        insert into intervals_snapshots_runtime (id, user_id, connection_id, source_job_id, captured_at, live_state_json)
                        values (%s,%s,%s,%s,%s,%s::jsonb)
                        on conflict (connection_id) do update set
                          id = excluded.id,
                          user_id = excluded.user_id,
                          source_job_id = excluded.source_job_id,
                          captured_at = excluded.captured_at,
                          live_state_json = excluded.live_state_json
                        """,
                        (snapshot.get("id"), snapshot.get("userId"), snapshot.get("connectionId"), snapshot.get("sourceJobId"), snapshot.get("capturedAt"), json.dumps(snapshot.get("liveState") or {})),
                    )
            conn.commit()

    def fetch_live_state_for_connection(self, connection: dict[str, Any], job_type: str) -> dict[str, Any]:
        credentials = parse_credential_payload(connection.get("credentialPayload", ""))
        api_key = credentials.get("api_key") or credentials.get("apiKey") or credentials.get("key")
        if not api_key:
            raise ValueError("Intervals API key missing from credential payload")
        athlete_id = connection.get("externalAthleteId", "")
        client = IntervalsApiClient(athlete_id=athlete_id, api_key=api_key)
        today = date.today()
        oldest = today - timedelta(days=42)
        month_start = date(today.year, today.month, 1)
        wellness_series = client.wellness(oldest=(date(today.year, 1, 1) - timedelta(days=7)).isoformat(), newest=today.isoformat())
        recent_activities = client.activities(oldest=oldest.isoformat(), newest=today.isoformat(), limit=50)
        month_activities = client.activities(oldest=month_start.isoformat(), newest=today.isoformat(), limit=240)
        year_activities = client.activities(oldest=date(today.year, 1, 1).isoformat(), newest=today.isoformat(), limit=1000)
        detailed_rows = []
        timeline_rows: list[dict[str, Any]] = []
        month_zone_totals: dict[str, int] = {}
        latest_day = None
        latest_day_rows: list[dict[str, Any]] = []

        seen_activity_ids: set[str] = set()

        def build_live_row(detail: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
            zone_times = {str(zone.get("id") or "other"): int(zone.get("secs") or 0) for zone in (detail.get("icu_zone_times") or []) if zone.get("id")}
            return {
                "activity_id": str(detail.get("id") or row.get("id") or row.get("activity_id") or ""),
                "start_date_local": str(detail.get("start_date_local") or row.get("start_date_local") or ""),
                "name": detail.get("name") or row.get("name"),
                "activity_type": detail.get("type") or row.get("type") or row.get("activity_type") or "Ride",
                "session_type": classify_session_type(detail),
                "training_load": detail.get("icu_training_load") or row.get("icu_training_load") or row.get("training_load"),
                "distance": detail.get("distance") or row.get("distance"),
                "moving_time": detail.get("moving_time") or row.get("moving_time"),
                "elapsed_time": detail.get("elapsed_time") or row.get("elapsed_time"),
                "duration_s": detail.get("moving_time") or detail.get("elapsed_time") or row.get("moving_time") or row.get("elapsed_time"),
                "weighted_avg_watts": detail.get("icu_weighted_avg_watts"),
                "average_watts": detail.get("icu_average_watts"),
                "average_heartrate": detail.get("average_heartrate"),
                "max_heartrate": detail.get("max_heartrate"),
                "zone_times": zone_times,
                "summary": {"short_label": detail.get("name") or row.get("name") or "Workout"},
            }

        for row in recent_activities[:12]:
            detail = client.activity(str(row.get("id") or row.get("activity_id")))
            live_row = build_live_row(detail, row)
            activity_date = str(live_row.get("start_date_local") or "")[:10]
            detailed_rows.append(live_row)
            if activity_date and (latest_day is None or activity_date > latest_day):
                latest_day = activity_date
                latest_day_rows = [live_row]
            elif activity_date and activity_date == latest_day:
                latest_day_rows.append(live_row)
            seen_activity_ids.add(str(live_row.get("activity_id") or ""))

        for row in month_activities:
            detail = client.activity(str(row.get("id") or row.get("activity_id")))
            live_row = build_live_row(detail, row)
            activity_id = str(live_row.get("activity_id") or "")
            if activity_id in seen_activity_ids:
                timeline_rows.append(live_row)
            else:
                timeline_rows.append(live_row)
                seen_activity_ids.add(activity_id)
            for zone_id, seconds in (live_row.get("zone_times") or {}).items():
                month_zone_totals[zone_id] = month_zone_totals.get(zone_id, 0) + int(seconds)

        def summarize_window(rows: list[dict[str, Any]]) -> dict[str, Any]:
            included = [row for row in rows if str(row.get("type") or row.get("activity_type") or "") in {"Ride", "VirtualRide", "Run"}]
            total_distance_m = sum(float(row.get("distance") or 0) for row in included)
            total_duration_s = sum(int(row.get("moving_time") or row.get("elapsed_time") or 0) for row in included)
            total_load = round(sum(float(row.get("icu_training_load") or row.get("training_load") or 0) for row in included))
            return {
                "distance_km": round(total_distance_m / 1000, 1),
                "duration_s": total_duration_s,
                "load": total_load,
                "activity_count": len(included),
            }

        detailed_rows.sort(key=lambda row: row.get("start_date_local", ""), reverse=True)
        latest_day_rows.sort(key=lambda row: row.get("start_date_local", ""), reverse=True)
        timeline_rows.sort(key=lambda row: row.get("start_date_local", ""), reverse=True)
        wellness = wellness_series[-1] if wellness_series else {}
        return {
            "today": today.isoformat(), "today_plan": None, "tomorrow_plan": None, "goal_race_date": None,
            "athlete_id": athlete_id, "working_threshold_w": None, "season_focus": "track endurance",
            "season_phase": "build user-scoped sync foundations",
            "wellness": {"ctl": wellness.get("ctl"), "atl": wellness.get("atl")},
            "wellness_series": [{"id": str(item.get("id") or item.get("date") or index), "ctl": item.get("ctl"), "atl": item.get("atl")} for index, item in enumerate(wellness_series)],
            "recent_rows": detailed_rows, "latest_day_rows": latest_day_rows, "timeline_rows": timeline_rows, "month_zone_totals": month_zone_totals,
            "month_summary": summarize_window(month_activities), "year_summary": summarize_window(year_activities),
            "next_three": build_next_three(today), "sync_source": job_type,
        }

    def run_next_sync_job(self) -> dict[str, Any]:
        state = self.load_runtime_state()
        job = self.pick_next_sync_job(state)
        if not job:
            return {"processed": False, "reason": "no_sync_jobs"}
        connection = next((item for item in state["intervalsConnections"] if item.get("id") == job.get("connectionId")), None)
        if not connection:
            job["status"] = "failed"
            job["lastError"] = "Intervals connection not found"
            job["updatedAt"] = now_iso()
            self.persist_runtime_state(state)
            return {"processed": False, "reason": "missing_connection", "jobId": job.get("id")}
        job["status"] = "running"
        job["progressPct"] = 42
        job["statusMessage"] = "Fetching Intervals athlete data"
        job.setdefault("startedAt", now_iso())
        job["updatedAt"] = now_iso()
        self.persist_runtime_state(state)
        try:
            live_state = self.live_state_fetcher(connection, job.get("jobType", "intervals_initial_sync"))
            self.complete_sync_job(state, job, connection, live_state)
            self.persist_runtime_state(state)
            return {"processed": True, "jobId": job.get("id"), "snapshotCount": len(state["intervalsSnapshots"])}
        except Exception as exc:
            job["status"] = "failed"
            job["lastError"] = str(exc)
            job["statusMessage"] = str(exc)
            job["updatedAt"] = now_iso()
            onboarding = next((item for item in state["onboardingRuns"] if item.get("userId") == job.get("userId")), None)
            if onboarding:
                onboarding["state"] = "sync_started"
                onboarding["statusMessage"] = str(exc)
                onboarding["updatedAt"] = now_iso()
            self.persist_runtime_state(state)
            return {"processed": False, "jobId": job.get("id"), "reason": str(exc)}

    def complete_sync_job(self, state: dict[str, Any], job: dict[str, Any], connection: dict[str, Any], live_state: dict[str, Any]) -> None:
        athlete_id = live_state.get("athlete_id")
        if athlete_id and athlete_id != connection.get("externalAthleteId"):
            raise ValueError("Live state athlete does not match the connected athlete")
        captured_at = now_iso()
        snapshot = next((item for item in state["intervalsSnapshots"] if item.get("connectionId") == connection.get("id")), None)
        if not snapshot:
            snapshot = {"id": f"snapshot_{captured_at.replace(':', '').replace('-', '').replace('.', '')}", "userId": job.get("userId"), "connectionId": connection.get("id"), "sourceJobId": job.get("id"), "capturedAt": captured_at, "liveState": live_state}
            state["intervalsSnapshots"].append(snapshot)
        else:
            snapshot["sourceJobId"] = job.get("id")
            snapshot["capturedAt"] = captured_at
            snapshot["liveState"] = live_state
        connection["syncStatus"] = "ready"
        job["status"] = "completed"
        job["progressPct"] = 100
        job["statusMessage"] = "Initial sync complete" if job.get("jobType") == "intervals_initial_sync" else "Incremental sync complete"
        job["finishedAt"] = captured_at
        job["updatedAt"] = captured_at
        onboarding = next((item for item in state["onboardingRuns"] if item.get("userId") == job.get("userId")), None)
        if onboarding:
            onboarding["state"] = "ready"
            onboarding["progressPct"] = 100
            onboarding["statusMessage"] = "Dashboard ready"
            onboarding["updatedAt"] = captured_at
        state["auditEvents"].append({"id": f"audit_{captured_at.replace(':', '').replace('-', '').replace('.', '')}", "eventType": "intervals.snapshot_ready", "entityType": "intervals_snapshot", "entityId": snapshot["id"], "createdAt": captured_at})


def classify_session_type(detail: dict[str, Any]) -> str:
    weighted = float(detail.get("icu_weighted_avg_watts") or 0)
    duration = int(detail.get("moving_time") or detail.get("elapsed_time") or 0)
    load = float(detail.get("icu_training_load") or 0)
    activity_type = str(detail.get("type") or detail.get("activity_type") or "Ride").lower()
    if "race" in activity_type:
        return "race or race-like stochastic session"
    if weighted >= 360:
        return "threshold / race-support ride"
    if weighted >= 320 and load >= 90:
        return "broken VO2 / repeatability session"
    if duration >= 3 * 3600:
        return "endurance / Z2 ride"
    if duration <= 3600 and load <= 35:
        return "easy / recovery ride"
    return "endurance / Z2 ride"


def build_next_three(today: date) -> list[dict[str, Any]]:
    return [{"day": (today + timedelta(days=index)).strftime("%a"), "date": (today + timedelta(days=index)).isoformat(), "plan": "Support endurance"} for index in range(1, 4)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Decisive platform worker")
    parser.add_argument("command", nargs="?", default="run-next", choices=["run-next"])
    parser.add_argument("--store-path", default=None)
    args = parser.parse_args()
    app = WorkerApp(store_path=Path(args.store_path) if args.store_path else None)
    result = app.run_next_sync_job()
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("processed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
