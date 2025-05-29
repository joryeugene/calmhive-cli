#!/usr/bin/env python3
"""
CALMHIVE MCP List Tool

This utility provides information about available MCP tools in the Claude system.
It can list all MCPs, display details about specific MCPs, and organize MCPs by category.

Usage:
  calmhive mcp list              # List all available MCP categories
  calmhive mcp list --all        # List all available MCP tools
  calmhive mcp list CATEGORY     # List all tools in a specific category
  calmhive mcp info TOOL_NAME    # Display info about a specific tool
  
Created: May 16, 2025
"""

import os
import sys
import json
import argparse
from pathlib import Path
import logging
import re

# Try importing rich for nicer output
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.markdown import Markdown
    console = Console()
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Rich library not available, using basic output formatting")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("calmhive_mcp")

# MCP data structure
# This structured data represents all available MCPs and their tools
MCP_DATA = {
    "memento": {
        "description": "Knowledge graph memory system for persistent knowledge storage and retrieval",
        "tools": {
            "mcp__memento__create_entities": "Create multiple new entities in your knowledge graph",
            "mcp__memento__create_relations": "Create multiple new relations between entities",
            "mcp__memento__add_observations": "Add new observations to existing entities",
            "mcp__memento__delete_entities": "Delete multiple entities and their associated relations",
            "mcp__memento__delete_observations": "Delete specific observations from entities",
            "mcp__memento__delete_relations": "Delete multiple relations from your knowledge graph",
            "mcp__memento__get_relation": "Get a specific relation with its enhanced properties",
            "mcp__memento__update_relation": "Update an existing relation with enhanced properties",
            "mcp__memento__read_graph": "Read the entire knowledge graph memory system",
            "mcp__memento__search_nodes": "Search for nodes based on a query",
            "mcp__memento__open_nodes": "Open specific nodes by their names",
            "mcp__memento__semantic_search": "Search for entities semantically using vector embeddings",
            "mcp__memento__get_entity_embedding": "Get the vector embedding for a specific entity",
            "mcp__memento__get_entity_history": "Get the version history of an entity",
            "mcp__memento__get_relation_history": "Get the version history of a relation",
            "mcp__memento__get_graph_at_time": "Get your knowledge graph as it existed at a specific point in time",
            "mcp__memento__get_decayed_graph": "Get your knowledge graph with confidence values decayed based on time",
            "mcp__memento__force_generate_embedding": "Forcibly generate and store an embedding for an entity",
            "mcp__memento__debug_embedding_config": "Debug tool to check embedding configuration and status",
            "mcp__memento__diagnose_vector_search": "Diagnostic tool to directly query database for entity embeddings"
        }
    },
    "sequentialthinking": {
        "description": "Structured analytical thinking framework with tool recommendations",
        "tools": {
            "mcp__sequentialthinking__sequentialthinking_tools": "A detailed tool for dynamic and reflective problem-solving through thoughts"
        }
    },
    "github": {
        "description": "GitHub repository interaction tools for code and project management",
        "tools": {
            "mcp__github__add_issue_comment": "Add a comment to an existing issue",
            "mcp__github__add_pull_request_review_comment": "Add a review comment to a pull request",
            "mcp__github__create_branch": "Create a new branch in a GitHub repository",
            "mcp__github__create_issue": "Create a new issue in a GitHub repository",
            "mcp__github__create_or_update_file": "Create or update a single file in a GitHub repository",
            "mcp__github__create_pull_request": "Create a new pull request in a GitHub repository",
            "mcp__github__create_pull_request_review": "Create a review on a pull request",
            "mcp__github__create_repository": "Create a new GitHub repository in your account",
            "mcp__github__fork_repository": "Fork a GitHub repository to your account or specified organization",
            "mcp__github__get_code_scanning_alert": "Get details of a specific code scanning alert",
            "mcp__github__get_commit": "Get details for a commit from a GitHub repository",
            "mcp__github__get_file_contents": "Get the contents of a file or directory from a GitHub repository",
            "mcp__github__get_issue": "Get details of a specific issue in a GitHub repository",
            "mcp__github__get_issue_comments": "Get comments for a GitHub issue",
            "mcp__github__get_me": "Get details of the authenticated GitHub user",
            "mcp__github__get_pull_request": "Get details of a specific pull request",
            "mcp__github__get_pull_request_comments": "Get the review comments on a pull request",
            "mcp__github__get_pull_request_files": "Get the list of files changed in a pull request",
            "mcp__github__get_pull_request_reviews": "Get the reviews on a pull request",
            "mcp__github__get_pull_request_status": "Get the combined status of all status checks for a pull request",
            "mcp__github__get_secret_scanning_alert": "Get details of a specific secret scanning alert",
            "mcp__github__list_branches": "List branches in a GitHub repository",
            "mcp__github__list_code_scanning_alerts": "List code scanning alerts in a GitHub repository",
            "mcp__github__list_commits": "Get list of commits of a branch in a GitHub repository",
            "mcp__github__list_issues": "List issues in a GitHub repository with filtering options",
            "mcp__github__list_pull_requests": "List and filter repository pull requests",
            "mcp__github__list_secret_scanning_alerts": "List secret scanning alerts in a GitHub repository",
            "mcp__github__merge_pull_request": "Merge a pull request",
            "mcp__github__push_files": "Push multiple files to a GitHub repository in a single commit",
            "mcp__github__search_code": "Search for code across GitHub repositories",
            "mcp__github__search_issues": "Search for issues and pull requests across GitHub repositories",
            "mcp__github__search_repositories": "Search for GitHub repositories",
            "mcp__github__search_users": "Search for GitHub users",
            "mcp__github__update_issue": "Update an existing issue in a GitHub repository",
            "mcp__github__update_pull_request": "Update an existing pull request in a GitHub repository",
            "mcp__github__update_pull_request_branch": "Update a pull request branch with the latest changes from the base branch"
        }
    },
    "gitmcp": {
        "description": "GitHub repository documentation and code search tools",
        "tools": {
            "mcp__gitmcp__match_common_libs_owner_repo_mapping": "Match a library name to an owner/repo",
            "mcp__gitmcp__fetch_generic_documentation": "Fetch documentation for any GitHub repository",
            "mcp__gitmcp__search_generic_documentation": "Semantically search in documentation for any GitHub repository",
            "mcp__gitmcp__search_generic_code": "Search for code in any GitHub repository",
            "mcp__gitmcp__fetch_generic_url_content": "Generic tool to fetch content from any absolute URL"
        }
    },
    "context7": {
        "description": "Library documentation lookup and retrieval tools",
        "tools": {
            "mcp__context7__resolve-library-id": "Resolves a package name to a Context7-compatible library ID",
            "mcp__context7__get-library-docs": "Fetches up-to-date documentation for a library"
        }
    },
    "omnisearch": {
        "description": "Web search capabilities using various search engines",
        "tools": {
            "mcp__omnisearch__tavily_search": "Search the web using Tavily Search API",
            "mcp__omnisearch__perplexity_search": "AI-powered response generation combining real-time web search",
            "mcp__omnisearch__tavily_extract_process": "Extract web page content from single or multiple URLs"
        }
    },
    "playwright": {
        "description": "Browser automation for web interactions and testing",
        "tools": {
            "mcp__playwright__browser_navigate": "Navigate to a URL",
            "mcp__playwright__browser_screenshot": "Take a screenshot of the current page or a specific element",
            "mcp__playwright__browser_click": "Click an element on the page using CSS selector",
            "mcp__playwright__browser_click_text": "Click an element on the page by its text content",
            "mcp__playwright__browser_fill": "Fill out an input field",
            "mcp__playwright__browser_select": "Select an element on the page with Select tag using CSS selector",
            "mcp__playwright__browser_select_text": "Select an element on the page with Select tag by its text content",
            "mcp__playwright__browser_hover": "Hover an element on the page using CSS selector",
            "mcp__playwright__browser_hover_text": "Hover an element on the page by its text content",
            "mcp__playwright__browser_evaluate": "Execute JavaScript in the browser console"
        }
    },
    "figma": {
        "description": "Figma design file interaction and asset extraction",
        "tools": {
            "mcp__figma__get_figma_data": "When the nodeId cannot be obtained, obtain the layout information about the entire Figma file",
            "mcp__figma__download_figma_images": "Download SVG and PNG images used in a Figma file"
        }
    },
    "shadcn-ui": {
        "description": "UI component library tools for Shadcn UI",
        "tools": {
            "mcp__shadcn-ui__list_shadcn_components": "Get a list of all available shadcn/ui components",
            "mcp__shadcn-ui__get_component_details": "Get detailed information about a specific shadcn/ui component",
            "mcp__shadcn-ui__get_component_examples": "Get usage examples for a specific shadcn/ui component",
            "mcp__shadcn-ui__search_components": "Search for shadcn/ui components by keyword"
        }
    },
    "asana": {
        "description": "Asana project management integration",
        "tools": {
            "mcp__asana__asana_list_workspaces": "List all available workspaces in Asana",
            "mcp__asana__asana_search_projects": "Search for projects in Asana using name pattern matching",
            "mcp__asana__asana_get_project": "Get detailed information about a specific project",
            "mcp__asana__asana_get_project_task_counts": "Get the number of tasks in a project",
            "mcp__asana__asana_get_project_sections": "Get sections in a project",
            "mcp__asana__asana_create_section_for_project": "Create a new section in a project",
            "mcp__asana__asana_create_project": "Create a new project in a workspace",
            "mcp__asana__asana_update_project": "Update details of an existing project",
            "mcp__asana__asana_reorder_sections": "Reorder a section within a project",
            "mcp__asana__asana_get_project_status": "Get a project status update",
            "mcp__asana__asana_get_project_statuses": "Get all status updates for a project",
            "mcp__asana__asana_create_project_status": "Create a new status update for a project",
            "mcp__asana__asana_delete_project_status": "Delete a project status update",
            "mcp__asana__asana_search_tasks": "Search tasks in a workspace with advanced filtering options",
            "mcp__asana__asana_get_task": "Get detailed information about a specific task",
            "mcp__asana__asana_create_task": "Create a new task in a project",
            "mcp__asana__asana_update_task": "Update an existing task's details",
            "mcp__asana__asana_create_subtask": "Create a new subtask for an existing task",
            "mcp__asana__asana_get_multiple_tasks_by_gid": "Get detailed information about multiple tasks by their GIDs",
            "mcp__asana__asana_add_task_to_section": "Add a task to a specific section in a project",
            "mcp__asana__asana_get_tasks_for_section": "Get all tasks from a specific section in a project",
            "mcp__asana__asana_get_project_hierarchy": "Get the complete hierarchical structure of an Asana project",
            "mcp__asana__asana_get_subtasks_for_task": "Get the list of subtasks for a specific task",
            "mcp__asana__asana_get_tasks_for_project": "Get all tasks from a specific project",
            "mcp__asana__asana_get_tasks_for_tag": "Get tasks for a specific tag",
            "mcp__asana__asana_get_tags_for_workspace": "Get tags in a workspace",
            "mcp__asana__asana_add_tags_to_task": "Add one or more tags to a task",
            "mcp__asana__asana_add_task_dependencies": "Set dependencies for a task",
            "mcp__asana__asana_add_task_dependents": "Set dependents for a task",
            "mcp__asana__asana_set_parent_for_task": "Set the parent of a task",
            "mcp__asana__asana_add_followers_to_task": "Add followers to a task",
            "mcp__asana__asana_get_task_stories": "Get comments and stories for a specific task",
            "mcp__asana__asana_create_task_story": "Create a comment or story on a task",
            "mcp__asana__asana_get_teams_for_user": "Get teams to which the user has access",
            "mcp__asana__asana_get_teams_for_workspace": "Get teams in a workspace",
            "mcp__asana__asana_add_members_for_project": "Add members to a project",
            "mcp__asana__asana_add_followers_for_project": "Add followers to a project",
            "mcp__asana__asana_list_workspace_users": "Get users in a workspace"
        }
    }
}

