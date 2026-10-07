// Funções puras: sem DOM, sem localStorage direto. Tudo aqui é testado em tests/.
import { EXERCISES, WORKOUTS, MAX_DUMBBELL_KG, WEEKLY_GOAL } from "./data.js";

export const STATE_VERSION = 1;
export const STORAGE_KEY = "treino-casa:v1";

export function emptyState() {
  return { version: STATE_VERSION, history: [], levels: {}, draft: null, marks: [], weights: [],
    meds: [], medLog: {}, meals: [], dietLog: {}, profile: null, dietPlan: null,
    nutrition: null, foodLog: {}, customFoods: [], tour: null, waterLog: {}, hydration: null,
    activityLog: {}, favActivities: [], activityPrefs: null, checkins: {}, avatar: null };
}

// ---------- Datas ----------

export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // semana começa na segunda
  d.setDate(d.getDate() + diff);
  return d;
}

export function calendarDaysBetween(a, b) {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / 86_400_000);
}

export function sessionsThisWeek(history, now) {
  const start = startOfWeek(now).getTime();
  return history.filter((s) => new Date(s.date).getTime() >= start).length;
}

// ---------- Agenda ----------

export const DEFAULT_ROTATION = ["A", "B"];

/** Ordem dos treinos do perfil (onboarding). Sem perfil, o app alterna A e B. */
export function rotationFor(state) {
  const r = state.profile?.rotation;
  return Array.isArray(r) && r.length && r.every((k) => WORKOUTS[k]) ? r : DEFAULT_ROTATION;
}

/** Próximo treino da rotação, depois do último feito. Se o último não está na rotação, volta ao começo dela. */
export function nextWorkoutKey(history, rotation = DEFAULT_ROTATION) {
  if (!history.length) return rotation[0];
  const i = rotation.indexOf(history[history.length - 1].workout);
  return i === -1 ? rotation[0] : rotation[(i + 1) % rotation.length];
}

export function restWarning(history, now) {
  if (!history.length) return null;
  const days = calendarDaysBetween(history[history.length - 1].date, now);
  if (days <= 0) return "Você já treinou hoje. O músculo cresce no descanso, não no treino extra.";
  if (days === 1) return "Você treinou ontem. O ideal é um dia de folga entre treinos de braço e peito.";
  return null;
}

// ---------- Entrada de dados ----------

export function parseReps(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 200 ? n : null;
}

export function parseKg(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (n < 0 || n > 50) return null;
  return Math.round(n * 2) / 2; // arredonda para 0,5 kg
}

// ---------- Progressão ----------

export function levelFor(state, exId) {
  const ex = EXERCISES[exId];
  if (!ex?.levels) return 0;
  const lvl = state.levels?.[exId] ?? 0;
  return Math.min(Math.max(lvl, 0), ex.levels.length - 1);
}

export function imageFor(exId, level = 0) {
  const ex = EXERCISES[exId];
  if (!ex) throw new Error(`Exercício desconhecido: ${exId}`);
  return ex.levels ? ex.levels[level].img : ex.img;
}

export function displayName(exId, level = 0) {
  const ex = EXERCISES[exId];
  return ex.levels ? ex.levels[level].name : ex.name;
}

/**
 * Avalia as séries feitas e diz o que fazer na próxima vez.
 * sets: [{ reps: number|null, kg: number|null, done: boolean }]
 */
export function evaluateSets(exId, sets, level = 0) {
  const ex = EXERCISES[exId];
  if (!ex) throw new Error(`Exercício desconhecido: ${exId}`);
  const done = (sets || []).filter((s) => s.done && Number.isFinite(s.reps));

  if (done.length < ex.sets) {
    return { status: "incompleto", message: `Faltam ${ex.sets - done.length} série(s).` };
  }

  const reps = done.map((s) => s.reps);
  const allTop = reps.every((r) => r >= ex.repMax);
  const anyBelow = reps.some((r) => r < ex.repMin);

  if (allTop) {
    if (ex.levels && level < ex.levels.length - 1) {
      return { status: "progredir", nextLevel: level + 1, message: `Bateu o teto. Próximo nível: ${ex.levels[level + 1].name}.` };
    }
    if (ex.type === "dumbbell") {
      const kg = Math.min(...done.map((s) => s.kg ?? 0));
      if (kg < MAX_DUMBBELL_KG) {
        return { status: "progredir", message: "Bateu o teto. Suba o peso na próxima." };
      }
      return { status: "progredir", message: "No limite dos 4 kg. Próxima vez: desça em 4 a 5 segundos ou faça uma pausa de 2 s no meio." };
    }
    return { status: "progredir", message: "Bateu o teto. Próxima vez: desça em 4 a 5 segundos ou faça uma série a mais." };
  }

  if (anyBelow) {
    if (ex.levels && level > 0) {
      return { status: "ajustar", prevLevel: level - 1, message: `Abaixo do mínimo. Vale voltar para: ${ex.levels[level - 1].name}.` };
    }
    return { status: "ajustar", message: `Abaixo de ${ex.repMin}. Diminua o peso ou descanse um pouco mais entre séries.` };
  }

  return { status: "manter", message: "Dentro da faixa. Tente 1 repetição a mais por série." };
}

