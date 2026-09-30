import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'wareops_refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateOpaqueSecret(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(rawToken: string): {
  sessionId: string | null;
  tokenHash: string;
} {
  const tokenHash = hashOpaqueToken(rawToken);
  const dotIndex = rawToken.indexOf('.');

  if (dotIndex <= 0) {
    return { sessionId: null, tokenHash };
  }

  const candidateSessionId = rawToken.slice(0, dotIndex);
  const secretPart = rawToken.slice(dotIndex + 1);

  if (!UUID_PATTERN.test(candidateSessionId) || secretPart.length < 16) {
    return { sessionId: null, tokenHash };
  }

  return {
    sessionId: candidateSessionId,
    tokenHash,
  };
}

export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return amount * 1_000;
    case 'm':
      return amount * 60 * 1_000;
    case 'h':
      return amount * 60 * 60 * 1_000;
    case 'd':
      return amount * 24 * 60 * 60 * 1_000;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

export function setRefreshTokenCookie(
  response: Response,
  rawToken: string,
  options: {
    maxAgeMs: number;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  },
): void {
  response.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: options.maxAgeMs,
  });
}

export function clearRefreshTokenCookie(
  response: Response,
  options: {
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  },
): void {
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}
