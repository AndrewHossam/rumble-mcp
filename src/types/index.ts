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

/**
 * The API serializes expert market codes inconsistently: sometimes plain
 * strings ("EGY"), sometimes the same string exploded into a char map
 * ({"0":"E","1":"G","2":"Y"}). Only index-to-single-char maps are recognized
 * and reassembled; any other shape passes through unchanged and fails
 * validation loudly instead of fabricating a string.
 */
const MarketCodeSchema = z.preprocess(val => {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const entries = Object.entries(val as Record<string, unknown>);
    const isCharMap =
      entries.length > 0 &&
      entries.every(([key, char]) => {
        const index = Number(key);
        return (
          Number.isInteger(index) &&
          index >= 0 &&
          String(index) === key &&
          typeof char === 'string' &&
          char.length === 1
        );
      });
    if (isCharMap) {
      return entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, char]) => char)
        .join('');
    }
  }
  return val;
}, z.string());

// Expert / Analyst object
export const ExpertInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().optional(),
  type: z.string().optional(), // e.g. "FUNDAMENTAL_ANALYST", "TECHNICAL_ANALYST"
  image: z.string().optional(),
  markets: z.array(MarketCodeSchema).optional(),
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

// ─── Call Detail Schemas (for /api/fundamental-calls/:id and /api/technical-calls/:id) ─

/**
 * Schema for individual update items within a call detail response.
 * content / the_story are kept as z.unknown() because they are recursive
 * rich-text documents — their TS types are preserved via the intersection below.
 */
export const UpdateItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  datetime: z.string(),
  // The API returns null for updates without an explicit action
  action: z.string().nullable().optional(),
  target_price: z.number().nullable().optional(),
  take_profit_price: z.number().nullable().optional(),
  stop_loss: z.number().nullable().optional(),
  sell_percentage: z.number().nullable().optional(),
  sell_price: z.number().nullable().optional(),
  first_published_at: z.string().optional(),
  last_published_at: z.string().optional(),
  parent_id: z.string().optional(),
  content: z.unknown().optional(),
  the_story: z.unknown().nullable().optional(),
});

export const CallDetailsSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
  recommended_action: z.string().optional(),
  action: z.string().optional(),
  published_datetime: z.string().optional(),
  updated_datetime: z.string().optional(),
  start_price: z.number().optional(),
  target_price: z.number().nullable().optional(),
  buy_range_start: z.number().nullable().optional(),
  buy_range_end: z.number().nullable().optional(),
  take_profit_price: z.number().nullable().optional(),
  close_price: z.number().nullable().optional(),
  close_datetime: z.string().nullable().optional(),
  close_index_price: z.number().nullable().optional(),
  start_index_price: z.number().optional(),
  index: z.string().optional(),
  read_time: z.number().nullable().optional(),
  asset: AssetInfoSchema.optional(),
  price: z.number().optional(),
  index_price: z.number().optional(),
  the_story: z.unknown().nullable().optional(),
  updates: z.array(UpdateItemSchema).optional(),
  experts: z.array(ExpertInfoSchema).optional(),
});

// ─── Call Detail Types (from /api/fundamental-calls/:id?expert_tool_table=true) ──

/**
 * Intersection preserves the recursive RumbleRichTextDocument / ContentfulDocument
 * TS types for downstream consumers while Zod validates the surrounding shape.
 */
export type UpdateItem = Omit<z.infer<typeof UpdateItemSchema>, 'content' | 'the_story'> & {
  content?: RumbleRichTextDocument;
  the_story?: ContentfulDocument | null;
};

/**
 * Intersection overrides the z.unknown() rich-text fields with their proper recursive TS types.
 * The `updates` array is also overridden so elements satisfy UpdateItem (not the raw schema type).
 */
export type CallDetails = Omit<z.infer<typeof CallDetailsSchema>, 'the_story' | 'updates'> & {
  the_story?: ContentfulDocument | null;
  updates?: UpdateItem[];
};

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
  // null when the API has no explicit action for an update
  action?: string | null;
  target_price?: number | null;
  stop_loss?: number | null;
  summary: string;
}

export interface CallDetailsResponse {
  id: string;
  type: string; // "fundamental" | "technical"
  title: string;
  status: string; // defaults to 'unknown' when API omits it
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

// ─── Latest Release Schema & Type ────────────────────────────────────────────

export const LatestReleaseSchema = z.object({
  title: z.string().optional(),
  parent_id: z.string().optional(),
  update_id: z.string().optional(),
  update_datetime: z.string().optional(),
  parent_type: z.string().optional(),
  read_time: z.string().nullable().optional(),
  // The API returns watch_time as either a string or a number depending on the record
  watch_time: z.union([z.string(), z.number()]).nullable().optional(),
  short_description: z.string().optional(),
  thumbnail_image: z.string().optional(),
  link_to: z.string().nullable().optional(),
  authors: z
    .array(
      z.object({
        id: z.string(),
        image: z.string().optional(),
        nickname: z.string().optional(),
      })
    )
    .optional(),
});

export type LatestRelease = z.infer<typeof LatestReleaseSchema>;

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
