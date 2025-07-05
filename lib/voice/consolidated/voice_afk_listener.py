#!/usr/bin/env python3
"""
CALMHIVE Voice AFk Listener
Listens for voice commands and interacts with AFk processes
Created: May 15, 2025
"""

import os
import sys
import json
import time
import yaml
import argparse
import logging
from pathlib import Path
import subprocess
import tempfile
import threading
import signal
import asyncio
from datetime import datetime

# Try importing optional packages
try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    console = Console()
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Rich library not available, using basic output formatting")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed, skipping .env file loading")

try:
    import openai
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("OpenAI package not available, TTS functionality limited")

try:
    from RealtimeSTT import AudioToTextRecorder
    REALTIMESTT_AVAILABLE = True
except ImportError:
    REALTIMESTT_AVAILABLE = False
    print("RealtimeSTT not available, voice recognition disabled")

try:
    import sounddevice as sd
    import soundfile as sf
    import numpy as np
    AUDIO_LIBS_AVAILABLE = True
except ImportError:
    AUDIO_LIBS_AVAILABLE = False
    print("Audio libraries not available, sound capabilities limited")

# Set up logging
LOG_DIR = os.path.expanduser("~/Library/Logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, "calmhive_afk_voice.log")),
        logging.StreamHandler()
    ]
)
log = logging.getLogger("afk_voice")

# Default configuration
DEFAULT_STT_MODEL = "small.en"
DEFAULT_TTS_VOICE = "nova"
DEFAULT_TRIGGERS = ["claude", "cloud", "assistant", "hey", "ok", "voice"]
SILENCE_DURATION = 2.0  # Seconds of silence before stopping recording

# Directory structure
CLAUDE_DIR = os.path.expanduser("~/.claude")
CALMHIVE_DIR = os.path.join(CLAUDE_DIR, "calmhive")
VOICE_DIR = os.path.join(CALMHIVE_DIR, "lib/voice")
VOICE_OUTPUT_DIR = os.path.join(VOICE_DIR, "afk_output")
PROCESS_DIR = os.path.join(CLAUDE_DIR, "afk/processes")
LOG_DIR = os.path.join(CLAUDE_DIR, "afk/logs")

# Ensure required directories exist
os.makedirs(VOICE_OUTPUT_DIR, exist_ok=True)

# Generate a beep sound
def generate_beep(frequency=700, duration=0.2, volume=0.5, is_rising=False, 
                  is_falling=False, is_double=False):
    """Generate a beep sound with specified parameters"""
    if not AUDIO_LIBS_AVAILABLE:
        return False
        
    try:
        # Generate audio
        sample_rate = 44100
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        
        if is_rising:
            # Rising tone
            freq = np.linspace(frequency * 0.7, frequency * 1.3, int(sample_rate * duration))
            beep = volume * np.sin(2 * np.pi * freq * t / sample_rate)
        elif is_falling:
            # Falling tone
            freq = np.linspace(frequency * 1.3, frequency * 0.7, int(sample_rate * duration))
            beep = volume * np.sin(2 * np.pi * freq * t / sample_rate)
        elif is_double:
            # Double beep
            half_dur = int(sample_rate * duration / 2.2)
            beep1 = volume * np.sin(2 * np.pi * frequency * t[:half_dur])
            beep2 = volume * np.sin(2 * np.pi * (frequency * 1.2) * t[:half_dur])
            silence = np.zeros(int(sample_rate * 0.05))
            beep = np.concatenate([beep1, silence, beep2])
        else:
            # Regular tone
            beep = volume * np.sin(2 * np.pi * frequency * t)
            
        # Play the sound
        sd.play(beep, sample_rate)
        sd.wait()
        return True
    except Exception as e:
        log.error(f"Sound error: {e}")
        return False

def play_notification_sound():
    """Play a notification sound"""
    return generate_beep(frequency=800, duration=0.15, volume=0.4, is_double=True)

