# Claude — AI Agent Working Guide

This document explains how to work effectively with Claude (AI) on this project, what Claude can do, and what it cannot.

## Quick Start: How to Use Claude Effectively

### ✅ Claude is good at:

1. **Designing systems & data models**
   - "Design the database schema for [feature]"
   - "What should the API contract look like?"
   - "Draw an architecture diagram for [flow]"

2. **Writing test specifications**
   - "Write test cases for [component]"
   - "What edge cases should we test for [feature]?"
   - "Create a test spec for form validation"

3. **Explaining technical concepts**
   - "Explain why we chose [technology]"
   - "What's the difference between [pattern A] and [pattern B]?"

4. **Documentation & decision records**
   - "Create an ADR for [decision]"
   - "Document the API endpoints for [module]"
   - "Write a troubleshooting guide for [process]"

5. **Code patterns & structure**
   - "What's the best folder organization for [feature]?"
   - "Show me a template for [component type]"
   - "What are React hook patterns for [scenario]?"

### ❌ Claude is NOT a:

- **Code writer** — Claude doesn't write production code; developers do (guided by tests)
- **Decision maker** — Isaac decides priorities, scope, and business direction
- **Debugger** — Humans debug; Claude helps think through problems
- **Designer** — Humans design UI; Claude suggests structure and patterns
- **DevOps engineer** — Humans deploy; Claude documents procedures
- **QA tester** — Humans test; Claude helps define what to test

## How to Ask Claude

### Good Questions

```
"Help me design a test spec for the Donation form.
It should validate: email required, amount > 0, type must be Monetary or InKind.
What edge cases am I missing?"
```

**Why this is good:** Clear context, specific component, asks for completeness

---

```
"Create an ADR explaining why we chose Supabase over Firebase for this project,
considering: auth needs, cost, scalability, and team familiarity."
```

**Why this is good:** Specific decision, context, criteria

---

```
"What TDD approach should I take for the ActorRole relationship?
We have N:N mapping and I'm not sure how to test role assignments."
```

**Why this is good:** Describes the problem, asks for guidance not code

### Avoid These Patterns

❌ "Write the entire form component for me"
✅ "How should I structure the form to make it testable? Show me a test spec first."

❌ "Fix this bug for me"
✅ "Help me think through this bug: [describe]. What should I test first?"

❌ "Design the whole system"
✅ "I need to design the Donation flow. Here's the requirement. What questions should I ask first?"

## TDD Workflow: Claude's Role

**Mandatory order, no exceptions:** plan → tests (red) → code (green) → refactor. Never start writing implementation code before a plan exists and failing tests are in place. If the plan touches the database in any way (new/altered table, column, constraint, migration, RLS policy), say so explicitly before moving to tests.

### Phase 1: Requirements → Test Spec (Claude helps)

**You ask Claude:**
```
"I need to implement New Donation with these requirements:
- Accept Actor (search by email, create if new)
- Add multi-line detail (Monetary or InKind)
- Validate: amount > 0 if Monetary, quantity + unit if InKind
- Upload attachments

What should my test cases look like? What edge cases am I missing?"
```

**Claude provides:**
- Test case structure with assertions
- Edge cases to consider
- Validation rules as tests
- Mocking strategy for Supabase

### Phase 2: Red (Developer writes failing tests)

**You:** Write the test file following Claude's spec.

**Claude's role:** Review tests against requirements (are they testing the right things?)

### Phase 3: Green (Developer writes minimal code)

**You:** Write code to pass tests.

**Claude's role:** NOT involved (this is pure developer work)

### Phase 4: Refactor (Developer improves code)

**You:** Improve code while keeping tests passing.

**Claude's role:** Code review — is this pattern consistent with the rest of the codebase?

### Phase 5: Code Review (Human + Claude)

**You:** Open PR with tests + code.

**Claude reviews for:**
- Do tests cover the requirements?
- Is the code following patterns we established?
- Are there edge cases we missed?
- Is documentation updated?

**You review for:**
- Does it actually work functionally?
- Performance OK?
- Security concerns?

## Example: TDD with Claude

### Step 1: Clarify Requirements

**You to Claude:**
> "I need to build the Actor search/create dialog. Requirements:
> - User can search existing Actors by email (exact match)
> - If not found, show a form to create new Actor (name, email, is_organization, is_anonymous)
> - Return the selected/created Actor ID to the parent component"

**Claude responds:** Clarifying questions + assumptions

### Step 2: Claude Writes Test Spec

Claude provides something like:

```javascript
describe('ActorSearchCreate', () => {
  test('searches existing actor by email', () => {
    // Given: Actor exists with email "john@example.com"
    // When: User enters email and clicks search
    // Then: Component shows the actor's name and a "Select" button
  });

  test('shows create form when actor not found', () => {
    // Given: Email "new@example.com" has no actor
    // When: User searches and form shows
    // Then: Fields for name, is_organization, is_anonymous are visible
  });

  test('validates email format before search', () => {
    // Given: User enters invalid email
    // When: User clicks search
    // Then: Error message shown, no API call made
  });

  // ... more tests
});
```

### Step 3: You Write Failing Tests

You translate Claude's spec into real code (Jest + Vitest or similar).

### Step 4: You Write Code to Pass Tests

You implement ActorSearchCreate component.

### Step 5: You Ask Claude to Review

> "I implemented ActorSearchCreate. Can you review it against the test spec?
> Are there patterns I should adjust?"

Claude reviews for consistency, patterns, completeness.

## Handling Disagreements or Uncertainty

If you're unsure about Claude's recommendation:

1. **Ask for clarification:** "Why did you suggest that pattern?"
2. **Ask for alternatives:** "What are other approaches, and what are the trade-offs?"
3. **Check with Isaac:** "Does this align with project goals?"

### Example

**Claude suggests:** "Use a custom hook for Supabase queries"

**You ask:** "Why not just call supabase.from() directly in the component?"

**Claude responds:** Explains hook benefits (reusability, testing, separation of concerns)

**You decide:** Based on the explanation, does this make sense for this project?

## Accessing Claude's Full Context

Claude has access to:
- All documents in `/docs` (architecture, design, database, ADRs)
- Test specifications (so Claude understands what you're testing)
- Code patterns from previous features (for consistency)

**To help Claude help you better:**
- Reference the relevant ADR when asking about decisions
- Share test code, not just requirements
- Include error messages, not just "it doesn't work"

## Escalation: When to Involve Isaac

- Architecture changes that affect multiple systems
- Scope decisions ("Should we add X before MVP?")
- Technology changes ("Should we switch from Recharts to Chart.js?")
- Timeline/resource questions

**Pattern:**
1. You + Claude explore the option
2. Document pros/cons in an ADR draft
3. Present to Isaac with Claude's analysis

## Claude's Limitations You Should Know

1. **Claude doesn't run code** — It can't actually test if something works; you must validate
2. **Claude forgets context** — Each conversation is fresh; refer back to decisions made in ADRs
3. **Claude can be wrong** — Always verify architectural advice with a second opinion or small test
4. **Claude doesn't know your full codebase** — Share relevant files/patterns when asking for consistency checks

## Review Checklist: Is This a Good Task for Claude?

- [ ] It's about design, architecture, or testing strategy?
- [ ] I can describe the requirement clearly?
- [ ] I'm not asking Claude to write production code?
- [ ] The answer will help me write better code, not replace my work?
- [ ] I'll review Claude's suggestion before implementing?

If all checked → Ask Claude!

---

**Version:** 1.0
**Last Updated:** [date]
**Remember:** Claude is a tool to make you a better architect and tester, not a replacement for thinking.
