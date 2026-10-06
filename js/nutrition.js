// Metas de nutrição e registro de alimentos. Funções puras, testadas em tests/nutrition.test.js.
// Tudo aqui é ESTIMATIVA GERAL para adultos saudáveis. Não substitui nutricionista nem orientação médica.

export const NUTRITION_DISCLAIMER =
  "As metas são estimativas gerais para adultos saudáveis e não substituem um nutricionista. Se você tem uma condição de saúde, está grávida ou amamentando, ou tem histórico de transtorno alimentar, siga a orientação de quem acompanha você.";

export const FOOD_SOURCE =
  "TACO, Tabela Brasileira de Composição de Alimentos, 4ª edição ampliada e revisada (NEPA/UNICAMP, 2011), pelo repositório github.com/brolesi/taco. Valores por 100 g de parte comestível.";

export const BRAND_SOURCE =
  "Marcas: Open Food Facts (openfoodfacts.org), base aberta sob licença ODbL, com dados enviados por usuários. Só entram produtos com valores consistentes, mas o sabor e o lote podem mudar os números: confira a sua embalagem.";

export const DRI_SOURCE =
  "Referências de vitaminas e minerais: Dietary Reference Intakes (NASEM/IOM), valores para adultos saudáveis. O sódio mostra o limite de 2.000 mg da OMS.";

// ---------- Nutrientes ----------

/** Todos os nutrientes do app, na ordem em que aparecem. `kind` separa macros de micros. */
export const NUTRIENTS = [
  { id: "energy_kcal", label: "Calorias", unit: "kcal", kind: "macro" },
  { id: "protein_g", label: "Proteínas", unit: "g", kind: "macro" },
  { id: "carbohydrate_g", label: "Carboidratos", unit: "g", kind: "macro" },
  { id: "lipids_g", label: "Gorduras", unit: "g", kind: "macro" },
  { id: "dietary_fiber_g", label: "Fibras", unit: "g", kind: "macro" },
  { id: "calcium_mg", label: "Cálcio", unit: "mg", kind: "micro" },
  { id: "iron_mg", label: "Ferro", unit: "mg", kind: "micro" },
  { id: "magnesium_mg", label: "Magnésio", unit: "mg", kind: "micro" },
  { id: "phosphorus_mg", label: "Fósforo", unit: "mg", kind: "micro" },
  { id: "potassium_mg", label: "Potássio", unit: "mg", kind: "micro" },
  { id: "zinc_mg", label: "Zinco", unit: "mg", kind: "micro" },
  { id: "copper_mg", label: "Cobre", unit: "mg", kind: "micro" },
  { id: "manganese_mg", label: "Manganês", unit: "mg", kind: "micro" },
  { id: "sodium_mg", label: "Sódio", unit: "mg", kind: "micro", limit: true },
  { id: "rae_mcg", label: "Vitamina A", unit: "mcg", kind: "micro" },
  { id: "vitamin_c_mg", label: "Vitamina C", unit: "mg", kind: "micro" },
  { id: "thiamine_mg", label: "Vitamina B1", unit: "mg", kind: "micro" },
  { id: "riboflavin_mg", label: "Vitamina B2", unit: "mg", kind: "micro" },
  { id: "niacin_mg", label: "Vitamina B3", unit: "mg", kind: "micro" },
  { id: "pyridoxine_mg", label: "Vitamina B6", unit: "mg", kind: "micro" },
];

export const MICRO_IDS = NUTRIENTS.filter((n) => n.kind === "micro").map((n) => n.id);
const CUSTOM_FIELDS = ["energy_kcal", "protein_g", "carbohydrate_g", "lipids_g", "dietary_fiber_g", "sodium_mg"];

// ---------- Perfil e metas ----------

export const ACTIVITY = {
  sedentario: { label: "Sedentário", desc: "Quase não se exercita fora o treino do app.", factor: 1.2 },
  leve: { label: "Pouco ativo", desc: "Exercício leve 1 a 3 dias por semana.", factor: 1.375 },
  moderado: { label: "Moderadamente ativo", desc: "Exercício 3 a 5 dias por semana.", factor: 1.55 },
  intenso: { label: "Muito ativo", desc: "Exercício intenso 6 a 7 dias por semana.", factor: 1.725 },
};

