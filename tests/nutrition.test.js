import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  NUTRIENTS, MICRO_IDS, ACTIVITY, GOALS, FORMULAS, bmr, ageFrom, microTargets, dailyTargets, searchFoods, parseTaco,
  saveCustomFood, removeCustomFood, activeCustomFoods, completePer100, addFoodEntry, removeFoodEntry, entriesOf, portionOf,
  dayTotals, intakeStatus, saveNutrition, latestWeightKg, NUTRITION_DISCLAIMER, FOOD_SOURCE,
  parseMarcas, unitOf, mealKcal, entriesByMeal, kcalBudget, BRAND_SOURCE,
} from "../js/nutrition.js";
import { emptyState, mergeStates } from "../js/logic.js";

const NOW = new Date(2026, 9, 6, 10, 0);
const KEY = "2026-10-06";
const base = { heightCm: 175, birthYear: 1996, activity: "moderado", goal: "manter", formula: "masculina", microRef: "masculina" };

describe("energia basal", () => {
  test("Mifflin-St Jeor para 70 kg, 175 cm e 30 anos, nas três estimativas", () => {
    const p = { weightKg: 70, heightCm: 175, age: 30 };
    assert.equal(bmr({ ...p, formula: "masculina" }), 1648.75);
    assert.equal(bmr({ ...p, formula: "feminina" }), 1482.75);
    assert.equal(bmr({ ...p, formula: "media" }), 1565.75);
  });
  test("a média fica entre as duas, e a diferença entre masculina e feminina é de 166 kcal", () => {
    const p = { weightKg: 80, heightCm: 180, age: 40 };
    assert.equal(bmr({ ...p, formula: "masculina" }) - bmr({ ...p, formula: "feminina" }), 166);
    assert.ok(bmr({ ...p, formula: "media" }) < bmr({ ...p, formula: "masculina" }));
    assert.ok(bmr({ ...p, formula: "media" }) > bmr({ ...p, formula: "feminina" }));
  });
  test("fórmula desconhecida é recusada", () => {
    assert.throws(() => bmr({ formula: "x", weightKg: 70, heightCm: 175, age: 30 }), /estimativa/);
  });
  test("ageFrom usa o ano", () => assert.equal(ageFrom(1996, NOW), 30));
});

