import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TABLES, activityKcal, activityPrefs, saveActivityPrefs, addActivity, removeActivity, activityEntries, activityTotals, activityCredit,
  addFavorite, removeFavorite, activeFavorites, favoriteList, parseActivities, findActivity, searchActivities, norm, SYNONYMS,
} from "../js/activities.js";
import { renderActivities, renderActivityResults, activityCard } from "../js/activityview.js";
import { emptyState, setWeight, mergeStates, dayKey } from "../js/logic.js";
import { saveNutrition, kcalBudget } from "../js/nutrition.js";

const NOW = new Date(2026, 9, 6, 14, 0);
const KEY = dayKey(NOW);
const data = parseActivities(JSON.parse(readFileSync(new URL("../assets/atividades.json", import.meta.url), "utf8")));
const withKg = (kg) => setWeight(emptyState(), kg, NOW);
const forro = { code: "03030", name: "Dança de salão, rápida", met: 5.5, table: "adulto" };

describe("dados do Compendium", () => {
  test("tem as duas tabelas, com códigos únicos e MET plausível", () => {
    assert.ok(data.adulto.length >= 90 && data.cadeira.length >= 30);
    for (const t of Object.keys(TABLES)) {
      const codes = data[t].map((a) => a.code);
      assert.equal(new Set(codes).size, codes.length, `códigos repetidos em ${t}`);
      for (const a of data[t]) {
        assert.match(a.code, /^\d{5}$/);
        assert.ok(a.met >= 0.8 && a.met <= 20, `${a.code} MET ${a.met}`);
        assert.ok(a.pt && a.group && a.en, a.code);
        assert.equal(a.table, t);
      }
    }
  });
  test("cobre o que as pessoas pediram: mercado, dança, escalada e trilha", () => {
    for (const q of ["mercado", "danca", "escalada", "trilha"]) assert.ok(searchActivities(data.adulto, q).length, q);
    assert.ok(searchActivities(data.cadeira, "basquete").length);
  });
});

describe("gasto de energia", () => {
  test("(MET - 1) x kg x horas, só o que passa do repouso", () => {
    assert.equal(activityKcal({ met: 5.5, minutes: 60, kg: 70 }), 315); // 4,5 x 70 x 1
    assert.equal(activityKcal({ met: 5.5, minutes: 30, kg: 70 }), 158);
    assert.equal(activityKcal({ met: 1, minutes: 60, kg: 70 }), 0);
  });
  test("cadeira de rodas usa 0,992 kcal/kg/h como repouso", () => {
    assert.equal(activityKcal({ met: 5.1, minutes: 60, kg: 70, factor: TABLES.cadeira.factor }), Math.round(4.1 * 0.992 * 70));
  });
  test("entradas inválidas dão zero", () => {
    for (const bad of [{ met: "x", minutes: 30, kg: 70 }, { met: 5, minutes: 0, kg: 70 }, { met: 5, minutes: 30, kg: null }, { met: 0.5, minutes: 30, kg: 70 }]) {
      assert.equal(activityKcal(bad), 0);
    }
  });
});

describe("registro", () => {
  test("registra, soma e remove deixando marcador", () => {
    let s = addActivity(withKg(70), { ...forro, minutes: 60 }, KEY, "a", NOW);
    s = addActivity(s, { code: "17082", name: "Trilha", met: 5.3, table: "adulto", minutes: "30" }, KEY, "b", NOW);
    assert.deepEqual(activityTotals(s, KEY), { kcal: 315 + 151, minutes: 90, count: 2 });
    s = removeActivity(s, KEY, "a", NOW);
    assert.equal(activityTotals(s, KEY).count, 1);
    assert.equal(s.activityLog[KEY].length, 2);
  });
  test("exige peso e duração válida", () => {
    assert.throws(() => addActivity(emptyState(), { ...forro, minutes: 30 }, KEY, "a", NOW), /peso/);
    for (const bad of [0, 4, 601, "abc", ""]) assert.throws(() => addActivity(withKg(70), { ...forro, minutes: bad }, KEY, "a", NOW), /minutos/, String(bad));
    assert.throws(() => addActivity(withKg(70), { ...forro, table: "x", minutes: 30 }, KEY, "a", NOW), /inválida/);
  });
  test("o gasto fica gravado: mudar o peso depois não reescreve o dia", () => {
    let s = addActivity(withKg(70), { ...forro, minutes: 60 }, KEY, "a", NOW);
    s = setWeight(s, 90, new Date(2026, 9, 13));
    assert.equal(activityTotals(s, KEY).kcal, 315);
  });
});

