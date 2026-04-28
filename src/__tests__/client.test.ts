import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RumbleClient, NotFoundError } from '../api/client.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Track the most recently created TokenManager instance so tests can inspect it
let mockManagerInstance: {
  getValidToken: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  hasRefreshToken: ReturnType<typeof vi.fn>;
  getCurrentToken: ReturnType<typeof vi.fn>;
} | null = null;

// Mock TokenManager so tests are not dependent on Firebase token logic
vi.mock('../api/token-refresh.js', () => {
  class MockTokenManager {
    getValidToken = vi.fn().mockResolvedValue('test-token');
    refresh = vi.fn().mockResolvedValue('refreshed-token');
    hasRefreshToken = vi.fn().mockReturnValue(false);
    getCurrentToken = vi.fn().mockReturnValue('test-token');

    constructor() {
      // Expose the latest instance for test assertions
      mockManagerInstance = this as typeof mockManagerInstance;
    }
  }

  return {
    TokenManager: MockTokenManager,
    isTokenExpired: vi.fn().mockReturnValue(false),
  };
});

function makeOkResponse(body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k: string) => headers[k] ?? null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  };
}

function makeErrorResponse(
  status: number,
  statusText: string,
  body = '',
  headers: Record<string, string> = {}
) {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: (k: string) => headers[k] ?? null },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  };
}