describe("metas diárias", () => {
  test("manter o peso: gasto total, macros e fibra", () => {
    const r = dailyTargets(base, 70, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.tdee, 2556); // 1648,75 x 1,55
    assert.equal(r.targets.energy_kcal, 2560);
    assert.equal(r.targets.protein_g, 112); // 1,6 g/kg
    assert.equal(r.targets.lipids_g, 71); // 25% das calorias
    assert.equal(r.targets.carbohydrate_g, 368); // o resto
    assert.equal(r.targets.dietary_fiber_g, 36); // 14 g por 1.000 kcal
  });
  test("as calorias dos macros fecham com a meta, com folga de arredondamento", () => {
    for (const goal of Object.keys(GOALS)) for (const formula of Object.keys(FORMULAS)) {
      const t = dailyTargets({ ...base, goal, formula }, 72, NOW).targets;
      const sum = t.protein_g * 4 + t.carbohydrate_g * 4 + t.lipids_g * 9;
      assert.ok(Math.abs(sum - t.energy_kcal) <= 12, `${goal}/${formula}: ${sum} vs ${t.energy_kcal}`);
    }
  });
  test("perder 0,5 kg por semana tira cerca de 550 kcal; ganhar soma o mesmo", () => {
    assert.equal(dailyTargets({ ...base, goal: "perder" }, 70, NOW).targets.energy_kcal, 2010);
    assert.equal(dailyTargets({ ...base, goal: "ganhar" }, 70, NOW).targets.energy_kcal, 3110);
    assert.equal(dailyTargets({ ...base, goal: "perder_devagar" }, 70, NOW).targets.energy_kcal, 2280);
    assert.equal(dailyTargets({ ...base, goal: "ganhar_devagar" }, 70, NOW).targets.energy_kcal, 2830);
  });
  test("a perda semanal não passa de 1% do peso", () => {
    const r = dailyTargets({ ...base, formula: "feminina", activity: "moderado", goal: "perder" }, 40, NOW);
    assert.equal(r.kgPerWeek, -0.4);
    assert.ok(r.warnings.some((w) => /1% do seu peso/.test(w)));
    assert.equal(dailyTargets({ ...base, goal: "perder" }, 70, NOW).warnings.length, 0);
  });
  test("o piso de segurança segura a meta e avisa", () => {
    const r = dailyTargets({ heightCm: 150, birthYear: 1986, activity: "sedentario", goal: "perder", formula: "feminina", microRef: "feminina" }, 45, NOW);
    assert.equal(r.targets.energy_kcal, 1200);
    assert.ok(r.warnings.some((w) => /piso de segurança de 1200/.test(w)));
  });
  test("o piso muda com a estimativa", () => {
    assert.deepEqual(Object.values(FORMULAS).map((f) => f.floor), [1500, 1200, 1350]);
  });
  test("meta digitada vale no lugar da fórmula e avisa se for baixa demais", () => {
    const r = dailyTargets({ ...base, kcalManual: 2200 }, 70, NOW);
    assert.equal(r.targets.energy_kcal, 2200);
    assert.equal(r.source, "manual");
    assert.equal(r.warnings.length, 0);
    const low = dailyTargets({ ...base, kcalManual: 1000 }, 70, NOW);
    assert.equal(low.targets.energy_kcal, 1000);
    assert.ok(low.warnings.some((w) => /abaixo de 1500/.test(w)));
  });
  test("proteína por quilo sobe um pouco ao perder ou ganhar", () => {
    assert.equal(dailyTargets({ ...base, goal: "manter" }, 80, NOW).targets.protein_g, 128);
    assert.equal(dailyTargets({ ...base, goal: "perder" }, 80, NOW).targets.protein_g, 144);
    assert.equal(dailyTargets({ ...base, goal: "ganhar" }, 80, NOW).targets.protein_g, 144);
  });
  test("recusa dados fora da faixa, sem devolver metas", () => {
    const cases = [
      [{ ...base, heightCm: 100 }, 70, /altura/], [{ ...base, heightCm: "abc" }, 70, /altura/],
      [{ ...base, birthYear: 2010 }, 70, /19 a 100/], [{ ...base, birthYear: 1900 }, 70, /19 a 100/],
      [base, null, /Registre o seu peso/], [base, 20, /Registre o seu peso/],
      [{ ...base, activity: "x" }, 70, /atividade/], [{ ...base, goal: "x" }, 70, /objetivo/],
      [{ ...base, formula: "x" }, 70, /estimativa/], [{ ...base, microRef: "x" }, 70, /referência/],
      [{ ...base, kcalManual: 300 }, 70, /entre 800 e 6.000/],
    ];
    for (const [profile, weight, rx] of cases) {
      const r = dailyTargets(profile, weight, NOW);
      assert.equal(r.ok, false);
      assert.ok(r.errors.some((e) => rx.test(e)), String(rx));
      assert.equal(r.targets, undefined);
    }
  });
  test("perfil vazio ou nulo devolve erros, sem estourar", () => {
    assert.equal(dailyTargets(null, 70, NOW).ok, false);
    assert.equal(dailyTargets({}, 70, NOW).ok, false);
  });
  test("traz todos os micronutrientes e o limite de sódio", () => {
    const t = dailyTargets(base, 70, NOW).targets;
    for (const id of MICRO_IDS) assert.ok(t[id] > 0, id);
    assert.equal(t.sodium_mg, 2000);
  });
});

describe("referências de vitaminas e minerais", () => {
  test("ferro e zinco mudam com a referência e a idade", () => {
    assert.equal(microTargets("feminina", 30).iron_mg, 18);
    assert.equal(microTargets("feminina", 55).iron_mg, 8);
    assert.equal(microTargets("masculina", 30).iron_mg, 8);
    assert.equal(microTargets("masculina", 30).zinc_mg, 11);
    assert.equal(microTargets("feminina", 30).zinc_mg, 8);
  });
  test("cálcio, magnésio e B6 por faixa de idade", () => {
    assert.equal(microTargets("feminina", 55).calcium_mg, 1200);
    assert.equal(microTargets("feminina", 30).calcium_mg, 1000);
    assert.equal(microTargets("masculina", 60).calcium_mg, 1000);
    assert.equal(microTargets("masculina", 75).calcium_mg, 1200);
    assert.equal(microTargets("masculina", 30).magnesium_mg, 400);
    assert.equal(microTargets("masculina", 31).magnesium_mg, 420);
    assert.equal(microTargets("feminina", 30).magnesium_mg, 310);
    assert.equal(microTargets("feminina", 31).magnesium_mg, 320);
    assert.equal(microTargets("masculina", 30).pyridoxine_mg, 1.3);
    assert.equal(microTargets("masculina", 55).pyridoxine_mg, 1.7);
    assert.equal(microTargets("feminina", 55).pyridoxine_mg, 1.5);
  });
});

