#!/usr/bin/env python3
"""
CALMHIVE Enhanced Trigger Words for Voice System
Created: May 15, 2025

This module provides enhanced trigger word detection for the CALMHIVE voice system.
It includes a comprehensive list of trigger words and variations to improve recognition.
"""

import re

# Define variations of trigger words to enhance recognition
TRIGGER_VARIATIONS = {
    # Primary assistant name variations
    "claude": ["claude", "cloud", "clod", "clawed", "cloud", "clout", "clown", "claud", 
              "clod", "clawed", "claude's", "clouds", "cloudy"],
              
    # Friendly assistant variations
    "friend": ["friend", "friends", "friendly", "befriend", "my friend", "hey friend", 
              "fiend", "fren", "front", "trend", "end", "rent", "fred", "fried"],
              
    # Code assistant variations
    "code": ["code", "coder", "coding", "encode", "decode", "coded", "codes", 
            "code helper", "code buddy", "let's code", "kode", "coat", "cold"],
            
    # CALMHIVE specific variations
    "calmhive": ["calmhive", "calm hive", "calm-hive", "call hive", "call mine", 
                "calm mind", "calm five", "com hive", "bee hive", "bee helper"],
                
    # Generic assistant variations
    "assistant": ["assistant", "assist", "assistance", "assistive", "assisting", "assists",
                 "assist me", "assistant please", "my assistant", "hey assistant"],
                
    # Action-based triggers
    "help": ["help", "helper", "helping", "helped", "helps", "help me", "can you help",
            "please help", "i need help", "would you help"],
            
    # Common voice assistant activations
    "hey": ["hey", "hi", "hello", "hey there", "hey you", "hey now", "hay", "they", "hay"],
    
    # OK prefix variations (like "OK Google")
    "ok": ["ok", "okay", "ok now", "alright", "all right", "o.k.", "ok then"],
    
    # Voice specific activations
    "voice": ["voice", "voice assistant", "voice helper", "voice mode", "by voice", 
             "with voice", "through voice", "using voice"],
             
    # Generic command triggers
    "command": ["command", "do this", "execute", "run", "perform", "please", "can you", 
               "would you", "could you", "execute command", "run command"],
}

# Additional patterns for compound triggers
COMPOUND_PATTERNS = [
    # Greeting + trigger combinations
    (r"(hey|hi|hello|ok|okay)\s+(claude|friend|assistant|calmhive|code)", 0.9),
    
    # Action phrases
    (r"(let's|let us)\s+(code|build|create|make|generate)", 0.8),
    (r"(help|assist)\s+(me|us)\s+with", 0.8),
    (r"(can|could|would)\s+you\s+(help|assist|show|tell|explain)", 0.7),
    
    # Questions directed at the assistant
    (r"(what|how|why|when|where|who)\s+(can|should|would|could|do|does|is|are)\s+", 0.6),
    
    # Polite requests
    (r"(please|kindly|can you please|would you please)\s+(help|show|tell|explain|create)", 0.7),
    
    # Direct commands
    (r"^(find|create|build|make|show|tell|explain|write)\s+", 0.6),
]

# Flatten the trigger variations into a single list
ALL_TRIGGERS = []
for primary, variations in TRIGGER_VARIATIONS.items():
    ALL_TRIGGERS.append(primary)
    ALL_TRIGGERS.extend(variations)

# Remove duplicates while preserving order
ALL_TRIGGERS = list(dict.fromkeys(ALL_TRIGGERS))

def contains_trigger_word(text, threshold=0.6):
    """
    Enhanced function to check if text contains any trigger word or variation.
    
    Uses a more sophisticated approach with confidence scoring:
    1. Direct matches of trigger words
    2. Compound pattern matching with confidence weights
    3. Partial matches for similar sounding words (handles speech recognition errors)
    
    Args:
        text: The text to check for trigger words
        threshold: Confidence threshold (0.0 to 1.0) for considering a match
        
    Returns:
        Boolean indicating if a trigger was detected with sufficient confidence
    """
    if not text:
        return False
    
    # Convert text to lowercase for case-insensitive matching
    text_lower = text.lower()
    
    # Track confidence score for potential triggers
    max_confidence = 0.0
    
    # Simple greeting words should not trigger by themselves
    if text_lower.strip() in ["hello", "hi", "hey", "ok", "okay"]:
        return False
    
    # 1. Check for exact trigger matches (highest confidence)
    for primary, variations in TRIGGER_VARIATIONS.items():
        # Check primary trigger (highest confidence)
        if f" {primary} " in f" {text_lower} ":
            return True  # Primary trigger with perfect match
            
        # Check for exact matches of variations (high confidence)
        for variant in variations:
            if variant in text_lower:
                # Check if it's a standalone word
                if re.search(r'\b' + re.escape(variant) + r'\b', text_lower):
                    max_confidence = max(max_confidence, 0.9)
                else:
                    # Partial match (embedded in other words)
                    max_confidence = max(max_confidence, 0.7)
                    
    # 2. Check compound patterns
    for pattern, confidence in COMPOUND_PATTERNS:
        if re.search(pattern, text_lower):
            max_confidence = max(max_confidence, confidence)
            
    # 3. Check for partial matches with word similarity
    words = text_lower.split()
    # Longer phrases increase confidence in trigger detection
    if len(words) >= 3:
        # Check each word against triggers
        for word in words:
            # Skip very short words
            if len(word) <= 2:
                continue
                
            for trigger in ALL_TRIGGERS:
                # Skip very short triggers
                if len(trigger) <= 2:
                    continue
                
                # Check for partial matches at word beginnings
                # E.g. "clau" could be a partial "claude"
                if len(word) >= 3 and len(trigger) >= 3:
                    min_len = min(len(word), len(trigger))
                    if word[:min_len] == trigger[:min_len]:
                        # Calculate match percentage
                        similarity = (min_len) / max(len(word), len(trigger))
                        match_confidence = similarity * 0.8  # Scale confidence
                        max_confidence = max(max_confidence, match_confidence)
                
    # Return True if confidence exceeds threshold
    return max_confidence >= threshold

# Test function
def test_trigger_detection():
    """Test function for trigger word detection"""
    test_cases = [
        ("Hello Claude, how are you today?", True),
        ("Hey friend, can you help me with this?", True),
        ("Let's code a new website", True),
        ("I need help with my homework", False),  # No clear trigger
        ("Hey Clod, are you there?", True),  # Misspelled but similar
        ("Just saying hi", False),
        ("Calmhive, what's the weather?", True),
        ("Call hive for assistance", True),  # Similar sounding
        ("Ok computer", False),  # Wrong assistant name
        ("Hey there Claude", True),
    ]
    
    success = 0
    for text, expected in test_cases:
        result = contains_trigger_word(text)
        if result == expected:
            success += 1
            status = "✓"
        else:
            status = "✗"
        print(f"{status} Text: \"{text}\" -> Detected: {result}, Expected: {expected}")
    
    print(f"Passed {success}/{len(test_cases)} tests")

if __name__ == "__main__":
    # Run test function
    test_trigger_detection()