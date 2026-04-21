import { z } from 'zod';

// ─── Shared Sub-schemas ────────────────────────────────────────────────────────

// Asset object returned for both fundamental and technical calls
export const AssetInfoSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  currency: z.string().optional(),
  no_of_shares: z.number().optional(),
  isin_code: z.string().optional(),
  feed_provider_id: z.string().optional(),
  icon: z.string().optional(),
  industry: z.string().optional(),
  market: z.string().optional(),
  dividends: z
    .array(
      z.object({
        ex_date: z.string().optional(),
        dividend_per_share: z.number().optional(),
      })
    )
    .optional(),
});

// Expert / Analyst object
export const ExpertInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().optional(),
  type: z.string().optional(), // e.g. "FUNDAMENTAL_ANALYST", "TECHNICAL_ANALYST"
  image: z.string().optional(),
  markets: z.array(z.string()).optional(),
  bio: z.string().optional(),
  title: z.string().optional(),
});

// ─── List Schemas (from /api/fundamental-calls & /api/technical-calls) ─────────

/**
 * Matches the actual API response shape for a fundamental call list item.
 * Key discovery: NO root-level ticker/company_name/rating/current_price fields.
 * All such data is nested under `asset` or uses different names.
 */
export const FundamentalCallSchema = z.object({
  id: z.string(),
  status: z.string().optional(), // "open" | "closed"
  recommended_action: z.string().optional(), // "buy" | "hold" | "sell"
  published_datetime: z.string().optional(),
  updated_datetime: z.string().optional(),
  start_price: z.number().optional(),
  target_price: z.number().optional(),
  close_price: z.number().nullable().optional(),
  close_index_price: z.number().nullable().optional(),
  close_datetime: z.string().nullable().optional(),
  start_index_price: z.number().optional(),
  index: z.string().optional(), // e.g. "EGX30CAPPED"
  asset: AssetInfoSchema.optional(),
  experts: z.array(ExpertInfoSchema).optional(),
  // price = current market price (runtime field from live feed)
  price: z.number().optional(),
  index_price: z.number().optional(),
});

/**
 * Matches the actual API response shape for a technical call list item.
 * No stop_loss or performance at list level — only available in detail call.
 */
export const TechnicalCallSchema = z.object({
  id: z.string(),
  status: z.string().optional(), // "open" | "closed"
  action: z.string().optional(), // "buy" | "sell"
  published_datetime: z.string().optional(),
  updated_datetime: z.string().optional(),
  start_price: z.number().optional(), // entry price
  target_price: z.number().optional(),
  buy_range_start: z.number().nullable().optional(),
  buy_range_end: z.number().nullable().optional(),
  start_index_price: z.number().optional(),
  index: z.string().optional(),
  asset: AssetInfoSchema.optional(),
  experts: z.array(ExpertInfoSchema).optional(),
  // price = current market price
  price: z.number().optional(),
  index_price: z.number().optional(),
});

// ─── Track Record Schema ──────────────────────────────────────────────────────

export const TrackRecordSchema = z.object({
  // Fundamental track record fields (from /api/track-record/fundamental)
  avgCallsAlpha: z.number().optional(),
  avgCallsReturn: z.number().optional(),
  avgIndexReturn: z.number().optional(),
  avgHoldingPeriod: z.number().optional(),
  callsCount: z.number().optional(),
  index: z.string().optional(),
  // Technical track record fields (from /api/track-record/technical)
  avgWin: z.number().optional(),
  avgLoss: z.number().optional(),
  hitRatio: z.number().optional(),
});

// ─── Asset List Schema ───────────────────────────────────────────────────────

export const AssetListSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  assets: z
    .array(
      z.object({
        id: z.string().optional(),
        symbol: z.string().optional(),
        name: z.string().optional(),
        weight: z.number().optional(),
      })
    )
    .optional(),
});

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type AssetInfo = z.infer<typeof AssetInfoSchema>;
export type ExpertInfo = z.infer<typeof ExpertInfoSchema>;
export type FundamentalCall = z.infer<typeof FundamentalCallSchema>;
export type TechnicalCall = z.infer<typeof TechnicalCallSchema>;
export type TrackRecord = z.infer<typeof TrackRecordSchema>;
export type AssetList = z.infer<typeof AssetListSchema>;