describe("busca de alimentos", () => {
  const foods = [
    { name: "Pão de arroz" }, { name: "Arroz, integral, cozido" }, { name: "Arroz, tipo 1, cozido" },
    { name: "Feijão, carioca, cozido" }, { name: "Maçã, Fuji, com casca, crua" }, { name: "Tapioca, goma" },
  ];
  test("ignora acento e maiúscula", () => {
    assert.deepEqual(searchFoods(foods, "FEIJAO").map((f) => f.name), ["Feijão, carioca, cozido"]);
    assert.deepEqual(searchFoods(foods, "maca").map((f) => f.name), ["Maçã, Fuji, com casca, crua"]);
  });
  test("exige todas as palavras", () => {
    assert.deepEqual(searchFoods(foods, "arroz integral").map((f) => f.name), ["Arroz, integral, cozido"]);
    assert.deepEqual(searchFoods(foods, "arroz banana"), []);
  });
  test("quem começa pela busca vem primeiro, depois os nomes mais curtos", () => {
    const names = searchFoods(foods, "arroz").map((f) => f.name);
    assert.equal(names[0], "Arroz, tipo 1, cozido"); // os dois começam por "arroz": vale o nome mais curto
    assert.equal(names.at(-1), "Pão de arroz");
    assert.equal(names.length, 3);
  });
  test("busca vazia ou só com símbolos não devolve nada, e o limite vale", () => {
    assert.deepEqual(searchFoods(foods, ""), []);
    assert.deepEqual(searchFoods(foods, "  ,, "), []);
    assert.equal(searchFoods(foods, "a", 2).length, 2);
  });
});

describe("registro de alimentos", () => {
  const arroz = { energy_kcal: 120, protein_g: 2.5, carbohydrate_g: 25, lipids_g: 1, calcium_mg: 5 };

  test("os nutrientes são proporcionais à quantidade", () => {
    const s = addFoodEntry(emptyState(), { name: "Arroz", per100: arroz, g: 150 }, KEY, "e1", NOW);
    const { totals } = dayTotals(s, KEY);
    assert.equal(totals.energy_kcal, 180);
    assert.equal(totals.protein_g, 3.75);
    assert.equal(totals.calcium_mg, 7.5);
  });
  test("soma vários alimentos e conta os que não têm dado de um nutriente", () => {
    let s = addFoodEntry(emptyState(), { name: "Arroz", per100: arroz, g: 100 }, KEY, "e1", NOW);
    s = addFoodEntry(s, { name: "Pão", per100: { energy_kcal: 250, protein_g: 8 }, g: 50 }, KEY, "e2", NOW);
    const { totals, missing, count } = dayTotals(s, KEY);
    assert.equal(count, 2);
    assert.equal(totals.energy_kcal, 245);
    assert.equal(totals.calcium_mg, 5); // só o arroz tem dado
    assert.equal(missing.calcium_mg, 1); // o pão não foi medido: total incompleto, não zero
    assert.equal(missing.energy_kcal, 0);
  });
  test("completa as calorias pelos macros quando faltam", () => {
    assert.equal(completePer100({ protein_g: 10, carbohydrate_g: 20, lipids_g: 5 }).energy_kcal, 165);
    assert.equal(completePer100({ energy_kcal: 99, protein_g: 10 }).energy_kcal, 99);
    assert.equal(completePer100({ calcium_mg: 5 }).energy_kcal, undefined);
  });
  test("guarda uma cópia dos nutrientes, sem mudar o alimento original", () => {
    const original = { ...arroz };
    const s = addFoodEntry(emptyState(), { name: "Arroz", per100: original, g: 100 }, KEY, "e1", NOW);
    original.energy_kcal = 999;
    assert.equal(entriesOf(s, KEY)[0].n.energy_kcal, 120);
  });
  test("valida a quantidade e o nome", () => {
    for (const g of [0, -5, "abc", "", null, 5001]) assert.throws(() => addFoodEntry(emptyState(), { name: "A", per100: arroz, g }, KEY, "e", NOW), /gramas/, String(g));
    assert.throws(() => addFoodEntry(emptyState(), { name: "  ", per100: arroz, g: 100 }, KEY, "e", NOW), /alimento/);
    assert.equal(entriesOf(addFoodEntry(emptyState(), { name: "A", per100: arroz, g: "150,5" }, KEY, "e", NOW), KEY)[0].g, 150.5);
  });
  test("remover deixa um marcador e o item sai dos totais", () => {
    let s = addFoodEntry(emptyState(), { name: "Arroz", per100: arroz, g: 100 }, KEY, "e1", NOW);
    s = removeFoodEntry(s, KEY, "e1", new Date(2026, 9, 6, 11));
    assert.equal(entriesOf(s, KEY).length, 0);
    assert.equal(s.foodLog[KEY].length, 1);
    assert.equal(dayTotals(s, KEY).totals.energy_kcal, 0);
  });
  test("dia sem registro tem totais zerados", () => {
    const r = dayTotals(emptyState(), KEY);
    assert.deepEqual([r.count, r.totals.energy_kcal, r.missing.energy_kcal], [0, 0, 0]);
  });
  test("o registro pode estar ligado a uma refeição da dieta", () => {
    const s = addFoodEntry(emptyState(), { mealId: "m1", name: "Arroz", per100: arroz, g: 100 }, KEY, "e1", NOW);
    assert.equal(entriesOf(s, KEY)[0].mealId, "m1");
    assert.equal(entriesOf(addFoodEntry(emptyState(), { name: "A", per100: arroz, g: 100 }, KEY, "e", NOW), KEY)[0].mealId, null);
  });
  test("portionOf deixa de fora o que não tem dado", () => {
    assert.deepEqual(portionOf({ energy_kcal: 100, calcium_mg: 10 }, 50), { energy_kcal: 50, calcium_mg: 5 });
  });
});

