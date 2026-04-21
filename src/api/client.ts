import { z } from 'zod';
import type {
  ListParams,
  FundamentalCall,
  TechnicalCall,
  TrackRecord,
  AssetList,
  CallDetails,
  LatestRelease,
} from '../types/index.js';
import { FundamentalCallSchema, TechnicalCallSchema, LatestReleaseSchema } from '../types/index.js';
import { randomBytes } from 'node:crypto';
import { TokenManager } from './token-refresh.js';

// ─── Response envelope schemas ────────────────────────────────────────────────

const FundamentalCallsEnvelopeSchema = z.object({
  objects: z.array(FundamentalCallSchema),
  pagination: z.object({ total: z.number() }).optional(),
});

const TechnicalCallsEnvelopeSchema = z.object({
  objects: z.array(TechnicalCallSchema),
  pagination: z.object({ total: z.number() }).optional(),
});

const LatestReleasesEnvelopeSchema = z.object({
  objects: z.array(LatestReleaseSchema),
});

// ─── Custom error types ────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(resource: string) {
    super(`Not found: ${resource}`);
    this.name = 'NotFoundError';
  }
}

const BASE_URL = 'https://therumble.app/api';

// Generate a secure random ID similar to what Rumble uses
function generateId(length: number = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  // Use cryptographically secure random numbers instead of Math.random()
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Public interface for the Rumble API client.
 * Tool handlers and tests should depend on this interface rather than
 * the concrete `RumbleClient` class so that mocks can satisfy the type
 * without needing to replicate private fields.
 */
export interface IRumbleClient {
  getFundamentalCalls(params?: ListParams): Promise<FundamentalCall[]>;
  getTechnicalCalls(params?: ListParams): Promise<TechnicalCall[]>;
  getFundamentalCallDetails(callId: string): Promise<CallDetails>;
  getTechnicalCallDetails(callId: string): Promise<CallDetails>;
  getFundamentalTrackRecord(market?: string): Promise<TrackRecord>;
  getTechnicalTrackRecord(market?: string): Promise<TrackRecord>;
  getLatestReleases(market?: string): Promise<LatestRelease[]>;
  getAssetList(listId: string): Promise<AssetList>;
}

export class RumbleClient implements IRumbleClient {
  private tokenManager: TokenManager;
  private defaultMarket: string;
  private deviceId: string;
  private sessionId: string;

  constructor(
    token: string,
    defaultMarket: string = 'EGY',
    deviceId?: string,
    sessionId?: string,
    refreshToken?: string
  ) {
    this.tokenManager = new TokenManager(token, refreshToken);
    this.defaultMarket = defaultMarket;
    // Use provided IDs or generate new ones
    this.deviceId = deviceId || process.env.RUMBLE_DEVICE_ID || generateId();
    this.sessionId = sessionId || process.env.RUMBLE_SESSION_ID || generateId();
  }

  private async fetch<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    retryOnAuth: boolean = true,
    singularMarket: boolean = false
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'market' && !singularMarket) {
            url.searchParams.append('market[]', String(value));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    // Get valid token (auto-refreshes if needed)
    const token = await this.tokenManager.getValidToken();

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-rumble-device-id': this.deviceId,
        'x-rumble-session-id': this.sessionId,
        'x-rumble-request-id': generateId(),
      },
    });

    // Handle 401 by trying to refresh token and retry once
    if (response.status === 401 && retryOnAuth && this.tokenManager.hasRefreshToken()) {
      try {
        await this.tokenManager.refresh();
        // Retry the request with new token (but don't retry again)
        return this.fetch<T>(endpoint, params, false, singularMarket);
      } catch (refreshError) {
        throw new Error(`API Error: 401 Unauthorized (token refresh failed: ${refreshError})`);
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(url.pathname);
      }
      // Include body in error message to help diagnose server-side failures
      let body = '';
      try {
        body = await response.text();
      } catch (bodyReadError) {
        console.warn(
          `[rumble-mcp] Failed to read error response body (status ${response.status}):`,
          bodyReadError
        );
      }
      throw new Error(
        `API Error: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch a single-object endpoint (response envelope: `{ object: T }`).
   * Throws a descriptive error when the `object` field is absent.
   *
   * Pass `singularMarket: true` for endpoints that require `market=X`
   * instead of the default array form `market[]=X`.
   */
  private async fetchSingle<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    options: { singularMarket?: boolean } = {}
  ): Promise<T> {
    const response = await this.fetch<{ object: T }>(
      endpoint,
      params,
      true,
      options.singularMarket ?? false
    );
    if (!response.object)
      throw new Error(`Malformed response from ${endpoint}: missing 'object' field`);
    return response.object;
  }

  async getFundamentalCalls(params: ListParams = {}): Promise<FundamentalCall[]> {
    const queryParams = {
      list_type: 'list-with-content',
      status: params.status || 'active',
      skip: params.skip || 0,
      limit: params.limit || 10,
      market: params.market || this.defaultMarket,
      expert_tool_table: true,
    };

    const raw = await this.fetch<unknown>('/fundamental-calls', queryParams);
    const response = FundamentalCallsEnvelopeSchema.parse(raw);
    return response.objects;
  }

  async getTechnicalCalls(params: ListParams = {}): Promise<TechnicalCall[]> {
    const queryParams = {
      status: params.status || 'active',
      skip: params.skip || 0,
      limit: params.limit || 10,
      market: params.market || this.defaultMarket,
      expert_tool_table: true,
    };

    const raw = await this.fetch<unknown>('/technical-calls', queryParams);
    const response = TechnicalCallsEnvelopeSchema.parse(raw);
    return response.objects;
  }

  async getFundamentalCallDetails(callId: string): Promise<CallDetails> {
    // expert_tool_table=true is required to get the full detail payload
    return this.fetchSingle<CallDetails>(`/fundamental-calls/${callId}`, {
      expert_tool_table: true,
    });
  }

  async getTechnicalCallDetails(callId: string): Promise<CallDetails> {
    // expert_tool_table=true is CRITICAL — without it the server returns 500
    return this.fetchSingle<CallDetails>(`/technical-calls/${callId}`, {
      expert_tool_table: true,
    });
  }

  async getFundamentalTrackRecord(market?: string): Promise<TrackRecord> {
    // singularMarket: true — this endpoint requires `market=X` not `market[]=X`
    return this.fetchSingle<TrackRecord>(
      '/track-record/fundamental',
      { market: market || this.defaultMarket },
      { singularMarket: true }
    );
  }

  async getTechnicalTrackRecord(market?: string): Promise<TrackRecord> {
    // singularMarket: true — this endpoint requires `market=X` not `market[]=X`
    return this.fetchSingle<TrackRecord>(
      '/track-record/technical',
      { market: market || this.defaultMarket },
      { singularMarket: true }
    );
  }

  async getLatestReleases(market?: string): Promise<LatestRelease[]> {
    const raw = await this.fetch<unknown>('/latest-releases', {
      fundamental_content_only: true,
      market: market || this.defaultMarket,
      expert_tool_table: true,
    });
    const response = LatestReleasesEnvelopeSchema.parse(raw);
    return response.objects;
  }

  async getAssetList(listId: string): Promise<AssetList> {
    // Asset lists use /api/assets-list/{id} endpoint (singular)
    return this.fetchSingle<AssetList>(`/assets-list/${listId}`);
  }
}
