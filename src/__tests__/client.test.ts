import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RumbleClient } from '../api/client.js';

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
      mockManagerInstance = this as any;
    }
  }

  return {
    TokenManager: MockTokenManager,
    isTokenExpired: vi.fn().mockReturnValue(false),
  };
});

function makeOkResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  };
}

function makeErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
  };
}

describe('RumbleClient', () => {
  let client: RumbleClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new RumbleClient('test-token', 'EGY');
  });

  describe('Constructor', () => {
    it('creates a client with the default market EGY', () => {
      const defaultClient = new RumbleClient('some-token');
      // Verify it can be constructed without errors
      expect(defaultClient).toBeInstanceOf(RumbleClient);
    });

    it('creates a client with a custom market', () => {
      const usaClient = new RumbleClient('some-token', 'USA');
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

    it('returns an empty array when the response has no objects field', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));

      const result = await client.getFundamentalCalls();
      expect(result).toEqual([]);
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

  describe('Error handling', () => {
    it('throws an error on a non-200 response', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(404, 'Not Found'));

      await expect(client.getFundamentalCalls()).rejects.toThrow('API Error: 404 Not Found');
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
      const localClient = new RumbleClient('test-token', 'EGY');
      const manager = mockManagerInstance!;

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
      expect((result as any).object).toBeUndefined();
    });
  });
});