describe("alimentos próprios", () => {
  test("cadastra com vírgula decimal e completa as calorias pelos macros", () => {
    const s = saveCustomFood(emptyState(), { name: "  Barra de cereal ", protein_g: "5,5", carbohydrate_g: "20", lipids_g: "6" }, "c1", NOW);
    const [f] = activeCustomFoods(s);
    assert.equal(f.name, "Barra de cereal");
    assert.equal(f.id, "custom:c1");
    assert.equal(f.per100.protein_g, 5.5);
    assert.equal(f.per100.energy_kcal, 156); // 22 + 80 + 54
  });
  test("exige nome e algum dado, e recusa valor inválido", () => {
    assert.throws(() => saveCustomFood(emptyState(), { name: " ", energy_kcal: 100 }, "c", NOW), /nome/);
    assert.throws(() => saveCustomFood(emptyState(), { name: "X" }, "c", NOW), /calorias ou os macronutrientes/);
    assert.throws(() => saveCustomFood(emptyState(), { name: "X", energy_kcal: "abc" }, "c", NOW), /números positivos/);
    assert.throws(() => saveCustomFood(emptyState(), { name: "X", energy_kcal: -1 }, "c", NOW), /números positivos/);
  });
  test("editar substitui sem duplicar, e remover deixa marcador", () => {
    let s = saveCustomFood(emptyState(), { name: "X", energy_kcal: 100 }, "c1", NOW);
    s = saveCustomFood(s, { name: "X novo", energy_kcal: 120 }, "c1", NOW);
    assert.equal(s.customFoods.length, 1);
    assert.equal(activeCustomFoods(s)[0].per100.energy_kcal, 120);
    s = removeCustomFood(s, "c1", NOW);
    assert.equal(activeCustomFoods(s).length, 0);
    assert.equal(s.customFoods.length, 1);
  });
});

describe("situação sem números", () => {
  test("nutrientes comuns", () => {
    assert.equal(intakeStatus(10, 100), "abaixo");
    assert.equal(intakeStatus(70, 100), "quase");
    assert.equal(intakeStatus(100, 100), "na-meta");
    assert.equal(intakeStatus(130, 100), "acima");
    assert.equal(intakeStatus(5, 0), "sem-meta");
  });
  test("limite, como o sódio", () => {
    assert.equal(intakeStatus(500, 2000, { limit: true }), "dentro");
    assert.equal(intakeStatus(1700, 2000, { limit: true }), "perto");
    assert.equal(intakeStatus(2500, 2000, { limit: true }), "acima");
  });
});

