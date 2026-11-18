export type ResourceOpenMode = "link" | "file" | "text" | "none";

export interface LibraryFilterInput {
  query?: string;
  categoryId?: string;
  type?: string;
}

export const RESOURCE_TYPES: Record<string, string>;
export function typeLabel(type: string): string;
export function safeExternalUrl(value: unknown): string;
export function resourceOpenMode(resource: {
  resource_type?: string | null;
  external_url?: string | null;
  storage_path?: string | null;
  content?: string | null;
}): ResourceOpenMode;
export function normalizeText(value: unknown): string;
export function filterResources<
  T extends { title: string; description: string; category_id: string; resource_type: string },
>(resources: T[], filters?: LibraryFilterInput): T[];
export function formatFileSize(bytes: number | null | undefined): string;