export function lastEntryFor(history, exId) {
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i].entries?.[exId];
    if (entry?.sets?.some((s) => s.done)) return { date: history[i].date, ...entry };
  }
  return null;
}

// ---------- Sessão ----------

export function newDraft(key, state, now) {
  const w = WORKOUTS[key];
  if (!w) throw new Error(`Treino desconhecido: ${key}`);
  const last = (id) => lastEntryFor(state.history, id);
  const entries = {};
  for (const id of w.exercises) {
    const prevKg = last(id)?.sets?.find((s) => s.done)?.kg ?? null;
    entries[id] = {
      level: levelFor(state, id),
      sets: Array.from({ length: EXERCISES[id].sets }, () => ({ reps: null, kg: prevKg, done: false })),
    };
  }
  return { workout: key, startedAt: new Date(now).toISOString(), cardio: false, entries };
}

export function draftProgress(draft) {
  const ids = Object.keys(draft.entries);
  const finished = ids.filter((id) => draft.entries[id].sets.every((s) => s.done)).length;
  return { finished, total: ids.length };
}

export function finishSession(state, draft, now) {
  const hasAnySet = Object.values(draft.entries).some((e) => e.sets.some((s) => s.done));
  if (!hasAnySet) throw new Error("Marque pelo menos uma série antes de concluir.");

  const levels = { ...state.levels };
  for (const [id, entry] of Object.entries(draft.entries)) {
    const verdict = evaluateSets(id, entry.sets, entry.level);
    if (verdict.nextLevel !== undefined) levels[id] = verdict.nextLevel;
  }
  const session = {
    workout: draft.workout,
    date: new Date(now).toISOString(),
    startedAt: draft.startedAt,
    cardio: draft.cardio === true,
    entries: draft.entries,
  };
  return { ...state, history: [...state.history, session], levels, draft: null };
}

// ---------- Hábito ----------

export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Dias treinados: sessões concluídas no app + marcações manuais (state.marks). */
export function trainedDays(state) {
  const days = new Set((state.marks ?? []).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)));
  for (const s of state.history) days.add(dayKey(s.date));
  return days;
}

/** Liga/desliga a marcação manual de um dia. Dia com sessão no app não pode ser desmarcado. */
export function toggleMark(state, key) {
  if (state.history.some((s) => dayKey(s.date) === key)) return state;
  const marks = state.marks ?? [];
  return { ...state, marks: marks.includes(key) ? marks.filter((k) => k !== key) : [...marks, key].sort() };
}

/** Treinos por semana (segunda a domingo) nas últimas `n` semanas, da mais antiga para a atual. */
export function weeklyCounts(state, now, n = 12) {
  const days = [...trainedDays(state)].map(parseDayKey);
  const thisWeek = startOfWeek(now);
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * (n - 1 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, count: days.filter((d) => d >= start && d < end).length };
  });
}

/** Semanas seguidas batendo a meta. A semana atual só quebra a sequência quando acabar. */
/** Meta de treinos por semana: a sugerida no onboarding, ou o padrão do app. */
export function weeklyGoal(state) {
  const n = state.profile?.perWeek;
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : WEEKLY_GOAL;
}

export function weekStreak(state, now, goal = weeklyGoal(state)) {
  const weeks = weeklyCounts(state, now, 104);
  let i = weeks.length - 1;
  if (weeks[i].count < goal) i--; // semana atual ainda em andamento
  let streak = 0;
  while (i >= 0 && weeks[i].count >= goal) { streak++; i--; }
  return streak;
}

// ---------- Peso ----------

/** Chave da semana (a segunda-feira dela). A pesagem é uma por semana. */
export function weekKey(date) {
  return dayKey(startOfWeek(date));
}

