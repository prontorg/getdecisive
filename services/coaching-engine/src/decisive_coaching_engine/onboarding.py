from enum import StrEnum


class OnboardingState(StrEnum):
    INVITE_PENDING = "invite_pending"
    ACCOUNT_CREATED = "account_created"
    INTERVALS_CREDENTIALS_SUBMITTED = "intervals_credentials_submitted"
    SYNC_STARTED = "sync_started"
    SYNC_IMPORTING_HISTORY = "sync_importing_history"
    SYNC_PROCESSING_ACTIVITIES = "sync_processing_activities"
    SYNC_BUILDING_DASHBOARD = "sync_building_dashboard"
    PROFILE_SETUP = "profile_setup"
    READY = "ready"
    FAILED = "failed"
