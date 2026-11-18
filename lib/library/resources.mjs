// Utilidades puras de la biblioteca académica (sin dependencias, probadas con node:test).

/** Tipos de recurso permitidos por la base de datos (restricción CHECK de academic_library_resources). */
export const RESOURCE_TYPES = {
  document: "Documento",
  guide: "Guía",
  template: "Plantilla",
  video: "Video",
  audio: "Audio",
  link: "Enlace",
  reading: "Lectura",
  infographic: "Infografía",
};

export function typeLabel(type) {
  return RESOURCE_TYPES[type] ?? "Recurso";
}

/** Devuelve la dirección normalizada solo si es http o https; de lo contrario, "". */
export function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Cómo se abre un recurso:
 * - "link": enlace externo válido; - "file": archivo en almacenamiento privado;
 * - "text": contenido escrito dentro de la plataforma; - "none": sin contenido utilizable.
 */
export function resourceOpenMode(resource) {
  if (resource?.resource_type === "link" && safeExternalUrl(resource.external_url)) return "link";
  if (typeof resource?.storage_path === "string" && resource.storage_path.trim()) return "file";
  if (typeof resource?.content === "string" && resource.content.trim()) return "text";
  return "none";
}

/** Minúsculas y sin tildes, para que "fotografia" encuentre "Fotografía". */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Filtra por texto (título y descripción), categoría y tipo. "all" o vacío = sin filtro. */
export function filterResources(resources, { query = "", categoryId = "all", type = "all" } = {}) {
  const needle = normalizeText(query);
  return resources.filter((resource) => {
    if (categoryId !== "all" && resource.category_id !== categoryId) return false;
    if (type !== "all" && resource.resource_type !== type) return false;
    if (!needle) return true;
    return normalizeText(`${resource.title} ${resource.description}`).includes(needle);
  });
}

/** Tamaño legible en español: 1,5 MB. Devuelve "" si no hay dato. */
export function formatFileSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(".", ",");
  return `${text.replace(/,0$/, "")} ${units[unit]}`;
}
