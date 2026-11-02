import assert from "node:assert/strict";
import test from "node:test";
import { canCreateRole, canManageAccount } from "../lib/admin-access";

const principal = { matricule: "PRM-8651", role: "SUPER_ADMIN" };
const secondary = { matricule: "ADM-100", role: "ADMIN" };
const otherSecondary = { matricule: "ADM-200", role: "ADMIN" };
const agent = { matricule: "AGT-100", role: "COMMISSARIAT_AGENT" };

test("seul l’administrateur principal peut créer un administrateur secondaire", () => {
  assert.equal(canCreateRole(principal, "ADMIN"), true);
  assert.equal(canCreateRole(secondary, "ADMIN"), false);
  assert.equal(canCreateRole(principal, "SUPER_ADMIN"), false);
});

test("l’administrateur principal contrôle les administrateurs secondaires", () => {
  assert.equal(canManageAccount(principal, secondary), true);
});

test("un administrateur secondaire ne peut agir ni sur le principal ni sur un autre administrateur", () => {
  assert.equal(canManageAccount(secondary, principal), false);
  assert.equal(canManageAccount(secondary, otherSecondary), false);
  assert.equal(canManageAccount(secondary, agent), true);
});

test("aucun administrateur ne peut suspendre, supprimer ou réinitialiser son propre compte", () => {
  assert.equal(canManageAccount(principal, principal), false);
  assert.equal(canManageAccount(secondary, secondary), false);
});
