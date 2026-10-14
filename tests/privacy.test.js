import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPrivacy, PRIVACY_VERSION, CONSENT_LABEL } from "../js/privacy.js";
import { emptyState, hasUserData } from "../js/logic.js";

test("a política cita o que é guardado, os direitos e o botão de exclusão", () => {
  const html = renderPrivacy("privacy-back");
  for (const t of ["O que o app guarda", "Seus direitos", "Excluir minha conta e meus dados", "consentimento", PRIVACY_VERSION]) {
    assert.ok(html.includes(t), t);
  }
  assert.ok(html.includes('data-action="privacy-back"'));
});

test("o aceite fala de dados de saúde", () => {
  assert.match(CONSENT_LABEL, /dados de saúde/);
});

test("hasUserData: estado vazio ou só com tour visto não conta como dados", () => {
  assert.equal(hasUserData(emptyState()), false);
  assert.equal(hasUserData({ ...emptyState(), tour: { done: true } }), false);
});

test("hasUserData: qualquer registro da pessoa conta", () => {
  assert.equal(hasUserData({ ...emptyState(), weights: [{ kg: 70 }] }), true);
  assert.equal(hasUserData({ ...emptyState(), waterLog: { "2026-10-01": [] } }), true);
  assert.equal(hasUserData({ ...emptyState(), profile: { name: "A" } }), true);
});