// Variação de peso por semana. O ajuste diário usa a regra geral de que 1 kg equivale a cerca de 7.700 kcal.
export const GOALS = {
  perder: { label: "Perder peso", kgPerWeek: -0.5 },
  perder_devagar: { label: "Perder peso devagar", kgPerWeek: -0.25 },
  manter: { label: "Manter o peso", kgPerWeek: 0 },
  ganhar_devagar: { label: "Ganhar massa devagar", kgPerWeek: 0.25 },
  ganhar: { label: "Ganhar massa", kgPerWeek: 0.5 },
};

// A fórmula de gasto de energia (Mifflin-St Jeor) tem um termo que depende de sexo. Não há diretriz validada para pessoas trans:
// a pessoa escolhe qual estimativa usar, ou digita a meta de calorias.
export const FORMULAS = {
  masculina: { label: "Estimativa masculina", term: 5, floor: 1500 },
  feminina: { label: "Estimativa feminina", term: -161, floor: 1200 },
  media: { label: "Média das duas", term: -78, floor: 1350 },
};

// Os valores de referência de vitaminas e minerais são definidos por sexo; por isso só há duas colunas.
export const MICRO_REFS = { masculina: "Referência masculina", feminina: "Referência feminina" };

export const MIN_AGE = 19;
export const MAX_AGE = 100;
const PROTEIN_PER_KG = { perder: 1.8, perder_devagar: 1.8, manter: 1.6, ganhar_devagar: 1.8, ganhar: 1.8 };

export const ageFrom = (birthYear, now) => new Date(now).getFullYear() - Number(birthYear);

/** Taxa metabólica basal pela equação de Mifflin-St Jeor, em kcal por dia. */
export function bmr({ formula, weightKg, heightCm, age }) {
  const f = FORMULAS[formula];
  if (!f) throw new Error("Escolha uma estimativa de energia.");
  return 10 * weightKg + 6.25 * heightCm - 5 * age + f.term;
}

/** Referências diárias de vitaminas e minerais (DRIs) para adultos. `ref` é "masculina" ou "feminina". */
export function microTargets(ref, age) {
  const m = ref === "masculina";
  const older = age > 50;
  return {
    calcium_mg: m ? (age > 70 ? 1200 : 1000) : (older ? 1200 : 1000),
    iron_mg: m ? 8 : (older ? 8 : 18),
    magnesium_mg: m ? (age <= 30 ? 400 : 420) : (age <= 30 ? 310 : 320),
    phosphorus_mg: 700,
    potassium_mg: m ? 3400 : 2600,
    zinc_mg: m ? 11 : 8,
    copper_mg: 0.9,
    manganese_mg: m ? 2.3 : 1.8,
    sodium_mg: 2000, // limite, não meta
    rae_mcg: m ? 900 : 700,
    vitamin_c_mg: m ? 90 : 75,
    thiamine_mg: m ? 1.2 : 1.1,
    riboflavin_mg: m ? 1.3 : 1.1,
    niacin_mg: m ? 16 : 14,
    pyridoxine_mg: older ? (m ? 1.7 : 1.5) : 1.3,
  };
}

const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * Metas diárias. Devolve { ok, errors, warnings, ... }. Com `ok` falso não há metas.
 * `profile`: { heightCm, birthYear, activity, goal, formula, microRef, kcalManual }.
 */
