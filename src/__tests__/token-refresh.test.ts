import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTokenExpired, TokenManager } from '../api/token-refresh.js';

// Helper to create test JWTs with a given exp timestamp
function createTestJWT(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.signature`;
}

describe('isTokenExpired', () => {
  it('returns true for an expired JWT', () => {
    // exp in the past
    const pastExp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    const token = createTestJWT(pastExp);
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false for a valid JWT with future expiry', () => {
    // exp well in the future, beyond the default 60s buffer
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = createTestJWT(futureExp);
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for a JWT about to expire within the buffer window', () => {
    // exp 30 seconds from now — within the default 60s buffer
    const soonExp = Math.floor(Date.now() / 1000) + 30;
    const token = createTestJWT(soonExp);
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns true for a malformed token that does not have 3 parts', () => {
    expect(isTokenExpired('not.a.valid.jwt.token')).toBe(true);
    expect(isTokenExpired('onlyone')).toBe(true);
    expect(isTokenExpired('only.two')).toBe(true);
  });

  it('returns true for a token with invalid base64 payload', () => {
    // Construct a token whose payload cannot be decoded as JSON
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const badPayload = '!!!not-valid-base64!!!';
    const token = `${header}.${badPayload}.signature`;
    expect(isTokenExpired(token)).toBe(true);
  });
});

describe('TokenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getValidToken() returns the current token when no refresh token is set', async () => {
    const manager = new TokenManager('my-id-token');
    const token = await manager.getValidToken();
    expect(token).toBe('my-id-token');
  });

  it('getValidToken() returns the current token when token is still valid', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validToken = createTestJWT(futureExp);
    // Provide a refresh token so the expiry check runs, but the token should not be refreshed
    const manager = new TokenManager(validToken, 'refresh-token-value');
    const token = await manager.getValidToken();
    expect(token).toBe(validToken);
  });

  it('hasRefreshToken() returns true when a refresh token is provided', () => {
    const manager = new TokenManager('id-token', 'my-refresh-token');
    expect(manager.hasRefreshToken()).toBe(true);
  });

  it('hasRefreshToken() returns false when no refresh token is provided', () => {
    const manager = new TokenManager('id-token');
    expect(manager.hasRefreshToken()).toBe(false);
  });

  it('getCurrentToken() returns the token without performing a refresh check', () => {
    const manager = new TokenManager('current-token', 'refresh-token');
    expect(manager.getCurrentToken()).toBe('current-token');
  });
});