def list_categories():
    """List all available MCP categories"""
    log.info("Listing all MCP categories")
    
    if RICH_AVAILABLE:
        table = Table(title="Available MCP Categories")
        table.add_column("Category", style="bold cyan")
        table.add_column("Description", style="green")
        table.add_column("Tools", style="blue")
        
        for category, data in sorted(MCP_DATA.items()):
            table.add_row(
                category,
                data["description"],
                str(len(data["tools"]))
            )
            
        console.print(table)
    else:
        print("\nAvailable MCP Categories:")
        print("-------------------------")
        for category, data in sorted(MCP_DATA.items()):
            print(f"- {category}: {len(data['tools'])} tools")
            print(f"  {data['description']}")
            print()

def list_all_tools():
    """List all available MCP tools across all categories"""
    log.info("Listing all MCP tools")
    
    total_tools = 0
    for category in MCP_DATA.values():
        total_tools += len(category["tools"])
    
    if RICH_AVAILABLE:
        table = Table(title=f"All Available MCP Tools ({total_tools} total)")
        table.add_column("Tool Name", style="bold cyan")
        table.add_column("Category", style="blue")
        table.add_column("Description", style="green")
        
        for category_name, category_data in sorted(MCP_DATA.items()):
            for tool_name, tool_desc in sorted(category_data["tools"].items()):
                table.add_row(
                    tool_name,
                    category_name,
                    tool_desc
                )
                
        console.print(table)
    else:
        print(f"\nAll Available MCP Tools ({total_tools} total):")
        print("--------------------------------------")
        
        for category_name, category_data in sorted(MCP_DATA.items()):
            print(f"\n## {category_name.upper()} ##")
            for tool_name, tool_desc in sorted(category_data["tools"].items()):
                print(f"- {tool_name}")
                print(f"  {tool_desc}")
                print()

