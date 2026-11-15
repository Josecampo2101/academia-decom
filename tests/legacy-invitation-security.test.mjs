import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20261115170000_harden_legacy_invitation_acceptance.sql",
  import.meta.url
);

const migration = await readFile(migrationPath, "utf8");

test("legacy invitation acceptance requires a Supabase-confirmed email", () => {
  assert.match(
    migration,
    /u\.email_confirmed_at\s+IS\s+NOT\s+NULL/i
  );
  assert.match(
    migration,
    /Debes confirmar tu correo electrónico antes de aceptar la invitación/i
  );
});

test("legacy invitation acceptance requires an active profile before writes", () => {
  assert.match(
    migration,
    /FROM public\.profiles p[\s\S]*?FOR SHARE[\s\S]*?v_profile_status IS DISTINCT FROM\s+'active'/i
  );
  assert.match(
    migration,
    /Tu perfil no está activo/i
  );
});

test("legacy invitation acceptance rejects inactive territorial scope", () => {
  assert.match(
    migration,
    /public\.districts d[\s\S]*?d\.status\s*=\s*'active'/i
  );
  assert.match(
    migration,
    /public\.congregations c[\s\S]*?c\.status\s*=\s*'active'/i
  );
  assert.match(
    migration,
    /public\.areas a[\s\S]*?a\.status\s*=\s*'active'/i
  );
});

test("legacy invitation acceptance does not grant anonymous execution", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.accept_invitation\(text\) FROM PUBLIC, anon/i
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.accept_invitation\(text\) TO authenticated, service_role/i
  );
});
