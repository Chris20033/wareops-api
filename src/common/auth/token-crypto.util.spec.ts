import {
  formatRefreshToken,
  generateOpaqueSecret,
  hashOpaqueToken,
  parseCookieHeader,
  parseDurationToMs,
  parseRefreshToken,
} from './token-crypto.util.js';

describe('token-crypto.util', () => {
  it('generates 256-bit opaque secrets and deterministic SHA-256 hashes', () => {
    const secretA = generateOpaqueSecret();
    const secretB = generateOpaqueSecret();

    expect(secretA).not.toBe(secretB);
    expect(secretA.length).toBeGreaterThanOrEqual(43);

    const hashA1 = hashOpaqueToken(secretA);
    const hashA2 = hashOpaqueToken(secretA);

    expect(hashA1).toBe(hashA2);
    expect(hashA1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashA1).not.toBe(secretA);
  });

  it('formats and parses session-bound refresh tokens', () => {
    const sessionId = '1a54e8aa-9d0f-4f29-8b85-8293496f2536';
    const secret = generateOpaqueSecret();
    const raw = formatRefreshToken(sessionId, secret);
    const parsed = parseRefreshToken(raw);

    expect(parsed.sessionId).toBe(sessionId);
    expect(parsed.tokenHash).toBe(hashOpaqueToken(raw));
  });

  it('handles malformed refresh tokens without throwing', () => {
    expect(parseRefreshToken('plain-token-without-dot').sessionId).toBeNull();
    expect(
      parseRefreshToken('not-a-uuid.some-secret-value-here').sessionId,
    ).toBeNull();
  });

  it('parses durations into milliseconds', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('7d')).toBe(604_800_000);
    expect(() => parseDurationToMs('invalid')).toThrow();
  });

  it('parses cookie headers safely', () => {
    const parsed = parseCookieHeader(
      'foo=bar; wareops_refresh_token=abc.def%20ghi; malformed',
    );

    expect(parsed).toEqual({
      foo: 'bar',
      wareops_refresh_token: 'abc.def ghi',
    });
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
