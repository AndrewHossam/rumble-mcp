import { z } from 'zod';
import type { RumbleClient } from '../api/client.js';

// Known asset list IDs
export const KNOWN_LISTS = {
    'rfp-egx': '5L2uHydWyA4BLLa6qLzG3b',      // Rumble Fundamental Portfolio - EGX
    'bottom-fisher': '5YyAHOWssTIyClNZ9PaJ64', // Bottom Fisher (Undervalued)
    'rtp-egx': 'undT2QOpIK9stSeq785tk',        // Rumble Technical Portfolio - EGX
} as const;

export const assetToolSchemas = {
    get_asset_list: {
        description: `Get a curated portfolio/asset list from TheRumble. Known lists: 
- "rfp-egx": Rumble Fundamental Portfolio (long-term picks)
- "bottom-fisher": Undervalued stocks
- "rtp-egx": Rumble Technical Portfolio (trading picks)
Or provide a custom list ID.`,
        inputSchema: z.object({
            listId: z.string().describe('Asset list ID or alias (rfp-egx, bottom-fisher, rtp-egx)'),
        }),
    },
    list_known_portfolios: {
        description: 'List all known curated portfolio IDs and their descriptions.',
        inputSchema: z.object({}),
    },
};

export async function handleAssetTool(
    client: RumbleClient,
    toolName: string,
    args: Record<string, unknown>
): Promise<unknown> {
    switch (toolName) {
        case 'get_asset_list': {
            const params = assetToolSchemas.get_asset_list.inputSchema.parse(args);
            // Resolve alias to ID if provided
            const listId = KNOWN_LISTS[params.listId as keyof typeof KNOWN_LISTS] || params.listId;
            return await client.getAssetList(listId);
        }

        case 'list_known_portfolios': {
            return {
                portfolios: [
                    {
                        alias: 'rfp-egx',
                        id: KNOWN_LISTS['rfp-egx'],
                        name: 'Rumble Fundamental Portfolio - EGX',
                        description: 'Long-term investment picks based on fundamental analysis',
                    },
                    {
                        alias: 'bottom-fisher',
                        id: KNOWN_LISTS['bottom-fisher'],
                        name: 'Bottom Fisher',
                        description: 'Undervalued stocks with high upside potential',
                    },
                    {
                        alias: 'rtp-egx',
                        id: KNOWN_LISTS['rtp-egx'],
                        name: 'Rumble Technical Portfolio - EGX',
                        description: 'Short to medium-term trading picks based on technical analysis',
                    },
                ],
            };
        }

        default:
            throw new Error(`Unknown asset tool: ${toolName}`);
    }
}
