import test from "node:test";
import assert from "node:assert/strict";

const normalize = value => value.toUpperCase().replace(/[\s-]/g, "").trim();
test("normalise IMEI, plaque et numéro de série", () => {
  assert.equal(normalize("351 234-567 890123"), "351234567890123");
  assert.equal(normalize("ml-4821 ab"), "ML4821AB");
});
