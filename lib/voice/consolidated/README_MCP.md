# CALMHIVE MCP Tools Reference

This document provides information about the MCP (Model Control Protocol) tools available in the CALMHIVE system.

## Overview

CALMHIVE integrates with various MCP tools that provide powerful capabilities for Claude. These tools are organized into categories, each serving a specific purpose.

## Available MCP Categories

| Category | Description | Tool Count |
|----------|-------------|------------|
| **Memento** | Knowledge graph memory system | 20 |
| **GitHub** | GitHub repository interaction | 36 |
| **Playwright** | Browser automation | 10 |
| **Asana** | Project management | 38 |
| **Omnisearch** | Web search capabilities | 3 |
| **Sequential Thinking** | Structured problem-solving | 1 |
| **Figma** | Design file interaction | 2 |
| **Shadcn UI** | UI component access | 4 |
| **Context7** | Library documentation | 2 |
| **GitMCP** | Repository documentation | 5 |

## MCP Command Tool

CALMHIVE provides a dedicated command-line tool to browse and learn about available MCP tools:

```bash
# List all available MCP categories
calmhive mcp list

# List all available MCP tools
calmhive mcp list --all

# List all tools in a specific category
calmhive mcp list memento

# Display information about a specific tool
calmhive mcp info mcp__memento__semantic_search
```

## Key MCP Tool Categories

### 1. Memento

Memento provides a persistent knowledge graph that allows Claude to store and retrieve information across sessions. Key tools include:

- **mcp__memento__create_entities**: Create new entities in your knowledge graph
- **mcp__memento__create_relations**: Create relations between entities
- **mcp__memento__semantic_search**: Search for entities semantically
- **mcp__memento__read_graph**: Read the entire knowledge graph

### 2. Sequential Thinking

This tool enables structured problem-solving with step-by-step reasoning:

- **mcp__sequentialthinking__sequentialthinking_tools**: Dynamic reflective problem-solving

### 3. Playwright

Playwright provides browser automation capabilities:

- **mcp__playwright__browser_navigate**: Navigate to a URL
- **mcp__playwright__browser_screenshot**: Take screenshots
- **mcp__playwright__browser_click**: Click elements on a page

### 4. Omnisearch

These tools provide web search capabilities:

- **mcp__omnisearch__tavily_search**: Search using Tavily API
- **mcp__omnisearch__perplexity_search**: AI-powered search
- **mcp__omnisearch__tavily_extract_process**: Extract web page content

## Installation

The MCP list tool can be installed using the provided installation script:

```bash
# Navigate to the directory
cd ~/.claude/calmhive/lib/voice/consolidated

# Run the installation script
./install_mcp_list.sh
```

## Usage in Claude Code

To use MCP tools in Claude Code, specify them in the `--allowedTools` parameter:

```bash
claude -p "My prompt" --allowedTools "mcp__memento__create_entities,mcp__memento__semantic_search"
```

You can also enable multiple MCP tools in your CLAUDE.md configuration.

## Development

The CALMHIVE MCP List tool is implemented in Python and can be found at:
`~/.claude/calmhive/lib/voice/consolidated/calmhive_mcp_list.py`

To extend with new MCP tools, update the `MCP_DATA` dictionary in the Python script.