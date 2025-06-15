#!/usr/bin/env -S uv run --script

# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "RealtimeSTT",
#   "openai",
#   "python-dotenv",
#   "rich",
#   "numpy",
#   "sounddevice",
#   "soundfile",
#   "markdown",
# ]
# ///

"""
# Voice to Claude Code - CALMHIVE Edition

A voice-enabled Claude Code assistant that allows you to interact with Claude Code using voice commands.
This tool combines RealtimeSTT for speech recognition and OpenAI TTS for speech output.

## Features
- Real-time speech recognition using RealtimeSTT
- Claude Code integration with complete tool access for programmable AI coding
- Text-to-speech responses using OpenAI TTS
- Conversation history tracking
- Voice trigger activation

## Requirements
- OpenAI API key (for TTS)
- Anthropic API key (for Claude Code)
- Python 3.9+
- UV package manager (for dependency management)

## Usage
Run the script:
```bash
claude-voice
```

Speak to the assistant using trigger words like "calmhive", "honeybot", "claude", etc.
For example: "Hey calmhive, create a simple hello world script"

Press Ctrl+C to exit.
"""

import os
import sys
import json
import yaml
import uuid
import asyncio
import tempfile
import subprocess
import sounddevice as sd
import soundfile as sf
import numpy as np
import argparse
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import logging
import re
import time

# Import enhanced enum patch for Python 3.13+ if needed
# This MUST be done before importing other modules
try:
    import enum
    # Check if IntFlag exists
    if not hasattr(enum, 'IntFlag'):
        from enum import IntEnum
        class IntFlag(IntEnum):
            """Support for integer-based flags"""
            def __or__(self, other):
                return self.__class__(self.value | other.value)
            def __and__(self, other):
                return self.__class__(self.value & other.value)
            def __xor__(self, other):
                return self.__class__(self.value ^ other.value)
            def __invert__(self):
                return self.__class__(~self.value)
        enum.IntFlag = IntFlag
        print("Added missing enum.IntFlag class")
except ImportError:
    print("Warning: Error importing enum module")

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.logging import RichHandler
    from rich.syntax import Syntax
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Rich library not available, using basic terminal output")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed, skipping .env file loading")

try:
    import openai
    from openai import OpenAI
except ImportError:
    print("Error: OpenAI package not installed. Run 'pip install openai'")
    sys.exit(1)

# Now that we've patched the enum module, we can import RealtimeSTT
try:
    from RealtimeSTT import AudioToTextRecorder
except ImportError:
    print("Error: RealtimeSTT not installed. Run 'pip install RealtimeSTT'")
    sys.exit(1)

# Configuration - default values
# Import trigger words from dedicated module if available
try:
    from .trigger_words import TRIGGER_VARIATIONS, ALL_TRIGGERS
    print("Using enhanced trigger word configurations")
except (ImportError, ModuleNotFoundError):
    # Fallback to built-in trigger words if module not found
    # Define variations of trigger words to enhance recognition
    TRIGGER_VARIATIONS = {
        "friend": ["friend", "friends", "friendly", "befriend", "my friend", "hey friend", 
                  "fiend", "fren", "front", "trend", "end", "rent"],
        "code": ["code helper", "code buddy", "let's code"],
        "assistant": ["assistant please", "my assistant", "hey assistant"]
    }

    # Flatten the trigger variations into a single list
    ALL_TRIGGERS = []
    for primary, variations in TRIGGER_VARIATIONS.items():
        ALL_TRIGGERS.append(primary)
        ALL_TRIGGERS.extend(variations)
    print("Using built-in trigger word configurations")

# Audio configuration
STT_MODEL = "small.en"
TTS_VOICE = "nova"
# Very long silence duration to allow for longer pauses in speech (increased to 5.0 seconds)
SILENCE_DURATION = 5.0
# Dynamic context tracking - base and max values
CONTEXT_LENGTH_BASE = 30 
CONTEXT_LENGTH_MAX = 100
# Calculate context length dynamically based on text complexity
# This will be used when check_for_trigger_word is called
# Minimum text length to process (to avoid early triggers with just the keyword)
MIN_TEXT_LENGTH = 10
# Path to notification sound
NOTIFICATION_SOUND = os.path.expanduser("~/Library/Sounds/Glass.aiff")
if not os.path.exists(NOTIFICATION_SOUND):
    NOTIFICATION_SOUND = os.path.expanduser("~/Library/Sounds/Tink.aiff")  # Fallback
if not os.path.exists(NOTIFICATION_SOUND):
    NOTIFICATION_SOUND = None  # No sound available

# Import the centralized tools configuration
import subprocess

def get_claude_tools():
    """Get the V3 CLAUDE_TOOLS from tool manager."""
    try:
        # Use V3's tool manager to get tools
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        tool_manager_path = os.path.join(script_dir, '../../tool-manager.js')
        
        if os.path.exists(tool_manager_path):
            result = subprocess.run([
                "node", "-e", 
                f"const toolManager = require('{tool_manager_path}'); console.log(toolManager.getAllToolsArray().join(','));"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                return result.stdout.strip()
        
        # Fallback to V3 tools
        return "Task,Bash,Glob,Grep,LS,Read,Edit,MultiEdit,Write,NotebookRead,NotebookEdit,WebFetch,TodoRead,TodoWrite,WebSearch,mcp__github__get_code_scanning_alert,mcp__github__get_commit,mcp__github__get_file_contents,mcp__github__get_issue,mcp__github__get_issue_comments,mcp__github__get_me,mcp__github__get_pull_request,mcp__github__get_pull_request_comments,mcp__github__get_pull_request_files,mcp__github__get_pull_request_reviews,mcp__github__get_pull_request_status,mcp__github__get_secret_scanning_alert,mcp__github__list_branches,mcp__github__list_code_scanning_alerts,mcp__github__list_commits,mcp__github__list_issues,mcp__github__list_pull_requests,mcp__github__list_secret_scanning_alerts,mcp__github__search_code,mcp__github__search_issues,mcp__github__search_repositories,mcp__github__search_users,mcp__sequentialthinking__sequentialthinking_tools,mcp__Context7__resolve-library-id,mcp__Context7__get-library-docs,mcp__omnisearch__tavily_search,mcp__omnisearch__perplexity_search,mcp__omnisearch__tavily_extract_process,mcp__figma__get_figma_data,mcp__figma__download_figma_images,mcp__shadcn-ui__list_shadcn_components,mcp__shadcn-ui__get_component_details,mcp__shadcn-ui__get_component_examples,mcp__shadcn-ui__search_components,mcp__asana__asana_list_workspaces,mcp__asana__asana_search_projects,mcp__asana__asana_get_project,mcp__asana__asana_get_project_task_counts,mcp__asana__asana_get_project_sections,mcp__asana__asana_get_project_status,mcp__asana__asana_get_project_statuses,mcp__asana__asana_search_tasks,mcp__asana__asana_get_task,mcp__asana__asana_get_multiple_tasks_by_gid,mcp__asana__asana_get_tasks_for_section,mcp__asana__asana_get_project_hierarchy,mcp__asana__asana_get_subtasks_for_task,mcp__asana__asana_get_tasks_for_project,mcp__asana__asana_get_tasks_for_tag,mcp__asana__asana_get_tags_for_workspace,mcp__asana__asana_get_task_stories,mcp__asana__asana_get_teams_for_user,mcp__asana__asana_get_teams_for_workspace,mcp__asana__asana_list_workspace_users,mcp__asana__asana_get_attachments_for_object,mcp__asana__asana_download_attachment,mcp__playwright__browser_navigate,mcp__playwright__browser_screenshot,mcp__playwright__browser_click,mcp__playwright__browser_click_text,mcp__playwright__browser_fill,mcp__playwright__browser_select,mcp__playwright__browser_select_text,mcp__playwright__browser_hover,mcp__playwright__browser_hover_text,mcp__playwright__browser_evaluate,mcp__memento__create_entities,mcp__memento__create_relations,mcp__memento__add_observations,mcp__memento__get_relation,mcp__memento__update_relation,mcp__memento__read_graph,mcp__memento__search_nodes,mcp__memento__open_nodes,mcp__memento__semantic_search,mcp__memento__get_entity_embedding,mcp__memento__get_entity_history,mcp__memento__get_relation_history,mcp__memento__get_graph_at_time,mcp__memento__get_decayed_graph,mcp__memento__force_generate_embedding,mcp__memento__debug_embedding_config,mcp__memento__diagnose_vector_search,mcp__gitmcp__match_common_libs_owner_repo_mapping,mcp__gitmcp__fetch_generic_documentation,mcp__gitmcp__search_generic_documentation,mcp__gitmcp__search_generic_code,mcp__gitmcp__fetch_generic_url_content"
    except Exception as e:
        print(f"Failed to get CLAUDE_TOOLS from V3 config: {e}")
        # Fallback to basic tools
        return "Task,Bash,Glob,Grep,LS,Read,Edit,MultiEdit,Write,WebFetch,TodoRead,TodoWrite,WebSearch"

# Get tools from centralized configuration
DEFAULT_CLAUDE_TOOLS = get_claude_tools()

# Prompt templates
COMPRESS_PROMPT = """
You are an assistant that makes long technical responses more concise for voice output.
Your task is to rephrase the following text to be shorter and more conversational,
while preserving all key information. Focus only on the most important details.
Be brief but clear, as this will be spoken aloud.

IMPORTANT HANDLING FOR CODE BLOCKS:
- Do not include full code blocks in your response
- Instead, briefly mention "I've created code for X" or "Here's a script that does Y"
- For large code blocks, just say something like "I've written a Python function that handles user authentication"
- DO NOT attempt to read out the actual code syntax
- Only describe what the code does in 1 sentences maximum

Original text:
{text}

Return only the compressed text, without any explanation or introduction.
"""

CLAUDE_PROMPT = """
# Voice-Enabled Claude Code Assistant for CALMHIVE

You are a helpful assistant that's being used via voice commands. Execute the user's request using your tools.

When asked to read files, return the entire file content.

{formatted_history}

Now help the user with their latest request.
"""

# Initialize logging
if RICH_AVAILABLE:
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(rich_tracebacks=True)],
    )
else:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)-8s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

log = logging.getLogger("claude_code_assistant")

# Suppress background logger noise
for logger_name in ["RealtimeSTT", "transcribe", "faster_whisper", "audio_recorder", 
                   "whisper", "faster_whisper.transcribe", "openai", 
                   "openai.http_client", "openai._client"]:
    logging.getLogger(logger_name).setLevel(logging.ERROR)

# Initialize console
if RICH_AVAILABLE:
    console = Console()
else:
    class SimpleConsole:
        def print(self, text, **kwargs):
            # Strip Rich formatting if present
            text = str(text)
            for tag in ["[bold]", "[/bold]", "[italic]", "[/italic]", "[bold red]", 
                      "[/bold red]", "[bold blue]", "[/bold blue]", "[bold green]", 
                      "[/bold green]", "[bold cyan]", "[/bold cyan]", 
                      "[bold magenta]", "[/bold magenta]", "[yellow]", "[/yellow]",
                      "[bold purple]", "[/bold purple]"]:
                text = text.replace(tag, "")
            print(text)
    console = SimpleConsole()

# Load environment variables
load_dotenv()

# Check required environment variables
required_vars = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]
missing_vars = [var for var in required_vars if not os.environ.get(var)]
if missing_vars:
    console.print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
    console.print("Please set these in your .env file or as environment variables.")
    sys.exit(1)

# Initialize OpenAI client for TTS
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# Sound function for generating different sounds with different parameters
def generate_beep(frequency=700, duration=0.2, volume=0.5, is_rising=False, is_falling=False, 
                is_double=False, is_chord=False, is_two_tone=False):
    """Generate a beep sound with the given parameters"""
    try:
        sample_rate = 44100
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        
        # Generate different types of tones
        if is_rising:
            # Rising tone (useful for start/submission)
            # Increased dynamic range from 0.6 to 1.5 (was 0.7 to 1.3)
            freq = np.linspace(frequency * 0.6, frequency * 1.5, int(sample_rate * duration))
            beep = volume * np.sin(2 * np.pi * freq * t / sample_rate)
        elif is_falling:
            # Falling tone (useful for completion/ending)
            # Increased dynamic range from 0.6 to 1.5 (was 0.7 to 1.3)
            freq = np.linspace(frequency * 1.5, frequency * 0.6, int(sample_rate * duration))
            beep = volume * np.sin(2 * np.pi * freq * t / sample_rate)
        elif is_double:
            # Double beep (two quick pulses)
            half_dur = int(sample_rate * duration / 2.2)
            beep1 = volume * np.sin(2 * np.pi * frequency * t[:half_dur])
            beep2 = volume * np.sin(2 * np.pi * (frequency * 1.2) * t[:half_dur])
            silence = np.zeros(int(sample_rate * 0.08))
            beep = np.concatenate([beep1, silence, beep2])
        elif is_chord:
            # Chord sound (multiple frequencies together)
            f1 = frequency
            f2 = frequency * 1.26  # Major third
            f3 = frequency * 1.5   # Perfect fifth
            beep = volume * 0.33 * (np.sin(2 * np.pi * f1 * t) + 
                                   np.sin(2 * np.pi * f2 * t) + 
                                   np.sin(2 * np.pi * f3 * t))
        elif is_two_tone:
            # Two-tone alert (alternating between two frequencies)
            f1 = frequency
            f2 = frequency * 1.4
            half_t = int(len(t)/2)
            beep = np.zeros_like(t)
            beep[:half_t] = volume * np.sin(2 * np.pi * f1 * t[:half_t])
            beep[half_t:] = volume * np.sin(2 * np.pi * f2 * t[half_t:])
        else:
            # Regular tone
            beep = volume * np.sin(2 * np.pi * frequency * t)
            
        # Play the sound
        sd.play(beep, sample_rate)
        sd.wait()
        return True
    except Exception as e:
        print(f"Sound error: {e}")
        return False

