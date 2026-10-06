// Hidratação: meta diária e registro de líquidos. Funções puras, testadas em tests/hydration.test.js.
// A meta é uma ESTIMATIVA GERAL para adultos saudáveis. Não substitui orientação médica ou de nutricionista.

import { dayKey } from "./logic.js";
import { latestWeightKg } from "./nutrition.js";

// Regra prática de 30 a 35 ml por kg de peso para adultos. Usamos 35 ml/kg.
export const ML_PER_KG = 35;
export const WORKOUT_EXTRA_ML = 500; // dia com treino concluído no app
export const MIN_GOAL_ML = 1500;
export const MAX_GOAL_ML = 4000;
export const MANUAL_MIN_ML = 1000;
export const MANUAL_MAX_ML = 6000;
export const QUICK_ML = [200, 300, 500];
export const MAX_SINGLE_ML = 2000;

export const HYDRATION_DISCLAIMER =
  "A meta é uma estimativa geral para adultos saudáveis, de cerca de 35 ml por kg de peso. Ela muda com calor, exercício, gravidez, amamentação e várias condições de saúde. Quem tem problema nos rins ou no coração, ou usa remédio que afeta os líquidos, deve seguir a orientação médica. Beber demais também faz mal: respeite a sede.";

export const HYDRATION_SOURCE =
  "Referência: regra prática de 30 a 35 ml por kg de peso para adultos e valores de água total da EFSA (2,0 a 2,5 L por dia, contando a água dos alimentos). Aqui a meta conta só o que você bebe.";

const roundTo = (n, step) => Math.round(n / step) * step;

/** Texto de um volume: "2,5 L", "1,25 L" ou "600 ml". */
export function fmtVolume(ml) {
  const n = Math.max(0, Math.round(Number(ml) || 0));
  if (n < 1000) return `${n} ml`;
  return `${String(Math.round((n / 1000) * 100) / 100).replace(".", ",")} L`;
}

/**
 * Meta de hoje. Usa a meta digitada, se houver; senão, 35 ml por kg do último peso registrado, mais 500 ml em dia de treino.
 * A altura não entra: as referências de hidratação não a usam para definir quanto beber.
 */
export function waterGoal(state, now) {
  const manual = Number(state.hydration?.goalMl);
  if (Number.isFinite(manual) && manual >= MANUAL_MIN_ML && manual <= MANUAL_MAX_ML) {
    return { ok: true, ml: Math.round(manual), base: Math.round(manual), extra: 0, source: "manual" };
  }
  const kg = latestWeightKg(state);
  if (!Number.isFinite(kg) || kg < 30 || kg > 300) return { ok: false, reason: "sem-peso" };
  const base = Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, roundTo(kg * ML_PER_KG, 50)));
  const today = dayKey(now);
  const trained = (state.history ?? []).some((s) => dayKey(s.date) === today);
  const extra = trained ? WORKOUT_EXTRA_ML : 0;
  return { ok: true, ml: Math.min(MAX_GOAL_ML, base + extra), base, extra, source: "peso", weightKg: kg, trained };
}

export function saveHydration(state, { goalMl }, now) {
  const empty = goalMl === "" || goalMl === null || goalMl === undefined;
  const n = empty ? null : Number(String(goalMl).replace(",", "."));
  if (!empty && (!Number.isFinite(n) || n < MANUAL_MIN_ML || n > MANUAL_MAX_ML)) {
    throw new Error(`Digite a meta em ml, entre ${MANUAL_MIN_ML} e ${MANUAL_MAX_ML}.`);
  }
  return { ...state, hydration: { goalMl: empty ? null : Math.round(n), updatedAt: new Date(now).toISOString() } };
}

// ---------- Registro ----------

export function addWater(state, ml, key, id, now) {
  const n = Number(String(ml).replace(",", "."));
  if (!Number.isFinite(n) || n < 10 || n > MAX_SINGLE_ML) throw new Error(`Informe a quantidade em ml, de 10 a ${MAX_SINGLE_ML}.`);
  const entry = { id, ml: Math.round(n), at: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), deleted: false };
  return { ...state, waterLog: { ...(state.waterLog ?? {}), [key]: [...(state.waterLog?.[key] ?? []), entry] } };
}

/** Remove deixando um marcador, para a exclusão valer nos outros aparelhos. */
export function removeWater(state, key, id, now) {
  const day = (state.waterLog?.[key] ?? []).map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: new Date(now).toISOString() } : e));
  return { ...state, waterLog: { ...(state.waterLog ?? {}), [key]: day } };
}

export const waterEntries = (state, key) => (state.waterLog?.[key] ?? []).filter((e) => !e.deleted);
export const waterTotal = (state, key) => waterEntries(state, key).reduce((sum, e) => sum + e.ml, 0);

/** Situação do dia em relação à meta, em palavras. */
export function waterStatus(ml, goal) {
  if (!goal) return "sem-meta";
  const pct = ml / goal;
  return pct >= 1.3 ? "acima" : pct >= 1 ? "na-meta" : pct >= 0.5 ? "quase" : "falta";
}

/** Últimos `days` dias, do mais antigo ao de hoje. A porcentagem usa a meta base (sem o extra de treino). */
export function waterWeek(state, now, days = 7) {
  const goal = waterGoal(state, now);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = dayKey(d);
    const ml = waterTotal(state, key);
    return { key, ml, pct: goal.ok ? Math.min(150, Math.round((ml / goal.base) * 100)) : null, label: d.toLocaleDateString("pt-BR", { weekday: "narrow" }) };
  });
}
