import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicDirectory = new URL("../public/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.webmanifest", publicDirectory), "utf8"),
);
const serviceWorker = await readFile(new URL("sw.js", publicDirectory), "utf8");

test("manifest describes an installable French standalone application", () => {
  assert.equal(manifest.lang, "fr");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
});

test("manifest and Apple icons exist with the declared PNG dimensions", async () => {
  for (const [file, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-touch-icon.png", 180],
  ]) {
    const png = await readFile(new URL(file, publicDirectory));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("service worker supports installation without caching sensitive app data", () => {
  assert.match(serviceWorker, /addEventListener\("fetch"/);
  assert.match(serviceWorker, /event\.respondWith\(fetch\(event\.request\)\)/);
  assert.doesNotMatch(serviceWorker, /caches\.(?:open|match|put)/);
});