export function parseWeight(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(",", ".");
  if (!/^\d{2,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (n < 20 || n > 400) return null;
  return Math.round(n * 10) / 10;
}

/** Grava o peso da semana de `now`. Pesar de novo na mesma semana substitui o valor. */
export function setWeight(state, kg, now) {
  const week = weekKey(now);
  const entry = { week, date: dayKey(now), kg, at: new Date(now).toISOString() };
  const weights = [...(state.weights ?? []).filter((w) => w.week !== week), entry]
    .sort((a, b) => a.week.localeCompare(b.week));
  return { ...state, weights };
}

export function weightLoggedThisWeek(state, now) {
  const week = weekKey(now);
  return (state.weights ?? []).some((w) => w.week === week);
}

// ---------- Remédios ----------

export const SLOTS = ["Manhã", "Tarde", "Noite", "Ao deitar"];
export const UNITS = { day: "dia", week: "semana", month: "mês" };

const live = (list) => (list ?? []).filter((x) => !x.deleted);
export const activeMeds = (state) => live(state.meds);
export const activeMeals = (state) => live(state.meals);

function normalizeEvery(every) {
  const n = Number(every?.n);
  if (!Number.isInteger(n) || n < 1 || n > 365 || !UNITS[every?.unit]) throw new Error("Informe o intervalo, por exemplo 90 dias.");
  return { n, unit: every.unit };
}

/** Cria ou atualiza um remédio. `id` é novo no cadastro e existente na edição. */
export function saveMed(state, data, id, now) {
  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("Escreva o nome do remédio.");
  const kind = data.kind === "interval" ? "interval" : "daily";
  const times = kind === "daily" ? SLOTS.filter((s) => (data.times ?? []).includes(s)) : [];
  if (kind === "daily" && !times.length) throw new Error("Escolha pelo menos um horário.");
  const old = (state.meds ?? []).find((m) => m.id === id);
  const med = {
    id, name: name.slice(0, 80), dose: String(data.dose ?? "").trim().slice(0, 60), kind, times,
    every: kind === "interval" ? normalizeEvery(data.every) : null,
    createdAt: old?.createdAt ?? dayKey(now), updatedAt: new Date(now).toISOString(), deleted: false,
  };
  return { ...state, meds: [...(state.meds ?? []).filter((m) => m.id !== id), med] };
}

/** Apaga deixando um marcador, para a exclusão também valer nos outros aparelhos. */
export function removeMed(state, id, now) {
  return { ...state, meds: (state.meds ?? []).map((m) => m.id === id ? { ...m, deleted: true, updatedAt: new Date(now).toISOString() } : m) };
}

const doseKey = (medId, slot) => `${medId}|${slot}`;

/** Liga ou desliga uma dose. Remédio de intervalo usa o horário "dose". */
export function toggleDose(state, medId, slot, key) {
  const day = { ...(state.medLog?.[key] ?? {}) };
  day[doseKey(medId, slot)] = !day[doseKey(medId, slot)];
  return { ...state, medLog: { ...(state.medLog ?? {}), [key]: day } };
}

export function addInterval(date, { n, unit }) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + 7 * n);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last)); // 31/out + 1 mês = 30/nov, não 1/dez
  }
  return d;
}

/** Última dose, próxima dose e situação de um remédio de intervalo. */
export function intervalStatus(state, med, now) {
  const dates = Object.entries(state.medLog ?? {})
    .filter(([, day]) => day[doseKey(med.id, "dose")] === true).map(([k]) => k).sort();
  const last = dates[dates.length - 1] ?? null;
  if (!last) return { last: null, next: null, daysLeft: null, status: "primeira" };
  const next = addInterval(parseDayKey(last), med.every);
  const daysLeft = calendarDaysBetween(now, next);
  return { last, next: dayKey(next), daysLeft, status: daysLeft < 0 ? "atrasado" : daysLeft <= 7 ? "perto" : "ok" };
}

/** Datas em que uma dose de remédio de intervalo foi tomada, da mais recente para a mais antiga. */
export function doseHistory(state, medId) {
  return Object.entries(state.medLog ?? {})
    .filter(([, day]) => day[doseKey(medId, "dose")] === true).map(([k]) => k).sort().reverse();
}

/** Doses de hoje dos remédios diários. */
export function todayDoses(state, now) {
  const key = dayKey(now);
  const log = state.medLog?.[key] ?? {};
  return activeMeds(state).filter((m) => m.kind === "daily")
    .flatMap((m) => m.times.map((slot) => ({ med: m, slot, taken: log[doseKey(m.id, slot)] === true })));
}

