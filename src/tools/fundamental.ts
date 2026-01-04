import { z } from 'zod';
import type { RumbleClient } from '../api/client.js';

export const fundamentalToolSchemas = {
    get_fundamental_calls: {
        description: 'Get a list of active fundamental investment calls from TheRumble. Returns stock recommendations with target prices, performance, and analyst info.',
        inputSchema: z.object({
            limit: z.number().min(1).max(50).default(10).describe('Maximum number of calls to return'),
            skip: z.number().min(0).default(0).describe('Number of calls to skip for pagination'),
            market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
            status: z.enum(['active', 'closed', 'all']).default('active').describe('Filter by call status'),
        }),
    },
    get_fundamental_track_record: {
        description: 'Get the overall track record for fundamental calls, including win rate, average return, and alpha vs benchmark.',
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
    client: RumbleClient,
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
                    ticker: call.ticker,
                    company: call.company_name,
                    rating: call.rating,
                    target_price: call.target_price,
                    current_price: call.current_price,
                    remaining_return: call.remaining_return,
                    performance: call.performance,
                    analysts: call.analysts,
                    updated_at: call.updated_at,
                })),
            };
        }

        case 'get_fundamental_track_record': {
            const params = fundamentalToolSchemas.get_fundamental_track_record.inputSchema.parse(args);
            return await client.getFundamentalTrackRecord(params.market);
        }

        case 'get_latest_releases': {
            const params = fundamentalToolSchemas.get_latest_releases.inputSchema.parse(args);
            return await client.getLatestReleases(params.market);
        }

        default:
            throw new Error(`Unknown fundamental tool: ${toolName}`);
    }
}
