import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261115190000_require_active_profile_for_assessments.sql",
    import.meta.url
  ),
  "utf8"
);

test("assessment attempt creation checks active profile before reading or creating attempts", () => {
  const startFunction = migration.split(
    "CREATE OR REPLACE FUNCTION public.submit_academic_assessment",
    1
  )[0];

  assert.match(
    startFunction,
    /FROM public\.profiles p[\s\S]*?p\.status\s*=\s*'active'[\s\S]*?FOR SHARE[\s\S]*?IF NOT FOUND/i
  );
});

test("assessment submission checks active profile before modifying responses or grades", () => {
  const submitFunction = migration.split(
    "CREATE OR REPLACE FUNCTION public.submit_academic_assessment",
    1
  )[1];

  assert.match(
    submitFunction,
    /FROM public\.profiles p[\s\S]*?p\.status\s*=\s*'active'[\s\S]*?FOR SHARE[\s\S]*?IF NOT FOUND/i
  );

  assert.match(
    submitFunction,
    /An active profile is required/i
  );
});
