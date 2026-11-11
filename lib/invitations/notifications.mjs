const expectedRequestStatus = {
  request_approved: "approved",
  request_rejected: "rejected",
};

/**
 * A receipt notification remains valid after the request advances to approved
 * or rejected. Decision notifications, however, must match the final state.
 */
export function isNotificationStateCompatible(notificationType, requestStatus) {
  if (notificationType === "request_received") return true;

  return expectedRequestStatus[notificationType] === requestStatus;
}
