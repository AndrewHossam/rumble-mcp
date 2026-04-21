import { z } from 'zod';
import type { RumbleClient } from '../api/client.js';

export const technicalToolSchemas = {
  get_technical_calls: {
    description:
      'Get a list of active technical trading calls from TheRumble. Returns short-term trading signals with entry range, target prices, and expert info. Use get_call_details for full story and updates on a specific call.',
    inputSchema: z.object({
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of calls to return'),
      skip: z.number().min(0).default(0).describe('Number of calls to skip for pagination'),
      market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
      status: z
        .enum(['active', 'closed', 'all'])
        .default('active')
        .describe('Filter by call status'),
    }),
  },
  get_technical_track_record: {
    description:
      'Get the overall track record for technical calls, including hit ratio, average win/loss, and holding period.',
    inputSchema: z.object({
      market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
    }),
  },
};

export async function handleTechnicalTool(
  client: RumbleClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'get_technical_calls': {
      const params = technicalToolSchemas.get_technical_calls.inputSchema.parse(args);
      const calls = await client.getTechnicalCalls(params);
      return {
        count: calls.length,
        calls: calls.map(call => {
          // Calculate performance vs start_price using current live price
          const currentPrice = call.price;
          const startPrice = call.start_price;
          const performance =
            currentPrice && startPrice
              ? ((currentPrice - startPrice) / startPrice) * 100
              : undefined;

          // Calculate remaining return to target
          const targetPrice = call.target_price;
          const remainingReturn =
            currentPrice && targetPrice
              ? ((targetPrice - currentPrice) / currentPrice) * 100
              : undefined;

          return {
            id: call.id,
            ticker: call.asset?.symbol,
            company: call.asset?.name,
            industry: call.asset?.industry,
            action: call.action,
            status: call.status,
            entry_price: call.start_price,
            target_price: call.target_price,
            buy_range:
              call.buy_range_start !== null &&
              call.buy_range_start !== undefined &&
              call.buy_range_end !== null &&
              call.buy_range_end !== undefined
                ? { start: call.buy_range_start, end: call.buy_range_end }
                : undefined,
            current_price: call.price,
            performance_pct:
              performance !== undefined ? parseFloat(performance.toFixed(2)) : undefined,
            remaining_return_pct:
              remainingReturn !== undefined ? parseFloat(remainingReturn.toFixed(2)) : undefined,
            updated_at: call.updated_datetime,
            published_at: call.published_datetime,
            analysts: call.experts?.map(e => e.nickname ?? e.name),
            index: call.index,
          };
        }),
      };
    }

    case 'get_technical_track_record': {
      const params = technicalToolSchemas.get_technical_track_record.inputSchema.parse(args);
      return await client.getTechnicalTrackRecord(params.market);
    }

    default:
      throw new Error(`Unknown technical tool: ${toolName}`);
  }
}
