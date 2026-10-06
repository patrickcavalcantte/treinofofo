import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ML_PER_KG, WORKOUT_EXTRA_ML, MIN_GOAL_ML, MAX_GOAL_ML, QUICK_ML, MAX_SINGLE_ML, HYDRATION_DISCLAIMER, HYDRATION_SOURCE,
  fmtVolume, waterGoal, saveHydration, addWater, removeWater, waterEntries, waterTotal, waterStatus, waterWeek,
} from "../js/hydration.js";
import { emptyState, setWeight, mergeStates, dayKey, finishSession, newDraft } from "../js/logic.js";
import { saveNutrition } from "../js/nutrition.js";

const NOW = new Date(2026, 10, 3, 14, 0);
const KEY = dayKey(NOW);
const withKg = (kg, extra = {}) => ({ ...setWeight(emptyState(), kg, NOW), ...extra });

describe("formato de volume", () => {
  test("litros com vírgula e ml abaixo de 1 L", () => {
    assert.equal(fmtVolume(2500), "2,5 L");
    assert.equal(fmtVolume(2000), "2 L");
    assert.equal(fmtVolume(1250), "1,25 L");
    assert.equal(fmtVolume(600), "600 ml");
    assert.equal(fmtVolume(0), "0 ml");
    assert.equal(fmtVolume(null), "0 ml");
    assert.equal(fmtVolume(-50), "0 ml");
  });
});

describe("meta de hidratação", () => {
  test("35 ml por kg, arredondado para 50 ml", () => {
    assert.equal(ML_PER_KG, 35);
    assert.equal(waterGoal(withKg(70), NOW).ml, 2450); // 70 x 35
    assert.equal(waterGoal(withKg(72.4), NOW).ml, 2550); // 2.534 arredonda para 2.550
    assert.equal(waterGoal(withKg(60), NOW).ml, 2100);
    assert.equal(waterGoal(withKg(70), NOW).source, "peso");
  });
  test("usa o último peso registrado", () => {
    let s = setWeight(emptyState(), 80, new Date(2026, 9, 20));
    s = setWeight(s, 70, NOW);
    assert.equal(waterGoal(s, NOW).weightKg, 70);
  });
  test("a altura não muda a meta", () => {
    const a = saveNutrition(withKg(70), { heightCm: 150, birthYear: 1996, activity: "leve", goal: "manter", formula: "media", microRef: "masculina" }, NOW);
    const b = saveNutrition(withKg(70), { heightCm: 195, birthYear: 1996, activity: "leve", goal: "manter", formula: "media", microRef: "masculina" }, NOW);
    assert.equal(waterGoal(a, NOW).ml, waterGoal(b, NOW).ml);
  });
  test("tem piso e teto, mesmo para pesos extremos", () => {
    assert.equal(waterGoal(withKg(35), NOW).ml, MIN_GOAL_ML); // 1.225 sobe para o piso
    assert.equal(waterGoal(withKg(200), NOW).ml, MAX_GOAL_ML); // 7.000 desce para o teto
  });
  test("dia de treino concluído soma 500 ml, sem passar do teto", () => {
    const draft = newDraft("A", withKg(70), NOW);
    draft.entries[Object.keys(draft.entries)[0]].sets[0] = { reps: 10, kg: 4, done: true };
    const trained = finishSession(withKg(70), draft, NOW);
    const g = waterGoal(trained, NOW);
    assert.deepEqual([g.base, g.extra, g.ml, g.trained], [2450, WORKOUT_EXTRA_ML, 2950, true]);
    assert.equal(waterGoal(withKg(70), NOW).extra, 0);
    const heavy = finishSession(withKg(200), (() => { const d = newDraft("A", withKg(200), NOW); d.entries[Object.keys(d.entries)[0]].sets[0] = { reps: 10, kg: 4, done: true }; return d; })(), NOW);
    assert.equal(waterGoal(heavy, NOW).ml, MAX_GOAL_ML);
  });
  test("treino de outro dia não conta", () => {
    const draft = newDraft("A", withKg(70), new Date(2026, 10, 1));
    draft.entries[Object.keys(draft.entries)[0]].sets[0] = { reps: 10, kg: 4, done: true };
    const s = finishSession(withKg(70), draft, new Date(2026, 10, 1));
    assert.equal(waterGoal(s, NOW).extra, 0);
  });
  test("sem peso, não há meta calculada", () => {
    assert.deepEqual(waterGoal(emptyState(), NOW), { ok: false, reason: "sem-peso" });
    assert.equal(waterGoal(withKg(20), NOW).ok, false);
    assert.equal(waterGoal(withKg(400), NOW).ok, false);
  });
  test("a meta digitada vale no lugar do cálculo, e no dia de treino não soma extra", () => {
    const s = saveHydration(withKg(70), { goalMl: "3000" }, NOW);
    assert.deepEqual([waterGoal(s, NOW).ml, waterGoal(s, NOW).source, waterGoal(s, NOW).extra], [3000, "manual", 0]);
    assert.equal(waterGoal(saveHydration(emptyState(), { goalMl: 2200 }, NOW), NOW).ok, true); // vale até sem peso
  });
  test("limpar a meta digitada volta ao cálculo", () => {
    let s = saveHydration(withKg(70), { goalMl: 3000 }, NOW);
    s = saveHydration(s, { goalMl: "" }, NOW);
    assert.equal(s.hydration.goalMl, null);
    assert.equal(waterGoal(s, NOW).source, "peso");
  });
  test("recusa meta digitada fora da faixa ou que não é número", () => {
    for (const bad of [500, 7000, "abc", -1]) assert.throws(() => saveHydration(emptyState(), { goalMl: bad }, NOW), /entre 1000 e 6000/, String(bad));
    assert.equal(saveHydration(emptyState(), { goalMl: "2500" }, NOW).hydration.goalMl, 2500); // texto numérico também vale
  });
});

