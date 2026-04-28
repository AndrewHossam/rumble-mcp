import type { ZodType } from 'zod';
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
import {
  FundamentalCallSchema,
  TechnicalCallSchema,
  CallDetailsSchema,
  TrackRecordSchema,
  AssetListSchema,
  LatestReleaseSchema,
} from '../types/index.js';
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

// Hard cap on Retry-After to prevent malicious or buggy servers from stalling the process
const MAX_RETRY_AFTER_MS = 60_000;

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    if (delta <= 0) return 0;
    return Math.min(delta, MAX_RETRY_AFTER_MS);
  }
  return null;
}

function backoffMs(attempt: number): number {
  return 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
}

/**
 * Validates a response payload against a Zod schema with structured error logging.
 * Uses safeParse to avoid throwing ZodErrors directly — throws a human-readable Error instead.
 */
function validateResponse<T>(endpoint: string, schema: ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.error(
      '[rumble-mcp] Schema validation failed for',
      endpoint,
      'issues:',
      parsed.error.issues,
      'payload sample:',
      JSON.stringify(payload).slice(0, 200)
    );
    throw new Error(`Response validation failed for ${endpoint}: ${issues}`);
  }
  return parsed.data;
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

export interface RumbleClientOptions {
  token: string;
  refreshToken?: string;
  /** @default 'EGY' */
  defaultMarket?: string;
  deviceId?: string;
  sessionId?: string;
  /** Used in the User-Agent header. @default 'unknown' */
  version?: string;
  /** Minimum ms between requests. @default 250 (env: RUMBLE_MIN_REQUEST_INTERVAL_MS) */
  minIntervalMs?: number;
  /** Maximum number of 429/5xx retries. @default 3 (env: RUMBLE_MAX_RETRIES) */
  maxRetries?: number;
}

export class RumbleClient implements IRumbleClient {
  private tokenManager: TokenManager;
  private defaultMarket: string;
  private deviceId: string;
  private sessionId: string;
  private version: string;
  private minIntervalMs: number;
  private maxRetries: number;
  private lastRequestAt: number = 0;

  constructor(options: RumbleClientOptions) {
    const {
      token,
      refreshToken,
      defaultMarket = 'EGY',
      deviceId,
      sessionId,
      version = 'unknown',
    } = options;

    const envMinInterval = Number(process.env.RUMBLE_MIN_REQUEST_INTERVAL_MS);
    const envMaxRetries = Number(process.env.RUMBLE_MAX_RETRIES);

    this.tokenManager = new TokenManager(token, refreshToken);
    this.defaultMarket = defaultMarket;
    this.deviceId = deviceId ?? process.env.RUMBLE_DEVICE_ID ?? generateId();
    this.sessionId = sessionId ?? process.env.RUMBLE_SESSION_ID ?? generateId();
    this.version = version;
    this.minIntervalMs =
      options.minIntervalMs !== undefined
        ? options.minIntervalMs
        : Number.isFinite(envMinInterval)
          ? envMinInterval
          : 250;
    this.maxRetries =
      options.maxRetries !== undefined
        ? options.maxRetries
        : Number.isFinite(envMaxRetries)
          ? envMaxRetries
          : 3;
  }

