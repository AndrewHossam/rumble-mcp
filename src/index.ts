#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { zodToJsonSchema } from './utils/zod-to-json.js';
import { RumbleClient } from './api/client.js';
import { fundamentalToolSchemas, handleFundamentalTool } from './tools/fundamental.js';
import { technicalToolSchemas, handleTechnicalTool } from './tools/technical.js';
import { assetToolSchemas, handleAssetTool } from './tools/assets.js';
import { callDetailsToolSchemas, handleCallDetailsTool } from './tools/call-details.js';

// Load environment variables
config();

const FIREBASE_TOKEN = process.env.RUMBLE_FIREBASE_TOKEN;
const REFRESH_TOKEN = process.env.RUMBLE_REFRESH_TOKEN;
const DEFAULT_MARKET = process.env.RUMBLE_MARKET || 'EGY';

if (!FIREBASE_TOKEN) {
  console.error('Error: RUMBLE_FIREBASE_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize Rumble API client
const client = new RumbleClient(
  FIREBASE_TOKEN,
  DEFAULT_MARKET,
  undefined,
  undefined,
  REFRESH_TOKEN
);

// Create MCP server
const server = new Server(
  {
    name: 'rumble-mcp-server',
    version: '1.4.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Combine all tool schemas
const allToolSchemas = {
  ...fundamentalToolSchemas,
  ...technicalToolSchemas,
  ...assetToolSchemas,
  ...callDetailsToolSchemas,
};

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(allToolSchemas).map(([name, schema]) => ({
      name,
      description: schema.description,
      inputSchema: zodToJsonSchema(schema.inputSchema),
    })),
  };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    if (name in callDetailsToolSchemas) {
      result = await handleCallDetailsTool(client, name, args);
    } else if (name in fundamentalToolSchemas) {
      result = await handleFundamentalTool(client, name, args);
    } else if (name in technicalToolSchemas) {
      result = await handleTechnicalTool(client, name, args);
    } else if (name in assetToolSchemas) {
      result = await handleAssetTool(client, name, args);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Rumble MCP Server running on stdio');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