// ─── Rich Text Types ─────────────────────────────────────────────────────────

// Rumble uses two rich-text formats:
// 1. Contentful format: {nodeType, content, value} — used in fundamental calls the_story
// 2. Rumble BlockNote format: {document: [{type, content, props}]} — used in technical call updates

export interface RumbleTableCell {
  type: string;
  props?: Record<string, unknown>;
  content?: RumbleBlockContent[];
}

export interface RumbleBlockContent {
  text?: string;
  // `string & {}` preserves the 'text' literal for IntelliSense while still accepting any string
  type?: 'text' | (string & {});
  styles?: Record<string, unknown>;
  cells?: RumbleTableCell[];
}

export interface RumbleBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: RumbleBlockContent[];
  children?: RumbleBlock[];
}

export interface RumbleRichTextDocument {
  document: RumbleBlock[];
  renderer: 'rumble' | string;
}

// Contentful format (used in fundamental calls)
export interface ContentfulNode {
  nodeType: string;
  value?: string;
  data?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: ContentfulNode[];
}

export interface ContentfulDocument {
  nodeType?: string;
  data?: Record<string, unknown>;
  content: ContentfulNode[];
}

// Union type for either format
export type RichTextContent = ContentfulDocument | RumbleRichTextDocument;

// ─── Call Detail Types (from /api/fundamental-calls/:id?expert_tool_table=true) ──

export interface UpdateItem {
  id?: string;
  title: string;
  datetime: string; // ISO datetime
  action?: string; // "buy" | "sell" etc
  target_price?: number | null;
  take_profit_price?: number | null;
  stop_loss?: number | null;
  sell_percentage?: number | null;
  sell_price?: number | null;
  first_published_at?: string;
  last_published_at?: string;
  parent_id?: string;
  content?: RumbleRichTextDocument; // BlockNote format
  the_story?: ContentfulDocument | null; // Contentful format (legacy)
}

export interface CallDetails {
  id: string;
  title?: string; // e.g. "Buy OFH", "Hold QNBE"
  status: string; // "open" | "closed"
  // Fundamental: recommended_action; Technical: action
  recommended_action?: string;
  action?: string;
  published_datetime?: string;
  updated_datetime?: string;
  start_price?: number;
  target_price?: number | null;
  buy_range_start?: number | null; // technical only
  buy_range_end?: number | null; // technical only
  take_profit_price?: number | null; // technical only
  close_price?: number | null;
  close_datetime?: string | null;
  close_index_price?: number | null;
  start_index_price?: number;
  index?: string;
  read_time?: number | null; // fundamental only
  asset?: AssetInfo;
  // price = current market price (live feed)
  price?: number;
  index_price?: number;
  // Rich content
  the_story?: ContentfulDocument | null;
  updates?: UpdateItem[];
  experts?: ExpertInfo[];
}

// ─── Formatted Output Types (what tool handlers return to the AI) ─────────────

export interface StorySection {
  raw: RichTextContent;
  text: string;
}

export interface PerformanceSection {
  start_price?: number;
  current_price?: number;
  target_price?: number | null;
  buy_range?: { start: number; end: number };
  take_profit_price?: number | null;
  close_price?: number | null;
  index?: string;
  index_price?: number;
}

export interface FormattedUpdate {
  id?: string;
  title: string;
  datetime: string;
  action?: string;
  target_price?: number | null;
  stop_loss?: number | null;
  summary: string;
}

export interface CallDetailsResponse {
  id: string;
  type: string; // "fundamental" | "technical"
  title: string;
  status: string;
  action?: string; // unified field (action or recommended_action)
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
}

// ─── Latest Release Type ─────────────────────────────────────────────────────

export interface LatestRelease {
  title?: string;
  parent_id?: string;
  update_id?: string;
  update_datetime?: string;
  parent_type?: string;
  read_time?: string | null;
  watch_time?: string | null;
  short_description?: string;
  thumbnail_image?: string;
  link_to?: string | null;
  authors?: Array<{
    id: string;
    image?: string;
    nickname?: string;
  }>;
}

// ─── API Parameters ──────────────────────────────────────────────────────────

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
