import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState, mergeStates, dayKey, saveMed, removeMed, activeMeds, toggleDose, addInterval, intervalStatus,
  todayDoses, medDay, medAdherence, saveMeal, removeMeal, setMealStatus, dietDay, dietAdherence, activeMeals, importMeals,
} from "../js/logic.js";

// 5/out/2026 é segunda-feira.
const at = (m, d, h = 9) => new Date(2026, m - 1, d, h, 0);
const OCT = (d) => at(10, d);
const KEY = (m, d) => dayKey(at(m, d));

const daily = (name, times = ["Manhã"]) => ({ name, dose: "10 mg", kind: "daily", times });
const hormone = { name: "Hormônio", dose: "1 ampola", kind: "interval", every: { n: 3, unit: "month" } };

describe("cadastro de remédios", () => {
  test("exige nome e pelo menos um horário nos diários", () => {
    assert.throws(() => saveMed(emptyState(), daily("  "), "a", OCT(1)), /nome/);
    assert.throws(() => saveMed(emptyState(), daily("X", []), "a", OCT(1)), /horário/);
  });
  test("remédio de intervalo exige um intervalo válido", () => {
    assert.throws(() => saveMed(emptyState(), { ...hormone, every: { n: 0, unit: "month" } }, "h", OCT(1)), /intervalo/);
    assert.throws(() => saveMed(emptyState(), { ...hormone, every: { n: 3, unit: "ano" } }, "h", OCT(1)), /intervalo/);
  });
  test("editar mantém a data de criação e não duplica", () => {
    let s = saveMed(emptyState(), daily("Vitamina D"), "a", OCT(1));
    s = saveMed(s, daily("Vitamina D3", ["Manhã", "Noite"]), "a", OCT(8));
    assert.equal(s.meds.length, 1);
    assert.equal(s.meds[0].createdAt, "2026-10-01");
    assert.deepEqual(s.meds[0].times, ["Manhã", "Noite"]);
  });
  test("horário desconhecido é ignorado", () => {
    const s = saveMed(emptyState(), daily("X", ["Manhã", "Madrugada"]), "a", OCT(1));
    assert.deepEqual(s.meds[0].times, ["Manhã"]);
  });
  test("remover deixa marcador e some da lista ativa", () => {
    let s = saveMed(emptyState(), daily("X"), "a", OCT(1));
    s = removeMed(s, "a", OCT(2));
    assert.equal(s.meds.length, 1);
    assert.equal(activeMeds(s).length, 0);
  });
});

describe("doses", () => {
  test("todayDoses lista um item por horário e reflete a marcação", () => {
    let s = saveMed(emptyState(), daily("A", ["Manhã", "Noite"]), "a", OCT(5));
    s = toggleDose(s, "a", "Manhã", KEY(10, 5));
    assert.deepEqual(todayDoses(s, OCT(5)).map((d) => [d.slot, d.taken]), [["Manhã", true], ["Noite", false]]);
  });
  test("tocar duas vezes desmarca", () => {
    let s = saveMed(emptyState(), daily("A"), "a", OCT(5));
    s = toggleDose(toggleDose(s, "a", "Manhã", KEY(10, 5)), "a", "Manhã", KEY(10, 5));
    assert.equal(todayDoses(s, OCT(5))[0].taken, false);
  });
  test("remédio de intervalo não aparece na lista diária", () => {
    const s = saveMed(emptyState(), hormone, "h", OCT(5));
    assert.equal(todayDoses(s, OCT(5)).length, 0);
  });
});

