export type LiveRow = {
  activity_id: string;
  start_date_local: string;
  name?: string;
  session_type?: string;
  training_load?: number;
  duration_s?: number;
  weighted_avg_watts?: number;
  average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  zone_times?: Record<string, number>;
  summary?: {
    short_label?: string;
  };
};

export type LiveState = {
  today: string;
  today_plan?: string;
  tomorrow_plan?: string;
  goal_race_date?: string;
  athlete_id?: string;
  working_threshold_w?: number;
  season_focus?: string;
  season_phase?: string;
  wellness?: {
    ctl?: number;
    atl?: number;
  };
  wellness_series?: Array<{ id: string; ctl?: number; atl?: number }>;
  recent_rows?: LiveRow[];
  latest_day_rows?: LiveRow[];
  month_zone_totals?: Record<string, number>;
  next_three?: Array<{ day: string; date: string; plan: string; weather?: { label?: string; tmax?: number; precip?: number } }>;
};