  private async fetch<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
    retryOnAuth: boolean = true,
    singularMarket: boolean = false,
    attempt: number = 0
  ): Promise<T> {
    // Pacing: enforce minimum interval between requests (skip on very first call)
    if (this.lastRequestAt !== 0) {
      const elapsed = Date.now() - this.lastRequestAt;
      if (elapsed < this.minIntervalMs) {
        await sleep(this.minIntervalMs - elapsed + Math.floor(Math.random() * 100));
      }
    }
    this.lastRequestAt = Date.now();

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
        'User-Agent': `rumble-mcp/${this.version} (+https://github.com/AndrewHossam/rumble-mcp)`,
        'x-rumble-device-id': this.deviceId,
        'x-rumble-session-id': this.sessionId,
        'x-rumble-request-id': generateId(),
      },
    });

    // Handle 401 by trying to refresh token and retry once
    // 401 retry is independent of the attempt/maxRetries budget — it's auth-specific
    if (response.status === 401 && retryOnAuth && this.tokenManager.hasRefreshToken()) {
      try {
        await this.tokenManager.refresh();
        // Retry the request with new token (but don't retry again); pass attempt unchanged
        return this.fetch<T>(endpoint, params, false, singularMarket, attempt);
      } catch (refreshError) {
        throw new Error(`API Error: 401 Unauthorized (token refresh failed: ${refreshError})`);
      }
    }

    // Handle 429 Too Many Requests with Retry-After support
    if (response.status === 429) {
      if (attempt >= this.maxRetries) {
        throw new Error(`API Error: 429 Too Many Requests after ${attempt} retries`);
      }
      const retryAfterHeader = response.headers.get('Retry-After');
      const waitMs = parseRetryAfter(retryAfterHeader) ?? backoffMs(attempt);
      await sleep(waitMs);
      return this.fetch<T>(endpoint, params, retryOnAuth, singularMarket, attempt + 1);
    }

    // Handle transient 5xx errors with exponential backoff
    if (response.status >= 500 && response.status < 600 && attempt < this.maxRetries) {
      await sleep(backoffMs(attempt));
      return this.fetch<T>(endpoint, params, retryOnAuth, singularMarket, attempt + 1);
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
   * Validates the unwrapped object against the provided Zod schema.
   * Throws a descriptive error when the `object` field is absent.
   *
   * Pass `singularMarket: true` for endpoints that require `market=X`
   * instead of the default array form `market[]=X`.
   */
  private async fetchSingle<T>(
    endpoint: string,
    schema: ZodType<T>,
    params?: Record<string, string | number | boolean>,
    options: { singularMarket?: boolean } = {}
  ): Promise<T> {
    const response = await this.fetch<{ object: unknown }>(
      endpoint,
      params,
      true,
      options.singularMarket ?? false
    );
    if (!response.object)
      throw new Error(`Malformed response from ${endpoint}: missing 'object' field`);
    return validateResponse(endpoint, schema, response.object);
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
    const response = validateResponse('/fundamental-calls', FundamentalCallsEnvelopeSchema, raw);
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
    const response = validateResponse('/technical-calls', TechnicalCallsEnvelopeSchema, raw);
    return response.objects;
  }

  async getFundamentalCallDetails(callId: string): Promise<CallDetails> {
    // expert_tool_table=true is required to get the full detail payload
    // Cast required: Zod uses z.unknown() for recursive rich-text fields (the_story, content).
    // The TS intersection type narrows them; runtime extractors in tools/call-details.ts
    // already do defensive narrowing.
    return this.fetchSingle<CallDetails>(
      `/fundamental-calls/${callId}`,
      CallDetailsSchema as ZodType<CallDetails>,
      { expert_tool_table: true }
    );
  }

  async getTechnicalCallDetails(callId: string): Promise<CallDetails> {
    // expert_tool_table=true is CRITICAL — without it the server returns 500
    return this.fetchSingle<CallDetails>(
      `/technical-calls/${callId}`,
      CallDetailsSchema as ZodType<CallDetails>,
      { expert_tool_table: true }
    );
  }

  async getFundamentalTrackRecord(market?: string): Promise<TrackRecord> {
    // singularMarket: true — this endpoint requires `market=X` not `market[]=X`
    return this.fetchSingle<TrackRecord>(
      '/track-record/fundamental',
      TrackRecordSchema,
      { market: market || this.defaultMarket },
      { singularMarket: true }
    );
  }

  async getTechnicalTrackRecord(market?: string): Promise<TrackRecord> {
    // singularMarket: true — this endpoint requires `market=X` not `market[]=X`
    return this.fetchSingle<TrackRecord>(
      '/track-record/technical',
      TrackRecordSchema,
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
    const response = validateResponse('/latest-releases', LatestReleasesEnvelopeSchema, raw);
    return response.objects;
  }

  async getAssetList(listId: string): Promise<AssetList> {
    // Asset lists use /api/assets-list/{id} endpoint (singular)
    return this.fetchSingle<AssetList>(`/assets-list/${listId}`, AssetListSchema);
  }
}
