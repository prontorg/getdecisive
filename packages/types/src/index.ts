export type PlatformRole = 'athlete' | 'coach' | 'admin';

export type OnboardingState =
  | 'invite_pending'
  | 'account_created'
  | 'intervals_credentials_submitted'
  | 'sync_started'
  | 'sync_importing_history'
  | 'sync_processing_activities'
  | 'sync_building_dashboard'
  | 'profile_setup'
  | 'ready'
  | 'failed';

export type SessionStatus = 'planned' | 'completed' | 'skipped' | 'moved' | 'archived';
