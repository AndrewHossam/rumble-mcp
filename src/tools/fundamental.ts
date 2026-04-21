import { z } from 'zod';
import type { IRumbleClient } from '../api/client.js';
import {
  computePerformance,
  computeRemainingReturn,
  mapAnalysts,
  mapReleaseAuthors,
} from './_shared.js';

export const fundamentalToolSchemas = {
  get_fundamental_calls: {
    description:
      'Get a list of active fundamental investment calls from TheRumble. Returns stock recommendations with target prices, performance, and analyst info. Use get_call_details for full details on a specific call.',
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
  get_fundamental_track_record: {
    description:
      'Get the overall track record for fundamental calls, including average return, alpha vs benchmark, and hit ratio.',
    inputSchema: z.object({
      market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
    }),
  },
  get_latest_releases: {
    description: 'Get the latest content releases and updates for fundamental calls.',
    inputSchema: z.object({
      market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
    }),
  },
};

export async function handleFundamentalTool(
  client: IRumbleClient,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'get_fundamental_calls': {
      const params = fundamentalToolSchemas.get_fundamental_calls.inputSchema.parse(args);
      const calls = await client.getFundamentalCalls(params);
      return {
        count: calls.length,
        calls: calls.map(call => ({
          id: call.id,
          ticker: call.asset?.symbol,
          company: call.asset?.name,
          industry: call.asset?.industry,
          recommendation: call.recommended_action,
          status: call.status,
          start_price: call.start_price,
          target_price: call.target_price,
          current_price: call.price,
          performance_pct: computePerformance(call.start_price, call.price),
          remaining_return_pct: computeRemainingReturn(call.price, call.target_price),
          updated_at: call.updated_datetime,
          published_at: call.published_datetime,
          analysts: mapAnalysts(call.experts),
          index: call.index,
        })),
      };
    }

    case 'get_fundamental_track_record': {
      const params = fundamentalToolSchemas.get_fundamental_track_record.inputSchema.parse(args);
      return await client.getFundamentalTrackRecord(params.market);
    }

    case 'get_latest_releases': {
      const params = fundamentalToolSchemas.get_latest_releases.inputSchema.parse(args);
      const releases = await client.getLatestReleases(params.market);
      return {
        count: releases.length,
        releases: releases.map(r => ({
          title: r.title,
          summary: r.short_description,
          update_at: r.update_datetime,
          parent_id: r.parent_id,
          type: r.parent_type,
          authors: mapReleaseAuthors(r.authors),
          thumbnail: r.thumbnail_image,
        })),
      };
    }

    default:
      throw new Error(`Unknown fundamental tool: ${toolName}`);
  }
}