describe("perfil de nutrição e sincronização", () => {
  test("saveNutrition limpa os tipos e guarda a escolha de esconder números", () => {
    const s = saveNutrition(emptyState(), { ...base, heightCm: "175", birthYear: "1996", kcalManual: "", hideNumbers: true }, NOW);
    assert.deepEqual([s.nutrition.heightCm, s.nutrition.birthYear, s.nutrition.kcalManual, s.nutrition.hideNumbers], [175, 1996, null, true]);
    assert.equal(saveNutrition(emptyState(), { ...base, kcalManual: "2200" }, NOW).nutrition.kcalManual, 2200);
  });
  test("latestWeightKg lê o último peso", () => {
    assert.equal(latestWeightKg(emptyState()), null);
    assert.equal(latestWeightKg({ ...emptyState(), weights: [{ kg: 70 }, { kg: 68.5 }] }), 68.5);
  });
  test("o registro dos dois aparelhos se junta dia a dia, e a remoção mais recente vale", () => {
    const a0 = addFoodEntry(emptyState(), { name: "Arroz", per100: { energy_kcal: 100 }, g: 100 }, KEY, "e1", new Date(2026, 9, 6, 8));
    const a = { ...a0, savedAt: "2026-10-06T08:00:00Z" };
    const b0 = addFoodEntry(a0, { name: "Pão", per100: { energy_kcal: 200 }, g: 50 }, KEY, "e2", new Date(2026, 9, 6, 9));
    const b1 = removeFoodEntry(b0, KEY, "e1", new Date(2026, 9, 6, 10));
    const b = { ...b1, savedAt: "2026-10-06T10:00:00Z" };
    const merged = mergeStates(a, b);
    assert.deepEqual(entriesOf(merged, KEY).map((e) => e.id), ["e2"]);
    assert.deepEqual(entriesOf(mergeStates(b, a), KEY).map((e) => e.id), ["e2"]);
  });
  test("dias diferentes se somam, e alimentos próprios e metas também", () => {
    const a = { ...saveNutrition(addFoodEntry(emptyState(), { name: "A", per100: { energy_kcal: 1 }, g: 1 }, "2026-10-05", "e1", NOW), base, new Date(2026, 9, 5)), savedAt: "2026-10-05T10:00:00Z" };
    const b = { ...saveCustomFood(addFoodEntry(emptyState(), { name: "B", per100: { energy_kcal: 1 }, g: 1 }, "2026-10-06", "e2", NOW), { name: "X", energy_kcal: 9 }, "c1", NOW), savedAt: "2026-10-06T10:00:00Z" };
    const merged = mergeStates(a, b);
    assert.deepEqual(Object.keys(merged.foodLog).sort(), ["2026-10-05", "2026-10-06"]);
    assert.equal(merged.customFoods.length, 1);
    assert.equal(merged.nutrition.heightCm, 175);
  });
  test("vale o perfil de nutrição mais recente", () => {
    const a = { ...saveNutrition(emptyState(), { ...base, heightCm: 170 }, new Date(2026, 9, 5)), savedAt: "2026-10-05T10:00:00Z" };
    const b = { ...saveNutrition(emptyState(), { ...base, heightCm: 180 }, new Date(2026, 9, 6)), savedAt: "2026-10-06T10:00:00Z" };
    assert.equal(mergeStates(a, b).nutrition.heightCm, 180);
    assert.equal(mergeStates(b, a).nutrition.heightCm, 180);
  });
  test("estado antigo, sem os campos novos, continua válido", () => {
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    const m = mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" });
    assert.deepEqual([m.foodLog, m.customFoods, m.nutrition], [{}, [], null]);
  });
});

describe("dados da TACO embutidos (assets/taco.json)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const data = JSON.parse(readFileSync(join(root, "assets/taco.json"), "utf8"));
  const foods = parseTaco(data);

  test("tem os 597 alimentos, e toda linha tem um valor por campo", () => {
    assert.equal(data.rows.length, 597);
    for (const row of data.rows) assert.equal(row.length, 3 + data.fields.length, row[1]);
  });
  test("todo nutriente do app existe nos dados", () => {
    for (const n of NUTRIENTS) assert.ok(data.fields.includes(n.id), n.id);
  });
  test("cita a fonte, e o app também", () => {
    assert.match(data.source, /TACO/);
    assert.match(FOOD_SOURCE, /NEPA\/UNICAMP/);
    assert.match(NUTRITION_DISCLAIMER, /não substituem um nutricionista/);
  });
  test("parseTaco devolve alimentos com id, categoria e valores sem negativos", () => {
    assert.equal(foods.length, 597);
    assert.equal(new Set(foods.map((f) => f.id)).size, 597);
    for (const f of foods) {
      assert.match(f.id, /^taco:\d+$/);
      assert.ok(f.category, f.name);
      for (const v of Object.values(f.per100)) assert.ok(v >= 0, f.name);
    }
  });
  test("a leitura confere com um alimento conhecido", () => {
    const arroz = foods.find((f) => f.name === "Arroz, integral, cozido");
    assert.equal(arroz.per100.energy_kcal, 123.53);
    assert.equal(arroz.per100.protein_g, 2.59);
    assert.equal(arroz.per100.vitamin_c_mg, undefined); // não medido: fica de fora
  });
  test("as calorias batem com os macros em quase todos os alimentos", () => {
    let checked = 0;
    const off = [];
    for (const f of foods) {
      const { energy_kcal: k, protein_g: p, carbohydrate_g: c, lipids_g: l } = f.per100;
      if ([k, p, c, l].some((v) => v === undefined)) continue;
      checked++;
      if (Math.abs(k - (4 * p + 4 * c + 9 * l)) > 0.25 * k + 15) off.push(f.name);
    }
    assert.ok(checked > 550);
    assert.ok(off.length <= 5, off.join(", ")); // bebida alcoólica e fermento, por exemplo
  });
  test("a busca acha alimentos comuns e dá para somar uma refeição de verdade", () => {
    const arroz = searchFoods(foods, "arroz integral cozido")[0];
    const feijao = searchFoods(foods, "feijão carioca cozido")[0];
    assert.ok(arroz && feijao);
    let s = addFoodEntry(emptyState(), { name: arroz.name, per100: arroz.per100, g: 150 }, KEY, "e1", NOW);
    s = addFoodEntry(s, { name: feijao.name, per100: feijao.per100, g: 100 }, KEY, "e2", NOW);
    const { totals } = dayTotals(s, KEY);
    assert.ok(totals.energy_kcal > 200 && totals.energy_kcal < 400, String(totals.energy_kcal));
    assert.ok(totals.protein_g > 5 && totals.iron_mg > 0.5);
  });
});

