import { z } from 'zod';
import type { RumbleClient } from '../api/client.js';

export const technicalToolSchemas = {
    get_technical_calls: {
        description: 'Get a list of active technical trading calls from TheRumble. Returns short-term trading signals with entry, target, and stop-loss prices. Use get_call_details for full details on a specific call.',
        inputSchema: z.object({
            limit: z.number().min(1).max(50).default(10).describe('Maximum number of calls to return'),
            skip: z.number().min(0).default(0).describe('Number of calls to skip for pagination'),
            market: z.string().default('EGY').describe('Market code (default: EGY for Egypt)'),
            status: z.enum(['active', 'closed', 'all']).default('active').describe('Filter by call status'),
        }),
    },
    get_technical_track_record: {
        description: 'Get the overall track record for technical calls, including win rate and performance metrics.',
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
                calls: calls.map(call => ({
                    id: call.id,
                    ticker: call.ticker,
                    company: call.company_name,
                    entry_price: call.entry_price,
                    target_price: call.target_price,
                    stop_loss: call.stop_loss,
                    current_price: call.current_price,
                    performance: call.performance,
                    risk_reward: call.risk_reward,
                    updated_at: call.updated_at,
                })),
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


