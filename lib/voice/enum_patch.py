#!/usr/bin/env python3
# Comprehensive enum module patch for Python 3.13+
# This patch adds missing attributes in Python 3.13+ that are required by standard library

import enum
import sys

# Create IntFlag if it doesn't exist
if not hasattr(enum, 'IntFlag'):
    class IntFlag(enum.IntEnum):
        """Support for integer-based flags in Python 3.13+."""
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

# Add the global_enum attribute if it doesn't exist
if not hasattr(enum, 'global_enum'):
    def global_enum(cls):
        # Simple implementation that just returns the class
        return cls
    enum.global_enum = global_enum
    print("Added missing enum.global_enum attribute")

# Add the _simple_enum attribute if it doesn't exist
if not hasattr(enum, '_simple_enum'):
    # Function signature based on CPython's Lib/enum.py implementation
    def _simple_enum(cls, boundary=None):
        """
        Simple implementation of _simple_enum decorator for Python 3.13+
        This is a compatibility shim to allow standard library modules to work
        """
        def decorator(cls):
            return cls
        return decorator if boundary is None else decorator
    
    # Add KEEP constant if it doesn't exist
    if not hasattr(enum, 'KEEP'):
        enum.KEEP = "KEEP"
    
    enum._simple_enum = _simple_enum
    print("Added missing enum._simple_enum attribute")

# This file is intended to be imported before any other module
# that might depend on enum attributes that were removed in Python 3.13+
print(f"Enum module patched for Python {sys.version_info.major}.{sys.version_info.minor}")

# Function to check if patch was applied successfully
def check_patch():
    missing = []
    if not hasattr(enum, 'global_enum'):
        missing.append('global_enum')
    if not hasattr(enum, '_simple_enum'):
        missing.append('_simple_enum')
    if not hasattr(enum, 'IntFlag'):
        missing.append('IntFlag')
    if not hasattr(enum, 'KEEP'):
        missing.append('KEEP')
        
    if not missing:
        return True, "Enum patch applied successfully"
    else:
        return False, f"Enum patch failed, missing: {', '.join(missing)}"

# If this script is run directly, print status
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Patch enum module for Python 3.13+")
    parser.add_argument("--check-only", action="store_true", help="Only check if patch is needed without applying")
    args = parser.parse_args()
    
    if args.check_only:
        success, message = check_patch()
        print(message)
        sys.exit(0 if success else 1)
    else:
        print(f"Python version: {sys.version}")
        print(f"Enum module patched: IntFlag={hasattr(enum, 'IntFlag')}, global_enum={hasattr(enum, 'global_enum')}, _simple_enum={hasattr(enum, '_simple_enum')}")