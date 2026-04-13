type CoachSummary = {
  session_type?: string;
  what_it_was?: string;
  interval_structure?: string;
  coaching_take?: string;
  value_rating?: string;
  fitness_lines?: string[];
  next_three_days?: string[];
  week_context?: {
    activities?: number;
    hard_days?: number;
    total_load?: number;
    days?: Record<string, string[]>;
  };
};

export type CoachActivity = {
  activity_id?: string;
  start_date_local?: string;
  name?: string;
  session_type?: string;
  training_load?: number;
  duration_s?: number;
  feedback_text?: string;
  summary?: CoachSummary;
};

export type CoachDashboardState = {
  today?: string;
  today_label?: string;
  tomorrow?: string;
  tomorrow_label?: string;
  today_plan?: string;
  tomorrow_plan?: string;
  plan_map?: Record<string, string>;
  week_rows?: Array<Record<string, unknown>>;
  next_three?: Array<{
    day?: string;
    date?: string;
    plan?: string;
    weather?: {
      icon?: string;
      label?: string;
      tmax?: number | string;
      tmin?: number | string;
      precip?: number | string;
    };
  }>;
  recent_rows?: CoachActivity[];
  latest_day_rows?: CoachActivity[];
  month_zone_totals?: Record<string, number>;
  wellness?: {
    ctl?: number;
    atl?: number;
    form?: number;
  };
};

export async function fetchCoachDashboardState(): Promise<CoachDashboardState | null> {
  try {
    const response = await fetch('http://127.0.0.1:8765/api/state', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;
    return (await response.json()) as CoachDashboardState;
  } catch {
    return null;
  }
}

export function formatDuration(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes.toString().padStart(2, '0')}m` : `${minutes} min`;
}

export function flattenLatestFitnessLines(activity?: CoachActivity | null): string[] {
  return (activity?.summary?.fitness_lines || []).map((line) => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

export function latestCoachingTake(activity?: CoachActivity | null): string | null {
  return activity?.summary?.coaching_take || null;
}

export function latestWorkoutHeadline(activity?: CoachActivity | null): string {
  if (!activity) return 'No recent workout loaded';
  const parts = [activity.summary?.what_it_was || activity.session_type || activity.name || 'Workout'];
  if (activity.summary?.interval_structure) parts.push(activity.summary.interval_structure);
  return parts.filter(Boolean).join(' • ');
}
