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
  assets: z
    .array(
      z.object({
        ticker: z.string(),
        company_name: z.string().optional(),
        weight: z.number().optional(),
        performance: z.number().optional(),
      })
    )
    .optional(),
});

export type FundamentalCall = z.infer<typeof FundamentalCallSchema>;
export type TechnicalCall = z.infer<typeof TechnicalCallSchema>;
export type TrackRecord = z.infer<typeof TrackRecordSchema>;
export type AssetList = z.infer<typeof AssetListSchema>;

// Rich text types (Contentful format)
export interface RichTextNode {
  nodeType: string;
  value?: string;
  content?: RichTextNode[];
}

export interface RichTextDocument {
  content: RichTextNode[];
}

// Call detail types
export interface CallDetails {
  id: string;
  title: string;
  status: string;
  recommended_action?: string;
  published_datetime?: string;
  updated_datetime?: string;
  asset?: {
    symbol: string;
    name: string;
    industry?: string;
    icon?: string;
  };
  the_story?: RichTextDocument;
  start_price?: number;
  current_price?: number;
  target_price?: number;
  entry_price?: number;
  stop_loss?: number;
  performance?: number;
  remaining_return?: number;
  risk_reward?: number;
  index?: string;
  updates?: UpdateItem[];
  news?: NewsItem[];
}

export interface UpdateItem {
  title: string;
  datetime: string;
  content?: RichTextDocument;
}

export interface NewsItem {
  title: string;
  datetime?: string;
  published_at?: string;
  source?: string;
  url?: string;
  summary?: string;
  content?: RichTextDocument;
}

export interface StorySection {
  raw: RichTextDocument;
  text: string;
}

export interface PerformanceSection {
  start_price?: number;
  current_price?: number;
  target_price?: number;
  entry_price?: number;
  stop_loss?: number;
  performance?: number;
  remaining_return?: number;
  risk_reward?: number;
  index?: string;
}

export interface FormattedUpdate {
  title: string;
  datetime: string;
  summary: string;
}

export interface FormattedNews {
  title: string;
  datetime?: string;
  source?: string;
  url?: string;
  summary: string;
}

export interface CallDetailsResponse {
  id: string;
  type: string;
  title: string;
  status: string;
  recommended_action?: string;
  published_at?: string;
  updated_at?: string;
  asset: {
    symbol: string;
    name: string;
    industry?: string;
    icon?: string;
  } | null;
  performance?: PerformanceSection;
  story?: StorySection | null;
  updates?: FormattedUpdate[];
  news?: FormattedNews[];
}

// Latest release type
export interface LatestRelease {
  id: string;
  title?: string;
  type?: string;
  published_at?: string;
  [key: string]: unknown;
}

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
