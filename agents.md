# Agents & Team

This document defines the team structure, roles, and how AI agents (Claude) collaborate on this project.

## Team Structure

| Role | Responsibility | Mode |
|------|---|---|
| **Isaac Delgado** | Product Owner, Strategic Decisions, Project Lead | Human |
| **Yang (yangetze)** | Product Owner, Strategic Decisions, Project Lead | Human |
| **Claude (AI)** | Architecture, Code Structure, Documentation, TDD Framework | AI Agent |
| **Developer(s)** | Implementation, Code Review, Deployment | Human (Future) |

## Claude's Role in This Project

Claude acts as an **architecture and TDD coach** — not a code generator replacing developers.

### Responsibilities

1. **Architecture & Design**
   - Data model design
   - System flow documentation
   - Technology recommendations
   - Design patterns and best practices

2. **Test-Driven Development (TDD)**
   - Test case structure and examples
   - Testing strategy documentation
   - Test file templates
   - Validation of test coverage

3. **Documentation**
   - Technical specifications
   - API contract documentation
   - Component design docs
   - Decision records (ADRs)

4. **Code Structure & Patterns**
   - Project layout recommendations
   - Naming conventions
   - Folder organization
   - Hook and component templates

5. **Git & DevOps Guidance**
   - Commit message standards
   - Branch strategy
   - Deployment checklists
   - Environment configuration

### What Claude Does NOT Do

- Write production code (developers do that, guided by tests)
- Make unilateral project decisions (Isaac owns decisions)
- Deploy or manage infrastructure directly
- Replace human code review

## Communication Protocol

### When to Ask Claude

- "Help me design the schema for [feature]"
- "What tests should I write for [component]?"
- "What's the best folder structure for [module]?"
- "Review the architecture of [system]"
- "Write a test spec for [feature]"
- "Create an ADR for [decision]"

### When to Ask Isaac

- "Which feature should we prioritize?"
- "Should we use [technology] vs [alternative]?"
- "Is this in scope for the MVP?"
- "Approve this design direction?"

### When to Pair (Isaac + Claude)

- Reviewing architectural decisions against business goals
- Making trade-offs between tech and timeline
- Deciding scope for upcoming sprints
- Evaluating post-MVP roadmap items

## Workflow: TDD-Driven Development

### Mandatory Order for Every Task

1. **Plan first.** Before writing any code, write out the plan for the issue/task (what's changing, why, affected files). Get it reviewed/agreed before moving on.
2. **Tests before code.** Once the plan is agreed, write the failing tests (TDD red) before writing any implementation code.
3. **Flag database changes.** If the plan implies any database change (new/altered table, column, constraint, migration, RLS policy), call it out explicitly in the plan and in the PR description before writing code — don't let a schema change surface only in the diff.

### The Flow

```
1. Feature Request / Requirement
        ↓
2. Claude: Write Test Spec (tests describe behavior)
        ↓
3. Developer: Write Failing Tests (red)
        ↓
4. Developer: Write Minimal Code (green)
        ↓
5. Developer: Refactor (using test coverage as safety net)
        ↓
6. Developer: Code Review (human + Claude)
        ↓
7. Merge to Main
```

### Claude's Role in Each Step

- **Step 2:** Provide test structure, edge cases, validation rules
- **Step 6:** Review code against test coverage, patterns, best practices

## Documentation Standards

All decisions that affect architecture must be documented in:

1. **ADRs** (Architecture Decision Records) — `/docs/adr/` folder
2. **Test Specs** — Alongside test files or in `/docs/specs/`
3. **Comments** — In code, especially non-obvious logic
4. **README** sections — High-level explanation

Example ADR filename: `ADR-001-why-we-chose-supabase.md`

## Git Workflow

### Commit Messages

Format: `[TYPE] Brief description`

Types:
- `[FEAT]` — New feature
- `[FIX]` — Bug fix
- `[TEST]` — Test additions/changes
- `[DOCS]` — Documentation
- `[REFACTOR]` — Code refactoring
- `[CHORE]` — Build, deps, setup

Example:
```
[TEST] Add tests for Donation form validation
[FEAT] Implement Actor CRUD endpoints
[DOCS] Add database relationships diagram
```

### Branches

- `main` — Production-ready, all tests pass
- `develop` — Integration branch for features
- `feature/[name]` — Individual feature branches
- `bugfix/[name]` — Bug fixes
- `docs/[name]` — Documentation changes

**Mandatory rules:**
- **Never commit directly to `main`.** All changes go through a branch and a PR.
- **Always branch from `main`** when creating a new branch (`git checkout main && git pull && git checkout -b [type]/[name]`), not from another feature branch.

### Pull Requests

Every PR must include:
- [ ] Plan referenced/linked (written before coding started)
- [ ] Tests (new + modified), written before the implementation (TDD)
- [ ] Documentation (if architecture changed)
- [ ] **Database changes called out explicitly** in the description, if any (new/altered tables, columns, constraints, migrations, RLS)
- [ ] No linting errors
- [ ] Meaningful description linking to issues

### Deployment

Merges to `main` auto-build and auto-publish to the default Vercel domain (`edificadigital.vercel.app`) — safe to check anytime, no manual step.

Publishing to the real production domain (`somosedificadigital.com`) is **always manual**: run the **"Promote to Custom Domain"** GitHub Action from the Actions tab. See `docs/adr/ADR-001-manual-production-promotion.md` for the full policy.

## Escalation Path

**Blocker or major decision needed?**

1. Document the issue in GitHub Issues
2. Tag @ai-agent (Claude) for technical analysis
3. Tag @isaac or @yangetze for product/business decision
4. Discuss in issue comments
5. Document decision in ADR

## Review Checklist (Human + AI)

### Claude Reviews For

- [ ] TDD principles followed (tests exist before code)
- [ ] Architecture consistency
- [ ] Naming conventions
- [ ] Code duplication
- [ ] Edge cases
- [ ] Documentation completeness

### Human Developer Reviews For

- [ ] Functional correctness
- [ ] Performance implications
- [ ] Security concerns
- [ ] Business logic accuracy
- [ ] User experience

---

**Version:** 1.0
**Last Updated:** [date]
**Maintained by:** Isaac Delgado, Yang (yangetze), Claude (AI)