describe("opções de tela", () => {
  test("os níveis de atividade têm fatores crescentes", () => {
    const f = Object.values(ACTIVITY).map((a) => a.factor);
    assert.deepEqual([...f].sort((a, b) => a - b), f);
  });
  test("o ganho e a perda de peso são simétricos", () => {
    assert.equal(GOALS.perder.kgPerWeek, -GOALS.ganhar.kgPerWeek);
    assert.equal(GOALS.manter.kgPerWeek, 0);
  });
});

describe("produtos de marca (assets/marcas.json)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const data = JSON.parse(readFileSync(join(root, "assets/marcas.json"), "utf8"));
  const marcas = parseMarcas(data);

  test("cita a Open Food Facts e a licença, e o app também", () => {
    assert.match(data.source, /Open Food Facts/);
    assert.equal(data.license, "ODbL 1.0");
    assert.match(BRAND_SOURCE, /Open Food Facts/);
    assert.match(BRAND_SOURCE, /confira a sua embalagem/);
  });
  test("tem as marcas pedidas: Ninho e as principais marcas de whey", () => {
    const text = marcas.map((m) => m.name).join(" | ");
    for (const brand of ["Ninho", "Molico", "Growth", "Max Titanium", "Dux", "Integralmédica", "Probiótica", "Black Skull"]) assert.match(text, new RegExp(brand), brand);
    assert.ok(searchFoods(marcas, "ninho").length >= 3);
    assert.ok(searchFoods(marcas, "whey").length >= 6);
  });
  test("ids únicos, com código de barras, e todo item tem os quatro macros", () => {
    assert.equal(new Set(marcas.map((m) => m.id)).size, marcas.length);
    for (const m of marcas) {
      assert.match(m.id, /^marca:\d{8,14}$/, m.name);
      for (const k of ["energy_kcal", "protein_g", "carbohydrate_g", "lipids_g"]) assert.equal(typeof m.per100[k], "number", `${m.name}: ${k}`);
    }
  });
  test("as calorias batem com os macros em todos os itens", () => {
    for (const m of marcas) {
      const { energy_kcal: k, protein_g: p, carbohydrate_g: c, lipids_g: l } = m.per100;
      assert.ok(Math.abs(k - (4 * p + 4 * c + 9 * l)) <= 0.12 * k + 10, `${m.name}: ${k} kcal vs ${4 * p + 4 * c + 9 * l}`);
    }
  });
  test("whey tem faixa de calorias e proteína coerente, e leite líquido vem em ml", () => {
    for (const m of marcas.filter((x) => /whey/i.test(x.name))) {
      assert.ok(m.per100.energy_kcal >= 350 && m.per100.energy_kcal <= 450, m.name);
      assert.ok(m.per100.protein_g >= 60, m.name);
    }
    const uht = marcas.filter((m) => /UHT/.test(m.name));
    assert.ok(uht.length >= 2);
    for (const m of uht) { assert.equal(m.unit, "ml", m.name); assert.ok(m.per100.energy_kcal < 100, m.name); }
    for (const m of marcas.filter((x) => x.unit === "g")) assert.ok(m.per100.energy_kcal > 100, m.name);
  });
  test("o leite em pó Ninho integral confere com um valor de rótulo conhecido", () => {
    const ninho = marcas.find((m) => /pó integral Ninho/.test(m.name));
    assert.ok(ninho.per100.energy_kcal > 480 && ninho.per100.energy_kcal < 520);
    assert.equal(ninho.source, "marca");
    assert.match(ninho.category, /Marcas/);
  });
  test("registrar um produto líquido guarda a unidade em ml", () => {
    const leite = marcas.find((m) => m.unit === "ml");
    let s = addFoodEntry(emptyState(), { name: leite.name, per100: leite.per100, g: 200, unit: unitOf(leite) }, KEY, "e1", NOW);
    assert.equal(entriesOf(s, KEY)[0].u, "ml");
    assert.ok(Math.abs(dayTotals(s, KEY).totals.energy_kcal - leite.per100.energy_kcal * 2) < 0.01);
    s = addFoodEntry(emptyState(), { name: "A", per100: { energy_kcal: 100 }, g: 100 }, KEY, "e2", NOW);
    assert.equal(entriesOf(s, KEY)[0].u, undefined);
    assert.equal(unitOf({ unit: "ml" }), "ml");
    assert.equal(unitOf({ u: "ml" }), "ml");
    assert.equal(unitOf({}), "g");
  });
  test("uma colher de whey de 30 g soma calorias e proteína de verdade", () => {
    const whey = marcas.find((m) => /Top Whey/.test(m.name));
    const s = addFoodEntry(emptyState(), { name: whey.name, per100: whey.per100, g: 30 }, KEY, "e1", NOW);
    const { totals } = dayTotals(s, KEY);
    assert.ok(totals.energy_kcal > 115 && totals.energy_kcal < 135, String(totals.energy_kcal));
    assert.ok(totals.protein_g > 22 && totals.protein_g < 25, String(totals.protein_g));
  });
});