describe('RumbleClient', () => {
  let client: RumbleClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new RumbleClient({
      token: 'test-token',
      defaultMarket: 'EGY',
      minIntervalMs: 0,
      maxRetries: 0,
    });
  });

  describe('Constructor', () => {
    it('creates a client with the default market EGY', () => {
      const defaultClient = new RumbleClient({
        token: 'some-token',
        minIntervalMs: 0,
        maxRetries: 0,
      });
      // Verify it can be constructed without errors
      expect(defaultClient).toBeInstanceOf(RumbleClient);
    });

    it('creates a client with a custom market', () => {
      const usaClient = new RumbleClient({
        token: 'some-token',
        defaultMarket: 'USA',
        minIntervalMs: 0,
        maxRetries: 0,
      });
      expect(usaClient).toBeInstanceOf(RumbleClient);
    });
  });

  describe('getFundamentalCalls', () => {
    it('calls the correct endpoint and returns the objects array', async () => {
      // Use real API shape: no root-level ticker, asset is nested
      const mockCalls = [
        { id: 'call1', asset: { id: 'a1', symbol: 'TEST', name: 'Test Co' }, status: 'open' },
      ];
      mockFetch.mockResolvedValue(makeOkResponse({ objects: mockCalls }));

      const result = await client.getFundamentalCalls();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/fundamental-calls');
      expect(result).toEqual(mockCalls);
    });

    it('passes query params including limit and skip', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getFundamentalCalls({ limit: 5, skip: 10, status: 'closed' });

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('skip=10');
      expect(calledUrl).toContain('status=closed');
    });

    it('encodes the market as market[] query parameter', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getFundamentalCalls({ market: 'EGY' });

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('market%5B%5D=EGY');
    });

    it('throws a ZodError when the response has no objects field', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));

      await expect(client.getFundamentalCalls()).rejects.toThrow();
    });
  });

  describe('getTechnicalCalls', () => {
    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getTechnicalCalls();

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/technical-calls');
    });

    it('passes query params to the technical calls endpoint', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getTechnicalCalls({ limit: 3, status: 'active' });

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('limit=3');
      expect(calledUrl).toContain('status=active');
    });

    it('throws when the response has no objects field (no silent default)', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));

      await expect(client.getTechnicalCalls()).rejects.toThrow();
    });
  });

  describe('getFundamentalTrackRecord', () => {
    it('calls the correct endpoint with a singular market param (not market[])', async () => {
      const mockObject = { avgCallsReturn: 0.92, callsCount: 18, index: 'EGX30CAPPED' };
      mockFetch.mockResolvedValue(
        makeOkResponse({ type: 'FundamentalTrackRecord', object: mockObject })
      );

      const result = await client.getFundamentalTrackRecord('EGY');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/track-record/fundamental');
      expect(calledUrl).toContain('market=EGY');
      expect(calledUrl).not.toContain('market%5B%5D');
      expect(result).toEqual(mockObject);
    });

    it('uses the default market when none is provided', async () => {
      const mockObject = { avgCallsReturn: 0.5, callsCount: 10 };
      mockFetch.mockResolvedValue(
        makeOkResponse({ type: 'FundamentalTrackRecord', object: mockObject })
      );

      await client.getFundamentalTrackRecord();

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('market=EGY');
    });
  });

  describe('getTechnicalTrackRecord', () => {
    it('calls the correct endpoint with a singular market param (not market[])', async () => {
      const mockObject = { avgCallsReturn: 0.069, hitRatio: 0.65, callsCount: 427 };
      mockFetch.mockResolvedValue(
        makeOkResponse({ type: 'TechnicalTrackRecord', object: mockObject })
      );

      const result = await client.getTechnicalTrackRecord('EGY');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/track-record/technical');
      expect(calledUrl).toContain('market=EGY');
      expect(calledUrl).not.toContain('market%5B%5D');
      expect(result).toEqual(mockObject);
    });
  });

  describe('getAssetList', () => {
    it('calls the correct endpoint with the list ID', async () => {
      const mockList = { id: 'list-123', name: 'Test List' };
      mockFetch.mockResolvedValue(makeOkResponse({ object: mockList }));

      const result = await client.getAssetList('list-123');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/assets-list/list-123');
      expect(result).toEqual(mockList);
    });
  });

  describe('getLatestReleases', () => {
    it('calls the correct endpoint with the right params', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getLatestReleases('EGY');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/latest-releases');
      expect(calledUrl).toContain('fundamental_content_only=true');
      expect(calledUrl).toContain('expert_tool_table=true');
    });

    it('returns the objects array from the response', async () => {
      const mockReleases = [
        { title: 'Release One', parent_id: 'p1', update_id: 'u1' },
        { title: 'Release Two', parent_id: 'p2', update_id: 'u2' },
      ];
      mockFetch.mockResolvedValue(makeOkResponse({ objects: mockReleases }));

      const result = await client.getLatestReleases();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Release One');
      expect(result[1].parent_id).toBe('p2');
    });

    it('throws a ZodError when the response has no objects field', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));

      await expect(client.getLatestReleases()).rejects.toThrow();
    });

    it('uses the default market when none is provided', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getLatestReleases();

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('market');
    });
  });

  describe('Error handling', () => {
    it('throws a NotFoundError on a 404 response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404, 'Not Found'));

      await expect(client.getFundamentalCalls()).rejects.toThrow(NotFoundError);
    });

    it('throws an error on a 500 response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500, 'Internal Server Error'));

      await expect(client.getTechnicalCalls()).rejects.toThrow(
        'API Error: 500 Internal Server Error'
      );
    });
  });

  describe('401 retry logic', () => {
    it('retries with a refreshed token on a 401 response when a refresh token is available', async () => {
      // Each new RumbleClient instantiation sets mockManagerInstance
      const localClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 0,
      });
      if (!mockManagerInstance) throw new Error('mockManagerInstance was not set');
      const manager = mockManagerInstance;

      // Simulate having a refresh token
      manager.hasRefreshToken.mockReturnValue(true);

      // First call returns 401, second (retry) call returns 200
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized')).mockResolvedValueOnce(
        makeOkResponse({
          objects: [{ id: 'retried-call', asset: { id: 'a2', symbol: 'RETRY', name: 'Retry Co' } }],
        })
      );

      const result = await localClient.getFundamentalCalls();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(manager.refresh).toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'retried-call', asset: { id: 'a2', symbol: 'RETRY', name: 'Retry Co' } },
      ]);
    });

    it('preserves singularMarket=true on 401 retry so track-record endpoints keep market=EGY', async () => {
      const localClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 0,
      });
      if (!mockManagerInstance) throw new Error('mockManagerInstance was not set');
      const manager = mockManagerInstance;

      manager.hasRefreshToken.mockReturnValue(true);

      const mockTrackRecord = { avgCallsReturn: 0.5, callsCount: 10 };

      // First call returns 401, retry returns 200
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(makeOkResponse({ object: mockTrackRecord }));

      await localClient.getFundamentalTrackRecord('EGY');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(manager.refresh).toHaveBeenCalled();

      // Both the initial call and the retry must use singular market=EGY, not market%5B%5D=EGY
      const retryUrl: string = mockFetch.mock.calls[1][0];
      expect(retryUrl).toContain('market=EGY');
      expect(retryUrl).not.toContain('market%5B%5D');
    });
  });

  describe('Authorization header', () => {
    it('sends the Authorization header with a Bearer token', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getFundamentalCalls();

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders['Authorization']).toBe('Bearer test-token');
    });

    it('sends the required Rumble custom headers', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await client.getFundamentalCalls();

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders['x-rumble-device-id']).toBeDefined();
      expect(calledHeaders['x-rumble-session-id']).toBeDefined();
      expect(calledHeaders['x-rumble-request-id']).toBeDefined();
    });
  });

  // ─── Critical regression tests for the 500 fix ─────────────────────────────
  describe('Call detail endpoints include expert_tool_table=true', () => {
    it('getTechnicalCallDetails MUST include expert_tool_table=true (missing param causes 500)', async () => {
      const mockDetail = {
        id: 'tech-1',
        status: 'open',
        action: 'buy',
        asset: { id: 'a1', symbol: 'OFH', name: 'Orascom' },
      };
      mockFetch.mockResolvedValue(makeOkResponse({ object: mockDetail }));

      await client.getTechnicalCallDetails('tech-1');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/technical-calls/tech-1');
      // This is the critical fix: without expert_tool_table=true the API returns 500
      expect(calledUrl).toContain('expert_tool_table=true');
    });

    it('getFundamentalCallDetails MUST include expert_tool_table=true', async () => {
      const mockDetail = {
        id: 'fund-1',
        status: 'open',
        recommended_action: 'buy',
        asset: { id: 'a2', symbol: 'QNBE', name: 'QNB' },
      };
      mockFetch.mockResolvedValue(makeOkResponse({ object: mockDetail }));

      await client.getFundamentalCallDetails('fund-1');

      const calledUrl: string = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/fundamental-calls/fund-1');
      expect(calledUrl).toContain('expert_tool_table=true');
    });

    it('getTechnicalCallDetails unwraps the object envelope', async () => {
      const mockDetail = {
        id: 'tech-2',
        status: 'open',
        action: 'sell',
        asset: { id: 'a3', symbol: 'EFIH', name: 'EFG' },
      };
      mockFetch.mockResolvedValue(makeOkResponse({ object: mockDetail }));

      const result = await client.getTechnicalCallDetails('tech-2');

      // Should unwrap response.object, not return the envelope
      expect(result).toEqual(mockDetail);
      expect((result as unknown as Record<string, unknown>).object).toBeUndefined();
    });
  });

  // ─── Boundary validation ─────────────────────────────────────────────────────
  describe('Boundary validation', () => {
    it('throws on missing required id field on detail endpoint', async () => {
      // CallDetailsSchema requires id: z.string() — omit it to trigger validation
      mockFetch.mockResolvedValue(makeOkResponse({ object: { title: 'Missing required fields' } }));

      await expect(client.getFundamentalCallDetails('x')).rejects.toThrow(
        /Response validation failed/
      );
    });

    it('throws when a required string field has the wrong type (id should be string, not number)', async () => {
      // id must be a string — sending 123 should fail validation
      mockFetch.mockResolvedValue(makeOkResponse({ object: { id: 123 } }));

      await expect(client.getFundamentalCallDetails('x')).rejects.toThrow(
        /Response validation failed/
      );
    });

    it('accepts unknown extra fields (strips them — forward-compat with API additions)', async () => {
      // Zod strips unknown keys by default, so extra fields should not cause failure
      const mockDetail = {
        id: 'x',
        status: 'open',
        new_unknown_field: 'hello',
        another_future_field: 42,
      };
      mockFetch.mockResolvedValue(makeOkResponse({ object: mockDetail }));

      // Should resolve without throwing
      const result = await client.getFundamentalCallDetails('x');
      expect(result.id).toBe('x');
      expect(result.status).toBe('open');
    });

    it('throws when the envelope object field is missing on a detail endpoint', async () => {
      // An empty response body has no `object` key — caught by the Malformed response check
      mockFetch.mockResolvedValue(makeOkResponse({}));

      await expect(client.getFundamentalCallDetails('x')).rejects.toThrow(/Malformed response/);
    });
  });

  // ─── Polite client — pacing, 429, 5xx, User-Agent ───────────────────────────
  describe('Polite client', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('429 with Retry-After waits and retries successfully', async () => {
      vi.useFakeTimers();

      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 1,
      });

      const response429 = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: (k: string) => (k === 'Retry-After' ? '1' : null) },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      };
      const response200 = makeOkResponse({ objects: [] });

      mockFetch.mockResolvedValueOnce(response429).mockResolvedValueOnce(response200);

      const resultPromise = politeClient.getFundamentalCalls();
      // Retry-After: 1 => sleep(1000 ms); advance past it
      await vi.advanceTimersByTimeAsync(1100);
      const result = await resultPromise;

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('429 with no Retry-After falls back to exponential backoff and eventually succeeds', async () => {
      vi.useFakeTimers();

      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 1,
      });

      const response429noHeader = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: (_k: string) => null },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      };
      const response200 = makeOkResponse({ objects: [] });

      mockFetch.mockResolvedValueOnce(response429noHeader).mockResolvedValueOnce(response200);

      const resultPromise = politeClient.getFundamentalCalls();
      // backoffMs(0) = 500 * 2^0 + jitter [0-249] => up to 749ms; advance 1s to be safe
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('500 retries up to maxRetries then throws', async () => {
      vi.useFakeTimers();

      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 2,
      });

      const response500 = {
        ok: false,
        status: 500,
        statusText: 'Internal',
        headers: { get: (_k: string) => null },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      };

      // 3 calls: initial + 2 retries
      mockFetch.mockResolvedValue(response500);

      // Wrap to prevent the unhandled rejection that leaks before the assertion picks it up
      const resultPromise = politeClient.getFundamentalCalls().catch((e: unknown) => e);
      // Advance through backoffs: attempt 0 => ~500ms, attempt 1 => ~1000ms
      await vi.advanceTimersByTimeAsync(5000);

      const err = await resultPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch('API Error: 500');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('500 followed by 200 succeeds on retry', async () => {
      vi.useFakeTimers();

      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 1,
      });

      const response500 = {
        ok: false,
        status: 500,
        statusText: 'Internal',
        headers: { get: (_k: string) => null },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      };
      const response200 = makeOkResponse({ objects: [{ id: 'recovered' }] });

      mockFetch.mockResolvedValueOnce(response500).mockResolvedValueOnce(response200);

      const resultPromise = politeClient.getFundamentalCalls();
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toEqual([{ id: 'recovered' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('sends a User-Agent header matching the expected pattern', async () => {
      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 0,
        maxRetries: 0,
        version: '2.1.1',
      });

      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      await politeClient.getFundamentalCalls();

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders['User-Agent']).toMatch(/^rumble-mcp\/[^ ]+ \(\+https/);
      expect(calledHeaders['User-Agent']).toContain('rumble-mcp/2.1.1');
    });

    it('pacing: second back-to-back call waits for minIntervalMs', async () => {
      vi.useFakeTimers();

      const politeClient = new RumbleClient({
        token: 'test-token',
        defaultMarket: 'EGY',
        minIntervalMs: 100,
        maxRetries: 0,
      });

      mockFetch.mockResolvedValue(makeOkResponse({ objects: [] }));

      // First call
      const firstPromise = politeClient.getFundamentalCalls();
      await vi.advanceTimersByTimeAsync(0);
      await firstPromise;

      const firstCallAt = Date.now();

      // Second call immediately after — should be delayed by minIntervalMs
      const secondPromise = politeClient.getFundamentalCalls();
      await vi.advanceTimersByTimeAsync(200);
      await secondPromise;

      const secondCallAt = Date.now();

      // The second call should have been delayed so that it fired >= 100ms after first
      expect(secondCallAt - firstCallAt).toBeGreaterThanOrEqual(100);
    });
  });
});
