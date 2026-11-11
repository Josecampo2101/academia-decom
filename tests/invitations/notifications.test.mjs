import test from "node:test";
import assert from "node:assert/strict";
import { isNotificationStateCompatible } from "../../lib/invitations/notifications.mjs";

test("receipt notifications remain valid after the request is reviewed", () => {
  assert.equal(isNotificationStateCompatible("request_received", "pending"), true);
  assert.equal(isNotificationStateCompatible("request_received", "approved"), true);
  assert.equal(isNotificationStateCompatible("request_received", "rejected"), true);
});

test("decision notifications must match the final request state", () => {
  assert.equal(isNotificationStateCompatible("request_approved", "approved"), true);
  assert.equal(isNotificationStateCompatible("request_approved", "pending"), false);
  assert.equal(isNotificationStateCompatible("request_approved", "rejected"), false);
  assert.equal(isNotificationStateCompatible("request_rejected", "rejected"), true);
  assert.equal(isNotificationStateCompatible("request_rejected", "pending"), false);
  assert.equal(isNotificationStateCompatible("request_rejected", "approved"), false);
});

test("unknown notification types are rejected", () => {
  assert.equal(isNotificationStateCompatible("unknown", "pending"), false);
});