describe("orçamento de calorias e soma por refeição", () => {
  const profile = { ...base, kcalManual: null };
  const withProfile = (extra = {}) => ({ ...saveNutrition({ ...emptyState(), weights: [{ kg: 70 }] }, profile, NOW), ...extra });
  const food = (g, kcal = 100) => ({ name: "Item", per100: { energy_kcal: kcal }, g });

  test("sem perfil, o orçamento avisa que falta calcular", () => {
    assert.deepEqual(kcalBudget(emptyState(), NOW, KEY), { ok: false, reason: "sem-perfil" });
  });
  test("perfil sem peso fica incompleto, com a lista do que falta", () => {
    const s = saveNutrition(emptyState(), profile, NOW);
    const b = kcalBudget(s, NOW, KEY);
    assert.equal(b.ok, false);
    assert.equal(b.reason, "incompleto");
    assert.ok(b.errors.some((e) => /peso/.test(e)));
  });
  test("a meta começa cheia e cada alimento registrado desconta dela", () => {
    let s = withProfile();
    assert.deepEqual([kcalBudget(s, NOW, KEY).target, kcalBudget(s, NOW, KEY).eaten, kcalBudget(s, NOW, KEY).remaining], [2560, 0, 2560]);
    s = addFoodEntry(s, { name: "Arroz", per100: { energy_kcal: 120 }, g: 150 }, KEY, "e1", NOW); // 180 kcal
    s = addFoodEntry(s, food(100, 250), KEY, "e2", NOW); // 250 kcal
    const b = kcalBudget(s, NOW, KEY);
    assert.deepEqual([b.eaten, b.remaining, b.over], [430, 2130, false]);
    assert.equal(b.pct, 17);
  });
  test("remover um alimento devolve as calorias ao orçamento", () => {
    let s = addFoodEntry(withProfile(), food(100, 500), KEY, "e1", NOW);
    assert.equal(kcalBudget(s, NOW, KEY).remaining, 2060);
    s = removeFoodEntry(s, KEY, "e1", NOW);
    assert.equal(kcalBudget(s, NOW, KEY).remaining, 2560);
  });
  test("passar da meta mostra o excesso e limita a barra em 100%", () => {
    const s = addFoodEntry(withProfile(), food(1000, 300), KEY, "e1", NOW); // 3.000 kcal
    const b = kcalBudget(s, NOW, KEY);
    assert.deepEqual([b.eaten, b.remaining, b.over, b.pct], [3000, -440, true, 100]);
  });
  test("para perder peso a meta é menor do que para manter, e o orçamento usa a meta do objetivo", () => {
    const lose = saveNutrition({ ...emptyState(), weights: [{ kg: 70 }] }, { ...profile, goal: "perder" }, NOW);
    const b = kcalBudget(lose, NOW, KEY);
    assert.equal(b.target, 2010);
    assert.equal(b.goal, "perder");
    assert.ok(b.target < kcalBudget(withProfile(), NOW, KEY).target);
  });
  test("meta digitada vale no orçamento, e esconder números é repassado", () => {
    const s = saveNutrition({ ...emptyState(), weights: [{ kg: 70 }] }, { ...profile, kcalManual: 1800, hideNumbers: true }, NOW);
    const b = kcalBudget(addFoodEntry(s, food(100, 400), KEY, "e1", NOW), NOW, KEY);
    assert.deepEqual([b.target, b.remaining, b.hide], [1800, 1400, true]);
  });
  test("o orçamento é por dia: o que foi registrado ontem não desconta de hoje", () => {
    const s = addFoodEntry(withProfile(), food(100, 800), "2026-10-05", "e1", NOW);
    assert.equal(kcalBudget(s, NOW, KEY).eaten, 0);
    assert.equal(kcalBudget(s, NOW, "2026-10-05").eaten, 800);
  });

  test("mealKcal soma as calorias dos itens de uma refeição", () => {
    let s = addFoodEntry(emptyState(), { mealId: "m1", name: "Arroz", per100: { energy_kcal: 120 }, g: 150 }, KEY, "e1", NOW);
    s = addFoodEntry(s, { mealId: "m1", name: "Feijão", per100: { energy_kcal: 76 }, g: 100 }, KEY, "e2", NOW);
    assert.equal(mealKcal(entriesOf(s, KEY)), 256);
    assert.equal(mealKcal([]), 0);
  });
  test("entriesByMeal agrupa na ordem da dieta, com a soma de cada refeição e os itens sem refeição por último", () => {
    const meals = [{ id: "m1", name: "Café da manhã" }, { id: "m2", name: "Almoço" }, { id: "m3", name: "Jantar" }];
    let s = addFoodEntry(emptyState(), { mealId: "m2", name: "Arroz", per100: { energy_kcal: 100 }, g: 200 }, KEY, "e1", NOW);
    s = addFoodEntry(s, { mealId: "m1", name: "Pão", per100: { energy_kcal: 250 }, g: 50 }, KEY, "e2", NOW);
    s = addFoodEntry(s, { name: "Fruta", per100: { energy_kcal: 60 }, g: 100 }, KEY, "e3", NOW);
    s = addFoodEntry(s, { mealId: "apagada", name: "Bolo", per100: { energy_kcal: 300 }, g: 50 }, KEY, "e4", NOW);
    const groups = entriesByMeal(s, KEY, meals);
    assert.deepEqual(groups.map((g) => [g.name, g.kcal]), [["Café da manhã", 125], ["Almoço", 200], ["Sem refeição", 210]]);
    assert.equal(groups.some((g) => g.name === "Jantar"), false); // refeição vazia não aparece
  });
  test("a soma das refeições fecha com o total do dia", () => {
    const meals = [{ id: "m1", name: "A" }, { id: "m2", name: "B" }];
    let s = addFoodEntry(emptyState(), { mealId: "m1", name: "X", per100: { energy_kcal: 123 }, g: 100 }, KEY, "e1", NOW);
    s = addFoodEntry(s, { mealId: "m2", name: "Y", per100: { energy_kcal: 211 }, g: 100 }, KEY, "e2", NOW);
    s = addFoodEntry(s, { name: "Z", per100: { energy_kcal: 66 }, g: 100 }, KEY, "e3", NOW);
    const sum = entriesByMeal(s, KEY, meals).reduce((acc, g) => acc + g.kcal, 0);
    assert.equal(sum, Math.round(dayTotals(s, KEY).totals.energy_kcal));
  });
});
describe("alimento próprio copiado de um produto líquido", () => {
  test("mantém a unidade ml; os demais ficam em g", () => {
    const ml = saveCustomFood(emptyState(), { name: "Meu leite", energy_kcal: 60, unit: "ml" }, "c1", NOW);
    assert.equal(activeCustomFoods(ml)[0].unit, "ml");
    const g = saveCustomFood(emptyState(), { name: "Minha barra", energy_kcal: 400 }, "c2", NOW);
    assert.equal(activeCustomFoods(g)[0].unit, "g");
    const tampered = saveCustomFood(emptyState(), { name: "X", energy_kcal: 1, unit: "litro" }, "c3", NOW);
    assert.equal(activeCustomFoods(tampered)[0].unit, "g");
  });
});