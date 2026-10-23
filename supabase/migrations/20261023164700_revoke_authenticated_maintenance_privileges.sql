-- Revoke unused maintenance privileges from authenticated (#143).
--
-- authenticated still held the automatic TRUNCATE, REFERENCES and TRIGGER
-- privileges on 35 tables and the view inventory_lot_balance. PostgREST never
-- exposes them and the app never uses them, but TRUNCATE bypasses RLS.
-- SELECT, INSERT, UPDATE and DELETE stay as they are.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Four objects declared narrower grants than edifydb carried. Reset them to
-- the declared set, which is exactly what their RLS policies allow:
-- - 20261021142000: executive_self_evaluation has select/insert/update
--   policies only; submitted evaluations are final and never deleted.
-- - 20260816030000: project_media_evidence and project_beneficiary_document
--   have select/insert/delete policies only.
-- - 202607190001: inventory_lot_balance is a read-only aggregate view.
revoke delete on table public.executive_self_evaluation from authenticated;
revoke update on table public.project_media_evidence, public.project_beneficiary_document from authenticated;
revoke insert, update, delete on table public.inventory_lot_balance from authenticated;
