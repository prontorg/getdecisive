# Worker

Background job runner for decisive.coach.

Current responsibilities:
- initial Intervals sync
- incremental sync
- persist user-scoped Intervals snapshots into the shared platform store
- move onboarding from queued sync to ready once the snapshot exists
- use Postgres runtime tables for sync jobs/snapshots when DATABASE_URL is configured

Run manually:
- python3 apps/worker/main.py run-next
- optionally set DECISIVE_PLATFORM_STORE_PATH=/path/to/store.json
- optionally set DATABASE_URL=postgres://... to use Postgres-backed sync job/snapshot storage

The web app now triggers this worker after Intervals connection submission.
