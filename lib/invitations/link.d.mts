export function normalizeSiteUrl(value: string | undefined | null): string;
export function isValidInvitationToken(token: unknown): boolean;
export function buildInvitationLink(token: string, siteUrl: string): string;
export function isTemporaryDeploymentUrl(value: string | undefined | null): boolean;
export function buildInvitationMessage(link: string, districtName?: string): string;
export function buildWhatsappShareUrl(message: string): string;