describe("registro de líquidos", () => {
  test("soma os registros do dia", () => {
    let s = addWater(emptyState(), 200, KEY, "a", NOW);
    s = addWater(s, 500, KEY, "b", NOW);
    s = addWater(s, "300", KEY, "c", NOW);
    assert.equal(waterTotal(s, KEY), 1000);
    assert.equal(waterEntries(s, KEY).length, 3);
    assert.deepEqual(QUICK_ML, [200, 300, 500]);
  });
  test("valida a quantidade", () => {
    for (const bad of [0, 5, -200, "abc", "", null, MAX_SINGLE_ML + 1]) assert.throws(() => addWater(emptyState(), bad, KEY, "x", NOW), /de 10 a 2000/, String(bad));
    assert.equal(waterEntries(addWater(emptyState(), "250,4", KEY, "x", NOW), KEY)[0].ml, 250);
  });
  test("remover deixa um marcador e tira do total", () => {
    let s = addWater(addWater(emptyState(), 200, KEY, "a", NOW), 300, KEY, "b", NOW);
    s = removeWater(s, KEY, "a", NOW);
    assert.equal(waterTotal(s, KEY), 300);
    assert.equal(s.waterLog[KEY].length, 2);
  });
  test("cada dia tem o seu total", () => {
    const s = addWater(addWater(emptyState(), 200, KEY, "a", NOW), 900, "2026-11-02", "b", NOW);
    assert.equal(waterTotal(s, KEY), 200);
    assert.equal(waterTotal(s, "2026-11-02"), 900);
    assert.equal(waterTotal(s, "2026-01-01"), 0);
  });
  test("guarda o horário do registro", () => {
    assert.match(waterEntries(addWater(emptyState(), 200, KEY, "a", NOW), KEY)[0].at, /^2026-11-03T/);
  });
});

describe("situação e semana", () => {
  test("situação do dia em palavras", () => {
    assert.equal(waterStatus(200, 2000), "falta");
    assert.equal(waterStatus(1200, 2000), "quase");
    assert.equal(waterStatus(2000, 2000), "na-meta");
    assert.equal(waterStatus(2700, 2000), "acima");
    assert.equal(waterStatus(500, 0), "sem-meta");
  });
  test("os últimos 7 dias vêm do mais antigo para hoje, com a porcentagem da meta base", () => {
    let s = withKg(70);
    s = addWater(addWater(s, 2000, KEY, "a", NOW), 450, KEY, "a2", NOW); // 2.450 ml no dia, em dois registros
    s = addWater(s, 1225, "2026-11-02", "b", NOW);
    const week = waterWeek(s, NOW, 7);
    assert.equal(week.length, 7);
    assert.equal(week.at(-1).key, KEY);
    assert.equal(week.at(-1).pct, 100);
    assert.equal(week.at(-2).pct, 50);
    assert.equal(week[0].ml, 0);
    assert.ok(week.every((d) => typeof d.label === "string"));
  });
  test("a porcentagem passa de 100 mas é limitada em 150", () => {
    const s = addWater(withKg(70), 2000, KEY, "a", NOW);
    assert.equal(waterWeek(addWater(s, 2000, KEY, "b", NOW), NOW).at(-1).pct, 150);
  });
  test("sem meta, a porcentagem é nula", () => {
    assert.equal(waterWeek(emptyState(), NOW).at(-1).pct, null);
  });
});

describe("sincronização", () => {
  test("os registros dos dois aparelhos se juntam no mesmo dia, e a remoção mais recente vale", () => {
    const base = addWater(emptyState(), 200, KEY, "a", new Date(2026, 10, 3, 8));
    const a = { ...base, savedAt: "2026-11-03T08:00:00Z" };
    const b0 = addWater(base, 300, KEY, "b", new Date(2026, 10, 3, 9));
    const b = { ...removeWater(b0, KEY, "a", new Date(2026, 10, 3, 10)), savedAt: "2026-11-03T10:00:00Z" };
    assert.deepEqual(waterEntries(mergeStates(a, b), KEY).map((e) => e.id), ["b"]);
    assert.deepEqual(waterEntries(mergeStates(b, a), KEY).map((e) => e.id), ["b"]);
  });
  test("vale a meta digitada mais recente", () => {
    const a = { ...saveHydration(emptyState(), { goalMl: 2000 }, new Date(2026, 10, 2)), savedAt: "2026-11-02T10:00:00Z" };
    const b = { ...saveHydration(emptyState(), { goalMl: 3000 }, new Date(2026, 10, 3)), savedAt: "2026-11-03T10:00:00Z" };
    assert.equal(mergeStates(a, b).hydration.goalMl, 3000);
    assert.equal(mergeStates(b, a).hydration.goalMl, 3000);
  });
  test("estado antigo sem os campos novos continua válido", () => {
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-11-01T10:00:00Z" };
    const m = mergeStates(legacy, { ...emptyState(), savedAt: "2026-11-02T10:00:00Z" });
    assert.deepEqual([m.waterLog, m.hydration], [{}, null]);
  });
});

describe("avisos e fonte", () => {
  test("o aviso lembra que muda com a saúde e que beber demais também faz mal", () => {
    assert.match(HYDRATION_DISCLAIMER, /estimativa geral/);
    assert.match(HYDRATION_DISCLAIMER, /rins/);
    assert.match(HYDRATION_DISCLAIMER, /Beber demais também faz mal/);
    assert.match(HYDRATION_SOURCE, /EFSA/);
  });
});
