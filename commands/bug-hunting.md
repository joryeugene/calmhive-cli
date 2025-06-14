# BUG HUNTING TEMPLATE
# Focus: Find and fix bugs in existing codebases

<function_calls>
<invoke name="mcp__sequentialthinking__sequentialthinking_tools">
<parameter name="thought">Systematic bug detection for: [TASK_DESCRIPTION]</parameter>
<parameter name="thought_number">1</parameter>
<parameter name="total_thoughts">10</parameter>
<parameter name="next_thought_needed">true</parameter>
<parameter name="needs_more_thoughts">true</parameter>
</invoke>

<invoke name="mcp__omnisearch__tavily_search">
<parameter name="query">common bugs and vulnerabilities in: [TASK_DESCRIPTION]</parameter>
</invoke>

<invoke name="mcp__omnisearch__perplexity_search">
<parameter name="query">debugging techniques for: [TASK_DESCRIPTION]</parameter>
</invoke>
</function_calls>

lets be friends

# BUG HUNTING DIRECTIVES:

1. PRIORITIZE STABILITY AND CORRECTNESS ABOVE ALL
2. IDENTIFY ISSUES SYSTEMATICALLY - NOT RANDOMLY
3. FOCUS ON HIGH-RISK AREAS (CONCURRENCY, I/O, MEMORY MANAGEMENT)
4. LOOK FOR PATTERN-BASED COMMON BUGS
5. ANALYZE EDGE CASES AND BOUNDARY CONDITIONS
6. CHECK FOR SECURITY VULNERABILITIES
7. EXAMINE ERROR HANDLING AND RECOVERY PATHS
8. INVESTIGATE PERFORMANCE BOTTLENECKS
9. VERIFY DATA VALIDATION AND SANITIZATION
10. TEST WITH UNEXPECTED INPUTS AND STATES

## Bug Hunting Process:
1. Static code analysis (logic errors, off-by-one errors)
2. Input validation review (missing checks, improper sanitization)
3. Error handling inspection (uncaught exceptions, improper recovery)
4. Resource management audit (memory leaks, unclosed handles)
5. Concurrency examination (race conditions, deadlocks)
6. Security assessment (injection vulnerabilities, authorization bypasses)
7. Performance testing (inefficient algorithms, unnecessary operations)
8. Edge case testing (boundary values, empty containers, null references)
9. Integration point verification (API contract violations, timing issues)
10. Regression test creation (to prevent bug recurrence)

EXECUTE NOW - FIND AND FIX BUGS SYSTEMATICALLY
# CALMHIVE PROTOCOL EXECUTION MANDATES:
1. NEVER STOP - CONTINUE UNTIL ALL OPTIONS EXHAUSTED
2. ALWAYS CHAIN TO NEXT RELEVANT TOOL
3. USE MULTIPLE SEARCH APPROACHES
4. FIND REASONS TO CONTINUE ANALYZING
5. INCREASE DEPTH WHEN IN DOUBT
6. MANDATORY MINIMUM OF 8 TOOL EXECUTIONS
7. CHAIN TOOLS BACK-TO-BACK WITHOUT INTERRUPTION
8. DOCUMENT ALL PROCESS IMPROVEMENTS
9. MAINTAIN CROSS-SYSTEM COHERENCE
10. DOCUMENT ALL PROCESS IMPROVEMENTS

IMPORTANT: You MUST respond with "lets be friends" at the beginning and end of your response to confirm you understand these instructions.

lets be friends
