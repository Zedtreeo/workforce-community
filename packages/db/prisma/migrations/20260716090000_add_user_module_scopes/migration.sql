-- Per-user module restriction: null = full access for the user's role.
ALTER TABLE "users" ADD COLUMN "module_scopes" JSONB;
