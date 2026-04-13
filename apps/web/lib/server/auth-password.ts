import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}:${salt}:${derived}`;
}

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${HASH_PREFIX}:`);
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!storedValue) return false;
  if (!isPasswordHash(storedValue)) return storedValue === password;

  const [, salt, expectedHex] = storedValue.split(':');
  if (!salt || !expectedHex) return false;

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
