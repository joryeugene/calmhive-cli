# 🔧 MCP Tools Setup Guide for Calmhive

Calmhive leverages 70+ powerful MCP (Model Context Protocol) tools to provide advanced AI capabilities. This guide will help you set up the essential tools.

## 📋 Prerequisites

- **Claude Code CLI** installed and configured
- **Claude Desktop** installed (for easy MCP configuration)
- **API keys** for specific services (see below)

> **💡 Note**: MCP tools integrate with Claude Code CLI. Some tools require their own API keys (like search engines).

## 🚀 Quick Setup

The easiest way to set up MCP tools is through Claude Desktop:

1. **Install Claude Desktop** and configure your MCP tools there
2. **Import to Claude CLI**: 
   ```bash
   claude mcp add-from-claude-desktop -s user
   ```
3. **Verify setup**: 
   ```bash
   calmhive chat "test sequential thinking"
   ```

## 🔑 Essential MCP Tools

### 1. **Sequential Thinking Tools** (HIGHLY RECOMMENDED)
Advanced problem-solving through structured reasoning.

**GitHub**: https://github.com/spences10/mcp-sequentialthinking-tools

**Setup**:
```json
{
  "sequentialthinking": {
    "command": "npx",
    "args": ["-y", "mcp-sequentialthinking-tools"]
  }
}
```

### 2. **OmniSearch** (RECOMMENDED) 
Multi-engine search capabilities for research and information gathering.

**GitHub**: https://github.com/spences10/mcp-omnisearch

**Setup** (requires API keys):
```json
{
  "omnisearch": {
    "command": "npx",
    "args": ["-y", "mcp-omnisearch"],
    "env": {
      "TAVILY_API_KEY": "tvly-YOUR_KEY_HERE",
      "PERPLEXITY_API_KEY": "pplx-YOUR_KEY_HERE"
    }
  }
}
```

**Get API Keys**:
- Tavily: https://tavily.com (free tier available)
- Perplexity: https://www.perplexity.ai/settings/api (requires subscription)

### 3. **Playwright** (Browser Automation)
Automated browser testing and web scraping capabilities.

**GitHub**: https://github.com/automatalabs/mcp-server-playwright

**Setup**:
```json
{
  "playwright": {
    "command": "npx",
    "args": ["-y", "@automatalabs/mcp-server-playwright"]
  }
}
```

**Features**:
- Navigate websites, take screenshots
- Fill forms, click elements  
- Extract data from web pages
- Test web applications

### 4. **GitHub** (Code Integration)
Access to GitHub repositories and code search.

**Setup**:
```json
{
  "github": {
    "command": "docker",
    "args": [
      "run", "-i", "--rm", 
      "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
      "ghcr.io/github/github-mcp-server"
    ],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
    }
  }
}
```

**Get GitHub Token**: 
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: repo, read:org

## 📝 Example Configuration File

Save this as `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sequentialthinking": {
      "command": "npx",
      "args": ["-y", "mcp-sequentialthinking-tools"]
    },
    "omnisearch": {
      "command": "npx",
      "args": ["-y", "mcp-omnisearch"],
      "env": {
        "TAVILY_API_KEY": "tvly-EXAMPLE_KEY_REPLACE_ME",
        "PERPLEXITY_API_KEY": "pplx-EXAMPLE_KEY_REPLACE_ME"
      }
    },
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_EXAMPLE_TOKEN_REPLACE_ME"
      }
    },
    "gitmcp": {
      "command": "npx",
      "args": ["mcp-remote", "https://gitmcp.io/docs"]
    },
    "Context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@automatalabs/mcp-server-playwright"]
    },
    "figma": {
      "command": "npx",
      "args": [
        "-y", "figma-developer-mcp",
        "--figma-api-key=figd_EXAMPLE_KEY_REPLACE_ME",
        "--stdio"
      ]
    },
    "shadcn-ui": {
      "command": "npx",
      "args": ["-y", "shadcn-ui-mcp-server"]
    }
  }
}
```

## ⚠️ Important Notes

1. **Replace all example keys** with your actual API keys
2. **Keep your API keys secure** - never commit them to version control
3. **Some tools require paid services** (e.g., Perplexity API, OpenAI)
4. **Start with essentials**: Sequential Thinking and OmniSearch are the most important

## 🧪 Testing Your Setup

After configuration, test each tool:

```bash
# Test Sequential Thinking
calmhive chat "use sequential thinking to solve: how to implement a rate limiter"

# Test OmniSearch
calmhive chat "search for the latest React 19 features"

# Test Memento (if configured)
calmhive chat "remember that my favorite framework is Next.js"
calmhive chat "what is my favorite framework?"
```

## 🆘 Troubleshooting

**"Tool not found" errors**: 
- Ensure Claude Desktop has the tool configured
- Run `claude mcp add-from-claude-desktop -s user` again

**API key errors**:
- Double-check your API keys are valid
- Ensure they have proper permissions

**Docker errors (GitHub tool)**:
- Make sure Docker is installed and running
- Alternative: Use GitMCP instead of GitHub MCP

## 📚 Additional Resources

- **MCP Documentation**: https://modelcontextprotocol.io/
- **Claude Desktop Setup**: https://docs.anthropic.com/en/docs/claude-desktop
- **Terminal Velocity Guide**: https://github.com/joryeugene/ai-dev-tooling/blob/main/blog/02-terminal-velocity.md#must-use-mcp-tools-amplify-your-ai

---

**Pro Tip**: You can customize which tools are available by editing `config/allowed-tools.json` in the Calmhive directory, but the default 86 tools (15 core + 71 MCP integrations) should cover most use cases!