import { z } from 'zod';

// API Response Schemas
export const FundamentalCallSchema = z.object({
    id: z.string(),
    ticker: z.string(),
    company_name: z.string().optional(),
    rating: z.string().optional(),
    target_price: z.number().optional(),
    current_price: z.number().optional(),
    open_price: z.number().optional(),
    opened_at: z.string().optional(),
    updated_at: z.string().optional(),
    remaining_return: z.number().optional(),
    performance: z.number().optional(),
    analysts: z.array(z.string()).optional(),
    the_story: z.string().optional(),
    the_good: z.array(z.string()).optional(),
    key_metrics: z.record(z.any()).optional(),
    status: z.string().optional(),
});

export const TechnicalCallSchema = z.object({
    id: z.string(),
    ticker: z.string(),
    company_name: z.string().optional(),
    entry_price: z.number().optional(),
    target_price: z.number().optional(),
    stop_loss: z.number().optional(),
    current_price: z.number().optional(),
    opened_at: z.string().optional(),
    updated_at: z.string().optional(),
    performance: z.number().optional(),
    risk_reward: z.number().optional(),
    status: z.string().optional(),
    thesis: z.string().optional(),
});

export const TrackRecordSchema = z.object({
    total_calls: z.number().optional(),
    winning_calls: z.number().optional(),
    losing_calls: z.number().optional(),
    win_rate: z.number().optional(),
    average_return: z.number().optional(),
    alpha: z.number().optional(),
    benchmark_performance: z.number().optional(),
});

export const AssetListSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    assets: z.array(z.object({
        ticker: z.string(),
        company_name: z.string().optional(),
        weight: z.number().optional(),
        performance: z.number().optional(),
    })).optional(),
});

export type FundamentalCall = z.infer<typeof FundamentalCallSchema>;
export type TechnicalCall = z.infer<typeof TechnicalCallSchema>;
export type TrackRecord = z.infer<typeof TrackRecordSchema>;
export type AssetList = z.infer<typeof AssetListSchema>;

// API Parameters
export interface ListParams {
    limit?: number;
    skip?: number;
    market?: string;
    status?: string;
}

export interface CallDetailsParams {
    callId: string;
}

export interface AssetListParams {
    listId: string;
}