export function dailyTargets(profile, weightKg, now) {
  const errors = [];
  const warnings = [];
  const p = profile ?? {};
  const age = ageFrom(p.birthYear, now);
  const height = Number(p.heightCm);

  if (!Number.isFinite(height) || height < 120 || height > 230) errors.push("Informe a altura em centímetros, entre 120 e 230.");
  if (!Number.isInteger(Number(p.birthYear)) || age < MIN_AGE || age > MAX_AGE) errors.push(`As referências do app são para adultos de ${MIN_AGE} a ${MAX_AGE} anos. Confira o ano de nascimento.`);
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) errors.push("Registre o seu peso na tela Peso para calcular as metas.");
  if (!ACTIVITY[p.activity]) errors.push("Escolha o seu nível de atividade.");
  if (!GOALS[p.goal]) errors.push("Escolha o seu objetivo.");
  if (!FORMULAS[p.formula]) errors.push("Escolha uma estimativa de energia.");
  if (!MICRO_REFS[p.microRef]) errors.push("Escolha a referência de vitaminas e minerais.");
  const manual = p.kcalManual === null || p.kcalManual === undefined || p.kcalManual === "" ? null : Number(p.kcalManual);
  if (manual !== null && (!Number.isFinite(manual) || manual < 800 || manual > 6000)) errors.push("A meta de calorias digitada precisa estar entre 800 e 6.000.");
  if (errors.length) return { ok: false, errors, warnings };

  const floor = FORMULAS[p.formula].floor;
  const basal = bmr({ formula: p.formula, weightKg, heightCm: height, age });
  const tdee = basal * ACTIVITY[p.activity].factor;

  // Perda de peso: no máximo 1% do peso por semana.
  let kgPerWeek = GOALS[p.goal].kgPerWeek;
  if (kgPerWeek < 0 && -kgPerWeek > weightKg * 0.01) {
    kgPerWeek = -weightKg * 0.01;
    warnings.push("O ritmo de perda foi reduzido para no máximo 1% do seu peso por semana.");
  }

  let kcal;
  let source = "formula";
  if (manual !== null) {
    kcal = Math.round(manual);
    source = "manual";
    if (kcal < floor) warnings.push(`A meta digitada está abaixo de ${floor} kcal, o piso de segurança desta estimativa. Converse com o seu nutricionista antes de seguir.`);
  } else {
    const wanted = tdee + (kgPerWeek * 7700) / 7;
    kcal = roundTo(Math.max(wanted, floor), 10);
    if (wanted < floor) warnings.push(`A meta ficou no piso de segurança de ${floor} kcal. Para perder peso com menos calorias do que isso, é preciso acompanhamento profissional.`);
  }

  const protein_g = Math.round(weightKg * PROTEIN_PER_KG[p.goal]);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carb_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const fiber_g = Math.round((kcal / 1000) * 14);

  return {
    ok: true, errors, warnings, age, source, bmr: Math.round(basal), tdee: Math.round(tdee), kgPerWeek, floor,
    targets: { energy_kcal: kcal, protein_g, carbohydrate_g: carb_g, lipids_g: fat_g, dietary_fiber_g: fiber_g, ...microTargets(p.microRef, age) },
  };
}

// ---------- Busca de alimentos ----------

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Alimentos cujo nome tem todas as palavras da busca. Os que começam pela busca vêm primeiro; depois, os nomes mais curtos. */
export function searchFoods(foods, query, limit = 30) {
  const tokens = norm(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const q = tokens.join(" ");
  return foods
    .map((f) => ({ f, n: f.norm ?? (f.norm = norm(f.name)) }))
    .filter(({ n }) => tokens.every((t) => n.includes(t)))
    .sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || a.n.length - b.n.length || a.n.localeCompare(b.n))
    .slice(0, limit)
    .map(({ f }) => f);
}

/** Produtos de marca (assets/marcas.json). A unidade é "g" ou "ml", conforme o rótulo. */
export function parseMarcas(data) {
  return data.items.map((i) => ({ id: `marca:${i.code}`, name: i.name, category: `Marcas · ${i.brand}`, brand: i.brand, per100: { ...i.per100 }, unit: i.unit === "ml" ? "ml" : "g", source: "marca" }));
}

export const unitOf = (x) => (x?.unit === "ml" || x?.u === "ml" ? "ml" : "g");

