import { z } from 'zod';
import type { IRumbleClient } from '../api/client.js';
import { NotFoundError } from '../api/client.js';
import type {
  CallDetails,
  CallDetailsResponse,
  ContentfulDocument,
  ContentfulNode,
  RumbleRichTextDocument,
  RumbleBlock,
  RumbleBlockContent,
  RumbleTableCell,
  StorySection,
  PerformanceSection,
  FormattedUpdate,
  UpdateItem,
} from '../types/index.js';

/**
 * Unified tool for getting detailed information about any call (fundamental or technical)
 *
 * Sections available:
 * - story: The main investment thesis/analysis
 * - performance: Prices + calculated returns
 * - updates: All revisions and updates to the call
 */
export const callDetailsToolSchemas = {
  get_call_details: {
    description: `Get detailed information about a specific investment call (fundamental or technical).

Returns comprehensive data including:
- Basic info: ID, title, status, action/recommendation
- Asset: Stock symbol (ticker), company name, industry, icon
- Prices: Start/current/target prices, buy range (for technical)
- Story: Full investment thesis and analysis
- Performance: Current price vs start, remaining upside
- Updates: Historical updates and revisions from analysts

Use the 'sections' parameter to filter which data to return.`,
    inputSchema: z.object({
      callId: z.string().describe('The call ID (e.g., "0c76e268-80df-4ab2-aaf7-a8a4dcc82b28")'),
      type: z
        .enum(['fundamental', 'technical'])
        .optional()
        .describe('Type of call. If not provided, will try fundamental first then technical.'),
      sections: z
        .array(z.enum(['story', 'performance', 'updates']))
        .optional()
        .describe('Which sections to include. If not provided, returns all sections.'),
    }),
  },
};

/**
 * Extract plain text from a Contentful rich-text document.
 * Fundamental calls use this format for `the_story`.
 */
export function extractContentfulText(richText: ContentfulDocument | undefined | null): string {
  if (!richText?.content) return '';

  const extractNode = (node: ContentfulNode): string => {
    if (node.nodeType === 'text') return node.value ?? '';
    if (node.content?.length) return node.content.map(extractNode).join('');
    return '';
  };

  return richText.content
    .map(extractNode)
    .filter(t => t.trim())
    .join('\n\n');
}

/**
 * Extract plain text from Rumble's BlockNote rich-text format.
 * Technical call updates use this format, and some fundamental updates also use it.
 * Handles paragraphs, tables, and nested children blocks.
 */
export function extractRumbleBlockText(doc: RumbleRichTextDocument | undefined | null): string {
  if (!doc?.document) return '';

  const extractFromBlock = (block: RumbleBlock): string => {
    let text = '';

    // 1. Extract from content (array of spans or cells)
    if (Array.isArray(block.content)) {
      text += block.content
        .map(item => {
          // Paragraph span: { text: "..." }
          if (item && item.text !== undefined) {
            return item.text ?? '';
          }
          // Table row: { cells: [...] }
          if (item && Array.isArray(item.cells)) {
            return item.cells
              .map((cell: RumbleTableCell) =>
                Array.isArray(cell.content)
                  ? cell.content.map((span: RumbleBlockContent) => span.text ?? '').join('')
                  : ''
              )
              .join(' | ');
          }
          return '';
        })
        .join('');
    }

    // 2. Extract from children recursively
    if (Array.isArray(block.children) && block.children.length > 0) {
      const childText = block.children.map(extractFromBlock).join('\n');
      if (childText) text += '\n' + childText;
    }

    return text;
  };

  return doc.document
    .map(extractFromBlock)
    .filter(t => t.trim())
    .join('\n\n');
}

/**
 * Format the story section from raw API data (Contentful format).
 */
function formatStory(details: CallDetails): StorySection | null {
  if (!details.the_story) return null;
  return {
    raw: details.the_story,
    text: extractContentfulText(details.the_story),
  };
}

/**
 * Format performance metrics from raw API data.
 * Computes returns since start_price and remaining to target.
 */
function formatPerformance(details: CallDetails): PerformanceSection {
  const currentPrice = details.price;
  const startPrice = details.start_price;
  const targetPrice = details.target_price;

  return {
    start_price: startPrice,
    current_price: currentPrice,
    target_price: targetPrice,
    buy_range:
      details.buy_range_start !== null &&
      details.buy_range_start !== undefined &&
      details.buy_range_end !== null &&
      details.buy_range_end !== undefined
        ? { start: details.buy_range_start, end: details.buy_range_end }
        : undefined,
    take_profit_price: details.take_profit_price,
    close_price: details.close_price,
    index: details.index,
    index_price: details.index_price,
  };
}

/**
 * Format updates, extracting plain text from either rich-text format.
 */
function formatUpdates(details: CallDetails): FormattedUpdate[] {
  if (!details.updates || !Array.isArray(details.updates)) return [];

  return details.updates.map((update: UpdateItem) => {
    // Try BlockNote format first (technical), fall back to Contentful (fundamental)
    let summary = '';
    if (update.content?.document) {
      summary = extractRumbleBlockText(update.content);
    }
    if (!summary.trim() && update.the_story) {
      summary = extractContentfulText(update.the_story);
    }

    return {
      id: update.id,
      title: update.title,
      datetime: update.datetime,
      action: update.action,
      target_price: update.target_price,
      stop_loss: update.stop_loss,
      summary,
    };
  });
}

export async function handleCallDetailsTool(
  client: IRumbleClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (toolName !== 'get_call_details') {
    throw new Error(`Unknown call details tool: ${toolName}`);
  }

  const params = callDetailsToolSchemas.get_call_details.inputSchema.parse(args);
  const { callId, type, sections } = params;

  // Determine which sections to include (all if not specified)
  const includeSections = sections || ['story', 'performance', 'updates'];
  const includeStory = includeSections.includes('story');
  const includePerformance = includeSections.includes('performance');
  const includeUpdates = includeSections.includes('updates');

  // Fetch call details (try specified type, or fundamental first then technical)
  let details: CallDetails;
  let callType: string;

  if (type === 'fundamental') {
    details = await client.getFundamentalCallDetails(callId);
    callType = 'fundamental';
  } else if (type === 'technical') {
    details = await client.getTechnicalCallDetails(callId);
    callType = 'technical';
  } else {
    // Try fundamental first; fall back to technical only when the call is not found
    try {
      details = await client.getFundamentalCallDetails(callId);
      callType = 'fundamental';
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err;
      details = await client.getTechnicalCallDetails(callId);
      callType = 'technical';
    }
  }

  // Derive unified action field (fundamental uses recommended_action, technical uses action)
  const action = details.recommended_action ?? details.action;

  // Build response with requested sections
  const response: CallDetailsResponse = {
    id: details.id,
    type: callType,
    title: details.title ?? details.asset?.symbol ?? callId,
    status: details.status ?? 'unknown',
    action,
    published_at: details.published_datetime,
    updated_at: details.updated_datetime,
    asset: details.asset
      ? {
          symbol: details.asset.symbol,
          name: details.asset.name,
          industry: details.asset.industry,
          icon: details.asset.icon,
        }
      : null,
  };

  if (includePerformance) {
    response.performance = formatPerformance(details);
  }

  if (includeStory) {
    response.story = formatStory(details);
  }

  if (includeUpdates) {
    response.updates = formatUpdates(details);
  }

  return response;
}
