-- Covering index for executive_self_evaluation.evaluator_user_id (FK to auth.users).
-- Flagged by the Supabase performance advisor (unindexed_foreign_keys) after S10;
-- also serves the RLS predicates that filter on evaluator_user_id = auth.uid().
create index if not exists executive_evaluation_evaluator_idx
  on public.executive_self_evaluation(evaluator_user_id);