/** Transforma o arquivo compacto da TACO (assets/taco.json) em uma lista de alimentos. */
export function parseTaco(data) {
  return data.rows.map((row) => {
    const per100 = {};
    data.fields.forEach((field, i) => { if (row[3 + i] !== null) per100[field] = Math.max(0, row[3 + i]); }); // a fonte tem alguns valores negativos por arredondamento
    return { id: `taco:${row[0]}`, name: row[1], category: data.categories[row[2]], per100, source: "taco" };
  });
}

// ---------- Alimentos próprios ----------

export function saveCustomFood(state, data, id, now) {
  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("Escreva o nome do alimento.");
  const per100 = {};
  for (const field of CUSTOM_FIELDS) {
    const raw = data[field];
    if (raw === "" || raw === null || raw === undefined) continue;
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 10000) throw new Error("Os valores de nutrientes precisam ser números positivos.");
    per100[field] = n;
  }
  if (per100.energy_kcal === undefined) {
    const { protein_g: p, carbohydrate_g: c, lipids_g: f } = per100;
    if (p === undefined && c === undefined && f === undefined) throw new Error("Informe pelo menos as calorias ou os macronutrientes.");
    per100.energy_kcal = Math.round(((p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9) * 10) / 10;
  }
  const food = { id, name: name.slice(0, 80), per100, updatedAt: new Date(now).toISOString(), deleted: false };
  if (data.unit === "ml") food.unit = "ml"; // cópia de um produto líquido
  return { ...state, customFoods: [...(state.customFoods ?? []).filter((x) => x.id !== id), food] };
}

export function removeCustomFood(state, id, now) {
  return { ...state, customFoods: (state.customFoods ?? []).map((f) => (f.id === id ? { ...f, deleted: true, updatedAt: new Date(now).toISOString() } : f)) };
}

export const activeCustomFoods = (state) =>
  (state.customFoods ?? []).filter((f) => !f.deleted).map((f) => ({ id: `custom:${f.id}`, name: f.name, category: "Meus alimentos", per100: f.per100, unit: f.unit === "ml" ? "ml" : "g", source: "custom" }));

// ---------- Registro do dia ----------

export const MAX_GRAMS = 5000;

/** Valor por 100 g com a energia completada pelos macros quando faltar. */
export function completePer100(per100) {
  const n = { ...per100 };
  if (n.energy_kcal === undefined && (n.protein_g !== undefined || n.carbohydrate_g !== undefined || n.lipids_g !== undefined)) {
    n.energy_kcal = Math.round(((n.protein_g ?? 0) * 4 + (n.carbohydrate_g ?? 0) * 4 + (n.lipids_g ?? 0) * 9) * 10) / 10;
  }
  return n;
}

/** Registra um alimento no dia. Guarda uma cópia dos nutrientes, para o histórico não mudar se o alimento for editado. */
export function addFoodEntry(state, { mealId = null, name, per100, g, unit = "g" }, dayKey, id, now) {
  const grams = Number(String(g).replace(",", "."));
  if (!Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) throw new Error(`Informe a quantidade em gramas (ou ml), de 1 a ${MAX_GRAMS}.`);
  const label = String(name ?? "").trim();
  if (!label) throw new Error("Escolha um alimento.");
  const entry = { id, mealId, name: label.slice(0, 80), g: Math.round(grams * 10) / 10, n: completePer100(per100 ?? {}), updatedAt: new Date(now).toISOString(), deleted: false };
  if (unit === "ml") entry.u = "ml"; // produto líquido: a quantidade é em ml, e o rótulo vale por 100 ml
  return { ...state, foodLog: { ...(state.foodLog ?? {}), [dayKey]: [...(state.foodLog?.[dayKey] ?? []), entry] } };
}

export function removeFoodEntry(state, dayKey, id, now) {
  const day = (state.foodLog?.[dayKey] ?? []).map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: new Date(now).toISOString() } : e));
  return { ...state, foodLog: { ...(state.foodLog ?? {}), [dayKey]: day } };
}

export const entriesOf = (state, dayKey) => (state.foodLog?.[dayKey] ?? []).filter((e) => !e.deleted);

