import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import tool schemas and handlers
import { fundamentalToolSchemas, handleFundamentalTool } from '../tools/fundamental.js';
import { technicalToolSchemas, handleTechnicalTool } from '../tools/technical.js';
import { assetToolSchemas, handleAssetTool, KNOWN_LISTS } from '../tools/assets.js';
import { callDetailsToolSchemas } from '../tools/call-details.js';

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

    it('should handle get_fundamental_track_record', async () => {
      const mockTrackRecord = { win_rate: 0.75, average_return: 0.15 };
      mockClient.getFundamentalTrackRecord.mockResolvedValue(mockTrackRecord);

      const result = await handleFundamentalTool(
        mockClient as any,
        'get_fundamental_track_record',
        {}
      );

      expect(mockClient.getFundamentalTrackRecord).toHaveBeenCalledWith('EGY');
      expect(result).toEqual(mockTrackRecord);
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
