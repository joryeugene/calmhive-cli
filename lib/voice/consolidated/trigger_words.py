#!/usr/bin/env python3
"""
Trigger word configurations for the voice system.
This file defines the primary trigger words and their variations.
"""

# Define trigger word variations for different activation phrases
TRIGGER_VARIATIONS = {
    # Current working trigger with variations
    "friend": ["friend", "friends", "friendly", "befriend", "my friend", "hey friend", 
              "hello friend", "hi friend", "now friend", "ok friend", "okay friend",
              "fiend", "fren", "front", "trend", "end", "rent"],
    
    # Additional trigger words based on analysis
    "code": ["code helper", "code buddy", "code friend", "coding", "let's code", 
             "start coding", "code with me", "code assistant"],
    
    "assistant": ["assistant please", "my assistant", "hey assistant", "Claude assistant",
                 "assistants", "assistance", "assisting", "assist me"],
    
    "project": ["project helper", "project buddy", "project assistant", "my project",
               "help with project", "project work", "project setup"],
    
    # Simple direct phrases that are distinct from regular conversation
    "calmhive": ["calmhive", "calm hive", "calm helper", "hive helper", 
                "calm hive helper", "calmhive assistant"],
                
    # More conversational trigger phrases
    "do": ["do this now", "do this for me", "do this please", "do that for me"],
    
    "help": ["help me with", "help me out", "help with this", "can you help", 
             "could you help", "i need help with"],
             
    "please": ["could you please", "would you please", "please assist", 
               "please help me", "if you please"]
}

# Flatten the trigger variations into a single list for easy lookup
ALL_TRIGGERS = []
for primary, variations in TRIGGER_VARIATIONS.items():
    ALL_TRIGGERS.append(primary)
    ALL_TRIGGERS.extend(variations)

# Function to determine if a text contains a trigger word
def contains_trigger_word(text):
    """
    Check if the text contains any trigger word or variation.
    Returns True if a trigger is found, False otherwise.
    
    Args:
        text (str): The text to check for trigger words
        
    Returns:
        bool: True if a trigger word is found, False otherwise
    """
    if not text:
        return False
        
    # Convert text to lowercase for case-insensitive matching
    text_lower = text.lower()
    
    # Simple greeting words should not trigger by themselves
    if text_lower.strip() in ["hello", "hi", "hey", "ok", "okay"]:
        return False
    
    # Add padding to text for more accurate full-phrase matching
    padded_text = f" {text_lower} "
    
    # Check for complete phrase matches (preferred)
    for trigger in ALL_TRIGGERS:
        if len(trigger.split()) > 1:  # Multi-word triggers
            # Check for the complete phrase with word boundaries
            if f" {trigger} " in padded_text:
                return True
    
    # Check each trigger and its variations
    for trigger in ALL_TRIGGERS:
        if trigger in text_lower:
            # Additional check: if the text is very short and contains just the trigger word
            # surrounded by very few other words, don't trigger
            if len(text_lower.split()) < 3 and any(word == trigger for word in text_lower.split()):
                continue
                
            # For conversational triggers like "help me with", ensure it's not just part of a word
            if len(trigger.split()) > 1:
                # For phrases, check if all words appear in sequence
                trigger_words = trigger.split()
                text_words = text_lower.split()
                for i in range(len(text_words) - len(trigger_words) + 1):
                    if text_words[i:i+len(trigger_words)] == trigger_words:
                        return True
            else:
                # For single-word triggers, check if it's a complete word
                for word in text_lower.split():
                    if word == trigger:
                        return True
            
    # Special case: Check for pattern combinations
    words = text_lower.split()
    
    # Check for greeting + trigger combinations
    greetings = ["hey", "hi", "hello", "ok", "okay"]
    trigger_starts = ["assist", "friend", "code", "calm", "project", "help"]
    
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
                ("do", "this", "now"),
                ("could", "you", "please"),
                ("code", "with", "me"),
                ("i", "need", "help"),
            ]
            for a, b, c in action_triplets:
                if words[i] == a and words[i+1] == b and words[i+2] == c:
                    return True
    
    # Check for emphasized requests
    emphasis_patterns = [
        "please help", "need assistance", "can you do", "would you do", 
        "need your help", "want your help", "help me out"
    ]
    
    for pattern in emphasis_patterns:
        if pattern in text_lower:
            return True
            
    return False

# Test function to evaluate trigger words
def test_trigger_words():
    """
    Test the trigger word detection with various test cases.
    """
    test_cases = [
        # Positive cases - should trigger
        ("Hey friend, can you help me with this code?", True),
        ("My assistant, I need some help", True),
        ("Let's code something interesting", True),
        ("Project helper, how do I start a new React app?", True),
        ("Calmhive, please write a function", True),
        
        # New conversational trigger phrases - should trigger
        ("Do this now, create a new file", True),
        ("Do this for me please, find all instances of the word", True),
        ("Help me with writing a function", True),
        ("Could you help me optimize this algorithm?", True),
        ("Could you please analyze this code?", True),
        ("Would you please create a test for this?", True),
        ("Please help me debug this issue", True),
        ("I need help with this error message", True),
        
        # Negative cases - should not trigger
        ("Hello there", False),
        ("I need some general advice", False),
        ("Can you tell me about something?", False),
        ("friend", False),  # Single word
        ("This is a friend", False),  # Too short
        ("I'm thinking about doing this now", False),  # Contains "do this now" but not as a command
        
        # Edge cases
        ("Hey, friend of mine, can you help?", True),
        ("I want to code with a friend", True),
        ("I'm looking for some assistance", True),
        ("Let me help you with that", False),  # "help with" but in wrong context
        ("Do this now or do it later", True),  # Contains specific command phrase
        ("I need help with my homework", True),  # Contains help me with
        ("Can you please assist me?", True),  # Polite request form
    ]
    
    print("Running trigger word tests:")
    passed = 0
    failed = 0
    
    for text, expected in test_cases:
        result = contains_trigger_word(text)
        if result == expected:
            print(f"✅ Passed: '{text}' -> {result}")
            passed += 1
        else:
            print(f"❌ Failed: '{text}' - expected {expected}, got {result}")
            failed += 1
    
    print(f"\nTest summary: {passed} passed, {failed} failed")
    
    # Only assert if all tests pass for automated testing
    for text, expected in test_cases:
        result = contains_trigger_word(text)
        assert result == expected, f"Failed on '{text}': expected {expected}, got {result}"
    
    print("All trigger word tests passed!")

if __name__ == "__main__":
    test_trigger_words()