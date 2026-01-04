# Rumble MCP

[![npm version](https://img.shields.io/npm/v/rumble-mcp.svg)](https://www.npmjs.com/package/rumble-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that provides AI assistants with access to [TheRumble.app](https://therumble.app) investment research data for the Egyptian stock market (EGX).

## Quick Install

<!-- Install buttons for popular IDEs -->
<p align="center">
  <a href="https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22rumble%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22rumble-mcp%22%5D%7D">
    <img src="https://img.shields.io/badge/VS_Code-Install_MCP-0078d4?style=for-the-badge&logo=visual-studio-code" alt="Install in VS Code">
  </a>
  <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=rumble&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22rumble-mcp%22%5D%7D">
    <img src="https://img.shields.io/badge/Cursor-Install_MCP-000000?style=for-the-badge&logo=cursor" alt="Install in Cursor">
  </a>
</p>

## Features

| Feature | Description |
|---------|-------------|
| 📈 **Fundamental Calls** | Long-term investment recommendations with target prices, analyst ratings, and performance metrics |
| 📊 **Technical Calls** | Short-term trading signals with entry, target, and stop-loss prices |
| 🏆 **Track Records** | Historical performance and alpha vs EGX30 benchmark |
| 📋 **Asset Lists** | Curated portfolios: RFP, Bottom Fisher, and RTP |

## Installation

### Option 1: npx (No Installation Required)
```bash
npx rumble-mcp
```

### Option 2: Global Install
```bash
npm install -g rumble-mcp
```

### Option 3: From Source
```bash
git clone https://github.com/yourusername/rumble-mcp.git
cd rumble-mcp
npm install && npm run build
npm link  # Makes 'rumble-mcp' globally available
```

---

## Getting Your Auth Token

TheRumble requires a Firebase authentication token. Run the helper script:

```bash
npx rumble-mcp && npm run extract-token
```

Or paste this in your browser console on [therumble.app](https://therumble.app) (while logged in):

```javascript
JSON.parse(localStorage.getItem('auth-store')).state.firebase_token
```

---

## IDE & AI Client Setup

### <img src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg" width="20"> VS Code / VS Code Insiders

1. Click the **Install in VS Code** button above, or
2. Open Settings (`Cmd+,`) → search "MCP" → Add server configuration:

```json
{
  "mcp": {
    "servers": {
      "rumble": {
        "command": "npx",
        "args": ["rumble-mcp"],
        "env": {
          "RUMBLE_FIREBASE_TOKEN": "your_token_here"
        }
      }
    }
  }
}
```

### <img src="https://www.cursor.com/favicon.ico" width="20"> Cursor

1. Click the **Install in Cursor** button above, or
2. Go to **Settings** → **MCP Servers** → Add:

```json
{
  "rumble": {
    "command": "npx",
    "args": ["rumble-mcp"],
    "env": {
      "RUMBLE_FIREBASE_TOKEN": "your_token_here"
    }
  }
}
```

### <img src="https://www.anthropic.com/favicon.ico" width="20"> Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "rumble": {
      "command": "npx",
      "args": ["rumble-mcp"],
      "env": {
        "RUMBLE_FIREBASE_TOKEN": "your_token_here"
      }
    }
  }
}
```

### <img src="https://www.anthropic.com/favicon.ico" width="20"> Claude Code (Anthropic)

```bash
claude mcp add rumble -- npx rumble-mcp
```

Then set your token:
```bash
export RUMBLE_FIREBASE_TOKEN="your_token_here"
```

### 🤖 Other AI Clients (Windsurf, Continue, etc.)

Most MCP-compatible clients follow a similar pattern:

```json
{
  "name": "rumble",
  "command": "npx",
  "args": ["rumble-mcp"],
  "env": {
    "RUMBLE_FIREBASE_TOKEN": "your_token_here"
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `get_fundamental_calls` | List active fundamental investment calls |
| `get_fundamental_track_record` | Get overall fundamental track record |
| `get_latest_releases` | Get latest content releases |
| `get_technical_calls` | List active technical trading calls |
| `get_technical_track_record` | Get overall technical track record |
| `get_asset_list` | Get a curated portfolio by ID or alias |
| `list_known_portfolios` | List all known portfolio aliases |

### Portfolio Aliases

| Alias | Portfolio |
|-------|-----------|
| `rfp-egx` | Rumble Fundamental Portfolio (long-term picks) |
| `bottom-fisher` | Undervalued stocks with high upside potential |
| `rtp-egx` | Rumble Technical Portfolio (short-term trades) |

---

## Example Usage

Once configured, ask your AI assistant:

> "What are the current active fundamental calls on Rumble?"

> "Show me the track record for technical calls"

> "Get the Bottom Fisher portfolio"

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUMBLE_FIREBASE_TOKEN` | ✅ Yes | Your Firebase auth token from therumble.app |
| `RUMBLE_MARKET` | No | Market code (default: `EGY` for Egypt) |

---

## Development

```bash
# Clone and setup
git clone https://github.com/yourusername/rumble-mcp.git
cd rumble-mcp
npm install

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## Registries

This MCP server can be discovered on:
- [Smithery.ai](https://smithery.ai) - MCP server registry
- [Glama.ai](https://glama.ai/mcp/servers) - MCP marketplace

---

## License

MIT © 2024

---

<p align="center">
  Made with ❤️ for the Egyptian investment community
</p>
