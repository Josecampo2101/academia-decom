import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(
  new URL("../next.config.ts", import.meta.url),
  "utf8"
);

test("global security headers are configured for all routes", () => {
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "Permissions-Policy",
  ]) {
    assert.ok(config.includes(header), `Missing security header: ${header}`);
  }
});
