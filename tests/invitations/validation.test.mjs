import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidDateOfBirth,
  isValidEmail,
  isValidUuid,
} from "../../lib/invitations/validation.mjs";

test("UUID validation accepts canonical UUIDs and rejects malformed values", () => {
  assert.equal(isValidUuid("8f14e45f-ea6b-4b9a-8f3a-123456789abc"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid("8f14e45f-ea6b-4b9a-8f3a-123456789abz"), false);
});

test("email validation rejects malformed and oversized addresses", () => {
  assert.equal(isValidEmail("estudiante@example.org"), true);
  assert.equal(isValidEmail("no-es-correo"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@example.org`), false);
});

test("date of birth validation rejects impossible and future dates", () => {
  const now = new Date("2026-11-11T12:00:00.000Z");
  assert.equal(isValidDateOfBirth("2000-02-29", now), true);
  assert.equal(isValidDateOfBirth("2001-02-29", now), false);
  assert.equal(isValidDateOfBirth("2027-01-01", now), false);
  assert.equal(isValidDateOfBirth("not-a-date", now), false);
});
