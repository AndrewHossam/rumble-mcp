import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import tool schemas and handlers
import { fundamentalToolSchemas, handleFundamentalTool } from '../tools/fundamental.js';
import { technicalToolSchemas, handleTechnicalTool } from '../tools/technical.js';
import { assetToolSchemas, handleAssetTool, KNOWN_LISTS } from '../tools/assets.js';
import { callDetailsToolSchemas } from '../tools/call-details.js';
import { TrackRecordSchema } from '../types/index.js';

// Mock RumbleClient
const createMockClient = () => ({
  getFundamentalCalls: vi.fn(),
  getTechnicalCalls: vi.fn(),
  getFundamentalCallDetails: vi.fn(),
  getTechnicalCallDetails: vi.fn(),
  getFundamentalTrackRecord: vi.fn(),
  getTechnicalTrackRecord: vi.fn(),
  getLatestReleases: vi.fn(),
  getAssetList: vi.fn(),
});

describe('Tool Schema Validation', () => {
  describe('Fundamental Tool Schemas', () => {
    it('should validate get_fundamental_calls with defaults', () => {
      const result = fundamentalToolSchemas.get_fundamental_calls.inputSchema.parse({});
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
      expect(result.market).toBe('EGY');
      expect(result.status).toBe('active');
    });

    it('should validate get_fundamental_calls with custom values', () => {
      const result = fundamentalToolSchemas.get_fundamental_calls.inputSchema.parse({
        limit: 25,
        skip: 10,
        market: 'USA',
        status: 'closed',
      });
      expect(result.limit).toBe(25);
      expect(result.status).toBe('closed');
    });

    it('should reject invalid limit values', () => {
      expect(() =>
        fundamentalToolSchemas.get_fundamental_calls.inputSchema.parse({ limit: 100 })
      ).toThrow();
      expect(() =>
        fundamentalToolSchemas.get_fundamental_calls.inputSchema.parse({ limit: 0 })
      ).toThrow();
    });

    it('should validate get_fundamental_track_record', () => {
      const result = fundamentalToolSchemas.get_fundamental_track_record.inputSchema.parse({});
      expect(result.market).toBe('EGY');
    });
  });

  describe('Technical Tool Schemas', () => {
    it('should validate get_technical_calls with defaults', () => {
      const result = technicalToolSchemas.get_technical_calls.inputSchema.parse({});
      expect(result.limit).toBe(10);
      expect(result.status).toBe('active');
    });

    it('should validate status enum values', () => {
      expect(() =>
        technicalToolSchemas.get_technical_calls.inputSchema.parse({ status: 'invalid' })
      ).toThrow();
    });
  });

  describe('Asset Tool Schemas', () => {
    it('should validate get_asset_list with required listId', () => {
      const result = assetToolSchemas.get_asset_list.inputSchema.parse({ listId: 'rfp-egx' });
      expect(result.listId).toBe('rfp-egx');
    });

    it('should reject get_asset_list without listId', () => {
      expect(() => assetToolSchemas.get_asset_list.inputSchema.parse({})).toThrow();
    });

    it('should validate empty object for portfolio tools', () => {
      expect(() => assetToolSchemas.get_rfp_portfolio.inputSchema.parse({})).not.toThrow();
      expect(() =>
        assetToolSchemas.get_bottom_fisher_portfolio.inputSchema.parse({})
      ).not.toThrow();
      expect(() => assetToolSchemas.list_known_portfolios.inputSchema.parse({})).not.toThrow();
    });
  });

  describe('Call Details Schema', () => {
    it('should validate with only callId', () => {
      const result = callDetailsToolSchemas.get_call_details.inputSchema.parse({
        callId: 'test123',
      });
      expect(result.callId).toBe('test123');
      expect(result.type).toBeUndefined();
    });

    it('should validate with type and sections', () => {
      const result = callDetailsToolSchemas.get_call_details.inputSchema.parse({
        callId: 'test123',
        type: 'fundamental',
        sections: ['story', 'performance'],
      });
      expect(result.type).toBe('fundamental');
      expect(result.sections).toEqual(['story', 'performance']);
    });

    it('should reject invalid type', () => {
      expect(() =>
        callDetailsToolSchemas.get_call_details.inputSchema.parse({
          callId: 'test123',
          type: 'invalid',
        })
      ).toThrow();
    });
  });
});

