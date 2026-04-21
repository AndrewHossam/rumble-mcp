import { vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { IRumbleClient } from '../api/client.js';

/**
 * Typed mock of the Rumble API client public interface.
 * Each method is a vi.fn() spy that also satisfies the typed IRumbleClient
 * interface, eliminating the need for `as any` casts in test files.
 */
export type MockRumbleClient = Mocked<IRumbleClient>;

export function createMockClient(): MockRumbleClient {
  return {
    getFundamentalCalls: vi.fn(),
    getTechnicalCalls: vi.fn(),
    getFundamentalCallDetails: vi.fn(),
    getTechnicalCallDetails: vi.fn(),
    getFundamentalTrackRecord: vi.fn(),
    getTechnicalTrackRecord: vi.fn(),
    getLatestReleases: vi.fn(),
    getAssetList: vi.fn(),
  } as MockRumbleClient;
}