/** Nutrientes de uma porção: `g` gramas de um alimento com valores por 100 g. Nutriente sem dado fica de fora. */
export function portionOf(per100, g) {
  const out = {};
  for (const [k, v] of Object.entries(completePer100(per100))) if (typeof v === "number") out[k] = (v * g) / 100;
  return out;
}

/**
 * Totais do dia. `missing[campo]` conta os alimentos registrados SEM dado daquele nutriente: nesse caso o total fica
 * incompleto (a TACO não mediu), o que é diferente de o alimento ter zero.
 */
export function dayTotals(state, dayKey) {
  const totals = {};
  const missing = {};
  const entries = entriesOf(state, dayKey);
  for (const n of NUTRIENTS) { totals[n.id] = 0; missing[n.id] = 0; }
  for (const e of entries) {
    for (const n of NUTRIENTS) {
      const v = e.n?.[n.id];
      if (typeof v === "number") totals[n.id] += (v * e.g) / 100;
      else missing[n.id]++;
    }
  }
  return { totals, missing, count: entries.length };
}

/** Calorias de um conjunto de itens, arredondadas. */
export const mealKcal = (entries) => Math.round(entries.reduce((sum, e) => sum + ((e.n?.energy_kcal ?? 0) * e.g) / 100, 0));

/** Itens do dia agrupados por refeição, na ordem da dieta, com a soma de calorias de cada uma. Itens sem refeição vêm por último. */
export function entriesByMeal(state, dayKey, meals) {
  const entries = entriesOf(state, dayKey);
  const known = new Set(meals.map((m) => m.id));
  const groups = meals.map((m) => ({ mealId: m.id, name: m.name, entries: entries.filter((e) => e.mealId === m.id) }));
  groups.push({ mealId: null, name: "Sem refeição", entries: entries.filter((e) => !e.mealId || !known.has(e.mealId)) });
  return groups.filter((g) => g.entries.length).map((g) => ({ ...g, kcal: mealKcal(g.entries) }));
}

/**
 * Orçamento de calorias do dia: a meta calculada, o que já foi registrado e quanto resta.
 * `ok` falso quando ainda não há metas (sem perfil, ou perfil incompleto).
 */
export function kcalBudget(state, now, dayKey) {
  if (!state.nutrition) return { ok: false, reason: "sem-perfil" };
  const result = dailyTargets(state.nutrition, latestWeightKg(state), now);
  if (!result.ok) return { ok: false, reason: "incompleto", errors: result.errors };
  const target = result.targets.energy_kcal;
  const eaten = Math.round(dayTotals(state, dayKey).totals.energy_kcal);
  const remaining = target - eaten;
  return {
    ok: true, target, eaten, remaining, over: remaining < 0, pct: Math.min(100, Math.round((eaten / target) * 100)),
    status: intakeStatus(eaten, target), hide: state.nutrition.hideNumbers === true, goal: state.nutrition.goal, warnings: result.warnings,
  };
}

/** Situação de um nutriente em relação à meta, sem números: usada por quem escolhe esconder os valores. */
export function intakeStatus(value, target, { limit = false } = {}) {
  if (!target) return "sem-meta";
  const pct = value / target;
  if (limit) return pct > 1 ? "acima" : pct >= 0.8 ? "perto" : "dentro";
  return pct < 0.5 ? "abaixo" : pct < 0.9 ? "quase" : pct <= 1.15 ? "na-meta" : "acima";
}

// ---------- Perfil de nutrição no estado ----------

export function saveNutrition(state, profile, now) {
  const clean = {
    heightCm: Number(profile.heightCm), birthYear: Number(profile.birthYear), activity: profile.activity, goal: profile.goal,
    formula: profile.formula, microRef: profile.microRef,
    kcalManual: profile.kcalManual === "" || profile.kcalManual === null || profile.kcalManual === undefined ? null : Number(profile.kcalManual),
    hideNumbers: profile.hideNumbers === true,
    updatedAt: new Date(now).toISOString(),
  };
  return { ...state, nutrition: clean };
}

export const latestWeightKg = (state) => (state.weights ?? []).at(-1)?.kg ?? null;
