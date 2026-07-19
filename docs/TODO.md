# TODO

Lightweight backlog for future work that does not yet have a plan in `docs/plans/`.

## Observability

- [x] Add application logging/monitoring on Vercel (e.g. runtime logs, error tracking) for the deployed frontend. See `docs/plans/SPRINT-S1-v1_vercel-observability.md`.
- [ ] Investigate equivalent logging/monitoring on Supabase (Auth, API, and Postgres logs) beyond the default dashboard log viewer, if a persistent/exportable option is available.

## Email deliverability

- [ ] Verify spam filtering on transactional email (magic link) sent via the Zoho custom SMTP sender. Magic-link emails initially landed in spam; confirm SPF/DKIM/DMARC alignment for the sending domain and re-test inbox placement.
