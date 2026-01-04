import type { ListParams, FundamentalCall, TechnicalCall, TrackRecord, AssetList } from '../types/index.js';

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
    private token: string;
    private defaultMarket: string;
    private deviceId: string;
    private sessionId: string;

    constructor(token: string, defaultMarket: string = 'EGY', deviceId?: string, sessionId?: string) {
        this.token = token;
        this.defaultMarket = defaultMarket;
        // Use provided IDs or generate new ones
        this.deviceId = deviceId || process.env.RUMBLE_DEVICE_ID || generateId();
        this.sessionId = sessionId || process.env.RUMBLE_SESSION_ID || generateId();
    }

    private async fetch<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
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

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-rumble-device-id': this.deviceId,
                'x-rumble-session-id': this.sessionId,
                'x-rumble-request-id': generateId(),
            },
        });

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

        const response = await this.fetch<{ data: FundamentalCall[] }>('/fundamental-calls', queryParams);
        return response.data || [];
    }

    async getTechnicalCalls(params: ListParams = {}): Promise<TechnicalCall[]> {
        const queryParams = {
            status: params.status || 'active',
            skip: params.skip || 0,
            limit: params.limit || 10,
            market: params.market || this.defaultMarket,
            expert_tool_table: true,
        };

        const response = await this.fetch<{ data: TechnicalCall[] }>('/technical-calls', queryParams);
        return response.data || [];
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
        const response = await this.fetch<{ data: any[] }>('/latest-releases', {
            fundamental_content_only: true,
            market: market || this.defaultMarket,
            expert_tool_table: true,
        });
        return response.data || [];
    }

    async getAssetList(listId: string): Promise<AssetList> {
        // Asset lists are accessed via a different URL pattern
        const response = await fetch(`https://therumble.app/assets-lists/${listId}`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/json',
                'x-rumble-device-id': this.deviceId,
                'x-rumble-session-id': this.sessionId,
                'x-rumble-request-id': generateId(),
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<AssetList>;
    }
}
