// Funções puras: sem DOM, sem localStorage direto. Tudo aqui é testado em tests/.
import { EXERCISES, WORKOUTS, MAX_DUMBBELL_KG, WEEKLY_GOAL } from "./data.js";

export const STATE_VERSION = 1;
export const STORAGE_KEY = "treino-casa:v1";

export function emptyState() {
  return { version: STATE_VERSION, history: [], levels: {}, draft: null, marks: [] };
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

export function nextWorkoutKey(history) {
  if (!history.length) return "A";
  const last = history[history.length - 1].workout;
  return last === "A" ? "B" : "A";
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
export function weekStreak(state, now, goal = WEEKLY_GOAL) {
  const weeks = weeklyCounts(state, now, 104);
  let i = weeks.length - 1;
  if (weeks[i].count < goal) i--; // semana atual ainda em andamento
  let streak = 0;
  while (i >= 0 && weeks[i].count >= goal) { streak++; i--; }
  return streak;
}

// ---------- Sincronização ----------

/**
 * Junta o estado local com o remoto sem perder treino de nenhum lado:
 * histórico e marcações são a união; níveis e rascunho vêm do estado salvo mais recentemente.
 */
export function mergeStates(a, b) {
  if (!b) return a;
  const newer = (a.savedAt ?? "") >= (b.savedAt ?? "") ? a : b;
  const byDate = new Map();
  for (const s of [...b.history, ...a.history]) byDate.set(s.date, s);
  return {
    ...newer,
    history: [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date)),
    marks: [...new Set([...(a.marks ?? []), ...(b.marks ?? [])])].sort(),
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