describe("intervalo", () => {
  test("addInterval soma meses sem estourar o fim do mês", () => {
    assert.equal(dayKey(addInterval(at(10, 31), { n: 1, unit: "month" })), "2026-11-30");
    assert.equal(dayKey(addInterval(at(11, 30), { n: 3, unit: "month" })), "2027-02-28");
    assert.equal(dayKey(addInterval(at(10, 5), { n: 3, unit: "month" })), "2027-01-05");
    assert.equal(dayKey(addInterval(at(10, 5), { n: 2, unit: "week" })), "2026-10-19");
    assert.equal(dayKey(addInterval(at(10, 5), { n: 10, unit: "day" })), "2026-10-15");
  });
  test("sem dose registrada, a situação é primeira", () => {
    const s = saveMed(emptyState(), hormone, "h", OCT(5));
    assert.equal(intervalStatus(s, s.meds[0], OCT(5)).status, "primeira");
  });
  test("calcula próxima dose e situação", () => {
    let s = saveMed(emptyState(), hormone, "h", OCT(5));
    s = toggleDose(s, "h", "dose", KEY(10, 5));
    const med = s.meds[0];
    const st = intervalStatus(s, med, OCT(5));
    assert.equal(st.next, "2027-01-05");
    assert.equal(st.status, "ok");
    assert.equal(intervalStatus(s, med, at(12, 31)).status, "perto");
    assert.equal(intervalStatus(s, med, new Date(2027, 0, 6, 9)).status, "atrasado");
  });
  test("usa a dose mais recente", () => {
    let s = saveMed(emptyState(), hormone, "h", at(7, 1));
    s = toggleDose(toggleDose(s, "h", "dose", KEY(7, 5)), "h", "dose", KEY(10, 5));
    assert.equal(intervalStatus(s, s.meds[0], OCT(6)).last, "2026-10-05");
  });
});

describe("adesão aos remédios", () => {
  const base = () => {
    let s = saveMed(emptyState(), daily("A", ["Manhã", "Noite"]), "a", OCT(1));
    return s;
  };
  test("conta doses esperadas e tomadas; hoje sem marcação não pesa", () => {
    let s = base();
    for (const d of [1, 2, 3]) s = toggleDose(s, "a", "Manhã", KEY(10, d));
    // dias 1-4 de 4 dias: 8 esperadas; hoje (4) sem marcação é ignorado → 3 dias = 6 esperadas
    const r = medAdherence(s, OCT(4), 7);
    assert.deepEqual([r.expected, r.taken, r.pct], [6, 3, 50]);
  });
  test("hoje entra quando já tem marcação", () => {
    let s = base();
    s = toggleDose(s, "a", "Manhã", KEY(10, 4));
    const r = medAdherence(s, OCT(4), 7);
    assert.deepEqual([r.expected, r.taken], [8, 1]);
  });
  test("dias antes do cadastro não contam", () => {
    const s = base();
    assert.equal(medDay(s, KEY(9, 30)).expected, 0);
  });
  test("sem remédios, a porcentagem é null", () => {
    assert.equal(medAdherence(emptyState(), OCT(5), 7).pct, null);
  });
});

describe("dieta", () => {
  const base = () => {
    let s = saveMeal(emptyState(), { name: "Café da manhã", text: "Ovos e fruta" }, "m1", OCT(1));
    s = saveMeal(s, { name: "Almoço", text: "" }, "m2", OCT(1));
    return s;
  };
  test("exige nome e preserva ordem de criação", () => {
    assert.throws(() => saveMeal(emptyState(), { name: " " }, "x", OCT(1)), /nome/);
    assert.deepEqual(activeMeals(base()).map((m) => m.order).sort(), [0, 1]);
  });
  test("tocar no mesmo status limpa; status inválido é ignorado", () => {
    let s = setMealStatus(base(), "m1", KEY(10, 5), "ok");
    assert.equal(s.dietLog["2026-10-05"].m1, "ok");
    s = setMealStatus(s, "m1", KEY(10, 5), "ok");
    assert.equal(s.dietLog["2026-10-05"].m1, null);
    assert.equal(setMealStatus(s, "m1", KEY(10, 5), "qualquer"), s);
  });
  test("pontuação: ok vale 1, parcial 0,5, fora 0", () => {
    let s = base();
    s = setMealStatus(s, "m1", KEY(10, 2), "ok");
    s = setMealStatus(s, "m2", KEY(10, 2), "parcial");
    assert.deepEqual(dietDay(s, KEY(10, 2)), { expected: 2, marked: 2, score: 1.5 });
  });
  test("adesão em % e hoje sem marcação não pesa", () => {
    let s = base();
    s = setMealStatus(s, "m1", KEY(10, 2), "ok");
    s = setMealStatus(s, "m2", KEY(10, 2), "fora");
    // dias 1 e 2 contam (4 refeições, 1 ponto); hoje (3) sem marcação é ignorado
    assert.equal(dietAdherence(s, OCT(3), 7).pct, 25);
  });
  test("remover refeição deixa marcador", () => {
    const s = removeMeal(base(), "m1", OCT(2));
    assert.deepEqual(activeMeals(s).map((m) => m.id), ["m2"]);
  });
});

