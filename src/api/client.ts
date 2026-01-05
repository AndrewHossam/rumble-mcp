import type { ListParams, FundamentalCall, TechnicalCall, TrackRecord, AssetList } from '../types/index.js';
import { TokenManager } from './token-refresh.js';

const BASE_URL = 'https://therumble.app/api';

// Generate a random ID similar to what Rumble uses
function generateId(length: number = 21): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export class RumbleClient {
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

    private async fetch<T>(endpoint: string, params?: Record<string, string | number | boolean>, retryOnAuth: boolean = true): Promise<T> {
        const url = new URL(`${BASE_URL}${endpoint}`);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (key === 'market') {
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
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
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
                return this.fetch<T>(endpoint, params, false);
            } catch (refreshError) {
                throw new Error(`API Error: 401 Unauthorized (token refresh failed: ${refreshError})`);
            }
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
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

        const response = await this.fetch<{ objects: FundamentalCall[], pagination?: { total: number } }>('/fundamental-calls', queryParams);
        return response.objects || [];
    }

    async getTechnicalCalls(params: ListParams = {}): Promise<TechnicalCall[]> {
        const queryParams = {
            status: params.status || 'active',
            skip: params.skip || 0,
            limit: params.limit || 10,
            market: params.market || this.defaultMarket,
            expert_tool_table: true,
        };

        const response = await this.fetch<{ objects: TechnicalCall[], pagination?: { total: number } }>('/technical-calls', queryParams);
        return response.objects || [];
    }

    async getFundamentalCallDetails(callId: string): Promise<any> {
        const response = await this.fetch<{ object: any }>(`/fundamental-calls/${callId}`);
        return response.object || response;
    }

    async getTechnicalCallDetails(callId: string): Promise<any> {
        const response = await this.fetch<{ object: any }>(`/technical-calls/${callId}`);
        return response.object || response;
    }

    async getFundamentalTrackRecord(market?: string): Promise<TrackRecord> {
        return this.fetch<TrackRecord>('/track-record/fundamental', {
            market: market || this.defaultMarket,
        });
    }

    async getTechnicalTrackRecord(market?: string): Promise<TrackRecord> {
        return this.fetch<TrackRecord>('/track-record/technical', {
            market: market || this.defaultMarket,
            expert_tool_table: true,
        });
    }

    async getLatestReleases(market?: string): Promise<any[]> {
        const response = await this.fetch<{ objects: any[] }>('/latest-releases', {
            fundamental_content_only: true,
            market: market || this.defaultMarket,
            expert_tool_table: true,
        });
        return response.objects || [];
    }

    async getAssetList(listId: string): Promise<AssetList> {
        // Asset lists use /api/assets-list/{id} endpoint (singular)
        const response = await this.fetch<{ object: AssetList }>(`/assets-list/${listId}`);
        return response.object || response as unknown as AssetList;
    }
}