describe('Tool Handlers', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  describe('handleFundamentalTool', () => {
    it('should handle get_fundamental_calls', async () => {
      const mockCalls = [
        {
          id: 'call1',
          ticker: 'TEST',
          company_name: 'Test Company',
          rating: 'buy',
          target_price: 100,
          current_price: 80,
          remaining_return: 0.25,
          performance: 0.1,
          analysts: ['Analyst 1'],
          updated_at: '2024-01-01',
        },
      ];
      mockClient.getFundamentalCalls.mockResolvedValue(mockCalls);

      const result = await handleFundamentalTool(mockClient as any, 'get_fundamental_calls', {
        limit: 5,
      });

      expect(mockClient.getFundamentalCalls).toHaveBeenCalledWith({
        limit: 5,
        skip: 0,
        market: 'EGY',
        status: 'active',
      });
      expect(result).toEqual({
        count: 1,
        calls: [
          {
            id: 'call1',
            ticker: 'TEST',
            company: 'Test Company',
            rating: 'buy',
            target_price: 100,
            current_price: 80,
            remaining_return: 0.25,
            performance: 0.1,
            analysts: ['Analyst 1'],
            updated_at: '2024-01-01',
          },
        ],
      });
    });

    it('should handle get_fundamental_track_record with real field names', async () => {
      const mockTrackRecord = {
        avgCallsAlpha: 0.548,
        avgCallsReturn: 0.92,
        avgIndexReturn: 0.372,
        avgHoldingPeriod: 388,
        callsCount: 18,
        index: 'EGX30CAPPED',
      };
      mockClient.getFundamentalTrackRecord.mockResolvedValue(mockTrackRecord);

      const result = await handleFundamentalTool(
        mockClient as any,
        'get_fundamental_track_record',
        {}
      );

      expect(mockClient.getFundamentalTrackRecord).toHaveBeenCalledWith('EGY');
      expect(result).toEqual(mockTrackRecord);
      // Verify new field names are present in the result
      expect((result as typeof mockTrackRecord).avgCallsReturn).toBe(0.92);
      expect((result as typeof mockTrackRecord).callsCount).toBe(18);
      expect((result as typeof mockTrackRecord).index).toBe('EGX30CAPPED');
    });

    it('should handle get_fundamental_track_record with a custom market', async () => {
      const mockTrackRecord = {
        avgCallsReturn: 0.5,
        callsCount: 10,
        avgHoldingPeriod: 200,
      };
      mockClient.getFundamentalTrackRecord.mockResolvedValue(mockTrackRecord);

      await handleFundamentalTool(mockClient as any, 'get_fundamental_track_record', {
        market: 'USA',
      });

      expect(mockClient.getFundamentalTrackRecord).toHaveBeenCalledWith('USA');
    });

    it('should throw for unknown tool', async () => {
      await expect(handleFundamentalTool(mockClient as any, 'unknown_tool', {})).rejects.toThrow(
        'Unknown fundamental tool: unknown_tool'
      );
    });
  });

  describe('handleTechnicalTool', () => {
    it('should handle get_technical_calls', async () => {
      const mockCalls = [
        {
          id: 'tech1',
          ticker: 'TECH',
          company_name: 'Tech Company',
          entry_price: 50,
          target_price: 60,
          stop_loss: 45,
          current_price: 52,
          performance: 0.04,
          risk_reward: 2.0,
          updated_at: '2024-01-01',
        },
      ];
      mockClient.getTechnicalCalls.mockResolvedValue(mockCalls);

      const result = await handleTechnicalTool(mockClient as any, 'get_technical_calls', {});

      expect(result).toHaveProperty('count', 1);
      expect(result).toHaveProperty('calls');
    });

    it('should handle get_technical_track_record with real field names', async () => {
      const mockTrackRecord = {
        avgCallsReturn: 0.069,
        avgHoldingPeriod: 50,
        avgWin: 0.152,
        avgLoss: -0.084,
        hitRatio: 0.649,
        callsCount: 427,
      };
      mockClient.getTechnicalTrackRecord.mockResolvedValue(mockTrackRecord);

      const result = await handleTechnicalTool(mockClient as any, 'get_technical_track_record', {});

      expect(mockClient.getTechnicalTrackRecord).toHaveBeenCalledWith('EGY');
      expect(result).toEqual(mockTrackRecord);
      // Verify technical-specific field names are present
      expect((result as typeof mockTrackRecord).hitRatio).toBe(0.649);
      expect((result as typeof mockTrackRecord).avgWin).toBe(0.152);
      expect((result as typeof mockTrackRecord).avgLoss).toBe(-0.084);
    });

    it('should handle get_technical_track_record with a custom market', async () => {
      mockClient.getTechnicalTrackRecord.mockResolvedValue({ callsCount: 5 });

      await handleTechnicalTool(mockClient as any, 'get_technical_track_record', {
        market: 'USA',
      });

      expect(mockClient.getTechnicalTrackRecord).toHaveBeenCalledWith('USA');
    });

    it('should throw for unknown tool', async () => {
      await expect(handleTechnicalTool(mockClient as any, 'unknown_tool', {})).rejects.toThrow(
        'Unknown technical tool: unknown_tool'
      );
    });
  });

  describe('handleAssetTool', () => {
    it('should resolve alias to list ID', async () => {
      const mockAssetList = { id: KNOWN_LISTS['rfp-egx'], name: 'RFP' };
      mockClient.getAssetList.mockResolvedValue(mockAssetList);

      await handleAssetTool(mockClient as any, 'get_asset_list', { listId: 'rfp-egx' });

      expect(mockClient.getAssetList).toHaveBeenCalledWith(KNOWN_LISTS['rfp-egx']);
    });

    it('should use raw ID if not an alias', async () => {
      const rawId = 'customListId123';
      mockClient.getAssetList.mockResolvedValue({ id: rawId });

      await handleAssetTool(mockClient as any, 'get_asset_list', { listId: rawId });

      expect(mockClient.getAssetList).toHaveBeenCalledWith(rawId);
    });

    it('should handle list_known_portfolios', async () => {
      const result = await handleAssetTool(mockClient as any, 'list_known_portfolios', {});

      expect(result).toHaveProperty('portfolios');
      expect((result as any).portfolios).toHaveLength(3);
    });

    it('should handle get_rfp_portfolio', async () => {
      mockClient.getAssetList.mockResolvedValue({ id: KNOWN_LISTS['rfp-egx'] });

      await handleAssetTool(mockClient as any, 'get_rfp_portfolio', {});

      expect(mockClient.getAssetList).toHaveBeenCalledWith(KNOWN_LISTS['rfp-egx']);
    });

    it('should throw for unknown tool', async () => {
      await expect(handleAssetTool(mockClient as any, 'unknown_tool', {})).rejects.toThrow(
        'Unknown asset tool: unknown_tool'
      );
    });
  });
});

