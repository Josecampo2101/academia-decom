import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvitationLink,
  buildInvitationMessage,
  buildWhatsappShareUrl,
  isTemporaryDeploymentUrl,
  isValidInvitationToken,
  normalizeSiteUrl,
} from "../../lib/invitations/link.mjs";

const TOKEN = "4595bd0b022bc175e62c4a0e76fc3b783b9551db50520e71bf5699a92eec001f";

test("normalizeSiteUrl conserva solo el origen y rechaza valores inválidos", () => {
  assert.equal(
    normalizeSiteUrl("https://academia-decom.vercel.app/"),
    "https://academia-decom.vercel.app",
  );
  assert.equal(
    normalizeSiteUrl("  https://escuela.example.org/ruta?x=1 "),
    "https://escuela.example.org",
  );
  assert.equal(normalizeSiteUrl("ftp://example.org"), "");
  assert.equal(normalizeSiteUrl("no es una url"), "");
  assert.equal(normalizeSiteUrl(""), "");
  assert.equal(normalizeSiteUrl(undefined), "");
});

test("isValidInvitationToken acepta hex/base64url y rechaza basura", () => {
  assert.equal(isValidInvitationToken(TOKEN), true);
  assert.equal(isValidInvitationToken("abc"), false);
  assert.equal(isValidInvitationToken("../../etc/passwd" + "x".repeat(20)), false);
  assert.equal(isValidInvitationToken(`${TOKEN}?a=b`), false);
  assert.equal(isValidInvitationToken(null), false);
});

test("buildInvitationLink genera el enlace corto y nunca un enlace roto", () => {
  assert.equal(
    buildInvitationLink(TOKEN, "https://academia-decom.vercel.app/"),
    `https://academia-decom.vercel.app/invitacion/${TOKEN}`,
  );
  assert.throws(() => buildInvitationLink(TOKEN, "esto no es una url"));
  assert.throws(() => buildInvitationLink("corto", "https://academia-decom.vercel.app"));
});

test("isTemporaryDeploymentUrl detecta vistas previas de Vercel y deja pasar dominios estables", () => {
  assert.equal(
    isTemporaryDeploymentUrl("https://academia-decom-ej9exzgpf-josecampo2101s-projects.vercel.app"),
    true,
  );
  assert.equal(
    isTemporaryDeploymentUrl(
      "https://academia-decom-git-feat-x-josecampo2101s-projects.vercel.app",
    ),
    true,
  );
  assert.equal(isTemporaryDeploymentUrl("https://academia-decom.vercel.app"), false);
  assert.equal(isTemporaryDeploymentUrl("https://escuela.ipuc.org.co"), false);
});

test("el mensaje incluye el enlace y el WhatsApp lo codifica correctamente", () => {
  const link = `https://academia-decom.vercel.app/invitacion/${TOKEN}`;
  const message = buildInvitationMessage(link, "Distrito 34");
  assert.match(message, /Distrito 34/);
  assert.ok(message.includes(link));
  const share = buildWhatsappShareUrl(message);
  assert.ok(share.startsWith("https://wa.me/?text="));
  assert.equal(decodeURIComponent(share.slice("https://wa.me/?text=".length)), message);
});
