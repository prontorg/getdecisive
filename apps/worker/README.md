# Worker

Background job runner for decisive.coach.

Current responsibilities:
- initial Intervals sync
- incremental sync
- persist user-scoped Intervals snapshots into the shared platform store
- move onboarding from queued sync to ready once the snapshot exists

Run manually:
- python3 apps/worker/main.py run-next
- optionally set DECISIVE_PLATFORM_STORE_PATH=/path/to/store.json

The web app now triggers this worker after Intervals connection submission.