def play_activation_sound():
    """Play an activation sound"""
    return generate_beep(frequency=900, duration=0.2, volume=0.5, is_rising=True)

def play_deactivation_sound():
    """Play a deactivation sound"""
    return generate_beep(frequency=900, duration=0.2, volume=0.5, is_falling=True)

def play_success_sound():
    """Play a success sound"""
    if generate_beep(frequency=1000, duration=0.1, volume=0.4):
        time.sleep(0.05)
        return generate_beep(frequency=1200, duration=0.15, volume=0.4)
    return False

def play_error_sound():
    """Play an error sound"""
    if generate_beep(frequency=400, duration=0.2, volume=0.5):
        time.sleep(0.05)
        return generate_beep(frequency=350, duration=0.3, volume=0.5)
    return False

class VoiceAFkListener:
    """Voice listener and command processor for AFk processes"""
    
    def __init__(self, process_id, background_mode=False):
        """Initialize the voice listener"""
        self.process_id = process_id
        self.background_mode = background_mode
        self.recorder = None
        self.client = None
        self.running = False
        self.voice_config = None
        self.process_info = None
        self.last_command_time = 0
        self.command_cooldown = 3  # Seconds between commands
        
        # Initialize OpenAI client if possible
        if OPENAI_AVAILABLE and os.environ.get("OPENAI_API_KEY"):
            self.client = OpenAI()
        
        log.info(f"Initializing voice listener for AFk process: {process_id}")
        log.info(f"Background mode: {background_mode}")
        
        # Load configurations
        self.load_configs()
        
    def load_configs(self):
        """Load voice and process configurations"""
        # Load voice configuration
        self.voice_config = self.load_voice_config()
        if not self.voice_config:
            log.error("Failed to load voice configuration. Creating new one.")
            self.voice_config = {
                "process_id": self.process_id,
                "stt_model": DEFAULT_STT_MODEL,
                "tts_voice": DEFAULT_TTS_VOICE,
                "voice_triggers": ",".join(DEFAULT_TRIGGERS),
                "status": "initialized",
                "last_update": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "voice_commands": [
                    "status",
                    "progress",
                    "pause",
                    "resume",
                    "summarize",
                    "complete"
                ],
                "voice_interactions": []
            }
            self.save_voice_config()
        
        # Load process information
        self.process_info = self.load_process_info()
        if not self.process_info:
            log.error("Failed to load process information.")
            if not self.background_mode:
                self.speak("Failed to load process information. Please check process ID.")
            return False
            
        return True
    
    def load_voice_config(self):
        """Load voice configuration for the process"""
        config_file = os.path.join(VOICE_OUTPUT_DIR, f"{self.process_id}.voice.json")
        try:
            if os.path.exists(config_file):
                with open(config_file, "r") as f:
                    return json.load(f)
            else:
                log.warning(f"Voice configuration file not found: {config_file}")
                return None
        except Exception as e:
            log.error(f"Failed to load voice configuration: {e}")
            return None
    
    def save_voice_config(self):
        """Save voice configuration for the process"""
        config_file = os.path.join(VOICE_OUTPUT_DIR, f"{self.process_id}.voice.json")
        try:
            # Update last_update timestamp
            self.voice_config["last_update"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            
            with open(config_file, "w") as f:
                json.dump(self.voice_config, f, indent=2)
            return True
        except Exception as e:
            log.error(f"Failed to save voice configuration: {e}")
            return False
    
    def load_process_info(self):
        """Load process information"""
        process_file = os.path.join(PROCESS_DIR, f"{self.process_id}.json")
        try:
            if os.path.exists(process_file):
                with open(process_file, "r") as f:
                    return json.load(f)
            else:
                log.warning(f"Process file not found: {process_file}")
                return None
        except Exception as e:
            log.error(f"Failed to load process information: {e}")
            return None
    
    def add_interaction(self, interaction_type, content):
        """Add an interaction to the voice configuration"""
        if not self.voice_config:
            return False
            
        interaction = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "type": interaction_type,
            "content": content
        }
        
        self.voice_config["voice_interactions"].append(interaction)
        return self.save_voice_config()
    
    def setup_recorder(self):
        """Set up the speech recognition recorder"""
        if not REALTIMESTT_AVAILABLE:
            log.error("RealtimeSTT not available, cannot set up recorder")
            return False
            
        try:
            # Get STT model from config
            stt_model = self.voice_config.get("stt_model", DEFAULT_STT_MODEL)
            
            log.info(f"Setting up STT recorder with model: {stt_model}")
            
            self.recorder = AudioToTextRecorder(
                model=stt_model,
                language="en",
                post_speech_silence_duration=SILENCE_DURATION,
                spinner=False,
                print_transcription_time=False,
                enable_realtime_transcription=True
            )
            
            log.info("Recorder initialized successfully")
            return True
        except Exception as e:
            log.error(f"Failed to set up recorder: {e}")
            return False
    
    def speak(self, text):
        """Generate speech output"""
        if not text:
            return False
            
        log.info(f"Generating speech: {text[:50]}...")
        
        # Add the TTS interaction
        self.add_interaction("tts_output", text)
        
        # If OpenAI client is not available, just print the text
        if not self.client:
            if RICH_AVAILABLE:
                console.print(Panel(f"[bold]Voice Output:[/bold]\n{text}"))
            else:
                print(f"\n--- Voice Output ---\n{text}\n------------------\n")
            return True
            
        try:
            # Get TTS voice from config
            tts_voice = self.voice_config.get("tts_voice", DEFAULT_TTS_VOICE)
            
            # Generate speech
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_filename = temp_file.name
                
                response = self.client.audio.speech.create(
                    model="tts-1",
                    voice=tts_voice,
                    input=text
                )
                
                response.stream_to_file(temp_filename)
            
            # Play audio
            if AUDIO_LIBS_AVAILABLE:
                data, samplerate = sf.read(temp_filename)
                sd.play(data, samplerate)
                sd.wait()
            else:
                # Fallback to system command on macOS
                subprocess.run(["afplay", temp_filename], check=False)
                
            # Clean up
            os.unlink(temp_filename)
            
            log.info("Speech generation completed")
            return True
        except Exception as e:
            log.error(f"Failed to generate speech: {e}")
            
            # Fallback to print
            if RICH_AVAILABLE:
                console.print(Panel(f"[bold red]Failed to generate speech.[/bold red]\n[bold]Text:[/bold] {text}"))
            else:
                print(f"\n--- Voice Output ---\n{text}\n------------------\n")
            
            return False
    
    def listen_for_command(self):
        """Listen for a voice command"""
        if not self.recorder:
            log.error("Recorder not initialized")
            return None
            
        try:
            log.info("Listening for command...")
            
            # Play sound to indicate listening
            play_notification_sound()
            
            result_container = {"text": "", "done": False}
            
            def callback(text):
                if text:
                    log.info(f"Heard: {text}")
                    result_container["text"] = text
                result_container["done"] = True
            
            # Start recording
            self.recorder.text(callback)
            
            # Wait for result
            timeout = 10  # seconds
            start_time = time.time()
            
            while not result_container["done"] and time.time() - start_time < timeout:
                time.sleep(0.1)
                
            # Check for timeout
            if not result_container["done"]:
                log.warning("Timeout waiting for speech")
                return None
                
            # Add the interaction
            self.add_interaction("voice_command", result_container["text"])
            
            return result_container["text"]
        except Exception as e:
            log.error(f"Error listening for command: {e}")
            return None
    
    def process_command(self, command_text):
        """Process a voice command"""
        if not command_text:
            return False
            
        # Check command cooldown
        current_time = time.time()
        if current_time - self.last_command_time < self.command_cooldown:
            log.info(f"Command cooldown active, ignoring: {command_text}")
            return False
            
        self.last_command_time = current_time
        
        log.info(f"Processing command: {command_text}")
        
        # Convert to lowercase for matching
        command_lower = command_text.lower()
        
        # Simple command mapping
        if any(word in command_lower for word in ["status", "progress", "update", "how", "going"]):
            return self.command_status()
        elif any(word in command_lower for word in ["pause", "stop", "wait", "hold"]):
            return self.command_pause()
        elif any(word in command_lower for word in ["resume", "continue", "start", "go"]):
            return self.command_resume()
        elif any(word in command_lower for word in ["summarize", "summary", "results", "findings"]):
            return self.command_summarize()
        elif any(word in command_lower for word in ["complete", "finish", "done", "end"]):
            return self.command_complete()
        else:
            # Unknown command
            log.warning(f"Unknown command: {command_text}")
            self.speak("I'm sorry, I didn't understand that command. You can ask for status, pause, resume, summarize, or complete.")
            return False
    
    def command_status(self):
        """Handle status command"""
        log.info("Processing status command")
        
        # Reload process info
        self.process_info = self.load_process_info()
        if not self.process_info:
            self.speak("I'm sorry, I couldn't retrieve process information.")
            return False
            
        # Get process status
        status = self.process_info.get("status", "unknown")
        current_iteration = self.process_info.get("current_iteration", 0)
        total_iterations = self.process_info.get("iterations", 0)
        current_phase = self.process_info.get("current_phase", "")
        
        # Calculate progress percentage
        progress_pct = 0
        if total_iterations > 0:
            progress_pct = int((current_iteration / total_iterations) * 100)
        
        # Construct status message
        status_message = f"The process is currently {status}. "
        status_message += f"Progress is at {progress_pct}% - iteration {current_iteration} of {total_iterations}. "
        
        if current_phase:
            status_message += f"Current phase: {current_phase}. "
            
        # Add additional information based on status
        if status == "active" or status == "running":
            status_message += "Processing is ongoing. I'll notify you when significant progress is made."
        elif status == "completed":
            status_message += "The process has completed successfully. You can ask me to summarize the results."
        elif status == "failed":
            status_message += "The process has failed. Check the logs for more information."
        elif status == "stopped":
            status_message += "The process has been stopped. You can resume it if needed."
        
        # Speak the status
        self.speak(status_message)
        return True
    
    def command_pause(self):
        """Handle pause command"""
        log.info("Processing pause command")
        
        # This would ideally pause the process, but for now just simulate
        self.speak("I've received your request to pause the process. This functionality is not yet implemented.")
        return True
    
    def command_resume(self):
        """Handle resume command"""
        log.info("Processing resume command")
        
        # This would ideally resume the process, but for now just simulate
        self.speak("I've received your request to resume the process. This functionality is not yet implemented.")
        return True
    
    def command_summarize(self):
        """Handle summarize command"""
        log.info("Processing summarize command")
        
        # Reload process info
        self.process_info = self.load_process_info()
        if not self.process_info:
            self.speak("I'm sorry, I couldn't retrieve process information.")
            return False
            
        # Get process log file
        log_file = os.path.join(LOG_DIR, f"{self.process_id}.log")
        if not os.path.exists(log_file):
            self.speak("I'm sorry, I couldn't find the process log file.")
            return False
            
        # Read the latest portion of the log
        try:
            # Read last 50 lines of log
            with open(log_file, "r") as f:
                log_content = f.readlines()
                log_tail = "".join(log_content[-50:])
                
            # Extract summary if available (look for EXECUTION_SUMMARY section)
            summary = ""
            if "[EXECUTION_SUMMARY]" in log_tail:
                summary_section = log_tail.split("[EXECUTION_SUMMARY]")[1].split("```")[0]
                summary = f"Here's a summary of the process execution: {summary_section}"
            else:
                # Generate a basic summary from process info
                status = self.process_info.get("status", "unknown")
                current_iteration = self.process_info.get("current_iteration", 0)
                total_iterations = self.process_info.get("iterations", 0)
                query = self.process_info.get("query", "")
                
                summary = f"I've been working on your request: {query}. "
                summary += f"Current status is {status}, "
                summary += f"completing {current_iteration} of {total_iterations} planned iterations. "
                
                # Add more information based on status
                if status == "completed":
                    summary += "The process has finished successfully."
                elif status == "failed":
                    summary += "The process encountered an error and failed to complete."
                elif status == "active" or status == "running":
                    summary += "The process is still running. Check back later for final results."
                    
            # Speak the summary
            self.speak(summary)
            return True
        except Exception as e:
            log.error(f"Error generating summary: {e}")
            self.speak("I'm sorry, I encountered an error while generating the summary.")
            return False
    
    def command_complete(self):
        """Handle complete command"""
        log.info("Processing complete command")
        
        # This would ideally finalize the process, but for now just simulate
        self.speak("I've received your request to complete the process. This functionality is not yet implemented.")
        return True
    
    def check_trigger_words(self, text):
        """Check if text contains any trigger words"""
        if not text:
            return False
            
        # Get triggers from config
        triggers_str = self.voice_config.get("voice_triggers", ",".join(DEFAULT_TRIGGERS))
        triggers = [t.strip().lower() for t in triggers_str.split(",")]
        
        # Convert text to lowercase
        text_lower = text.lower()
        
        # Check for triggers
        for trigger in triggers:
            if trigger in text_lower:
                return True
                
        return False
    
    def passive_listen_loop(self):
        """Run a passive listening loop for trigger detection"""
        if not REALTIMESTT_AVAILABLE:
            log.error("RealtimeSTT not available, cannot run passive listening")
            return False
            
        try:
            log.info("Starting passive listening for trigger words")
            
            # Simplified version of recorder for trigger detection
            # In a real implementation, this would use a more efficient model
            # and lower resource consumption
            trigger_recorder = AudioToTextRecorder(
                model="tiny.en",  # Use smallest model for efficiency
                language="en",
                post_speech_silence_duration=1.0,  # Shorter silence for quicker response
                spinner=False,
                print_transcription_time=False,
                enable_realtime_transcription=True
            )
            
            while self.running:
                result_container = {"text": "", "done": False}
                
                def callback(text):
                    if text:
                        log.info(f"Passive heard: {text}")
                        result_container["text"] = text
                    result_container["done"] = True
                
                # Start recording
                trigger_recorder.text(callback)
                
                # Wait for result
                timeout = 5  # shorter timeout for passive listening
                start_time = time.time()
                
                while not result_container["done"] and time.time() - start_time < timeout and self.running:
                    time.sleep(0.1)
                    
                # Check if we're still running
                if not self.running:
                    break
                    
                # Check for trigger words
                if self.check_trigger_words(result_container["text"]):
                    log.info(f"Trigger word detected: {result_container['text']}")
                    
                    # Play activation sound
                    play_activation_sound()
                    
                    # Add interaction
                    self.add_interaction("trigger_detected", result_container["text"])
                    
                    # Start active listening
                    command = self.listen_for_command()
                    if command:
                        self.process_command(command)
                    
                # Small sleep to prevent too frequent checks
                time.sleep(0.1)
                
            log.info("Passive listening loop terminated")
            return True
        except Exception as e:
            log.error(f"Error in passive listening loop: {e}")
            return False
    
    def check_process_health(self):
        """Check process health and send notifications for important events"""
        try:
            # Load latest process info
            previous_status = self.process_info.get("status", "") if self.process_info else ""
            previous_iteration = self.process_info.get("current_iteration", 0) if self.process_info else 0
            previous_phase = self.process_info.get("current_phase", "") if self.process_info else ""
            
            # Reload process info
            self.process_info = self.load_process_info()
            if not self.process_info:
                return
                
            # Get current status
            current_status = self.process_info.get("status", "")
            current_iteration = self.process_info.get("current_iteration", 0)
            current_phase = self.process_info.get("current_phase", "")
            
            # Check for status changes
            if current_status != previous_status:
                log.info(f"Process status changed: {previous_status} -> {current_status}")
                
                if current_status == "completed":
                    # Play success sound
                    play_success_sound()
                    # Speak completion message
                    self.speak("Good news! The background process has completed successfully. You can ask me to summarize the results.")
                elif current_status == "failed":
                    # Play error sound
                    play_error_sound()
                    # Speak failure message
                    self.speak("I'm sorry, but the background process has failed. Check the logs for more information.")
                
            # Check for iteration changes
            if current_iteration > previous_iteration:
                log.info(f"Process iteration changed: {previous_iteration} -> {current_iteration}")
                
                # Notify about iteration progress every other iteration
                if current_iteration % 2 == 0:
                    total_iterations = self.process_info.get("iterations", 0)
                    progress_pct = 0
                    if total_iterations > 0:
                        progress_pct = int((current_iteration / total_iterations) * 100)
                        
                    # Play notification sound
                    play_notification_sound()
                    # Speak progress message
                    self.speak(f"Progress update: Iteration {current_iteration} of {total_iterations} completed - {progress_pct}% done.")
            
            # Check for phase changes
            if current_phase != previous_phase and current_phase:
                log.info(f"Process phase changed: {previous_phase} -> {current_phase}")
                
                # Play notification sound
                play_notification_sound()
                # Speak phase change message
                self.speak(f"The process has moved to a new phase: {current_phase}.")
                
        except Exception as e:
            log.error(f"Error checking process health: {e}")
    
    def health_check_loop(self):
        """Run a health check loop for process monitoring"""
        log.info("Starting health check loop")
        
        check_interval = 5  # seconds
        
        while self.running:
            # Check process health
            self.check_process_health()
            
            # Sleep before next check
            for _ in range(int(check_interval * 10)):  # Convert to 100ms chunks
                if not self.running:
                    break
                time.sleep(0.1)
                
        log.info("Health check loop terminated")
    
    def start(self):
        """Start the voice listener"""
        log.info("Starting voice listener")
        
        # Update voice configuration
        self.voice_config["status"] = "active"
        self.save_voice_config()
        
        # Set up the recorder
        if REALTIMESTT_AVAILABLE:
            self.setup_recorder()
        
        # Speak startup message
        startup_message = f"Voice assistant activated for background process {self.process_id}. "
        startup_message += "You can ask me for status updates or give commands."
        self.speak(startup_message)
        
        self.running = True
        
        try:
            # Start health check loop in a separate thread
            health_thread = threading.Thread(target=self.health_check_loop)
            health_thread.daemon = True
            health_thread.start()
            
            # Start passive listening if available
            if REALTIMESTT_AVAILABLE:
                self.passive_listen_loop()
            else:
                # If voice recognition not available, just run health checks
                while self.running:
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            log.info("Voice listener interrupted by user")
        except Exception as e:
            log.error(f"Error in voice listener: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the voice listener"""
        log.info("Stopping voice listener")
        
        self.running = False
        
        # Play deactivation sound
        play_deactivation_sound()
        
        # Speak shutdown message
        shutdown_message = "Voice assistant deactivated. Background processing will continue."
        self.speak(shutdown_message)
        
        # Update voice configuration
        self.voice_config["status"] = "inactive"
        self.save_voice_config()
        
        # Cleanup
        if self.recorder:
            self.recorder.shutdown()
            self.recorder = None
            
        log.info("Voice listener stopped")

def main():
    """Main function for AFk voice listener"""
    # Configure argument parser
    parser = argparse.ArgumentParser(description="CALMHIVE Voice AFk Listener")
    parser.add_argument("process_id", help="AFk process ID to monitor")
    parser.add_argument("--background", action="store_true", help="Run in background mode")
    args = parser.parse_args()
    
    # Create and start the voice listener
    listener = VoiceAFkListener(args.process_id, args.background)
    
    # Handle Ctrl+C more gracefully
    def signal_handler(sig, frame):
        log.info("Received signal to terminate")
        if listener:
            listener.stop()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the listener
    listener.start()

if __name__ == "__main__":
    main()