def list_category_tools(category):
    """List all tools in a specific category"""
    category = category.lower()
    
    if category not in MCP_DATA:
        log.error(f"Category not found: {category}")
        print(f"Error: Category '{category}' not found.")
        print("Available categories:")
        for cat_name in sorted(MCP_DATA.keys()):
            print(f"- {cat_name}")
        return False
    
    log.info(f"Listing tools for category: {category}")
    category_data = MCP_DATA[category]
    
    if RICH_AVAILABLE:
        table = Table(title=f"{category.upper()} MCP Tools")
        table.add_column("Tool Name", style="bold cyan")
        table.add_column("Description", style="green")
        
        for tool_name, tool_desc in sorted(category_data["tools"].items()):
            table.add_row(tool_name, tool_desc)
            
        console.print(Panel(f"[bold]{category.upper()}[/bold]: {category_data['description']}"))
        console.print(table)
    else:
        print(f"\n{category.upper()} MCP Tools:")
        print(f"Description: {category_data['description']}")
        print("-" * (len(category) + 14))
        
        for tool_name, tool_desc in sorted(category_data["tools"].items()):
            print(f"- {tool_name}")
            print(f"  {tool_desc}")
            print()
            
    return True

def show_tool_info(tool_name):
    """Show detailed information about a specific tool"""
    # Check if tool exists and which category it belongs to
    found = False
    category_name = None
    tool_description = None
    
    for cat_name, cat_data in MCP_DATA.items():
        if tool_name in cat_data["tools"]:
            found = True
            category_name = cat_name
            tool_description = cat_data["tools"][tool_name]
            break
    
    if not found:
        log.error(f"Tool not found: {tool_name}")
        print(f"Error: Tool '{tool_name}' not found.")
        return False
    
    log.info(f"Showing information for tool: {tool_name}")
    
    # Extract module and function name from tool name
    parts = tool_name.split("__")
    if len(parts) >= 3:
        module_name = parts[1]
        function_name = parts[2]
    else:
        module_name = "unknown"
        function_name = "unknown"
    
    if RICH_AVAILABLE:
        console.print(Panel(
            f"[bold cyan]{tool_name}[/bold cyan]\n\n"
            f"[bold]Category:[/bold] {category_name}\n"
            f"[bold]Module:[/bold] {module_name}\n"
            f"[bold]Function:[/bold] {function_name}\n\n"
            f"[bold]Description:[/bold]\n{tool_description}",
            title="Tool Information",
            expand=False
        ))
    else:
        print(f"\nTool Information: {tool_name}")
        print("-" * (len(tool_name) + 18))
        print(f"Category: {category_name}")
        print(f"Module: {module_name}")
        print(f"Function: {function_name}")
        print(f"Description: {tool_description}")
        print()
    
    # Also show other tools in the same category
    if RICH_AVAILABLE:
        console.print("[bold]Other tools in the same category:[/bold]")
    else:
        print("Other tools in the same category:")
    
    for other_tool in sorted(MCP_DATA[category_name]["tools"].keys()):
        if other_tool != tool_name:
            if RICH_AVAILABLE:
                console.print(f"- [cyan]{other_tool}[/cyan]")
            else:
                print(f"- {other_tool}")
    
    return True

def main():
    """Main entry point for the tool"""
    parser = argparse.ArgumentParser(description="CALMHIVE MCP List Tool")
    
    # Define command-line arguments
    parser.add_argument("command", nargs="?", default="list",
                       help="Command to run (list, info)")
    parser.add_argument("parameter", nargs="?",
                       help="Parameter for the command (category name or tool name)")
    parser.add_argument("--all", action="store_true",
                       help="List all tools across all categories")
    parser.add_argument("--debug", action="store_true",
                       help="Enable debug logging")
    
    args = parser.parse_args()
    
    # Set log level based on debug flag
    if args.debug:
        log.setLevel(logging.DEBUG)
        log.debug("Debug logging enabled")
    
    # Process command
    if args.command == "list":
        if args.all:
            list_all_tools()
        elif args.parameter:
            list_category_tools(args.parameter)
        else:
            list_categories()
    elif args.command == "info":
        if not args.parameter:
            log.error("Tool name parameter required for 'info' command")
            print("Error: Tool name parameter required for 'info' command")
            return 1
        show_tool_info(args.parameter)
    else:
        log.error(f"Unknown command: {args.command}")
        print(f"Error: Unknown command '{args.command}'")
        print("Available commands: list, info")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())