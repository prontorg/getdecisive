import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path('/root/.hermes/profiles/profdecisive/scripts/intervals_dashboard.py')
spec = importlib.util.spec_from_file_location('intervals_dashboard', MODULE_PATH)
intervals_dashboard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intervals_dashboard)


class DashboardStateResolutionTest(unittest.TestCase):
    def test_resolve_dashboard_state_merges_user_snapshot_with_shared_dashboard_fields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store_path = Path(tmpdir) / '.decisive-dev-store.json'
            store_path.write_text(
                '{"users":[{"id":"user_1"}],"intervalsSnapshots":[{"userId":"user_1","capturedAt":"2026-04-14T11:00:00Z","liveState":{"today":"2026-04-14","athlete_id":"athlete_1","goal_race_date":null,"wellness":{"ctl":50,"atl":55}}}]}'
            )
            shared_state = {
                'today': '2026-04-14',
                'athlete_id': 'shared-athlete',
                'plan_map': {'2026-04-14': 'Z2 endurance'},
                'week_rows': [],
                'latest_day_rows': [],
                'goal_race_date': '2026-05-12',
                'next_three': [],
                'timeline_rows': [],
                'month_zone_totals': {},
                'today_plan': 'Z2 endurance',
                'tomorrow_plan': 'threshold',
                'wellness': {'ctl': 100, 'atl': 105},
                'wellness_series': [],
            }

            with patch.object(intervals_dashboard, 'planner_store_path', return_value=store_path), \
                 patch.object(intervals_dashboard, 'fetch_live_state', return_value=shared_state):
                resolved = intervals_dashboard.resolve_dashboard_state('decisive_session_user=user_1')

            self.assertEqual(resolved['athlete_id'], 'athlete_1')
            self.assertEqual(resolved['wellness']['ctl'], 50)
            self.assertIn('plan_map', resolved)
            self.assertEqual(resolved['plan_map']['2026-04-14'], 'Z2 endurance')
            self.assertEqual(resolved['goal_race_date'], '2026-05-12')

    def test_resolve_dashboard_state_keeps_shared_weather_when_user_snapshot_has_plain_next_three(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store_path = Path(tmpdir) / '.decisive-dev-store.json'
            store_path.write_text(
                '{"users":[{"id":"user_1"}],"intervalsSnapshots":[{"userId":"user_1","capturedAt":"2026-04-14T11:00:00Z","liveState":{"today":"2026-04-14","next_three":[{"day":"Wed","date":"2026-04-15","plan":"Support endurance"}]}}]}'
            )
            shared_state = {
                'today': '2026-04-14',
                'athlete_id': 'shared-athlete',
                'plan_map': {},
                'week_rows': [],
                'latest_day_rows': [],
                'goal_race_date': '2026-05-12',
                'next_three': [
                    {
                        'day': 'Wed',
                        'date': '2026-04-15',
                        'plan': 'Support endurance',
                        'weather': {'label': 'Partly cloudy', 'tmax': 18},
                    }
                ],
                'timeline_rows': [],
                'month_zone_totals': {},
                'today_plan': 'Z2 endurance',
                'tomorrow_plan': 'threshold',
                'wellness': {'ctl': 100, 'atl': 105},
                'wellness_series': [],
            }

            with patch.object(intervals_dashboard, 'planner_store_path', return_value=store_path), \
                 patch.object(intervals_dashboard, 'fetch_live_state', return_value=shared_state):
                resolved = intervals_dashboard.resolve_dashboard_state('decisive_session_user=user_1')

            self.assertEqual(resolved['next_three'][0]['weather']['label'], 'Partly cloudy')
            self.assertEqual(resolved['next_three'][0]['weather']['tmax'], 18)

    def test_resolve_dashboard_state_prefers_live_recent_rows_for_this_week_table(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store_path = Path(tmpdir) / '.decisive-dev-store.json'
            store_path.write_text(
                '{"users":[{"id":"user_1"}],"intervalsSnapshots":[{"userId":"user_1","capturedAt":"2026-04-17T11:00:00Z","liveState":{"today":"2026-04-17","recent_rows":[{"activity_id":"a1","start_date_local":"2026-04-15T08:00:00","session_type":"endurance / Z2 ride","training_load":88,"summary":{"short_label":"Morning Endurance"}}]}}]}'
            )
            shared_state = {
                'today': '2026-04-17',
                'athlete_id': 'shared-athlete',
                'plan_map': {'2026-04-15': 'Z2 endurance'},
                'week_rows': [],
                'latest_day_rows': [],
                'goal_race_date': '2026-05-12',
                'next_three': [],
                'timeline_rows': [],
                'month_zone_totals': {},
                'today_plan': 'Z2 endurance',
                'tomorrow_plan': 'threshold',
                'wellness': {'ctl': 100, 'atl': 105},
                'wellness_series': [],
            }

            with patch.object(intervals_dashboard, 'planner_store_path', return_value=store_path), \
                 patch.object(intervals_dashboard, 'fetch_live_state', return_value=shared_state):
                resolved = intervals_dashboard.resolve_dashboard_state('decisive_session_user=user_1')

            self.assertEqual(len(resolved['week_rows']), 1)
            self.assertEqual(resolved['week_rows'][0]['activity_id'], 'a1')
            self.assertIn('2026-04-15', resolved['done_map'])

    def test_request_location_context_falls_back_to_zurich_when_browser_location_is_unusable(self):
        with patch.object(intervals_dashboard, 'reverse_geocode_label', return_value={'city': '', 'country': ''}):
            resolved = intervals_dashboard.request_location_context({
                'X-Device-City': 'current location',
                'X-Device-Country': '',
                'X-Device-Latitude': '',
                'X-Device-Longitude': '',
            })

        self.assertEqual(resolved['city'], 'Zurich')
        self.assertEqual(resolved['country'], 'Switzerland')
        self.assertEqual(resolved['label'], 'Zurich, Switzerland')


if __name__ == '__main__':
    unittest.main()
