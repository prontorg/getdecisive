import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import WorkerApp


class WorkerAppTest(unittest.TestCase):
    def test_run_next_sync_job_persists_user_snapshot_and_completes_job(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store_path = Path(tmpdir) / 'store.json'
            payload = {
                'invites': [],
                'users': [{'id': 'user_1', 'email': 'athlete@example.com', 'displayName': 'Athlete', 'password': 'hashed', 'workspaceId': 'ws_1'}],
                'memberships': [],
                'onboardingRuns': [{
                    'id': 'onboard_1',
                    'userId': 'user_1',
                    'state': 'sync_started',
                    'progressPct': 25,
                    'statusMessage': 'Sync job queued',
                    'syncStartedAt': '2026-04-13T00:00:00Z',
                    'updatedAt': '2026-04-13T00:00:00Z',
                }],
                'intervalsConnections': [{
                    'id': 'conn_1',
                    'userId': 'user_1',
                    'externalAthleteId': '17634020',
                    'credentialPayload': 'api_key=secret',
                    'syncStatus': 'sync_started',
                    'createdAt': '2026-04-13T00:00:00Z',
                }],
                'syncJobs': [{
                    'id': 'job_1',
                    'userId': 'user_1',
                    'connectionId': 'conn_1',
                    'jobType': 'intervals_initial_sync',
                    'status': 'queued',
                    'progressPct': 25,
                    'statusMessage': 'Sync job queued',
                    'startedAt': '2026-04-13T00:00:00Z',
                    'updatedAt': '2026-04-13T00:00:00Z',
                }],
                'intervalsSnapshots': [],
                'auditEvents': [],
            }
            store_path.write_text(json.dumps(payload))

            def fake_fetch(connection, job_type):
                self.assertEqual(connection['externalAthleteId'], '17634020')
                self.assertEqual(job_type, 'intervals_initial_sync')
                return {
                    'today': '2026-04-13',
                    'athlete_id': '17634020',
                    'today_plan': 'Support endurance',
                    'tomorrow_plan': '6x4 min @ 410-420 W',
                    'wellness': {'ctl': 107, 'atl': 128},
                    'recent_rows': [],
                    'latest_day_rows': [],
                    'month_zone_totals': {},
                    'next_three': [],
                }

            result = WorkerApp(store_path=store_path, live_state_fetcher=fake_fetch).run_next_sync_job()
            self.assertTrue(result['processed'])

            updated = json.loads(store_path.read_text())
            self.assertEqual(updated['syncJobs'][0]['status'], 'completed')
            self.assertEqual(updated['intervalsConnections'][0]['syncStatus'], 'ready')
            self.assertEqual(updated['onboardingRuns'][0]['state'], 'ready')
            self.assertEqual(updated['intervalsSnapshots'][0]['liveState']['athlete_id'], '17634020')

    def test_run_next_sync_job_ignores_non_sync_jobs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store_path = Path(tmpdir) / 'store.json'
            store_path.write_text(json.dumps({
                'invites': [],
                'users': [],
                'memberships': [],
                'onboardingRuns': [],
                'intervalsConnections': [],
                'syncJobs': [{
                    'id': 'job_1',
                    'userId': 'user_1',
                    'connectionId': 'conn_1',
                    'jobType': 'dashboard_rebuild',
                    'status': 'queued',
                    'progressPct': 10,
                    'statusMessage': 'Queued',
                    'updatedAt': '2026-04-13T00:00:00Z',
                }],
                'intervalsSnapshots': [],
                'auditEvents': [],
            }))

            result = WorkerApp(store_path=store_path, live_state_fetcher=lambda *_: {}).run_next_sync_job()
            self.assertFalse(result['processed'])


if __name__ == '__main__':
    unittest.main()
