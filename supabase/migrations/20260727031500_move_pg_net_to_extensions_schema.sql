-- pg_net does not support ALTER EXTENSION ... SET SCHEMA (Postgres error 0A000).
-- The security advisor flags extensions left in the public schema, so
-- reinstall it in the dedicated `extensions` schema (matching pgcrypto,
-- uuid-ossp) instead. Its functions live in their own `net` schema
-- regardless of which schema owns the extension, so
-- private.notify_operator_invitation()'s schema-qualified net.http_post
-- call needs no change.

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
