import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTokenExpired, TokenManager, refreshFirebaseToken } from '../api/token-refresh.js';

// Helper to create test JWTs with a given exp timestamp (also used by Single-flight block)
function makeTokenResponse(idToken: string, newRefreshToken: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        id_token: idToken,
        refresh_token: newRefreshToken,
        expires_in: '3600',
      }),
  };
}

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

// ─── Single-flight refresh ─────────────────────────────────────────────────────

describe('Single-flight refresh', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('concurrent refresh() calls coalesce to one network request', async () => {
    mockFetch.mockResolvedValue(makeTokenResponse('new-token', 'new-refresh'));

    const manager = new TokenManager('old-token', 'refresh-token-value');
    const results = await Promise.all([manager.refresh(), manager.refresh(), manager.refresh()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['new-token', 'new-token', 'new-token']);
  });

  it('failed refresh clears the in-flight slot so the next call retries', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'fail',
        json: () => Promise.resolve({ error: { message: 'boom' } }),
      })
      .mockResolvedValueOnce(makeTokenResponse('recovered-token', 'new-refresh'));

    const manager = new TokenManager('old-token', 'refresh-token-value');

    await expect(manager.refresh()).rejects.toThrow('Token refresh failed');
    const token = await manager.refresh();

    expect(token).toBe('recovered-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('concurrent getValidToken() calls with expired JWT coalesce to one network request', async () => {
    mockFetch.mockResolvedValue(makeTokenResponse('refreshed-token', 'new-refresh'));

    const expiredExp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    const expiredJWT = createTestJWT(expiredExp);
    const manager = new TokenManager(expiredJWT, 'refresh-token-value');

    const results = await Promise.all([
      manager.getValidToken(),
      manager.getValidToken(),
      manager.getValidToken(),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['refreshed-token', 'refreshed-token', 'refreshed-token']);
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

// ─── refreshFirebaseToken ──────────────────────────────────────────────────────

describe('refreshFirebaseToken', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns new id token and refresh token on a successful 200 response', async () => {
    const responseBody = {
      id_token: 'new-id-token',
      access_token: 'new-id-token',
      refresh_token: 'new-refresh-token',
      expires_in: '3600',
      token_type: 'Bearer',
      user_id: 'user123',
      project_id: 'therumble-aec18',
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(responseBody),
    });

    const result = await refreshFirebaseToken('old-refresh-token', 'test-api-key');

    expect(result.idToken).toBe('new-id-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.expiresIn).toBe(3600);
  });

  it('throws an error with the API error message on a 400 response', async () => {
    const errorBody = {
      error: {
        code: 400,
        message: 'TOKEN_EXPIRED',
        errors: [{ message: 'TOKEN_EXPIRED', domain: 'googleapis.com', reason: 'invalid' }],
      },
    };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve(errorBody),
    });

    await expect(refreshFirebaseToken('bad-token', 'test-api-key')).rejects.toThrow(
      'Token refresh failed: TOKEN_EXPIRED'
    );
  });

  it('propagates a network error when fetch itself rejects', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    await expect(refreshFirebaseToken('any-token', 'test-api-key')).rejects.toThrow(
      'Network failure'
    );
  });

  it('posts the refresh_token in the request body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          id_token: 'tok',
          access_token: 'tok',
          refresh_token: 'r',
          expires_in: '3600',
          token_type: 'Bearer',
          user_id: 'u',
          project_id: 'p',
        }),
    });

    await refreshFirebaseToken('my-refresh', 'test-api-key');

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('securetoken.googleapis.com');
    expect(url).toContain('test-api-key');
    expect(options.method).toBe('POST');
    expect(options.body).toContain('my-refresh');
  });
});

// ─── TokenManager.refresh() and auto-refresh ──────────────────────────────────

describe('TokenManager with fetch mock', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeTokenResponse(idToken: string, refreshToken: string) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          id_token: idToken,
          access_token: idToken,
          refresh_token: refreshToken,
          expires_in: '3600',
          token_type: 'Bearer',
          user_id: 'u',
          project_id: 'p',
        }),
    };
  }

  it('refresh() updates the stored id token and refresh token', async () => {
    mockFetch.mockResolvedValue(makeTokenResponse('refreshed-id-token', 'rotated-refresh-token'));

    const manager = new TokenManager('old-id-token', 'old-refresh-token', 'test-api-key');
    const newToken = await manager.refresh();

    expect(newToken).toBe('refreshed-id-token');
    expect(manager.getCurrentToken()).toBe('refreshed-id-token');
  });

  it('refresh() calls the onTokenRefresh callback with the new token', async () => {
    mockFetch.mockResolvedValue(makeTokenResponse('callback-token', 'new-refresh'));

    const onRefresh = vi.fn();
    const manager = new TokenManager('old-token', 'refresh-tok', 'test-api-key', onRefresh);
    await manager.refresh();

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledWith('callback-token');
  });

  it('refresh() throws when no refresh token is available', async () => {
    const manager = new TokenManager('id-token');

    await expect(manager.refresh()).rejects.toThrow('No refresh token available');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('getValidToken() auto-refreshes when the token is expired', async () => {
    mockFetch.mockResolvedValue(makeTokenResponse('auto-refreshed-token', 'new-refresh'));

    const expiredToken = createTestJWT(Math.floor(Date.now() / 1000) - 3600);
    const manager = new TokenManager(expiredToken, 'refresh-token', 'test-api-key');

    const token = await manager.getValidToken();

    expect(token).toBe('auto-refreshed-token');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('getValidToken() does not refresh when the token is still valid', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validToken = createTestJWT(futureExp);
    const manager = new TokenManager(validToken, 'refresh-token', 'test-api-key');

    const token = await manager.getValidToken();

    expect(token).toBe(validToken);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
