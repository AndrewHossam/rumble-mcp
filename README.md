# Rumble MCP

[![CI](https://github.com/AndrewHossam/rumble-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/AndrewHossam/rumble-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/rumble-mcp.svg)](https://www.npmjs.com/package/rumble-mcp)
[![npm downloads](https://img.shields.io/npm/dm/rumble-mcp.svg)](https://www.npmjs.com/package/rumble-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ⚠️ **Disclaimer**: This tool requires a valid subscription to [TheRumble.app](https://therumble.app). It is intended for **personal use only**. Any misuse of this tool is not the responsibility of the developer. By using this tool, you agree to comply with TheRumble's terms of service.

An MCP (Model Context Protocol) server that provides AI assistants with access to [TheRumble.app](https://therumble.app) investment research data for the Egyptian stock market (EGX).

## Quick Install

<!-- Install buttons for popular IDEs -->
<p align="center">
  <a href="https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22rumble%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22rumble-mcp%22%5D%7D">
    <img src="https://img.shields.io/badge/VS_Code-Install_MCP-0078d4?style=for-the-badge&logo=visual-studio-code" alt="Install in VS Code">
  </a>
  <a href="cursor://anysphere.cursor-deeplink/mcp/install?name=rumble&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJydW1ibGUtbWNwIl19">
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
git clone https://github.com/AndrewHossam/rumble-mcp.git
cd rumble-mcp
npm install && npm run build
npm link  # Makes 'rumble-mcp' globally available
```

---

## Getting Your Credentials

TheRumble uses Firebase authentication. To prevent your token from expiring every hour, you should use both an ID token and a Refresh token.

Run the helper script to get both:

```bash
npx rumble-mcp extract-token
# OR inside the project
npm run extract-token
```

Paste the generated script into your browser console on [therumble.app](https://therumble.app). It will give you the `.env` content to copy.

**Why use a refresh token?**
- Without it: Credentials expire in 1 hour
- With it: The MCP auto-refreshes your session indefinitely 🚀

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
          "RUMBLE_FIREBASE_TOKEN": "your_firebase_token",
          "RUMBLE_REFRESH_TOKEN": "your_refresh_token",
          "RUMBLE_MARKET": "EGY"
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
      "RUMBLE_FIREBASE_TOKEN": "your_firebase_token",
      "RUMBLE_REFRESH_TOKEN": "your_refresh_token",
      "RUMBLE_MARKET": "EGY"
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
        "RUMBLE_FIREBASE_TOKEN": "your_firebase_token",
        "RUMBLE_REFRESH_TOKEN": "your_refresh_token",
        "RUMBLE_MARKET": "EGY"
      }
    }
  }
}
```

### <img src="https://www.anthropic.com/favicon.ico" width="20"> Claude Code (Anthropic)

```bash
claude mcp add rumble -- npx rumble-mcp
```

Then set your tokens:
```bash
export RUMBLE_FIREBASE_TOKEN="your_firebase_token"
export RUMBLE_REFRESH_TOKEN="your_refresh_token"
export RUMBLE_MARKET="EGY"  # Optional, defaults to EGY
```

### 🤖 Other AI Clients (Windsurf, Continue, etc.)

Most MCP-compatible clients follow a similar pattern:

```json
{
  "name": "rumble",
  "command": "npx",
  "args": ["rumble-mcp"],
  "env": {
    "RUMBLE_FIREBASE_TOKEN": "your_firebase_token",
    "RUMBLE_REFRESH_TOKEN": "your_refresh_token",
    "RUMBLE_MARKET": "EGY"
  }
}
```

---

## Available Tools

| Tool | Category | Description |
|------|----------|-------------|
| `get_fundamental_calls` | Discovery | List active fundamental investment calls |
| `get_technical_calls` | Discovery | List active technical trading calls |
| `get_call_details` | Details | Get full details for any call (fundamental/technical) by ID |
| `get_fundamental_track_record`| Insights | Overall fundamental track record (win rate, alpha) |
| `get_technical_track_record` | Insights | Overall technical track record |
| `get_latest_releases` | Insights | Latest content releases |
| `get_rfp_portfolio` | Portfolios | Rumble Fundamental Portfolio (long-term picks) |
| `get_bottom_fisher_portfolio` | Portfolios | Bottom Fisher Portfolio (undervalued stocks) |
| `get_rsp_portfolio` | Portfolios | Rumble Shariah Portfolio (Shariah-compliant) |
| `list_known_portfolios` | Portfolios | List all known portfolio aliases |

### `get_call_details` Usage
*   **Parameters**: `callId` (required), `type` (optional: fundamental/technical), `sections` (optional: `["story", "performance", "updates", "news"]`)
*   **Example**:
    ```json
    {"callId": "call_id_here", "sections": ["performance", "updates"]}
    ```

---

## Example Usage

Once configured, ask your AI assistant:

> "What are the current active fundamental calls on Rumble?"

> "Get full details for call_id_here"

> "Show me just the performance and updates for that symbol"

> "Get the Bottom Fisher portfolio"

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUMBLE_FIREBASE_TOKEN` | ✅ Yes | Your Firebase ID token from therumble.app |
| `RUMBLE_REFRESH_TOKEN` | ✅ Yes | Your Firebase refresh token for auto-renewal |
| `RUMBLE_MARKET` | No | Market code (default: `EGY` for Egypt) |

---

## Development

```bash
# Clone and setup
git clone https://github.com/AndrewHossam/rumble-mcp.git
cd rumble-mcp
npm install

# Development mode (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Developer Workflow & Safety
This project includes automated safety checks to prevent breaking changes:
*   **Pre-commit Hooks**: Automatically builds the project before every commit to catch syntax and type errors.
*   **CI/CD**: GitHub Actions automatically verifies builds and types on every push and pull request.
*   **Publish Safety**: The project is locked to automatically run a fresh build before `npm publish` to ensure users always get the latest code.


---

## Support & Sponsorship

If you find this MCP useful, consider supporting the project:

- **[Support via TipTea](https://www.tiptea.app/#/u/andrewhossam)** (Egypt Local: InstaPay / Vodafone Cash)

## License

MIT © 2026

---

<p align="center">
  Made with ❤️ for the Egyptian investment community
</p>
