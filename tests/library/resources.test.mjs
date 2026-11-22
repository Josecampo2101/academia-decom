import test from "node:test";
import assert from "node:assert/strict";
import {
  RESOURCE_TYPES,
  filterResources,
  formatFileSize,
  normalizeText,
  resourceOpenMode,
  safeExternalUrl,
  typeLabel,
} from "../../lib/library/resources.mjs";

test("los ocho tipos de la base de datos tienen etiqueta en español", () => {
  for (const type of [
    "document",
    "guide",
    "template",
    "video",
    "audio",
    "link",
    "reading",
    "infographic",
  ]) {
    assert.ok(RESOURCE_TYPES[type], type);
  }
  assert.equal(typeLabel("guide"), "Guía");
  assert.equal(typeLabel("otro"), "Recurso");
});

test("safeExternalUrl solo acepta http y https", () => {
  assert.equal(safeExternalUrl("https://ipuc.org.co/recursos"), "https://ipuc.org.co/recursos");
  assert.equal(safeExternalUrl("  http://ejemplo.org "), "http://ejemplo.org/");
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("data:text/html,<script>"), "");
  assert.equal(safeExternalUrl("ftp://ejemplo.org/a"), "");
  assert.equal(safeExternalUrl("no es url"), "");
  assert.equal(safeExternalUrl(null), "");
});

test("resourceOpenMode decide cómo abrir cada recurso", () => {
  assert.equal(resourceOpenMode({ resource_type: "link", external_url: "https://a.org" }), "link");
  assert.equal(resourceOpenMode({ resource_type: "link", external_url: "javascript:x" }), "none");
  assert.equal(resourceOpenMode({ resource_type: "guide", storage_path: "d/a.pdf" }), "file");
  assert.equal(resourceOpenMode({ resource_type: "reading", content: "Texto" }), "text");
  assert.equal(resourceOpenMode({ resource_type: "reading", content: "   " }), "none");
  assert.equal(resourceOpenMode({}), "none");
});

test("normalizeText y filterResources ignoran tildes y mayúsculas", () => {
  assert.equal(normalizeText("  Fotografía Básica "), "fotografia basica");
  const items = [
    {
      title: "Fundamentos de fotografía",
      description: "Luz y encuadre",
      category_id: "c1",
      resource_type: "video",
    },
    {
      title: "Manual de identidad",
      description: "Uso del logo",
      category_id: "c2",
      resource_type: "guide",
    },
    {
      title: "Plantilla de nota",
      description: "Redacción informativa",
      category_id: "c1",
      resource_type: "template",
    },
  ];
  assert.equal(filterResources(items).length, 3);
  assert.deepEqual(
    filterResources(items, { query: "FOTOGRAFIA" }).map((i) => i.title),
    ["Fundamentos de fotografía"],
  );
  assert.equal(filterResources(items, { categoryId: "c1" }).length, 2);
  assert.equal(filterResources(items, { type: "guide" }).length, 1);
  assert.equal(
    filterResources(items, { categoryId: "c1", type: "template", query: "nota" }).length,
    1,
  );
  assert.equal(filterResources(items, { query: "inexistente" }).length, 0);
});

test("formatFileSize usa coma decimal y unidades", () => {
  assert.equal(formatFileSize(null), "");
  assert.equal(formatFileSize(0), "");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1536), "1,5 KB");
  assert.equal(formatFileSize(1024 * 1024), "1 MB");
  assert.equal(formatFileSize(5 * 1024 * 1024 + 300 * 1024), "5,3 MB");
});
