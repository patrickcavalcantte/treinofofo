import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validAvatar, saveAvatar, removeAvatar, avatarSrc, AVATAR_MAX_CHARS } from "../js/avatar.js";
import { emptyState, mergeStates } from "../js/logic.js";

const OK = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD";
const T1 = new Date(2026, 9, 7, 10);
const T2 = new Date(2026, 9, 8, 10);

describe("foto de perfil", () => {
  test("aceita só JPEG em base64 e de tamanho pequeno", () => {
    assert.equal(validAvatar(OK), true);
    for (const bad of [null, "", "data:image/jpeg;base64,", "data:image/png;base64,AAAA", "https://x.com/a.jpg", "javascript:alert(1)",
      'data:image/jpeg;base64,AAAA" onerror="x', OK + "a".repeat(AVATAR_MAX_CHARS)]) {
      assert.equal(validAvatar(bad), false, String(bad).slice(0, 40));
    }
  });
  test("salva, mostra e remove", () => {
    let s = saveAvatar(emptyState(), OK, T1);
    assert.equal(avatarSrc(s), OK);
    s = removeAvatar(s, T2);
    assert.equal(avatarSrc(s), null);
    assert.equal(s.avatar.data, null); // fica o marcador, para a remoção valer nos outros aparelhos
  });
  test("recusa uma foto inválida sem mexer no estado", () => {
    assert.throws(() => saveAvatar(emptyState(), "https://x.com/a.jpg", T1), /Não foi possível/);
  });
  test("sem foto, o cabeçalho usa o logo", () => {
    assert.equal(avatarSrc(emptyState()), null);
  });
});

describe("sincronização", () => {
  test("vale a mudança mais recente, inclusive a remoção", () => {
    const a = { ...saveAvatar(emptyState(), OK, T1), savedAt: "2026-10-07T10:00:00Z" };
    const b = { ...removeAvatar(a, T2), savedAt: "2026-10-08T10:00:00Z" };
    assert.equal(avatarSrc(mergeStates(a, b)), null);
    assert.equal(avatarSrc(mergeStates(b, a)), null);
    const c = { ...saveAvatar(emptyState(), OK, new Date(2026, 9, 9, 10)), savedAt: "2026-10-09T10:00:00Z" };
    assert.equal(avatarSrc(mergeStates(b, c)), OK);
  });
  test("estado antigo sem o campo continua válido", () => {
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    assert.equal(mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" }).avatar, null);
  });
});