describe("sincronização de remédios e dieta", () => {
  test("união de remédios cadastrados em aparelhos diferentes", () => {
    const a = { ...saveMed(emptyState(), daily("A"), "a", OCT(1)), savedAt: "2026-10-02T10:00:00Z" };
    const b = { ...saveMed(emptyState(), daily("B"), "b", OCT(1)), savedAt: "2026-10-03T10:00:00Z" };
    assert.deepEqual(mergeStates(a, b).meds.map((m) => m.id).sort(), ["a", "b"]);
  });
  test("a exclusão mais recente vence e não ressuscita o remédio", () => {
    const created = saveMed(emptyState(), daily("A"), "a", OCT(1));
    const a = { ...created, savedAt: "2026-10-02T10:00:00Z" };
    const b = { ...removeMed(created, "a", OCT(3)), savedAt: "2026-10-03T10:00:00Z" };
    assert.equal(activeMeds(mergeStates(a, b)).length, 0);
    assert.equal(activeMeds(mergeStates(b, a)).length, 0);
  });
  test("marcações dos dois lados se juntam; desmarcar no mais recente vale", () => {
    let a = { ...saveMed(emptyState(), daily("A", ["Manhã", "Noite"]), "a", OCT(1)), savedAt: "2026-10-02T10:00:00Z" };
    a = { ...toggleDose(a, "a", "Manhã", KEY(10, 2)), savedAt: "2026-10-02T10:00:00Z" };
    let b = { ...a, savedAt: "2026-10-03T10:00:00Z" };
    b = { ...toggleDose(b, "a", "Manhã", KEY(10, 2)), savedAt: "2026-10-03T10:00:00Z" }; // desmarcou
    b = { ...toggleDose(b, "a", "Noite", KEY(10, 2)), savedAt: "2026-10-03T10:00:00Z" };
    const log = mergeStates(a, b).medLog["2026-10-02"];
    assert.deepEqual([log["a|Manhã"], log["a|Noite"]], [false, true]);
  });
  test("refeições e marcações da dieta também se juntam", () => {
    const a = { ...setMealStatus(saveMeal(emptyState(), { name: "Café" }, "m1", OCT(1)), "m1", KEY(10, 2), "ok"), savedAt: "2026-10-02T10:00:00Z" };
    const b = { ...setMealStatus(saveMeal(emptyState(), { name: "Jantar" }, "m2", OCT(1)), "m2", KEY(10, 2), "fora"), savedAt: "2026-10-03T10:00:00Z" };
    const m = mergeStates(a, b);
    assert.equal(activeMeals(m).length, 2);
    assert.deepEqual(m.dietLog["2026-10-02"], { m1: "ok", m2: "fora" });
  });
  test("estado antigo sem os campos novos continua válido", () => {
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    const m = mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" });
    assert.deepEqual([m.meds, m.meals, m.medLog, m.dietLog], [[], [], {}, {}]);
  });
});

describe("importar plano", () => {
  let n = 0;
  const makeId = () => `id${++n}`;
  test("importa as refeições na ordem do arquivo", () => {
    const { state, added } = importMeals(emptyState(), [{ name: "Café", text: "Pão" }, { name: "Almoço", text: "Arroz" }], OCT(1), makeId);
    assert.equal(added, 2);
    assert.deepEqual(activeMeals(state).sort((a, b) => a.order - b.order).map((m) => m.name), ["Café", "Almoço"]);
  });
  test("importar de novo não duplica", () => {
    const list = [{ name: "Café", text: "Pão" }];
    const first = importMeals(emptyState(), list, OCT(1), makeId);
    const again = importMeals(first.state, [{ name: "café", text: "outro" }, { name: "Ceia", text: "" }], OCT(2), makeId);
    assert.equal(again.added, 1);
    assert.equal(activeMeals(again.state).length, 2);
  });
  test("recusa arquivo que não é uma lista ou item sem nome", () => {
    assert.throws(() => importMeals(emptyState(), {}, OCT(1), makeId), /lista/);
    assert.throws(() => importMeals(emptyState(), [], OCT(1), makeId), /lista/);
    assert.throws(() => importMeals(emptyState(), [{ text: "x" }], OCT(1), makeId), /nome/);
  });
  test("aceita textos longos do plano", () => {
    const text = "x".repeat(1900);
    const { state } = importMeals(emptyState(), [{ name: "Jantar", text }], OCT(1), makeId);
    assert.equal(activeMeals(state)[0].text.length, 1900);
  });
});