describe("crédito no orçamento de calorias", () => {
  const profile = { heightCm: 170, birthYear: 1996, activity: "leve", goal: "perder", formula: "media", microRef: "feminina" };
  const base = () => saveNutrition(withKg(70), profile, NOW);

  test("o que a pessoa registrou vira calorias extras para comer", () => {
    const before = kcalBudget(base(), NOW, KEY);
    const s = addActivity(base(), { ...forro, minutes: 60 }, KEY, "a", NOW);
    const after = kcalBudget(s, NOW, KEY);
    assert.equal(after.credit, 315);
    assert.equal(after.allowed, before.target + 315);
    assert.equal(after.remaining, before.remaining + 315);
    assert.equal(before.credit, 0);
  });
  test("a pessoa escolhe quanto conta: 100, 75 ou 50%", () => {
    let s = addActivity(base(), { ...forro, minutes: 60 }, KEY, "a", NOW);
    assert.equal(activityPrefs(s).creditPct, 100);
    s = saveActivityPrefs(s, { table: "adulto", creditPct: "50" }, NOW);
    assert.equal(activityCredit(s, KEY), 158);
    assert.equal(kcalBudget(s, NOW, KEY).credit, 158);
    assert.throws(() => saveActivityPrefs(s, { table: "adulto", creditPct: 120 }, NOW), /crédito/);
    assert.throws(() => saveActivityPrefs(s, { table: "marte", creditPct: 100 }, NOW), /tabela/);
  });
  test("atividade de outro dia não conta", () => {
    const s = addActivity(base(), { ...forro, minutes: 60 }, "2026-10-05", "a", NOW);
    assert.equal(kcalBudget(s, NOW, KEY).credit, 0);
  });
});

describe("favoritas", () => {
  test("guarda com apelido, sem repetir a mesma, e remove com marcador", () => {
    let s = addFavorite(emptyState(), { code: "03025", table: "adulto", alias: "  Forró de sábado " }, "f1", NOW);
    s = addFavorite(s, { code: "03025", table: "adulto", alias: "Forró de sábado" }, "f2", NOW);
    assert.equal(activeFavorites(s).length, 1);
    assert.equal(activeFavorites(s)[0].alias, "Forró de sábado");
    s = removeFavorite(s, "f1", NOW);
    assert.equal(activeFavorites(s).length, 0);
    assert.equal(s.favActivities.length, 1);
  });
  test("a favorita aponta para a atividade oficial, então o MET não muda", () => {
    const some = data.adulto[0];
    const s = addFavorite(emptyState(), { code: some.code, table: "adulto", alias: "Meu treino" }, "f1", NOW);
    const [fav] = favoriteList(s, data);
    assert.equal(fav.met, findActivity(data, some.code, "adulto").met);
    assert.equal(fav.label, "Meu treino");
  });
  test("favorita cuja atividade não existe mais é ignorada", () => {
    const s = addFavorite(emptyState(), { code: "99999", table: "adulto" }, "f1", NOW);
    assert.deepEqual(favoriteList(s, data), []);
  });
});