describe('KNOWN_LISTS Constants', () => {
  it('should have valid list IDs', () => {
    expect(KNOWN_LISTS['rfp-egx']).toBeDefined();
    expect(KNOWN_LISTS['bottom-fisher']).toBeDefined();
    expect(KNOWN_LISTS['rsp-egx']).toBeDefined();
  });

  it('should have string values', () => {
    Object.values(KNOWN_LISTS).forEach(id => {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });
});

describe('TrackRecordSchema', () => {
  describe('fundamental track record shape', () => {
    it('accepts a valid fundamental response with all fields', () => {
      const input = {
        avgCallsAlpha: 0.548,
        avgCallsReturn: 0.92,
        avgIndexReturn: 0.372,
        avgHoldingPeriod: 388,
        callsCount: 18,
        index: 'EGX30CAPPED',
      };
      const result = TrackRecordSchema.parse(input);
      expect(result.avgCallsAlpha).toBe(0.548);
      expect(result.avgCallsReturn).toBe(0.92);
      expect(result.avgIndexReturn).toBe(0.372);
      expect(result.avgHoldingPeriod).toBe(388);
      expect(result.callsCount).toBe(18);
      expect(result.index).toBe('EGX30CAPPED');
    });

    it('accepts a fundamental response with only some fields (all are optional)', () => {
      // All TrackRecordSchema fields are optional — the schema must not reject partial data
      const result = TrackRecordSchema.parse({ avgCallsReturn: 0.5, callsCount: 10 });
      expect(result.avgCallsReturn).toBe(0.5);
      expect(result.callsCount).toBe(10);
      expect(result.hitRatio).toBeUndefined();
    });

    it('rejects a fundamental response where a numeric field is a string', () => {
      expect(() =>
        TrackRecordSchema.parse({ avgCallsReturn: 'not-a-number', callsCount: 18 })
      ).toThrow();
    });
  });

  describe('technical track record shape', () => {
    it('accepts a valid technical response with all fields', () => {
      const input = {
        avgCallsReturn: 0.069,
        avgHoldingPeriod: 50,
        avgWin: 0.152,
        avgLoss: -0.084,
        hitRatio: 0.649,
        callsCount: 427,
      };
      const result = TrackRecordSchema.parse(input);
      expect(result.avgCallsReturn).toBe(0.069);
      expect(result.avgHoldingPeriod).toBe(50);
      expect(result.avgWin).toBe(0.152);
      expect(result.avgLoss).toBe(-0.084);
      expect(result.hitRatio).toBe(0.649);
      expect(result.callsCount).toBe(427);
    });

    it('accepts a technical response without fundamental-only fields', () => {
      // avgCallsAlpha and avgIndexReturn are fundamental-only — their absence is valid
      const result = TrackRecordSchema.parse({ hitRatio: 0.6, avgWin: 0.1, avgLoss: -0.05 });
      expect(result.hitRatio).toBe(0.6);
      expect(result.avgCallsAlpha).toBeUndefined();
      expect(result.avgIndexReturn).toBeUndefined();
    });

    it('rejects a technical response where hitRatio is a string', () => {
      expect(() =>
        TrackRecordSchema.parse({ hitRatio: 'high', avgWin: 0.1, avgLoss: -0.05 })
      ).toThrow();
    });

    it('rejects a technical response where avgLoss is a positive string', () => {
      expect(() =>
        TrackRecordSchema.parse({ hitRatio: 0.6, avgWin: 0.1, avgLoss: 'bad' })
      ).toThrow();
    });
  });

  describe('invalid shapes', () => {
    it('rejects an entirely non-object value', () => {
      expect(() => TrackRecordSchema.parse(null)).toThrow();
      expect(() => TrackRecordSchema.parse('string')).toThrow();
      expect(() => TrackRecordSchema.parse(42)).toThrow();
    });

    it('accepts an empty object (all fields are optional)', () => {
      // The schema allows an empty object — callers must handle missing fields
      expect(() => TrackRecordSchema.parse({})).not.toThrow();
    });

    it('rejects stale field names from before the fix', () => {
      // win_rate and average_return are the OLD field names — the schema must not accept them
      // as typed fields. Zod strips unknown keys by default (passthrough is not set),
      // so parsing succeeds but old field names do not appear on the typed output.
      const result = TrackRecordSchema.parse({ win_rate: 0.75, average_return: 0.15 });
      // The old keys must NOT be carried through to the typed schema fields
      expect((result as Record<string, unknown>)['win_rate']).toBeUndefined();
      expect((result as Record<string, unknown>)['average_return']).toBeUndefined();
      // And none of the real fields should be accidentally populated
      expect(result.avgCallsReturn).toBeUndefined();
      expect(result.hitRatio).toBeUndefined();
    });
  });
});
