import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261115130000_secure_student_lesson_progress.sql", import.meta.url),
  "utf8",
);
const functionBody = migration.match(
  /create or replace function public\.save_lesson_progress\([\s\S]*?\$function\$;\s*/i,
)?.[0];

test("students cannot write lesson_progress directly", () => {
  assert.match(
    migration,
    /revoke insert, update on table public\.lesson_progress from public, anon, authenticated;/i,
  );
  assert.match(migration, /drop policy if exists lesson_progress_insert_own/i);
  assert.match(migration, /drop policy if exists lesson_progress_update_own/i);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|insert\s*,\s*update)\s+on\s+(?:table\s+)?public\.lesson_progress\s+to\s+authenticated/i,
  );
});

test("student progress RPC is authenticated and scoped to the student's active enrollment", () => {
  assert.ok(functionBody, "save_lesson_progress function must exist");
  assert.match(functionBody, /security definer/i);
  assert.match(functionBody, /set search_path\s*=\s*''/i);
  assert.match(functionBody, /auth\.uid\(\)/i);
  assert.match(functionBody, /e\.user_id\s*=\s*v_user_id/i);
  assert.match(functionBody, /e\.status\s*=\s*'active'/i);
  assert.match(functionBody, /l\.status\s*=\s*'published'/i);
  assert.match(functionBody, /cm\.status\s*=\s*'published'/i);
});

test("student progress RPC changes position only and preserves completed records", () => {
  assert.ok(functionBody, "save_lesson_progress function must exist");
  assert.match(
    functionBody,
    /do update\s+set last_position_seconds\s*=\s*excluded\.last_position_seconds/i,
  );
  assert.match(functionBody, /where public\.lesson_progress\.status <> 'completed'/i);
  assert.doesNotMatch(functionBody, /set\s+status\s*=/i);
  assert.doesNotMatch(functionBody, /set\s+completed_at\s*=/i);
  assert.match(migration, /grant execute on function public\.save_lesson_progress\(uuid, uuid, integer\)\s+to authenticated/i);
  assert.match(migration, /revoke all on function public\.save_lesson_progress\(uuid, uuid, integer\)\s+from public, anon/i);
});

const studentFormation = readFileSync(
  new URL("../app/dashboard/estudiante/formacion/page.tsx", import.meta.url),
  "utf8",
);

test("student interface uses the protected RPC instead of direct completion writes", () => {
  assert.match(studentFormation, /supabase\.rpc\(["']save_lesson_progress["']/);
  assert.match(studentFormation, /p_last_position_seconds:\s*0/);
  assert.doesNotMatch(studentFormation, /from\(["']lesson_progress["']\)\.upsert/);
  assert.doesNotMatch(studentFormation, /status:\s*["']completed["']/);
  assert.match(studentFormation, /Registrar inicio/);
});