describe("busca", () => {
  test("ignora acento e caixa; começa-com vem antes", () => {
    assert.equal(norm("Forró"), "forro");
    const r = searchActivities(data.adulto, "CAMINHADA");
    assert.ok(r.length);
    assert.ok(norm(r[0].pt).startsWith("caminhada") || r.every((a) => !norm(a.pt).startsWith("caminhada")));
  });
  test("forró não existe no Compendium, mas a busca leva às danças mais parecidas", () => {
    const codes = searchActivities(data.adulto, "forró").map((a) => a.code);
    assert.ok(codes.includes("03025") && codes.includes("03042"));
  });
  test("toda palavra-chave aponta para uma atividade que existe", () => {
    for (const code of Object.keys(SYNONYMS)) assert.ok(findActivity(data, code, "adulto"), code);
  });
  test("busca vazia devolve tudo", () => {
    assert.equal(searchActivities(data.adulto, "  ").length, data.adulto.length);
  });
});

describe("sincronização", () => {
  test("registros dos dois aparelhos se juntam e a remoção mais recente vale", () => {
    const base = addActivity(withKg(70), { ...forro, minutes: 60 }, KEY, "a", new Date(2026, 9, 6, 8));
    const a = { ...base, savedAt: "2026-10-06T08:00:00Z" };
    const b0 = addActivity(base, { ...forro, minutes: 30 }, KEY, "b", new Date(2026, 9, 6, 9));
    const b = { ...removeActivity(b0, KEY, "a", new Date(2026, 9, 6, 10)), savedAt: "2026-10-06T10:00:00Z" };
    assert.deepEqual(activityEntries(mergeStates(a, b), KEY).map((e) => e.id), ["b"]);
    assert.deepEqual(activityEntries(mergeStates(b, a), KEY).map((e) => e.id), ["b"]);
  });
  test("vale a preferência e as favoritas mais recentes; estado antigo continua válido", () => {
    const a = { ...saveActivityPrefs(emptyState(), { table: "adulto", creditPct: 100 }, new Date(2026, 9, 5)), savedAt: "2026-10-05T10:00:00Z" };
    const b = { ...saveActivityPrefs(emptyState(), { table: "cadeira", creditPct: 75 }, new Date(2026, 9, 6)), savedAt: "2026-10-06T10:00:00Z" };
    assert.equal(mergeStates(a, b).activityPrefs.table, "cadeira");
    assert.equal(mergeStates(b, a).activityPrefs.creditPct, 75);
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    const m = mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" });
    assert.deepEqual([m.activityLog, m.favActivities, m.activityPrefs], [{}, [], null]);
  });
});

describe("tela", () => {
  const bad = (html) => /undefined|NaN|\[object|Infinity/.test(html);
  const ctx = (extra = {}) => ({ query: "", selected: null, minutes: "", alias: "", error: null, ...extra });
  test("abre com a tabela carregada, com e sem busca, sem erro de renderização", () => {
    for (const query of ["", "forro", "xyzxyz"]) {
      const html = renderActivities(withKg(70), ctx({ query }), data, false, NOW, KEY);
      assert.equal(bad(html), false, query);
      assert.match(html, /Registrar atividade/);
    }
    assert.match(renderActivityResults(data.adulto, "forro"), /Dança cultural/);
    assert.match(renderActivityResults(data.adulto, "forro"), /salve como favorita/);
  });
  test("mostra o aviso de carregando enquanto a tabela não chegou", () => {
    assert.match(renderActivities(withKg(70), ctx(), null, true, NOW, KEY), /Carregando a tabela/);
  });
  test("com atividade escolhida, mostra duração e favorita; o cartão da home resume o dia", () => {
    const a = { ...data.adulto[0], label: data.adulto[0].pt };
    const html = renderActivities(withKg(70), ctx({ selected: a, minutes: "30" }), data, false, NOW, KEY);
    assert.match(html, /Duração/); assert.match(html, /Salvar como favorita/); assert.match(html, /≈ \d+ kcal/);
    const s = addActivity(withKg(70), { ...forro, minutes: 60 }, KEY, "a", NOW);
    assert.deepEqual(activityCard(s, KEY), { value: "60 min", label: "315 kcal gastas hoje" });
    assert.equal(bad(renderActivities(s, ctx(), data, false, NOW, KEY)), false);
  });
});