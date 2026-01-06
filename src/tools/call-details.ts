import { z } from 'zod';
import type { RumbleClient } from '../api/client.js';

/**
 * Unified tool for getting detailed information about any call (fundamental or technical)
 *
 * Sections available:
 * - story: The main investment thesis/analysis
 * - performance: Returns, remaining upside, price performance
 * - updates: All revisions and updates to the call
 * - news: Related news articles (if available)
 */
export const callDetailsToolSchemas = {
  get_call_details: {
    description: `Get detailed information about a specific investment call (fundamental or technical).

Returns comprehensive data including:
- Basic info: ID, title, status, recommended action
- Asset: Stock symbol, company name, industry
- Prices: Start/current/target prices, entry/stop-loss (for technical)
- Story: Full investment thesis and analysis
- Performance: Returns, remaining upside
- Updates: Historical updates and revisions
- News: Related news articles (if available)

Use the 'sections' parameter to filter which data to return.`,
    inputSchema: z.object({
      callId: z.string().describe('The call ID (e.g., "7CRN9unbNwyniJPAlLYaVR")'),
      type: z
        .enum(['fundamental', 'technical'])
        .optional()
        .describe('Type of call. If not provided, will try fundamental first then technical.'),
      sections: z
        .array(z.enum(['story', 'performance', 'updates', 'news']))
        .optional()
        .describe('Which sections to include. If not provided, returns all sections.'),
    }),
  },
};

/**
 * Extract plain text from Contentful rich text document
 */
function extractTextFromRichText(richText: any): string {
  if (!richText || !richText.content) return '';

  const extractText = (node: any): string => {
    if (node.nodeType === 'text') {
      return node.value || '';
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }
    return '';
  };

  return richText.content
    .map((block: any) => extractText(block))
    .filter((text: string) => text.trim())
    .join('\n\n');
}

/**
 * Format the story section from raw API data
 */
function formatStory(details: any): any {
  if (!details.the_story) return null;

  return {
    raw: details.the_story,
    text: extractTextFromRichText(details.the_story),
  };
}

/**
 * Format performance metrics from raw API data
 */
function formatPerformance(details: any): any {
  return {
    start_price: details.start_price,
    current_price: details.current_price,
    target_price: details.target_price,
    entry_price: details.entry_price, // Technical calls
    stop_loss: details.stop_loss, // Technical calls
    performance: details.performance,
    remaining_return: details.remaining_return,
    risk_reward: details.risk_reward, // Technical calls
    index: details.index, // Benchmark index
  };
}

/**
 * Format updates from raw API data
 */
function formatUpdates(details: any): any[] {
  if (!details.updates || !Array.isArray(details.updates)) return [];

  return details.updates.map((update: any) => ({
    title: update.title,
    datetime: update.datetime,
    summary: extractTextFromRichText(update.content),
  }));
}

/**
 * Format news from raw API data
 */
function formatNews(details: any): any[] {
  if (!details.news || !Array.isArray(details.news)) return [];

  return details.news.map((item: any) => ({
    title: item.title,
    datetime: item.datetime || item.published_at,
    source: item.source,
    url: item.url,
    summary: item.summary || extractTextFromRichText(item.content),
  }));
}

export async function handleCallDetailsTool(
  client: RumbleClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (toolName !== 'get_call_details') {
    throw new Error(`Unknown call details tool: ${toolName}`);
  }

  const params = callDetailsToolSchemas.get_call_details.inputSchema.parse(args);
  const { callId, type, sections } = params;

  // Determine which sections to include (all if not specified)
  const includeSections = sections || ['story', 'performance', 'updates', 'news'];
  const includeStory = includeSections.includes('story');
  const includePerformance = includeSections.includes('performance');
  const includeUpdates = includeSections.includes('updates');
  const includeNews = includeSections.includes('news');

  // Fetch call details (try specified type, or fundamental first then technical)
  let details: any;
  let callType: string;

  if (type === 'fundamental') {
    details = await client.getFundamentalCallDetails(callId);
    callType = 'fundamental';
  } else if (type === 'technical') {
    details = await client.getTechnicalCallDetails(callId);
    callType = 'technical';
  } else {
    // Try fundamental first, fall back to technical
    try {
      details = await client.getFundamentalCallDetails(callId);
      callType = 'fundamental';
    } catch {
      details = await client.getTechnicalCallDetails(callId);
      callType = 'technical';
    }
  }

  // Build response with requested sections
  const response: any = {
    // Always include basic info
    id: details.id,
    type: callType,
    title: details.title,
    status: details.status,
    recommended_action: details.recommended_action,
    published_at: details.published_datetime,
    updated_at: details.updated_datetime,

    // Asset info
    asset: details.asset
      ? {
          symbol: details.asset.symbol,
          name: details.asset.name,
          industry: details.asset.industry,
          icon: details.asset.icon,
        }
      : null,
  };

  // Add requested sections
  if (includePerformance) {
    response.performance = formatPerformance(details);
  }

  if (includeStory) {
    response.story = formatStory(details);
  }

  if (includeUpdates) {
    response.updates = formatUpdates(details);
  }

  if (includeNews) {
    response.news = formatNews(details);
  }

  return response;
}