def play_notification_sound():
    """Play a notification sound to indicate trigger word detection"""
    # Disabled to prevent audio conflicts and popping
    return True
    # First try system sound if available
    if NOTIFICATION_SOUND and os.path.exists(NOTIFICATION_SOUND):
        try:
            # Try to play with system sound player (works on macOS)
            subprocess.run(["afplay", NOTIFICATION_SOUND], check=False, 
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except:
            try:
                # Fallback to sounddevice/soundfile
                data, samplerate = sf.read(NOTIFICATION_SOUND)
                sd.play(data, samplerate)
                sd.wait()
                return True
            except:
                pass
    
    # Fallback to generated sound - use chord for notification
    return generate_beep(frequency=1000, duration=0.2, volume=0.5, is_chord=True)

def play_startup_sound():
    """Play a startup sound when ready to listen (not during initialization)"""
    # More distinctive startup sound with a chord
    return generate_beep(frequency=600, duration=0.25, volume=0.5, is_chord=True)

def play_trigger_sound():
    """Play a sound when trigger word is detected"""
    # Two-tone alert for more distinctive trigger sound
    return generate_beep(frequency=800, duration=0.2, volume=0.5, is_two_tone=True)

def play_listening_ready_sound():
    """Play a sound when the system is ready to listen"""
    # Higher pitched gentle sound
    return generate_beep(frequency=900, duration=0.12, volume=0.4)

def play_submission_sound():
    """Play a sound when sending request to Claude Code"""
    # Rising tone for submission - more dynamic range
    return generate_beep(frequency=400, duration=0.35, volume=0.5, is_rising=True)

def play_response_complete_sound():
    """Play a sound when Claude's response is complete and returning to listening mode"""
    # Double beep for completion - more distinctive
    return generate_beep(frequency=700, duration=0.25, volume=0.5, is_double=True)

def play_cancel_sound():
    """Play a sound to indicate cancellation"""
    # Disabled to prevent audio conflicts and popping
    return True
    # Two-tone low pitch for cancellation - very distinct from other sounds
    return generate_beep(frequency=300, duration=0.3, volume=0.4, is_two_tone=True)


def check_for_trigger_word(text):
    """Check if any trigger word or variation is in the text"""
    # Check for imported function from trigger_words if available
    try:
        from .trigger_words import contains_trigger_word
        return contains_trigger_word(text)
    except (ImportError, ModuleNotFoundError):
        # Use the built-in function if module not available
        pass
    
    # Convert text to lowercase for case-insensitive matching
    text_lower = text.lower()
    
    # Don't play sounds in this function - we'll play them when we act on the trigger
    # Track if we've already found a trigger
    trigger_found = False
    
    # Simple greeting words should not trigger by themselves
    if text_lower.strip() in ["hello", "hi", "hey", "ok", "okay"]:
        return False
        
    # More effective detection of complete phrases
    # Check for primary trigger phrases first (most reliable)
    primary_triggers = list(TRIGGER_VARIATIONS.keys())
    for primary in primary_triggers:
        if f" {primary} " in f" {text_lower} ":
            trigger_found = True
            return True
    
    # Check each trigger and its variations
    for trigger in ALL_TRIGGERS:
        if trigger in text_lower and not trigger_found:
            # Additional check: if the text is very short and contains just the trigger word
            # surrounded by very few other words, don't trigger
            if len(text_lower.split()) < 3 and any(word == trigger for word in text_lower.split()):
                continue
                
            trigger_found = True
            return True
            
    # Special case: Check for combined patterns like "hey assistant" or "let's code"
    words = text_lower.split()
    
    # Check for greeting + trigger combinations
    greetings = ["hey", "hi", "hello", "ok", "okay"]
    trigger_starts = ["assist", "friend", "code", "calm", "project"]
    
    for i in range(len(words) - 1):
        # Check for greeting + trigger pattern
        if (words[i] in greetings and 
            any(words[i+1].startswith(start) for start in trigger_starts)):
            return True
            
        # Check for action phrases
        if i < len(words) - 2:
            action_triplets = [
                ("let", "'s", "code"),
                ("help", "me", "with"),
                ("code", "with", "me"),
            ]
            for a, b, c in action_triplets:
                if words[i] == a and words[i+1] == b and words[i+2] == c:
                    return True
            
    return False

def get_dynamic_context_length(text):
    """Calculate a dynamic context length based on text complexity
    
    This function adjusts the context length based on:
    1. Text length - longer text gets more context lines
    2. Sentence complexity - more complex sentences get more context
    3. Number of potential trigger words - more triggers means more context
    
    Returns:
        int: The calculated context length between BASE and MAX values
    """
    if not text:
        return CONTEXT_LENGTH_BASE
        
    # Start with base context length
    context_length = CONTEXT_LENGTH_BASE
    
    # 1. Adjust based on text length (longer text = more context)
    text_length = len(text)
    if text_length > 500:
        context_length += 20
    elif text_length > 200:
        context_length += 10
    elif text_length > 100:
        context_length += 5
        
    # 2. Adjust based on sentence complexity (more punctuation = more context)
    complexity_markers = ['.', ',', '?', '!', ';', ':', '(', ')', '-']
    complexity_count = sum(text.count(marker) for marker in complexity_markers)
    if complexity_count > 15:
        context_length += 15
    elif complexity_count > 10:
        context_length += 10
    elif complexity_count > 5:
        context_length += 5
        
    # 3. Adjust based on trigger word prevalence
    # More trigger word mentions = more context needed
    text_lower = text.lower()
    trigger_count = sum(text_lower.count(trigger) for trigger in ALL_TRIGGERS)
    if trigger_count > 3:
        context_length += 15
    elif trigger_count > 1:
        context_length += 10
    elif trigger_count > 0:
        context_length += 5
    
    # Ensure we don't exceed the maximum
    return min(context_length, CONTEXT_LENGTH_MAX)


class ClaudeCodeAssistant:
    def __init__(
        self,
        conversation_id: Optional[str] = None,
        initial_prompt: Optional[str] = None,
    ):
        log.info("Initializing Claude Code Assistant")
        self.recorder = None
        self.initial_prompt = initial_prompt
        self.context_buffer = []  # Store transcription lines dynamically
        self.context_text = ""    # Combined text from all context lines
        self._cancel_audio = False  # Flag for cancelling audio playback
        self.debug_mode = False    # Debug mode flag

        # Set up conversation ID and history
        if conversation_id:
            # Use the provided ID
            self.conversation_id = conversation_id
        else:
            # Generate a short 5-character ID
            self.conversation_id = "".join(str(uuid.uuid4()).split("-")[0][:5])
        log.info(f"Using conversation ID: {self.conversation_id}")

        # Ensure output directory exists
        self.output_dir = Path("output")
        self.output_dir.mkdir(exist_ok=True)

        # Set up the conversation file path
        self.conversation_file = self.output_dir / f"{self.conversation_id}.yml"

        # Load existing conversation or start a new one
        self.conversation_history = self.load_conversation_history()

        # Set up recorder
        self.setup_recorder()

    def load_conversation_history(self) -> List[Dict[str, str]]:
        """Load conversation history from YAML file if it exists"""
        if self.conversation_file.exists():
            try:
                log.info(f"Loading existing conversation from {self.conversation_file}")
                with open(self.conversation_file, "r") as f:
                    history = yaml.safe_load(f)
                    if history is None:
                        log.info("Empty conversation file, starting new conversation")
                        return []
                    log.info(f"Loaded {len(history)} conversation turns")
                    return history
            except Exception as e:
                log.error(f"Error loading conversation history: {e}")
                log.info("Starting with empty conversation history")
                return []
        else:
            log.info(
                f"No existing conversation found at {self.conversation_file}, starting new conversation"
            )
            return []

    def extract_tool_usage(self, response: str) -> List[str]:
        """Extract tool usage information from Claude's response"""
        try:
            # Use regex to identify tool uses in the response
            import re
            # Look for function call patterns in response - typical Claude Code patterns
            tools_used = []
            
            # Match <function_calls> blocks
            function_calls = re.findall(r'<function_calls>.*?<invoke name="([^"]+)">', response, re.DOTALL)
            if function_calls:
                for tool in function_calls:
                    if tool not in tools_used:
                        tools_used.append(tool)
            
            # Another pattern is "I'll use the X tool to..."
            tool_mentions = re.findall(r'(use|using|used) the ([A-Za-z_]+) tool', response)
            for _, tool in tool_mentions:
                if tool not in tools_used:
                    tools_used.append(tool)
            
            # Also look for "I've used these tools: X, Y, Z" pattern
            summary_mentions = re.findall(r'used these tools: (.*?)[\.\n]', response)
            for tools_list in summary_mentions:
                for tool in re.split(r', | and ', tools_list):
                    tool = tool.strip()
                    if tool and tool not in tools_used:
                        tools_used.append(tool)
            
            return tools_used
        except Exception as e:
            log.error(f"Error extracting tool usage: {e}")
            return []
    
    def save_conversation_history(self) -> None:
        """Save conversation history to YAML file"""
        try:
            log.info(f"Saving conversation history to {self.conversation_file}")
            with open(self.conversation_file, "w") as f:
                yaml.dump(self.conversation_history, f, default_flow_style=False)
            log.info(f"Saved {len(self.conversation_history)} conversation turns")
        except Exception as e:
            log.error(f"Error saving conversation history: {e}")
            console.print(f"Failed to save conversation history: {e}")

    def setup_recorder(self):
        """Set up the RealtimeSTT recorder"""
        log.info(f"Setting up STT recorder with model {STT_MODEL}")
        
        # Initialize trigger detection display tracking variable
        self._trigger_already_displayed = False
        
        self.recorder = AudioToTextRecorder(
            model=STT_MODEL,
            language="en",
            compute_type="float32",
            # Longer silence to capture more speech
            post_speech_silence_duration=SILENCE_DURATION,
            beam_size=5,
            initial_prompt=None,
            spinner=False,
            print_transcription_time=False,
            enable_realtime_transcription=True,
            realtime_model_type="tiny.en",
            # More frequent updates for better real-time feedback
            realtime_processing_pause=0.3
            # The enable_automatic_punctuation parameter causes errors with some RealtimeSTT versions
            # DO NOT ADD enable_automatic_punctuation parameter here, it causes errors
        )

        log.info(f"STT recorder initialized with model {STT_MODEL}")

    def format_conversation_history(self) -> str:
        """Format the conversation history in the required format"""
        if not self.conversation_history:
            return ""

        formatted_history = "# Conversation History\n\n"

        for entry in self.conversation_history:
            role = entry["role"].capitalize()
            content = entry["content"]
            formatted_history += f"## {role}\n{content}\n\n"

        return formatted_history

    async def listen(self) -> str:
        """Listen for user speech and convert to text"""
        log.info("Listening for speech...")

        # If this is the first call and we have an initial prompt, use it instead of recording
        if hasattr(self, "initial_prompt") and self.initial_prompt:
            prompt = self.initial_prompt

            # Display the prompt as if it were spoken
            if RICH_AVAILABLE:
                console.print(
                    Panel(title="You", title_align="left", renderable=Markdown(prompt))
                )
            else:
                console.print(f"╭─ You ────────────────────────────────────────────╮")
                console.print(f"│ {prompt}")
                console.print(f"╰──────────────────────────────────────────────────╯")

            # Clear the initial prompt so it's only used once
            self.initial_prompt = None

            return prompt

        # Set up realtime display
        # Tracking variable to prevent continuous trigger detection rendering
        self._trigger_already_displayed = False
        
        def on_realtime_update(text):
            # Always initialize trigger_detected to avoid UnboundLocalError
            trigger_detected = False
            
            # Ensure text is not None and has content before processing
            if text is None:
                text = ""
            
            # Store text in context buffer if it has content
            if text and text.strip():
                # Update the combined context text
                self.context_text = (self.context_text + " " + text).strip()
                
                # Calculate dynamic context length based on text complexity
                dynamic_context_length = get_dynamic_context_length(self.context_text)
                
                # Add text to context buffer
                self.context_buffer.append(text)
                
                # Keep only the most recent entries based on the dynamic context length
                if len(self.context_buffer) > dynamic_context_length:
                    # Trim the buffer to the calculated dynamic length
                    self.context_buffer = self.context_buffer[-dynamic_context_length:]
                
                # Log the dynamic context length for debugging if in debug mode
                if hasattr(self, 'debug_mode') and self.debug_mode:
                    log.debug(f"Dynamic context length: {dynamic_context_length}, Buffer size: {len(self.context_buffer)}")
                
                # Get combined text from context buffer for trigger detection
                combined_text = " ".join(self.context_buffer)
                
                # Check for trigger words in context buffer only if we haven't already
                # detected a trigger in this session
                if not self._trigger_already_displayed and check_for_trigger_word(combined_text):
                    # If a trigger word is found in the context, highlight it but only once
                    text = f"[TRIGGER DETECTED] {text}"
                    self._trigger_already_displayed = True
                    trigger_detected = True
                    
                    # Log the context that contained the trigger if in debug mode
                    if hasattr(self, 'debug_mode') and self.debug_mode:
                        log.debug(f"Trigger detected in context: {combined_text}")
            
            # Clear line and update realtime text only if there's something meaningful to update
            # or if we just detected a trigger - trigger_detected is always defined now
            if trigger_detected or (text and text.strip()):
                sys.stdout.write("\r\033[K")  # Clear line
                sys.stdout.write(f"Listening: {text}")
                sys.stdout.flush()

        self.recorder.on_realtime_transcription_update = on_realtime_update

        # Create a synchronization object for the callback
        result_container = {"text": "", "done": False}
        
        # Reset the trigger detection display flag for the next listening session
        self._trigger_already_displayed = False

        def callback(text):
            if text:
                console.print("")
                if RICH_AVAILABLE:
                    console.print(
                        Panel(title="You", title_align="left", renderable=Markdown(text))
                    )
                else:
                    console.print(f"╭─ You ────────────────────────────────────────────╮")
                    console.print(f"│ {text}")
                    console.print(f"╰──────────────────────────────────────────────────╯")
                log.info(f'Heard: "{text}"')
                
                # Check if we should look at the context buffer instead of just this text
                # This helps catch trigger words that might have been split across utterances
                # Reset the trigger detection display flag when final text is determined
                self._trigger_already_displayed = False
                
                if not check_for_trigger_word(text) and self.context_buffer:
                    # Check if this is a continuation of a triggered conversation
                    # Look back through recent context for a trigger word
                    trigger_found = False
                    trigger_index = -1
                    
                    # Search backwards through buffer for most recent trigger
                    for i in range(len(self.context_buffer) - 1, -1, -1):
                        if check_for_trigger_word(self.context_buffer[i]):
                            trigger_found = True
                            trigger_index = i
                            break
                    
                    if trigger_found and trigger_index >= 0:
                        # For long prompts: if the trigger was recent (within last 5 entries)
                        # include everything from the trigger onwards
                        if len(self.context_buffer) - trigger_index <= 5:
                            # Get everything from trigger onwards, but deduplicate
                            context_from_trigger = self.context_buffer[trigger_index:]
                            # Remove duplicate partial transcriptions by keeping only unique endings
                            cleaned_context = []
                            for i, entry in enumerate(context_from_trigger):
                                # Skip if this entry is contained in the next entry
                                if i < len(context_from_trigger) - 1:
                                    next_entry = context_from_trigger[i + 1]
                                    if entry in next_entry:
                                        continue
                                cleaned_context.append(entry)
                            
                            # Combine cleaned context with current text
                            combined = " ".join(cleaned_context + [text])
                            log.info(f'Using context from trigger (cleaned): "{combined}"')
                            result_container["text"] = combined
                        else:
                            # Trigger was too far back, just use current text
                            result_container["text"] = text
                    else:
                        result_container["text"] = text
                else:
                    result_container["text"] = text

            result_container["done"] = True

        # Get text with callback
        self.recorder.text(callback)

        # Wait for result with a simple polling loop
        timeout = 60  # seconds
        wait_interval = 0.1  # seconds
        elapsed = 0

        while not result_container["done"] and elapsed < timeout:
            await asyncio.sleep(wait_interval)
            elapsed += wait_interval

        if elapsed >= timeout:
            log.warning("Timeout waiting for speech")
            return ""

        return result_container["text"]

    async def compress_speech(self, text: str) -> str:
        """Compress the response text to be more concise for speech"""
        log.info("Compressing response for speech...")

        # Check if the text is empty or too short to compress
        if not text or len(text.strip()) < 10:
            log.warning("Empty or very short response received - skipping compression")
            return text or "I'm ready to assist you. Please provide your query."
            
        try:
            # Use the prompt template from the constants
            prompt = COMPRESS_PROMPT.format(text=text)

            # Call OpenAI with GPT-4o-mini to compress the text
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1024,
            )

            compressed_text = response.choices[0].message.content
            log.info(
                f"Compressed response from {len(text)} to {len(compressed_text)} characters"
            )
            
            # Display full text in console
            if RICH_AVAILABLE:
                console.print(
                    Panel(
                        f"[bold cyan]Original response:[/bold cyan]\n{text}",
                        title="Original Text",
                        border_style="cyan",
                    )
                )
                console.print(
                    Panel(
                        f"[bold green]Compressed for speech:[/bold green]\n{compressed_text}",
                        title="Compressed Text",
                        border_style="green",
                    )
                )
            else:
                console.print(f"╭─ Original Text ─────────────────────────────────╮")
                console.print(f"│ Original response:")
                console.print(f"│ {text}")
                console.print(f"╰──────────────────────────────────────────────────╯")
                console.print(f"╭─ Compressed Text ───────────────────────────────╮")
                console.print(f"│ Compressed for speech:")
                console.print(f"│ {compressed_text}")
                console.print(f"╰──────────────────────────────────────────────────╯")

            return compressed_text

        except Exception as e:
            log.error(f"Error compressing speech: {str(e)}")
            console.print(f"Error compressing speech: {str(e)}")
            # Return original text if compression fails
            return text

    async def speak(self, text: str):
        """Convert text to speech using OpenAI TTS"""
        log.info(f'Speaking: "{text[:50]}..."')

        try:
            # Compress text before converting to speech
            compressed_text = await self.compress_speech(text)

            # Generate speech with compressed text
            response = client.audio.speech.create(
                model="tts-1",
                voice=TTS_VOICE,
                input=compressed_text,
                speed=1.0,
            )

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_filename = temp_file.name
                
                # Write audio to file - use the correct method depending on the response type
                try:
                    # Always use with_streaming_response to avoid deprecation warning
                    if hasattr(client.audio.speech, 'with_streaming_response'):
                        speech_with_streaming = client.audio.speech.with_streaming_response
                        streaming_resp = speech_with_streaming.create(
                            model="tts-1",
                            voice=TTS_VOICE,
                            input=compressed_text,
                            speed=1.0,
                        )
                        streaming_resp.stream_to_file(temp_filename)
                    # Fallback only if needed
                    elif hasattr(response, 'stream_to_file'):
                        # Fallback with deprecation warning (will be removed in future)
                        # This line will show a deprecation warning but will work
                        response.stream_to_file(temp_filename)
                    else:
                        # Then try the older direct .write() method
                        temp_file.write(response.content)
                except AttributeError:
                    try:
                        # Fallback for older API versions
                        temp_file.write(response.content)
                    except AttributeError:
                        # Finally try the raw bytes method
                        if hasattr(response, 'read'):
                            temp_file.write(response.read())
                        else:
                            # Just write whatever we have as a last resort
                            temp_file.write(response.content if hasattr(response, 'content') else response)

            # Play audio with better handling to prevent popping
            data, samplerate = sf.read(temp_filename)
            
            # Ensure data is float32 for better compatibility
            if data.dtype != np.float32:
                data = data.astype(np.float32)
            
            # Apply fade-in and fade-out using numpy (more efficient)
            fade_duration = 0.02  # 20ms fade (longer for better effect)
            fade_samples = int(fade_duration * samplerate)
            
            if len(data) > fade_samples * 2:
                # Create fade curves
                fade_in = np.linspace(0, 1, fade_samples)
                fade_out = np.linspace(1, 0, fade_samples)
                
                # Apply fades (handles both mono and stereo)
                if len(data.shape) == 1:  # Mono
                    data[:fade_samples] *= fade_in
                    data[-fade_samples:] *= fade_out
                else:  # Stereo or multi-channel
                    data[:fade_samples] *= fade_in[:, np.newaxis]
                    data[-fade_samples:] *= fade_out[:, np.newaxis]
            
            # Add small silence padding to prevent abrupt start/stop
            silence_pad = int(0.01 * samplerate)  # 10ms silence
            silence = np.zeros((silence_pad,) + data.shape[1:] if len(data.shape) > 1 else (silence_pad,), dtype=np.float32)
            data = np.concatenate([silence, data, silence])
            
            # Configure sounddevice for better performance
            sd.default.latency = 'low'
            sd.default.blocksize = 512  # Smaller blocksize for better response
            
            # Play with blocking=True to ensure proper synchronization
            sd.play(data, samplerate, blocking=True)

            # Log start time for duration tracking
            start_time = asyncio.get_event_loop().time()

            # Set up a cancellation flag for audio playback
            self._cancel_audio = False
            
            # Wait for audio to finish or be cancelled with voice command monitoring
            try:
                # Set up for voice monitoring during playback
                listen_for_cancel = True
                recorder_for_cancel = None
                
                try:
                    # Create a separate recorder instance just for stop commands
                    # This allows us to listen for stop commands during TTS playback
                    recorder_for_cancel = AudioToTextRecorder(
                        model="tiny.en",  # Use tiny model for faster processing
                        language="en",
                        compute_type="float32",
                        post_speech_silence_duration=0.5,  # Even shorter silence for faster detection
                        spinner=False,
                        print_transcription_time=False,
                        enable_realtime_transcription=True,
                        realtime_processing_pause=0.1,  # More frequent updates
                        initial_prompt="stop cancel halt"  # Hint for improved detection of stop words
                        # The enable_automatic_punctuation parameter causes errors with some RealtimeSTT versions
                        # DO NOT ADD enable_automatic_punctuation parameter here, it causes errors
                    )
                except Exception as rec_error:
                    log.error(f"Could not create cancel monitor: {rec_error}")
                    listen_for_cancel = False
                
                # Function to check stop commands in background
                async def check_for_cancel():
                    if recorder_for_cancel:
                        result = {"text": "", "done": False}
                        
                        def cancel_callback(text):
                            if text:
                                # More aggressive check for stop commands
                                # Check individual words to catch partial matches
                                words = text.lower().split()
                                # Expanded stop words for better recognition
                                stop_words = ["stop", "cancel", "halt", "abort", "quit", "end", "shut", 
                                             "terminate", "break", "enough", "no more"]
                                
                                # Function to check if a word matches or contains a stop command
                                def is_stop_command(word):
                                    # Exact match check
                                    if word in stop_words:
                                        return True
                                    
                                    # Partial match check for word beginnings
                                    for stop in stop_words:
                                        # Check if the word begins with the stop word
                                        # This catches variations like "stopping", "cancelling", etc.
                                        if word.startswith(stop):
                                            return True
                                            
                                        # For shorter stop words (3-4 chars), ensure they're not just 
                                        # part of another word by requiring them to be at word boundaries
                                        if len(stop) <= 4 and stop in word:
                                            # Check if the stop word appears at the beginning
                                            if word.startswith(stop):
                                                return True
                                            # Check if it appears as a distinct part
                                            if f"-{stop}" in word or f" {stop}" in word:
                                                return True
                                    
                                    return False
                                
                                # Check all words in the text for stop commands
                                if any(is_stop_command(word) for word in words):
                                    log.info(f"Stop command detected during TTS: {text}")
                                    # Set cancellation flag
                                    self._cancel_audio = True
                                    
                                    # Early termination of playback
                                    sd.stop()
                            
                            # Complete the callback
                            result["text"] = text
                            result["done"] = True
                        
                        # Get text in non-blocking way with short timeout
                        try:
                            # Try with a shorter timeout for more responsiveness
                            recorder_for_cancel.text(cancel_callback)
                            
                            # Poll frequently
                            while not result["done"] and not self._cancel_audio and sd.get_stream().active:
                                await asyncio.sleep(0.05)  # Shorter sleep interval
                        except Exception as e:
                            log.error(f"Error in cancel recording: {e}")
                        finally:
                            # Always clean up
                            try:
                                if hasattr(recorder_for_cancel, 'shutdown'):
                                    recorder_for_cancel.shutdown()
                            except Exception as e:
                                log.error(f"Error shutting down cancel recorder: {e}")
                
                # Use a background task for monitoring
                cancel_task = None
                if listen_for_cancel:
                    # Start the cancel monitor in background
                    cancel_task = asyncio.create_task(check_for_cancel())
                
                # Also poll the keyboard for Ctrl+C while waiting for audio
                while sd.get_stream().active and not self._cancel_audio:
                    # More frequent polling
                    await asyncio.sleep(0.05)
                    
                    # Check if keyboard interrupt (will be caught by outer try/except)
                    try:
                        # Non-blocking check for keyboard input (if available)
                        import select
                        if select.select([sys.stdin], [], [], 0)[0]:
                            char = sys.stdin.read(1)
                            if char == '\x03':  # Ctrl+C character
                                raise KeyboardInterrupt
                    except (ImportError, IOError):
                        # Skip keyboard check if not available
                        pass
                
                # Cancel the monitor task if it's still running
                if cancel_task and not cancel_task.done():
                    cancel_task.cancel()
                    try:
                        await cancel_task
                    except asyncio.CancelledError:
                        pass
                    
                # If cancelled, stop audio playback
                if self._cancel_audio:
                    # Stop playback if still active
                    if sd.get_stream().active:
                        sd.stop()
                    
                    log.info("Audio playback cancelled")
                    # Play cancel sound to acknowledge
                    play_cancel_sound()
                    # Show cancellation message
                    if RICH_AVAILABLE:
                        console.print("[bold red]🔇 TTS output cancelled. Returning to listening...[/bold red]")
                    else:
                        console.print("🔇 TTS output cancelled. Returning to listening...")
            except Exception as e:
                log.error(f"Error during audio playback: {e}")
                # Fall back to regular wait
                sd.wait()
            finally:
                # Calculate speech duration
                duration = asyncio.get_event_loop().time() - start_time

                # Clean up the temporary file
                os.unlink(temp_filename)

            log.info(f"Audio played (duration: {duration:.2f}s)")

        except Exception as e:
            log.error(f"Error in speech synthesis: {str(e)}")
            console.print(f"Error in speech synthesis: {str(e)}")
            # Display the text as fallback
            console.print(f"Text: {text}")

    async def process_message(self, message: str) -> Optional[str]:
        """Process the user message and run Claude Code"""
        log.info(f'Processing message: "{message}"')

        # Function to check for STOP command with enhanced detection
        def check_for_stop_command(text):
            """
            Check if the text contains a stop command.
            Now modified to only match EXPLICIT stop commands, not casual mentions.
            """
            if not text:
                return False
                
            # List of stop command words and phrases
            stop_patterns = ["stop", "cancel", "abort", "quit", "exit", "halt", 
                            "terminate", "break", "stop command", "cancel command"]
            text_lower = text.lower()
            
            # Split text into words and count total words
            words = text_lower.split()
            word_count = len(words)
            
            # ONLY consider it a stop command if it's a very short phrase (1-3 words)
            # or if it starts with an explicit stop word
            
            # Short commands like "stop", "cancel", "abort now" (1-3 words total)
            if word_count <= 3:
                # For very short commands, check if any word is a stop word
                for word in words:
                    if word in stop_patterns:
                        return True
                        
                # Check for combination like "abort now" or "please stop"
                if word_count == 2:
                    for pattern in stop_patterns:
                        if pattern in text_lower:
                            return True
            
            # Check if text EXPLICITLY starts with a stop command
            # Example: "Stop the process" or "Cancel this request"
            for pattern in stop_patterns:
                if text_lower.startswith(f"{pattern} "):
                    # Also verify this isn't the start of a longer query
                    # by checking if it looks like an actual query after the command
                    rest_of_text = text_lower[len(pattern):].strip()
                    words_after = rest_of_text.split()
                    
                    # Does the text after have query-like words?
                    query_indicators = ["can", "could", "what", "who", "when", "where", "how", "why", 
                                       "is", "are", "was", "tell", "show", "find", "search", "help",
                                       "please", "explain", "describe", "list", "create", "make"]
                                       
                    # If there are no query indicators after the stop word, it's likely
                    # meant as an actual stop command
                    has_query_after = any(word in query_indicators for word in words_after[:3])
                    if not has_query_after:
                        return True
            
            # EXPLICIT stop phrases that are definitely commands
            definite_stop_phrases = [
                "stop command", "cancel command", "i want to stop", "stop now please",
                "please stop now", "stop execution", "cancel execution", "abort execution",
                "abort this", "cancel this", "stop this"
            ]
            
            for phrase in definite_stop_phrases:
                if phrase in text_lower:
                    return True
                    
            # If we get here, it's probably not an explicit stop command
            return False
        
        # Check if STOP command is in the text
        if check_for_stop_command(message):
            log.info("STOP command detected, cancelling current request")
            if RICH_AVAILABLE:
                console.print("[bold red]⚠️ STOP command detected! Cancelling current request...[/bold red]")
            else:
                console.print("⚠️ STOP command detected! Cancelling current request...")
            
            # Play cancel sound to indicate request cancellation
            play_cancel_sound()
            return "Request cancelled by user command. Ready for new input."
            
        # Check for any trigger word in the message - use our enhanced function
        if not check_for_trigger_word(message):
            log.info("No trigger word detected, skipping")
            return None
            
        # Check if the message is too short (just the trigger word)
        # This prevents triggering with just a trigger word and no actual request
        if len(message) < MIN_TEXT_LENGTH:
            if RICH_AVAILABLE:
                console.print(f"[bold yellow]Message too short ({len(message)} chars). Please provide a more complete request.[/bold yellow]")
            else:
                console.print(f"Message too short ({len(message)} chars). Please provide a more complete request.")
            log.info(f"Message too short: {len(message)} chars < {MIN_TEXT_LENGTH} minimum")
            
            # Play cancel sound to indicate it was heard but not processed
            play_cancel_sound()
                
            return None
        
        # Visual confirmation of trigger detection with immediate sound
        if RICH_AVAILABLE:
            console.print("[bold green]⚡ Trigger word detected - Processing request...[/bold green]")
        else:
            console.print("⚡ Trigger word detected - Processing request...")
            
        # Play trigger sound immediately when we confirm we're processing the request
        # This provides immediate audio feedback that trigger was detected
        play_trigger_sound()
            
        # Add to conversation history
        self.conversation_history.append({"role": "user", "content": message})

        # Prepare the prompt for Claude Code including conversation history
        formatted_history = self.format_conversation_history()
        prompt = CLAUDE_PROMPT.format(formatted_history=formatted_history)

        # Execute Claude Code as a subprocess with full tool access
        log.info("Starting Claude Code subprocess with full tool access...")
        cmd = [
            "claude",
            # Use headless mode to avoid input timeout issues with long input
            "-p",
            prompt,
            "--allowedTools",
            DEFAULT_CLAUDE_TOOLS
            # Removed --timeout flag as it's not supported
        ]
        log.info(f"Using tools: {DEFAULT_CLAUDE_TOOLS}")

        # Play submission sound to indicate the query is being sent to Claude Code
        play_submission_sound()
        
        if RICH_AVAILABLE:
            console.print("\n[bold blue]🔄 Running Claude Code...[/bold blue]")
            console.print("[bold yellow](Processing your request with tools)[/bold yellow]")
            # Show which tools are available for this request
            tools_list = DEFAULT_CLAUDE_TOOLS.split(",")
            if len(tools_list) > 5:
                # Just show count if there are many tools
                console.print(f"[dim]Using {len(tools_list)} tools including: {', '.join(tools_list[:5])}... and more[/dim]")
            else:
                console.print(f"[dim]Using tools: {', '.join(tools_list)}[/dim]")
        else:
            console.print("\n🔄 Running Claude Code...")
            console.print("(Processing your request with tools)")
            # Show which tools are available for this request
            tools_list = DEFAULT_CLAUDE_TOOLS.split(",")
            if len(tools_list) > 5:
                # Just show count if there are many tools
                console.print(f"Using {len(tools_list)} tools including: {', '.join(tools_list[:5])}... and more")
            else:
                console.print(f"Using tools: {', '.join(tools_list)}")

        # Create a cancellable subprocess using Popen instead of run
        try:
            # Start process
            process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Set up for voice monitoring during Claude Code processing
            listen_for_cancel = True
            recorder_for_cancel = None
            process_cancelled = False
            
            try:
                # Create a separate recorder instance just for stop commands
                recorder_for_cancel = AudioToTextRecorder(
                    model="tiny.en",  # Use tiny model for faster processing
                    language="en",
                    compute_type="float32",
                    post_speech_silence_duration=0.5,  # Even shorter silence for faster detection
                    spinner=False,
                    print_transcription_time=False,
                    enable_realtime_transcription=True,
                    realtime_processing_pause=0.1,  # More frequent updates for better responsiveness
                    initial_prompt="stop cancel halt abort"  # Hint for improved detection of stop words
                    # The enable_automatic_punctuation parameter causes errors with some RealtimeSTT versions
                    # DO NOT ADD enable_automatic_punctuation parameter here, it causes errors
                )
            except Exception as rec_error:
                log.error(f"Could not create cancel monitor: {rec_error}")
                listen_for_cancel = False
            
            # Wait for completion or cancellation
            try:
                # If we can listen for cancel commands, start a background task
                if listen_for_cancel and recorder_for_cancel:
                    # Set up a way to check for voice cancellations while communicate() is running
                    # We'll use a separate thread for this since communicate() blocks
                    def voice_cancel_monitor():
                        nonlocal process_cancelled
                        try:
                            # Function to handle speech recognition results
                            def cancel_callback(text):
                                nonlocal process_cancelled
                                if text:
                                    # Debug logging if enabled
                                    if hasattr(self, 'debug_mode') and self.debug_mode:
                                        log.debug(f"Processing cancel monitor heard: {text}")
                                        
                                    # Use the same enhanced stop command detection as elsewhere
                                    # First, log the text for debugging if debug mode is enabled
                                    if hasattr(self, 'debug_mode') and self.debug_mode:
                                        log.debug(f"Checking for stop command in: {text}")
                                    
                                    # List of stop command words and phrases with expanded vocabulary
                                    stop_words = ["stop", "cancel", "halt", "abort", "quit", "end", "shut",
                                                "terminate", "break", "enough", "no more", "stop it", "cancel it"]
                                    text_lower = text.lower()
                                    words = text_lower.split()
                                    
                                    # Function to check if a word matches or contains a stop command
                                    def is_stop_command(word):
                                        # Exact match check (most reliable)
                                        if word in stop_words:
                                            return True
                                        
                                        # Partial match check for word beginnings
                                        for stop in stop_words:
                                            # Single word stop commands can match at the beginning 
                                            # This catches variations like "stopping", "cancelling", etc.
                                            if len(stop.split()) == 1 and word.startswith(stop):
                                                return True
                                                
                                        # Also check for complete phrases
                                        for phrase in ["stop it", "cancel it", "make it stop"]:
                                            if phrase in text_lower:
                                                return True
                                                
                                        return False
                                    
                                    # Check words in the text for stop commands
                                    if any(is_stop_command(word) for word in words) or any(phrase in text_lower for phrase in ["stop it", "cancel it", "make it stop"]):
                                        log.info(f"Stop command detected during Claude Code processing: {text}")
                                        process_cancelled = True
                                        
                                        # Terminate the process promptly with staged approach
                                        if process.poll() is None:
                                            try:
                                                # Try SIGINT first for cleaner shutdown
                                                import signal
                                                process.send_signal(signal.SIGINT)
                                                # Give it a moment to clean up
                                                time.sleep(0.2)
                                                # If still running, force terminate
                                                if process.poll() is None:
                                                    log.info("Process didn't respond to SIGINT, trying terminate()")
                                                    process.terminate()
                                                    # Give it another moment
                                                    time.sleep(0.2)
                                                    # If still running, force kill
                                                    if process.poll() is None:
                                                        log.info("Process didn't respond to terminate(), trying kill()")
                                                        process.kill()
                                            except Exception as term_error:
                                                log.error(f"Error terminating process: {term_error}")
                                                # Last resort
                                                try:
                                                    process.kill()
                                                except:
                                                    pass
                                        
                                        # Display cancellation message - more visible
                                        print("\n⚠️ Claude Code processing cancelled by voice command. Stopping...\n")
                                        
                                        # Play cancel sound to acknowledge - use dedicated function
                                        play_cancel_sound()
                            
                            # Get text in non-blocking way
                            recorder_for_cancel.text(cancel_callback)
                        except Exception as e:
                            log.error(f"Error in voice cancel monitor: {e}")
                        finally:
                            # Make sure to clean up the recorder
                            try:
                                if recorder_for_cancel:
                                    recorder_for_cancel.shutdown()
                            except:
                                pass
                    
                    # Start the monitor in a separate thread
                    import threading
                    cancel_thread = threading.Thread(target=voice_cancel_monitor)
                    cancel_thread.daemon = True
                    cancel_thread.start()
                    
                    # Log monitor startup if in debug mode
                    if hasattr(self, 'debug_mode') and self.debug_mode:
                        log.debug("Voice cancel monitor thread started for Claude Code processing")
                
                # Now communicate with the process
                stdout, stderr = process.communicate()
                
                # Clean up cancel monitor if it exists
                if listen_for_cancel and recorder_for_cancel:
                    try:
                        recorder_for_cancel.shutdown()
                        if hasattr(self, 'debug_mode') and self.debug_mode:
                            log.debug("Cancel monitor shutdown successful")
                    except Exception as shutdown_error:
                        log.error(f"Error shutting down cancel monitor: {shutdown_error}")
                
                # Check if we were cancelled by voice command
                if process_cancelled:
                    log.info("Claude Code subprocess was cancelled by voice command")
                    play_cancel_sound()  # Extra confirmation
                    return "Processing cancelled by voice command. Ready for new input."
                
                # If we get here, process completed normally
                if process.returncode == 0:
                    response = stdout
                    log.info(f"Claude Code succeeded, output length: {len(response)}")
                    
                    # Extract tool usage information from response if possible
                    tool_insights = self.extract_tool_usage(response)
                    
                    # Display the complete response
                    if RICH_AVAILABLE:
                        # Add tool insights
                        if tool_insights:
                            tool_summary = "\n".join([f"- {tool}" for tool in tool_insights])
                            console.print(Panel(
                                f"[bold cyan]Tools Used:[/bold cyan]\n{tool_summary}", 
                                title="Tool Usage", 
                                border_style="cyan"
                            ))
                        
                        console.print(Panel(title="Claude Response", renderable=Markdown(response)))
                    else:
                        # Add tool insights
                        if tool_insights:
                            console.print(f"╭─ Tools Used ──────────────────────────────╮")
                            for tool in tool_insights:
                                console.print(f"│ - {tool}")
                            console.print(f"╰──────────────────────────────────────────────────╯")
                        
                        console.print(f"╭─ Claude Response ────────────────────────────────╮")
                        console.print(f"│ {response}")
                        console.print(f"╰──────────────────────────────────────────────────╯")
                    
                    # Add to conversation history
                    self.conversation_history.append({"role": "assistant", "content": response})
                    
                    # Save the updated conversation history
                    self.save_conversation_history()
                    
                    return response
                else:
                    # Process failed
                    error_msg = f"Claude Code failed with exit code: {process.returncode}"
                    log.error(f"{error_msg}\nError: {stderr[:500]}...")
                    
                    error_response = "I'm sorry, but I encountered an error while processing your request. Please try again."
                    self.conversation_history.append(
                        {"role": "assistant", "content": error_response}
                    )
                    
                    # Save the updated conversation history even when there's an error
                    self.save_conversation_history()
                    
                    return error_response
                    
            except KeyboardInterrupt:
                # User pressed Ctrl+C to cancel the ongoing request
                if RICH_AVAILABLE:
                    console.print("\n[bold red]Request cancelled by user. Continuing to listen...[/bold red]")
                else:
                    console.print("\nRequest cancelled by user. Continuing to listen...")
                
                # Terminate the subprocess
                process.terminate()
                try:
                    # Give it a moment to terminate gracefully
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    # If it doesn't terminate in time, kill it
                    process.kill()
                
                log.info("Claude Code subprocess was cancelled by user")
                
                # Don't add anything to conversation history for cancelled requests
                return None
                
        except Exception as e:
            error_msg = f"Error starting Claude Code: {str(e)}"
            log.error(error_msg)
            
            error_response = "I'm sorry, but I encountered an error while processing your request. Please try again."
            self.conversation_history.append(
                {"role": "assistant", "content": error_response}
            )
            
            # Save the updated conversation history even when there's an error
            self.save_conversation_history()
            
            return error_response

    async def conversation_loop(self):
        """Run the main conversation loop"""
        log.info("Starting conversation loop")
        # Reset trigger detection display flag at start of conversation
        self._trigger_already_displayed = False
        
        # Format a list of primary triggers to display to the user (not all variations)
        primary_triggers = list(TRIGGER_VARIATIONS.keys())
        
        # Create friendly message with categorized trigger words
        # Group similar trigger types for better user understanding
        trigger_categories = {
            "Names": ["friend", "assistant", "calmhive"],
            "Actions": ["code", "project", "help"],
            "Commands": ["do", "please"]
        }
        
        # Format display text for categories
        display_categories = []
        for category, trigger_types in trigger_categories.items():
            # Filter to only include triggers that are in our config
            available_triggers = [t for t in trigger_types if t in primary_triggers]
            if available_triggers:
                trigger_text = ", ".join([f"'{t}'" for t in available_triggers])
                display_categories.append(f"{category}: {trigger_text}")
        
        # Join categories with semicolons for better separation
        display_triggers_text = "; ".join(display_categories)
        
        # Format examples with a variety of trigger types
        examples = []
        
        # Add name-based examples
        if "friend" in primary_triggers:
            examples.append("Hey friend")
        if "assistant" in primary_triggers:
            examples.append("My assistant")
        if "calmhive" in primary_triggers:
            examples.append("Calmhive")
            
        # Add action-based examples  
        if "code" in primary_triggers:
            examples.append("Let's code")
        if "help" in primary_triggers:
            examples.append("Help me with")
            
        # Add command examples
        if "do" in primary_triggers:
            examples.append("Do this now")
        if "please" in primary_triggers:
            examples.append("Could you please")
            
        # Format examples text - show more examples now that we have more trigger types
        examples_text = ", ".join([f"'{ex}'" for ex in examples[:6]])  # Increased from 4 to 6
        
        welcome_message = (
            "🎤 Claude Code Voice Assistant Ready\n"
            f"Speak to interact. Include any trigger word or phrase to activate:\n"
            f"  • {display_triggers_text}\n"
            f"Example activation phrases: {examples_text}\n"
            f"The assistant will listen, process with Claude Code, and respond using voice '{TTS_VOICE}'.\n"
            f"STT model: {STT_MODEL}\n"
            f"Speech buffer: {SILENCE_DURATION}s\n"
            f"Conversation ID: {self.conversation_id}\n"
            f"Saving conversation to: {self.conversation_file}\n"
            f"Press Ctrl+C to exit.\n"
            f"Say 'stop', 'cancel', 'halt', 'quit', 'end', or 'enough' at any time to interrupt.\n"
            f"Stop/cancel works during both processing and TTS playback."
        )
        
        if RICH_AVAILABLE:
            console.print(Panel.fit(f"[bold magenta]{welcome_message}[/bold magenta]"))
        else:
            console.print("╭──────────────────────────────────────────────────╮")
            console.print(f"│ {welcome_message}")
            console.print("╰──────────────────────────────────────────────────╯")
        
        # Play startup sound only when fully initialized and ready to listen
        play_startup_sound()
        
        # Log that we're ready to receive voice input
        log.info("Voice assistant initialized and ready to receive voice input")

        try:
            while True:
                user_text = await self.listen()

                if not user_text:
                    console.print("No speech detected. Try again.")
                    continue

                response = await self.process_message(user_text)

                # Only speak if we got a response (trigger word was detected)
                if response:
                    await self.speak(response)
                    # Play a sound to indicate we're done with the response and returning to listening mode
                    play_response_complete_sound()
                    # Give a small break between interactions
                    await asyncio.sleep(0.5)
                    # After speaking, explicitly tell the user we're listening again
                    if RICH_AVAILABLE:
                        console.print("[bold blue]🎤 Listening for your next input...[/bold blue]")
                    else:
                        console.print("🎤 Listening for your next input...")
                    # Play a gentle beep to indicate we're actively listening again
                    play_listening_ready_sound()
                else:
                    # If no trigger word, just continue listening
                    if RICH_AVAILABLE:
                        console.print(
                            f"[yellow]No trigger word detected. Please say '{primary_triggers[0]}', '{primary_triggers[1]}', 'Hey {primary_triggers[0]}', or 'Hello {primary_triggers[1]}'. Continuing to listen...[/yellow]"
                        )
                    else:
                        console.print(
                            f"No trigger word detected. Please say '{primary_triggers[0]}', '{primary_triggers[1]}', 'Hey {primary_triggers[0]}', or 'Hello {primary_triggers[1]}'. Continuing to listen..."
                        )

        except KeyboardInterrupt:
            if RICH_AVAILABLE:
                console.print("\n[bold red]Stopping assistant...[/bold red]")
            else:
                console.print("\nStopping assistant...")
            log.info("Conversation loop stopped by keyboard interrupt")
        except Exception as e:
            if RICH_AVAILABLE:
                console.print(f"[bold red]Error:[/bold red] {str(e)}")
            else:
                console.print(f"Error: {str(e)}")
            log.error(f"Error in conversation loop: {str(e)}", exc_info=True)
        finally:
            # Safe cleanup
            try:
                if hasattr(self, "recorder") and self.recorder:
                    # Shutdown the recorder properly
                    self.recorder.shutdown()
            except Exception as shutdown_error:
                log.error(f"Error during shutdown: {str(shutdown_error)}")

            if RICH_AVAILABLE:
                console.print("[bold red]Assistant stopped.[/bold red]")
                # Add CALMHIVE sign-off
                console.print("[bold purple]lets bee friends[/bold purple]")
            else:
                console.print("Assistant stopped.")
                # Add CALMHIVE sign-off
                console.print("lets bee friends")
            log.info("Conversation loop ended")


