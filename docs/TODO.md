# TODO

Lightweight backlog for future work that does not yet have a plan in `docs/plans/`.

## Observability

- [x] Add application logging/monitoring on Vercel (e.g. runtime logs, error tracking) for the deployed frontend. See `docs/plans/SPRINT-S1-v1_vercel-observability.md`.
- [x] Investigate equivalent logging/monitoring on Supabase (Auth, API, and Postgres logs) beyond the default dashboard log viewer, if a persistent/exportable option is available. Findings:
  - The `edifydb` organization (`xmsxkeedcavfhacfxzan`) is currently on the **Free plan**. The dashboard's built-in Logs Explorer (covering `auth_logs`, `edge_logs`/API, `postgres_logs`, `storage_logs`, `realtime_logs`, `function_logs`) only retains **1 day** of history on Free (7 days on Pro, 28 on Team, 90 on Enterprise). A query's results can be exported to CSV manually from the dashboard today, but that is ad hoc, not an automated pipeline.
  - **Log Drains** (`Project Settings > Log Drains`) are Supabase's real answer to "persistent/exportable logging": they continuously stream every log source above to Datadog, Sentry, Loki, Axiom, Amazon S3, a generic HTTP endpoint, or an OTLP collector. This requires upgrading the organization to at least the **Pro plan** ($25/mo) plus the add-on itself (~$60/mo per drain) plus $0.20 per million log events and egress. This is a cost/plan decision for the product owners, not something to enable unilaterally.
  - One durable, **zero-cost option is already available today**: Supabase Auth writes every signup, login, password reset, MFA, and token event to the `auth.audit_log_entries` table in the project's own Postgres database (not the ephemeral BigQuery-backed dashboard logs), so it is already queryable via ordinary SQL and exportable via `pg_dump`/`COPY` regardless of plan or the 1-day dashboard retention window.
  - Enabling the `pgaudit` extension broadens what statement classes land in Postgres Logs, but on the Free plan those entries still only live for 1 day in the dashboard unless a Log Drain (or a custom export) also carries them out — it does not by itself solve persistence.
  - The Prometheus-compatible **Metrics API** (`/customer/v1/privileged/metrics`, authenticated with the service role key) exposes ~200 Postgres health/performance series and is not gated behind the Log Drains add-on, so it is a free option for ongoing database health dashboards (e.g. Grafana Cloud free tier) if that need arises, though it is metrics rather than logs.
  - Recommendation: keep relying on `auth.audit_log_entries` for durable auth history now; revisit Log Drains if/when the organization upgrades to Pro for other reasons (more compute, longer backups), pointed at a low-cost destination (e.g. a free Sentry or Grafana Cloud/Loki project) rather than paying for the add-on on its own.

## Email deliverability

- [ ] Verify spam filtering on transactional email (magic link) sent via the Zoho custom SMTP sender. Magic-link emails initially landed in spam. Findings and status:
  - SPF (`v=spf1 include:zohomail.com ~all`) and DKIM (`zmail._domainkey.somosedificadigital.com`) were already published and aligned to `somosedificadigital.com`.
  - DMARC was missing entirely. Added `_dmarc.somosedificadigital.com` as `v=DMARC1; p=none; rua=mailto:contacto@somosedificadigital.com; pct=100` (monitor mode) in Cloudflare DNS.
  - Remaining: re-send a magic link after DNS propagation and confirm inbox placement (not spam). If it still lands in spam, next lever is customizing the default Supabase magic-link email template (`Authentication > Emails > Templates`), since the stock template is generic.
