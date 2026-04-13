export type LaunchAuthMode = 'password' | 'magic_link';

export type InviteValidationResult = {
  valid: boolean;
  reason?: string;
};

export type PendingRegistration = {
  inviteCode: string;
  email: string;
  displayName: string;
};
