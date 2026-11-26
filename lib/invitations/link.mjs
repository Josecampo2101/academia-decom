// Utilidades puras para construir los enlaces de invitación (sin dependencias, probadas con node:test).

/**
 * Devuelve solo el origen (https://dominio) de una dirección, o "" si no es válida.
 * Evita barras finales, rutas y protocolos distintos de http/https.
 */
export function normalizeSiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch {
    return "";
  }
}

/** El token se genera en el navegador (hex o base64url). Se acota para rechazar basura en la URL. */
export function isValidInvitationToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(token);
}

/**
 * Enlace público e invitación corta: https://dominio/invitacion/<token>
 * Lanza un error si la dirección o el token no son válidos (nunca genera un enlace roto).
 */
export function buildInvitationLink(token, siteUrl) {
  const origin = normalizeSiteUrl(siteUrl);
  if (!origin) throw new Error("La dirección pública del sitio no es válida.");
  if (!isValidInvitationToken(token)) throw new Error("El token de invitación no es válido.");
  return `${origin}/invitacion/${token}`;
}

/**
 * Indica si la dirección parece un despliegue temporal de Vercel (vista previa o rama),
 * que cambia en cada versión y no debe usarse para invitaciones.
 */
export function isTemporaryDeploymentUrl(value) {
  const origin = normalizeSiteUrl(value);
  if (!origin) return false;
  const host = new URL(origin).hostname;
  return host.endsWith(".vercel.app") && (host.includes("-projects.") || host.includes("-git-"));
}

/** Mensaje listo para enviar por WhatsApp, correo o mensaje de texto. */
export function buildInvitationMessage(link, districtName) {
  const place = districtName ? ` del ${districtName}` : "";
  return [
    `Hola, te invitamos a la Escuela de Comunicaciones D34 (DECOM)${place}.`,
    "Solicita tu ingreso con este enlace personal:",
    link,
    "El enlace es de uso único y tiene fecha de vencimiento.",
  ].join("\n");
}

/** Enlace de WhatsApp (abre el selector de contacto con el texto ya escrito). */
export function buildWhatsappShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
