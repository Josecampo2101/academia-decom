import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261115180000_revoke_api_bypass_privileges.sql",
    import.meta.url
  ),
  "utf8"
);

test("API roles cannot TRUNCATE exposed public tables", () => {
  assert.match(migration, /REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM anon, authenticated/i);
  assert.match(migration, /pg_catalog\.pg_class[\s\S]*?n\.nspname\s*=\s*'public'[\s\S]*?c\.relkind IN \('r', 'p'\)/i);
});

test("role catalogue is read-only to anonymous and authenticated API roles", () => {
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES[\s\S]*?ON TABLE public\.roles[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT SELECT ON TABLE public\.roles TO anon, authenticated/i);
});

test("anonymous clients cannot mutate tutor assignments", () => {
  assert.match(migration, /REVOKE ALL PRIVILEGES[\s\S]*?ON TABLE public\.academic_course_tutor_assignments[\s\S]*?FROM PUBLIC, anon/i);
});