/** Doses esperadas e tomadas em um dia (só remédios diários que já existiam naquele dia). */
export function medDay(state, key) {
  const log = state.medLog?.[key] ?? {};
  let expected = 0, taken = 0;
  for (const m of activeMeds(state)) {
    if (m.kind !== "daily" || m.createdAt > key) continue;
    for (const slot of m.times) { expected++; if (log[doseKey(m.id, slot)] === true) taken++; }
  }
  return { expected, taken };
}

function daysBack(now, n) {
  return Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - i); return dayKey(d); });
}

/** Adesão dos últimos `days` dias. Hoje só entra se já houver alguma marcação, porque o dia ainda não acabou. */
export function medAdherence(state, now, days) {
  const today = dayKey(now);
  let expected = 0, taken = 0;
  for (const key of daysBack(now, days)) {
    const d = medDay(state, key);
    if (key === today && d.taken === 0) continue;
    expected += d.expected; taken += d.taken;
  }
  return { expected, taken, pct: expected ? Math.round((100 * taken) / expected) : null };
}

// ---------- Dieta ----------

export const MEAL_STATUS = { ok: 1, parcial: 0.5, fora: 0 };

export function saveMeal(state, data, id, now) {
  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("Escreva o nome da refeição.");
  const old = (state.meals ?? []).find((m) => m.id === id);
  const meal = {
    id, name: name.slice(0, 60), text: String(data.text ?? "").trim().slice(0, 4000),
    order: old?.order ?? (state.meals ?? []).length,
    createdAt: old?.createdAt ?? dayKey(now), updatedAt: new Date(now).toISOString(), deleted: false,
  };
  return { ...state, meals: [...(state.meals ?? []).filter((m) => m.id !== id), meal] };
}

/** Plano alimentar anexado (PDF guardado na conta). Só os dados do arquivo ficam no estado; o PDF fica no armazenamento. */
export function setDietPlan(state, { name, size, path }, now) {
  const cleanName = String(name ?? "plano.pdf").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) || "plano.pdf";
  return { ...state, dietPlan: { name: cleanName, size: Number(size) || 0, path: path ?? null, at: new Date(now).toISOString() } };
}

/** Remove o anexo deixando um marcador, para a remoção também valer nos outros aparelhos. */
export function clearDietPlan(state, now) {
  return { ...state, dietPlan: { removed: true, at: new Date(now).toISOString() } };
}

export const activeDietPlan = (state) => (state.dietPlan && !state.dietPlan.removed && state.dietPlan.path ? state.dietPlan : null);

/** Importa refeições de uma lista [{ name, text }]. Nomes que já existem são ignorados, então importar de novo não duplica. */
export function importMeals(state, list, now, makeId) {
  if (!Array.isArray(list) || !list.length) throw new Error("O arquivo precisa ser uma lista de refeições.");
  let next = state;
  const have = new Set(activeMeals(state).map((m) => m.name.toLowerCase()));
  let added = 0;
  for (const item of list) {
    const name = String(item?.name ?? "").trim();
    if (!name) throw new Error("Toda refeição precisa ter um nome.");
    if (have.has(name.toLowerCase())) continue;
    next = saveMeal(next, { name, text: item.text }, makeId(), now);
    have.add(name.toLowerCase());
    added++;
  }
  return { state: next, added };
}

export function removeMeal(state, id, now) {
  return { ...state, meals: (state.meals ?? []).map((m) => m.id === id ? { ...m, deleted: true, updatedAt: new Date(now).toISOString() } : m) };
}

/** Marca a refeição do dia. Tocar no mesmo status de novo limpa a marcação. */
export function setMealStatus(state, mealId, key, status) {
  if (status !== null && !(status in MEAL_STATUS)) return state;
  const day = { ...(state.dietLog?.[key] ?? {}) };
  day[mealId] = day[mealId] === status ? null : status;
  return { ...state, dietLog: { ...(state.dietLog ?? {}), [key]: day } };
}

/** Pontos de dieta de um dia: refeições esperadas e soma dos status. */
export function dietDay(state, key) {
  const log = state.dietLog?.[key] ?? {};
  const meals = activeMeals(state).filter((m) => m.createdAt <= key);
  const marked = meals.filter((m) => log[m.id]).length;
  const score = meals.reduce((sum, m) => sum + (MEAL_STATUS[log[m.id]] ?? 0), 0);
  return { expected: meals.length, marked, score };
}

export function dietAdherence(state, now, days) {
  const today = dayKey(now);
  let expected = 0, score = 0;
  for (const key of daysBack(now, days)) {
    const d = dietDay(state, key);
    if (key === today && d.marked === 0) continue;
    expected += d.expected; score += d.score;
  }
  return { expected, pct: expected ? Math.round((100 * score) / expected) : null };
}

