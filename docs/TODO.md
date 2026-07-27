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

## Reported by product owner (2026-07-26)

- [x] Mejorar la entrega de informes impresos (revisar formato, maquetación y flujo de exportación/impresión de los reportes actuales). Se agregó un botón "Exportar PDF" (pdfmake) con encabezado repetido por página (nombre del proyecto, fecha de exportación, "Página X de Y") y se reforzó el CSS de impresión (saltos de página, encabezados de tabla repetidos). Ver `docs/plans/SPRINT-S2-v1_printed-reports-improvements.md`.
- [ ] Al crear un tenant, la persona cuyo correo se registra debe crearse automáticamente como administrador de ese tenant.
- [ ] Mejorar el proceso para crear aliados (suppliers/actores) y unificar la experiencia en todos los sitios donde se pueda buscar y/o crear un aliado, de forma simple y consistente.
- [ ] Revisar la etiqueta del estimado de donantes (verificar redacción/precisión de la etiqueta mostrada en la interfaz).
- [ ] Ajustar la parte visual del resumen: actualmente se ve muy amontonado; revisar espaciado y jerarquía visual.
- [ ] Evaluar una funcionalidad de calendario de disponibilidad para voluntarios.

## Product strategy: modular ecosystem

- [ ] Evaluate restructuring Edifica Digital as a suite of independently sellable, integrated modules/systems rather than a single donation-traceability product.
  - **Context.** The donation-traceability workflow (actors, donations, shipments, inventory, impact, protected beneficiaries) is itself a complete, complex system. The product opportunity is to treat it as the first module of a broader ecosystem, where each module solves one operational need for a faith-based or nonprofit organization and can be adopted, priced, and onboarded on its own, while sharing identity, actors, audit trail, bilingual UI, and design system with the rest of the suite.
  - **Module 1 (current, in production): Donation traceability.** Actor and role management, monetary and in-kind donation intake, shipment/inventory tracking, transformations, impact reporting, and protected beneficiary registration — as documented in `docs/ARCHITECTURE.md` and `docs/DATABASE.md`.
  - **Module 2 (proposed, next to scope): Church/congregation management software.** A distinct system oriented around the internal operation of a local church rather than donation flow, likely covering:
    - Member and family directory (household relationships, contact info, privacy tiers analogous to the existing `private.beneficiary` boundary).
    - Attendance and participation tracking for services, groups, and events.
    - Ministries, small groups/cell groups, and volunteer/serving-team scheduling.
    - Giving/tithing records, which may reuse or extend the existing monetary donation schema (`submit_monetary_donation`, receipt methods, currency handling) rather than duplicating it.
    - Event and facility/room scheduling, calendar coordination.
    - Communications (announcements, bilingual messaging) reusing the platform's Spanish/English pattern.
    - Reporting for pastoral/leadership decision-making, kept separate from public donor-facing impact reports.
  - **Cross-cutting design questions to resolve before a plan can be written** (per `AGENTS.md`/this guide's plan-first requirement):
    - Shared vs. separate identity: does a church use one `somosedificadigital` account across modules, and how does `private` schema isolation extend to member data (likely stricter than beneficiary data, since it includes minors, families, and giving history)?
    - Data model boundary: is "member" a new actor role, a new table set, or a fully separate schema namespace (e.g. `church.*`) to keep RLS and audits scoped per module?
    - Packaging/pricing: are modules sold independently, bundled, or as an add-on tier on top of the donation module?
    - Multi-tenancy: does one Supabase project serve multiple churches, and if so, what row-level tenant isolation is required beyond the current single-organization assumption?
  - **Next step.** Do not implement until a product owner confirms scope and priority; when ready, this becomes its own plan in `docs/plans/` (schema, RLS, bilingual UI, and migration impact) following the standard plan → tests → implementation → verification → documentation order.
