import { describe, it, expect, beforeEach } from 'vitest';
import { handleCallDetailsTool } from '../tools/call-details.js';
import { NotFoundError } from '../api/client.js';
import { createMockClient, type MockRumbleClient } from './_helpers.js';
import type { CallDetailsResponse } from '../types/index.js';

const mockCallDetails = {
  id: 'test-call-1',
  title: 'Test Call',
  status: 'active',
  recommended_action: 'buy',
  published_datetime: '2024-01-01',
  updated_datetime: '2024-01-15',
  asset: {
    id: 'asset-1',
    symbol: 'TEST',
    name: 'Test Company',
    industry: 'Tech',
    icon: 'icon.png',
  },
  the_story: {
    content: [
      {
        nodeType: 'paragraph',
        content: [{ nodeType: 'text', value: 'Test story text' }],
      },
    ],
  },
  start_price: 100,
  price: 120, // Replaces current_price to match real API
  target_price: 150,
  performance: 0.2,
  remaining_return: 0.25,
  updates: [
    {
      title: 'Update 1',
      datetime: '2024-01-10',
      content: {
        renderer: 'rumble' as const,
        document: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Update text' }],
          },
        ],
      },
    },
  ],
};

describe('handleCallDetailsTool', () => {
  let mockClient: MockRumbleClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it('fetches fundamental details when type is "fundamental"', async () => {
    mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient, 'get_call_details', {
      callId: 'test-call-1',
      type: 'fundamental',
    });

    expect(mockClient.getFundamentalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getTechnicalCallDetails).not.toHaveBeenCalled();
    expect((result as CallDetailsResponse).type).toBe('fundamental');
  });

  it('fetches technical details when type is "technical"', async () => {
    mockClient.getTechnicalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient, 'get_call_details', {
      callId: 'test-call-1',
      type: 'technical',
    });

    expect(mockClient.getTechnicalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getFundamentalCallDetails).not.toHaveBeenCalled();
    expect((result as CallDetailsResponse).type).toBe('technical');
  });

  it('falls back to technical when fundamental returns 404 and no type is specified', async () => {
    mockClient.getFundamentalCallDetails.mockRejectedValue(new NotFoundError('test-call-1'));
    mockClient.getTechnicalCallDetails.mockResolvedValue(mockCallDetails);

    const result = await handleCallDetailsTool(mockClient, 'get_call_details', {
      callId: 'test-call-1',
    });

    expect(mockClient.getFundamentalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getTechnicalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect((result as CallDetailsResponse).type).toBe('technical');
  });

  it('re-throws non-404 errors from fundamental without trying technical', async () => {
    const serverError = new Error('API Error: 500 Internal Server Error');
    mockClient.getFundamentalCallDetails.mockRejectedValue(serverError);

    await expect(
      handleCallDetailsTool(mockClient, 'get_call_details', { callId: 'test-call-1' })
    ).rejects.toThrow('API Error: 500 Internal Server Error');

    expect(mockClient.getTechnicalCallDetails).not.toHaveBeenCalled();
  });

  it('always returns basic info (id, type, title, status, asset)', async () => {
    mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);

    const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
      callId: 'test-call-1',
      type: 'fundamental',
      sections: ['performance'],
    })) as CallDetailsResponse;

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
      handleCallDetailsTool(mockClient, 'unknown_tool', { callId: 'test-call-1' })
    ).rejects.toThrow('Unknown call details tool: unknown_tool');
  });

  describe('Section filtering', () => {
    beforeEach(() => {
      mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);
    });

    it('returns the story section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['story'],
      })) as CallDetailsResponse;

      expect(result.story).toBeDefined();
      if (!result.story) throw new Error('story should be defined');
      expect(result.story.text).toContain('Test story text');
      expect(result.performance).toBeUndefined();
      expect(result.updates).toBeUndefined();
    });

    it('returns the performance section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['performance'],
      })) as CallDetailsResponse;

      expect(result.performance).toBeDefined();
      if (!result.performance) throw new Error('performance should be defined');
      expect(result.performance.start_price).toBe(100);
      expect(result.performance.current_price).toBe(120);
      expect(result.performance.target_price).toBe(150);
      expect(result.story).toBeUndefined();
    });

    it('returns the updates section when requested', async () => {
      const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['updates'],
      })) as CallDetailsResponse;

      expect(result.updates).toBeDefined();
      expect(result.updates).toHaveLength(1);
      if (!result.updates) throw new Error('updates should be defined');
      expect(result.updates[0].title).toBe('Update 1');
      expect(result.story).toBeUndefined();
    });

    it('returns all sections when no sections param is provided', async () => {
      const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
      })) as CallDetailsResponse;

      expect(result.story).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.updates).toBeDefined();
    });
  });
});