// ---------- Sincronização ----------

/**
 * Junta o estado local com o remoto sem perder treino de nenhum lado:
 * histórico e marcações são a união; níveis e rascunho vêm do estado salvo mais recentemente.
 */
/** Uma pesagem por semana; se os dois lados têm a mesma semana, vale a gravada por último. */
/** Une listas por id; em cada item vale o mais recente (updatedAt). */
function mergeById(a = [], b = []) {
  const byId = new Map();
  for (const x of [...b, ...a]) {
    const cur = byId.get(x.id);
    if (!cur || (x.updatedAt ?? "") >= (cur.updatedAt ?? "")) byId.set(x.id, x);
  }
  return [...byId.values()];
}

/** Une registros por dia; na mesma marcação vale o estado salvo mais recentemente. */
function mergeLogs(older = {}, newer = {}) {
  const out = {};
  for (const day of new Set([...Object.keys(older), ...Object.keys(newer)])) out[day] = { ...older[day], ...newer[day] };
  return out;
}

/** Entre dois valores com carimbo `updatedAt`, vale o mais recente. */
function latestBy(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return (a.updatedAt ?? "") >= (b.updatedAt ?? "") ? a : b;
}

/** Une os registros de alimentos dia a dia; dentro do dia, cada item vale pelo `updatedAt` mais recente. */
function mergeDays(a = {}, b = {}) {
  const out = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)])) out[day] = mergeById(a[day], b[day]);
  return out;
}

/** Entre dois valores com carimbo `at`, vale o mais recente. */
function latestAt(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return (a.at ?? "") >= (b.at ?? "") ? a : b;
}

/** Check-ins por dia; se os dois aparelhos fizeram, vale o mais recente. */
function mergeCheckins(a = {}, b = {}) {
  const out = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)])) out[day] = latestBy(a[day], b[day]);
  return out;
}

function mergeWeights(a = [], b = []) {
  const byWeek = new Map();
  for (const w of [...b, ...a]) {
    const cur = byWeek.get(w.week);
    if (!cur || w.at >= cur.at) byWeek.set(w.week, w);
  }
  return [...byWeek.values()].sort((x, y) => x.week.localeCompare(y.week));
}

export function mergeStates(a, b) {
  if (!b) return a;
  const newer = (a.savedAt ?? "") >= (b.savedAt ?? "") ? a : b;
  const byDate = new Map();
  for (const s of [...b.history, ...a.history]) byDate.set(s.date, s);
  return {
    ...newer,
    history: [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date)),
    marks: [...new Set([...(a.marks ?? []), ...(b.marks ?? [])])].sort(),
    weights: mergeWeights(a.weights, b.weights),
    profile: newer.profile ?? (newer === a ? b.profile : a.profile) ?? null,
    dietPlan: latestAt(a.dietPlan, b.dietPlan),
    nutrition: latestBy(a.nutrition, b.nutrition),
    tour: latestBy(a.tour, b.tour),
    hydration: latestBy(a.hydration, b.hydration),
    waterLog: mergeDays(a.waterLog, b.waterLog),
    activityLog: mergeDays(a.activityLog, b.activityLog),
    favActivities: mergeById(a.favActivities, b.favActivities),
    activityPrefs: latestBy(a.activityPrefs, b.activityPrefs),
    checkins: mergeCheckins(a.checkins, b.checkins),
    avatar: latestBy(a.avatar, b.avatar),
    customFoods: mergeById(a.customFoods, b.customFoods),
    foodLog: mergeDays(a.foodLog, b.foodLog),
    meds: mergeById(a.meds, b.meds),
    meals: mergeById(a.meals, b.meals),
    medLog: mergeLogs(newer === a ? b.medLog : a.medLog, newer.medLog),
    dietLog: mergeLogs(newer === a ? b.dietLog : a.dietLog, newer.dietLog),
  };
}

// ---------- Persistência ----------

function isValidState(s) {
  return s && typeof s === "object" && s.version === STATE_VERSION
    && Array.isArray(s.history) && typeof s.levels === "object" && s.levels !== null;
}

export function createStore(storage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(STORAGE_KEY);
        if (!raw) return emptyState();
        const parsed = JSON.parse(raw);
        return isValidState(parsed) ? parsed : emptyState();
      } catch {
        return emptyState();
      }
    },
    save(state) {
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false; // modo privado, cota cheia etc. O app segue funcionando em memória.
      }
    },
  };
}
