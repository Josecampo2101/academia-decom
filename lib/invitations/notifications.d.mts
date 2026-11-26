export type InvitationNotificationType =
  "request_received" | "request_approved" | "request_rejected";

export type InvitationRequestStatus = "pending" | "approved" | "rejected";

export function isNotificationStateCompatible(
  notificationType: InvitationNotificationType,
  requestStatus: InvitationRequestStatus,
): boolean;