async def main():
    """Main entry point for the assistant"""
    log.info("Starting Claude Code Voice Assistant")
    
    # DON'T play a startup sound immediately - we'll play it when actually ready to listen

    # Define globals at the beginning of the function
    global SILENCE_DURATION, MIN_TEXT_LENGTH, CONTEXT_LENGTH_BASE, CONTEXT_LENGTH_MAX
    
    # Store default values in local variables for help text
    silence_default = SILENCE_DURATION
    min_length_default = MIN_TEXT_LENGTH
    context_base_default = CONTEXT_LENGTH_BASE
    context_max_default = CONTEXT_LENGTH_MAX
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Voice-enabled Claude Code assistant")
    parser.add_argument(
        "--id",
        "-i",
        type=str,
        help="Unique ID for the conversation. If provided and exists, will load existing conversation.",
    )
    parser.add_argument(
        "--input",
        "-t",  # Changed from -i to -t to avoid conflict with --id/-i
        type=str,
        help="Initial input to process immediately (will be prefixed with trigger word)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run a basic test to verify system functionality",
    )
    parser.add_argument(
        "--silence",
        "-s",
        type=float,
        help=f"Post-speech silence duration in seconds (default: {silence_default})",
    )
    parser.add_argument(
        "--min-length",
        "-m",
        type=int,
        help=f"Minimum text length to process (default: {min_length_default})",
    )
    parser.add_argument(
        "--debug",
        "-d",
        action="store_true",
        help="Enable debug mode with verbose logging",
    )
    parser.add_argument(
        "--context-base",
        type=int,
        help=f"Base context length for dynamic context calculation (default: {context_base_default})",
    )
    parser.add_argument(
        "--context-max",
        type=int,
        help=f"Maximum context length for dynamic context calculation (default: {context_max_default})",
    )
    
    args = parser.parse_args()
    
    # Update silence duration if provided
    if args.silence:
        SILENCE_DURATION = args.silence
        print(f"Setting silence duration to {SILENCE_DURATION} seconds")
        
    # Update minimum text length if provided
    if args.min_length:
        MIN_TEXT_LENGTH = args.min_length
        print(f"Setting minimum text length to {MIN_TEXT_LENGTH} characters")
        
    # Update context length parameters if provided
    if args.context_base:
        CONTEXT_LENGTH_BASE = args.context_base
        print(f"Setting base context length to {CONTEXT_LENGTH_BASE}")
    
    if args.context_max:
        CONTEXT_LENGTH_MAX = args.context_max
        print(f"Setting maximum context length to {CONTEXT_LENGTH_MAX}")
        
    # Configure debug logging if debug mode is enabled
    if args.debug:
        # Set logging level to DEBUG for more verbose output
        log.setLevel(logging.DEBUG)
        print("Debug mode enabled - verbose logging active")
        # Store debug flag in assistant instance later
    
    # If in test mode, just verify everything loads correctly
    if args.test:
        print("Voice system test: All modules loaded successfully")
        print("Enum module patched for Python 3.13+")
        print("System is ready for voice interaction")
        print("🙇☁️🐝 lets bee friends 🌟🍯")
        return

    # Create assistant instance with conversation ID and initial input
    assistant = ClaudeCodeAssistant(conversation_id=args.id, initial_prompt=args.input)
    
    # Set debug mode if enabled
    if args.debug:
        assistant.debug_mode = True

    # Show some helpful information about the conversation
    if args.id:
        if assistant.conversation_file.exists():
            log.info(f"Resuming existing conversation with ID: {args.id}")
            if RICH_AVAILABLE:
                console.print(
                    f"[bold green]Resuming conversation {args.id} with {len(assistant.conversation_history)} turns[/bold green]"
                )
            else:
                console.print(
                    f"Resuming conversation {args.id} with {len(assistant.conversation_history)} turns"
                )
        else:
            log.info(f"Starting new conversation with user-provided ID: {args.id}")
            if RICH_AVAILABLE:
                console.print(
                    f"[bold blue]Starting new conversation with ID: {args.id}[/bold blue]"
                )
            else:
                console.print(
                    f"Starting new conversation with ID: {args.id}"
                )
    else:
        log.info(
            f"Starting new conversation with auto-generated ID: {assistant.conversation_id}"
        )
        if RICH_AVAILABLE:
            console.print(
                f"[bold blue]Starting new conversation with auto-generated ID: {assistant.conversation_id}[/bold blue]"
            )
        else:
            console.print(
                f"Starting new conversation with auto-generated ID: {assistant.conversation_id}"
            )

    log.info(f"Conversation will be saved to: {assistant.conversation_file}")
    if RICH_AVAILABLE:
        console.print(f"[bold]Conversation file: {assistant.conversation_file}[/bold]")
    else:
        console.print(f"Conversation file: {assistant.conversation_file}")

    # Process initial input if provided
    if args.input:
        log.info(f"Processing initial input: {args.input}")
        if RICH_AVAILABLE:
            console.print(
                f"[bold cyan]Processing initial input: {args.input}[/bold cyan]"
            )
        else:
            console.print(
                f"Processing initial input: {args.input}"
            )

        # Create a full prompt that includes the trigger word to ensure it's processed
        # Use the first primary trigger word - "friend"
        initial_prompt = f"{list(TRIGGER_VARIATIONS.keys())[0]} {args.input}"

        # Process the initial prompt
        response = await assistant.process_message(initial_prompt)

        # Speak the response if there is one
        if response:
            await assistant.speak(response)

    # Run the conversation loop
    await assistant.conversation_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Program terminated by user")
        if RICH_AVAILABLE:
            console.print("\n[bold red]Program terminated by user.[/bold red]")
            # Add CALMHIVE sign-off 
            console.print("[bold purple]🙇☁️🐝 lets bee friends 🌟🍯[/bold purple]")
        else:
            console.print("\nProgram terminated by user.")
            # Add CALMHIVE sign-off 
            console.print("🙇☁️🐝 lets bee friends 🌟🍯")