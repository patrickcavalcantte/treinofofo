import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hasCheckedIn, doCheckin, checkinsThisMonth, pendingItems, renderCheckin } from "../js/checkin.js";
import { emptyState, saveMed, toggleDose, saveMeal, setMealStatus, setWeight, mergeStates, dayKey } from "../js/logic.js";
import { addWater } from "../js/hydration.js";

const NOW = new Date(2026, 9, 7, 9, 0); // quarta
const KEY = dayKey(NOW);
const bad = (html) => /undefined|NaN|\[object|Infinity/.test(html);
const flat = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const before = new Date(2026, 8, 1);

describe("check-in", () => {
  test("registra o dia uma vez e não mexe em mais nada", () => {
    const s0 = setWeight(emptyState(), 70, NOW);
    const s1 = doCheckin(s0, KEY, NOW);
    assert.equal(hasCheckedIn(s1, KEY), true);
    assert.equal(hasCheckedIn(s0, KEY), false);
    assert.deepEqual({ ...s1, checkins: {} }, { ...s0, checkins: {} }); // nenhuma dose, refeição ou água foi marcada
    assert.equal(doCheckin(s1, KEY, new Date(2026, 9, 7, 20)), s1); // repetir não muda o horário
  });
  test("conta só os dias do mês, sem sequência", () => {
    let s = doCheckin(emptyState(), "2026-10-02", NOW);
    s = doCheckin(s, "2026-10-07", NOW);
    s = doCheckin(s, "2026-09-30", NOW);
    assert.equal(checkinsThisMonth(s, NOW), 2);
  });
});

describe("o que falta hoje", () => {
  test("lista doses, água, refeições e pesagem pendentes", () => {
    let s = saveMed(emptyState(), { name: "Vitamina D", dose: "", kind: "daily", times: ["Manhã", "Noite"] }, "m1", before);
    s = saveMeal(s, { name: "Almoço", text: "" }, "r1", before);
    s = setWeight(s, 70, new Date(2026, 8, 20)); // pesou em semana anterior
    const ids = pendingItems(s, NOW).map((i) => i.id);
    assert.deepEqual(ids, ["meds", "agua", "diet", "weight"]);
    assert.match(pendingItems(s, NOW)[0].text, /2 doses/);
  });
  test("some o que já foi feito", () => {
    let s = saveMed(emptyState(), { name: "Vitamina D", dose: "", kind: "daily", times: ["Manhã"] }, "m1", before);
    s = saveMeal(s, { name: "Almoço", text: "" }, "r1", before);
    s = setWeight(s, 70, NOW);
    s = toggleDose(s, "m1", "Manhã", KEY);
    s = setMealStatus(s, "r1", KEY, "ok");
    s = addWater(s, 2000, KEY, "a", NOW);
    s = addWater(s, 500, KEY, "b", NOW);
    assert.deepEqual(pendingItems(s, NOW), []);
  });
  test("sem peso, não cobra água; sem remédio nem dieta, só a pesagem", () => {
    assert.deepEqual(pendingItems(emptyState(), NOW).map((i) => i.id), ["weight"]);
  });
});

describe("cartão", () => {
  test("antes do check-in tem o botão; depois some, e os pendentes continuam à mostra", () => {
    let s = saveMed(emptyState(), { name: "X", dose: "", kind: "daily", times: ["Manhã"] }, "m1", before);
    const a = renderCheckin(s, NOW);
    assert.match(a, /data-action="checkin-done"/);
    assert.match(flat(a), /1 dose de remédio/);
    s = doCheckin(s, KEY, NOW);
    const b = renderCheckin(s, NOW);
    assert.doesNotMatch(b, /checkin-done/);
    assert.match(flat(b), /Check-in de hoje feito/);
    assert.match(flat(b), /1 dose de remédio/);
    assert.match(flat(b), /1 dia com check-in neste mês/);
    assert.equal(bad(a) || bad(b), false);
  });
  test("tudo em dia mostra uma mensagem tranquila", () => {
    const s = setWeight(emptyState(), 70, NOW);
    const s2 = addWater(addWater(s, 2000, KEY, "a", NOW), 500, KEY, "b", NOW);
    assert.match(flat(renderCheckin(s2, NOW)), /Tudo em dia/);
  });
});

describe("sincronização", () => {
  test("check-ins dos dois aparelhos se juntam; estado antigo continua válido", () => {
    const a = { ...doCheckin(emptyState(), "2026-10-06", NOW), savedAt: "2026-10-06T10:00:00Z" };
    const b = { ...doCheckin(emptyState(), "2026-10-07", NOW), savedAt: "2026-10-07T10:00:00Z" };
    assert.equal(checkinsThisMonth(mergeStates(a, b), NOW), 2);
    assert.equal(checkinsThisMonth(mergeStates(b, a), NOW), 2);
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    assert.deepEqual(mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" }).checkins, {});
  });
});
