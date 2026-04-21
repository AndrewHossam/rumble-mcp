import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleCallDetailsTool,
  extractContentfulText,
  extractRumbleBlockText,
} from '../tools/call-details.js';
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
      expect(result.story?.text).toBe('Test story text');

      expect(result.performance).toBeDefined();
      expect(result.performance?.start_price).toBe(100);

      expect(result.updates).toBeDefined();
      if (!result.updates) throw new Error('updates should be defined');
      expect(result.updates[0].title).toBe('Update 1');
    });

    it('extracts text from a contentful-format update (the_story field)', async () => {
      mockClient.getFundamentalCallDetails.mockResolvedValue({
        ...mockCallDetails,
        updates: [
          {
            title: 'Contentful Update',
            datetime: '2024-02-01',
            the_story: {
              content: [
                {
                  nodeType: 'paragraph',
                  content: [{ nodeType: 'text', value: 'Story update text' }],
                },
              ],
            },
          },
        ],
      });

      const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
        callId: 'test-call-1',
        type: 'fundamental',
        sections: ['updates'],
      })) as CallDetailsResponse;

      expect(result.updates).toBeDefined();
      expect(result.updates).toHaveLength(1);
      if (!result.updates) throw new Error('updates should be defined');
      expect(result.updates[0].summary).toBe('Story update text');
    });
  });

  it('detects call type as fundamental when no type is specified and fundamental succeeds', async () => {
    mockClient.getFundamentalCallDetails.mockResolvedValue(mockCallDetails);

    const result = (await handleCallDetailsTool(mockClient, 'get_call_details', {
      callId: 'test-call-1',
    })) as CallDetailsResponse;

    expect(mockClient.getFundamentalCallDetails).toHaveBeenCalledWith('test-call-1');
    expect(mockClient.getTechnicalCallDetails).not.toHaveBeenCalled();
    expect(result.type).toBe('fundamental');
  });
});

describe('extractContentfulText', () => {
  it('returns empty string for undefined input', () => {
    expect(extractContentfulText(undefined)).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(extractContentfulText(null)).toBe('');
  });

  it('returns empty string for an empty document', () => {
    expect(extractContentfulText({ content: [] })).toBe('');
  });

  it('extracts text from a simple paragraph with a text node', () => {
    const doc = {
      content: [
        {
          nodeType: 'paragraph',
          content: [{ nodeType: 'text', value: 'Hello world' }],
        },
      ],
    };
    expect(extractContentfulText(doc)).toBe('Hello world');
  });

  it('joins multiple paragraphs with double newlines', () => {
    const doc = {
      content: [
        {
          nodeType: 'paragraph',
          content: [{ nodeType: 'text', value: 'First' }],
        },
        {
          nodeType: 'paragraph',
          content: [{ nodeType: 'text', value: 'Second' }],
        },
      ],
    };
    expect(extractContentfulText(doc)).toBe('First\n\nSecond');
  });

  it('recursively joins nested content nodes', () => {
    const doc = {
      content: [
        {
          nodeType: 'paragraph',
          content: [
            { nodeType: 'text', value: 'Part A ' },
            { nodeType: 'text', value: 'Part B' },
          ],
        },
      ],
    };
    expect(extractContentfulText(doc)).toBe('Part A Part B');
  });

  it('handles nodes with no value and no children gracefully', () => {
    const doc = {
      content: [{ nodeType: 'hr' }],
    };
    expect(extractContentfulText(doc)).toBe('');
  });
});

describe('extractRumbleBlockText', () => {
  it('returns empty string for undefined input', () => {
    expect(extractRumbleBlockText(undefined)).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(extractRumbleBlockText(null)).toBe('');
  });

  it('returns empty string for an empty document array', () => {
    expect(extractRumbleBlockText({ renderer: 'rumble', document: [] })).toBe('');
  });

  it('extracts text from a paragraph block with text spans', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello from rumble' }],
        },
      ],
    };
    expect(extractRumbleBlockText(doc)).toBe('Hello from rumble');
  });

  it('joins multiple blocks with double newlines', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Block one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Block two' }] },
      ],
    };
    expect(extractRumbleBlockText(doc)).toBe('Block one\n\nBlock two');
  });

  it('extracts table cells as pipe-joined row text', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [
        {
          type: 'table',
          content: [
            {
              cells: [
                { type: 'tableCell', content: [{ type: 'text', text: 'Col A' }] },
                { type: 'tableCell', content: [{ type: 'text', text: 'Col B' }] },
              ],
            },
          ],
        },
      ],
    };
    const result = extractRumbleBlockText(doc);
    expect(result).toContain('Col A');
    expect(result).toContain('Col B');
    expect(result).toContain(' | ');
  });

  it('recursively extracts text from children blocks', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [
        {
          type: 'bulletListItem',
          content: [],
          children: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child text' }] }],
        },
      ],
    };
    expect(extractRumbleBlockText(doc)).toContain('Child text');
  });

  it('handles a block with empty content array', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [{ type: 'paragraph', content: [] }],
    };
    expect(extractRumbleBlockText(doc)).toBe('');
  });

  it('returns empty string for a content item that is neither text nor table row', () => {
    const doc = {
      renderer: 'rumble' as const,
      document: [
        {
          type: 'paragraph',
          // content item has neither .text nor .cells — hits the default return ''
          content: [{ type: 'unknown', someOtherProp: 42 }],
        },
      ],
    };
    expect(extractRumbleBlockText(doc)).toBe('');
  });
});
