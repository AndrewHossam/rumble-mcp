import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCallDetailsTool } from '../tools/call-details.js';

const createMockClient = () => ({
  getFundamentalCallDetails: vi.fn(),
  getTechnicalCallDetails: vi.fn(),
});

const mockCallDetails = {
  id: 'test-call-1',
  title: 'Test Call',
  status: 'active',
  recommended_action: 'buy',
  published_datetime: '2024-01-01',
  updated_datetime: '2024-01-15',
  asset: { symbol: 'TEST', name: 'Test Company', industry: 'Tech', icon: 'icon.png' },
  the_story: {
    content: [
      {
        nodeType: 'paragraph',
        content: [{ nodeType: 'text', value: 'Test story text' }],
      },
    ],
  },
  start_price: 100,
  current_price: 120,
  target_price: 150,
  performance: 0.2,
  remaining_return: 0.25,
  updates: [
    {
      title: 'Update 1',
      datetime: '2024-01-10',
      content: {
        content: [
          {
            nodeType: 'paragraph',
            content: [{ nodeType: 'text', value: 'Update text' }],
          },
        ],
      },
    },
  ],
  news: [
    {
      title: 'News 1',
      datetime: '2024-01-12',
      source: 'Reuters',
      url: 'https://example.com',
      summary: 'News summary',
    },
  ],
};

describe('handleCallDetailsTool', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  it('fetches fundamental details when type is "fundamental"', async () => {
    mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient as any, 'get_call_details', {
      callId: 'test-call-1',
      type: 'fundamental',
    });

    expect(mockClient.getFundamentalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getTechnicalCallDetails).not.toHaveBeenCalled();
    expect((result as any).type).toBe('fundamental');
  });

  it('fetches technical details when type is "technical"', async () => {
    mockClient.getTechnicalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient as any, 'get_call_details', {
      callId: 'test-call-1',
      type: 'technical',
    });

    expect(mockClient.getTechnicalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getFundamentalCallDetails).not.toHaveBeenCalled();
    expect((result as any).type).toBe('technical');
  });

  it('falls back to technical when fundamental fails and no type is specified', async () => {
    mockClient.getFundamentalCallDetails.mockRejectedValue(new Error('Not found'));
    mockClient.getTechnicalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient as any, 'get_call_details', {
      callId: 'test-call-1',
    });

    expect(mockClient.getFundamentalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getTechnicalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect((result as any).type).toBe('technical');
  });

  it('always returns basic info (id, type, title, status, asset)', async () => {
    mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);

    const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
      callId: 'test-call-1',
      type: 'fundamental',
      sections: ['performance'],
    })) as any;

    expect(result.id).toBe('test-call-1');
    expect(result.type).toBe('fundamental');
    expect(result.title).toBe('Test Call');
    expect(result.status).toBe('active');
    expect(result.asset).toEqual({
      symbol: 'TEST',
      name: 'Test Company',
      industry: 'Tech',
      icon: 'icon.png',
    });
  });

  it('throws for an unknown tool name', async () => {
    await expect(
      handleCallDetailsTool(mockClient as any, 'unknown_tool', { callId: 'test-call-1' })
    ).rejects.toThrow('Unknown call details tool: unknown_tool');
  });

  describe('Section filtering', () => {
    beforeEach(() => {
      mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);
    });

    it('returns the story section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['story'],
      })) as any;

      expect(result.story).toBeDefined();
      expect(result.story.text).toContain('Test story text');
      expect(result.performance).toBeUndefined();
      expect(result.updates).toBeUndefined();
      expect(result.news).toBeUndefined();
    });

    it('returns the performance section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['performance'],
      })) as any;

      expect(result.performance).toBeDefined();
      expect(result.performance.start_price).toBe(100);
      expect(result.performance.current_price).toBe(120);
      expect(result.performance.target_price).toBe(150);
      expect(result.story).toBeUndefined();
    });

    it('returns the updates section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['updates'],
      })) as any;

      expect(result.updates).toBeDefined();
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].title).toBe('Update 1');
      expect(result.story).toBeUndefined();
    });

    it('returns the news section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['news'],
      })) as any;

      expect(result.news).toBeDefined();
      expect(result.news).toHaveLength(1);
      expect(result.news[0].title).toBe('News 1');
      expect(result.news[0].source).toBe('Reuters');
      expect(result.story).toBeUndefined();
    });

    it('returns all sections when no sections param is provided', async () => {
      const result = (await handleCallDetailsTool(mockClient as any, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
      })) as any;

      expect(result.story).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.updates).toBeDefined();
      expect(result.news).toBeDefined();
    });
  });
});
