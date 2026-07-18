# Contributing to Donation Traceability System

Thanks for helping build this system! This guide covers the basics.

## Setup

1. Clone the repo and navigate to `frontend/`
2. `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase credentials
4. `npm run dev`

## Code Guidelines

- **Components:** Functional components with hooks (React 18+)
- **Naming:** camelCase for variables/functions, PascalCase for components
- **Files:** One component per file in `src/components/`
- **Styling:** Tailwind CSS (utility-first)
- **Hooks:** Custom hooks in `src/hooks/` (e.g., `useDonation`, `useAuth`)

## Database Guidelines (MANDATORY)

**All database artifacts MUST be in English:**
- Table names: `actor`, `donation`, `impact_event` (snake_case)
- Column names: `recorded_at`, `kit_name`, `quantity_generated` (snake_case)
- Functions & procedures: English names only
- Views & constraints: English names only
- Comments & documentation: English

Example:
```sql
CREATE TABLE actor (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);
```

**NOT:**
```sql
CREATE TABLE actor (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  correo TEXT UNIQUE NOT NULL
);
```

## Commits

- Use clear, present-tense messages: `"Add donation form"` not `"Added form"`
- Keep commits focused: one feature/fix per commit
- Reference GitHub issues: `"Fix #123: Resolve auth redirect"`

## Testing

Before submitting a PR:
- [ ] Test locally on desktop
- [ ] Test on mobile viewport
- [ ] Check browser console for errors
- [ ] Test with Supabase data (not just mock data)

## Pull Requests

1. **Never commit directly to `main`.** Always start a new branch, and always cut it from `main`: `git checkout main && git pull && git checkout -b feature/your-feature`
2. Make changes
3. Push and open a PR against `main`
4. Describe what the PR does and link any related issues
5. Wait for review before merging

## Questions?

Open a GitHub Issue or Discussion in the repository.

---

**Keep it simple. Ship it. Iterate.**
