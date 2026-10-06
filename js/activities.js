// Atividades físicas além do treino do app: registro, gasto de energia (MET) e crédito de calorias no dia.
// Funções puras, testadas em tests/activities.test.js. Os valores de MET vêm do Compendium of Physical Activities
// e nunca são alterados nem combinados.

export const TABLES = {
  adulto: { label: "Adultos", factor: 1 },
  cadeira: { label: "Pessoas que usam cadeira de rodas", factor: 0.992 },
};
export const CREDIT_OPTIONS = [100, 75, 50];
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 600;

export const ACTIVITY_SOURCE =
  "Gasto de energia: Compendium of Physical Activities (Herrmann SD et al., J Sport Health Sci, 2024; pacompendium.com), tabelas de adultos e de pessoas que usam cadeira de rodas. Os valores de MET são médias de pesquisas e os nomes em português são traduções do app.";
export const ACTIVITY_DISCLAIMER =
  "É uma estimativa. O gasto real varia com o seu corpo, a intensidade e a técnica. O app desconta o gasto de repouso e usa só o que passou dele, para não contar duas vezes o que o seu nível de atividade já considera.";

const lastWeight = (state) => (state.weights ?? []).at(-1)?.kg ?? null;
const iso = (now) => new Date(now).toISOString();

/** Tira acento e põe em minúsculas, para a busca achar "forro" em "Forró". */
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Calorias gastas ALÉM do repouso: (MET - 1) x fator x kg x horas. */
export function activityKcal({ met, minutes, kg, factor = 1 }) {
  const m = Number(met), min = Number(minutes), w = Number(kg), f = Number(factor);
  if (![m, min, w, f].every(Number.isFinite) || m < 1 || min <= 0 || w <= 0 || f <= 0) return 0;
  return Math.round((m - 1) * f * w * (min / 60));
}

// ---------- Preferências ----------

export function activityPrefs(state) {
  const p = state.activityPrefs ?? {};
  return { table: p.table in TABLES ? p.table : "adulto", creditPct: CREDIT_OPTIONS.includes(p.creditPct) ? p.creditPct : 100 };
}

export function saveActivityPrefs(state, { table, creditPct }, now) {
  if (!(table in TABLES)) throw new Error("Escolha uma tabela de referência.");
  const pct = Number(creditPct);
  if (!CREDIT_OPTIONS.includes(pct)) throw new Error("Escolha quanto do gasto vira crédito.");
  return { ...state, activityPrefs: { table, creditPct: pct, updatedAt: iso(now) } };
}

// ---------- Registro ----------

export function addActivity(state, { code, name, met, table, minutes }, key, id, now) {
  if (!(table in TABLES)) throw new Error("Atividade inválida.");
  const min = Number(String(minutes).replace(",", "."));
  if (!Number.isFinite(min) || min < MIN_MINUTES || min > MAX_MINUTES) throw new Error(`Informe a duração em minutos, de ${MIN_MINUTES} a ${MAX_MINUTES}.`);
  const kg = lastWeight(state);
  if (!kg) throw new Error("Registre o seu peso antes: o gasto depende dele.");
  const kcal = activityKcal({ met, minutes: min, kg, factor: TABLES[table].factor });
  const entry = { id, code, name: String(name), met: Number(met), table, minutes: Math.round(min), kcal, at: iso(now), updatedAt: iso(now), deleted: false };
  return { ...state, activityLog: { ...(state.activityLog ?? {}), [key]: [...(state.activityLog?.[key] ?? []), entry] } };
}

export function removeActivity(state, key, id, now) {
  const day = (state.activityLog?.[key] ?? []).map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: iso(now) } : e));
  return { ...state, activityLog: { ...(state.activityLog ?? {}), [key]: day } };
}

export const activityEntries = (state, key) => (state.activityLog?.[key] ?? []).filter((e) => !e.deleted);
export const activityTotals = (state, key) => {
  const list = activityEntries(state, key);
  return { kcal: list.reduce((s, e) => s + e.kcal, 0), minutes: list.reduce((s, e) => s + e.minutes, 0), count: list.length };
};
/** Crédito do dia: a parte do gasto que a pessoa escolheu somar à meta de calorias. */
export const activityCredit = (state, key) => Math.round((activityTotals(state, key).kcal * activityPrefs(state).creditPct) / 100);

// ---------- Favoritas ----------

export const activeFavorites = (state) => (state.favActivities ?? []).filter((f) => !f.deleted);

export function addFavorite(state, { code, table, alias }, id, now) {
  if (!(table in TABLES) || !code) throw new Error("Atividade inválida.");
  const cleanAlias = String(alias ?? "").trim().slice(0, 60);
  const dup = activeFavorites(state).find((f) => f.code === code && f.table === table && (f.alias ?? "") === cleanAlias);
  if (dup) return state;
  return { ...state, favActivities: [...(state.favActivities ?? []), { id, code, table, alias: cleanAlias, updatedAt: iso(now), deleted: false }] };
}

export function removeFavorite(state, id, now) {
  return { ...state, favActivities: (state.favActivities ?? []).map((f) => (f.id === id ? { ...f, deleted: true, updatedAt: iso(now) } : f)) };
}

// ---------- Dados e busca ----------

/** Lê assets/atividades.json e devolve { adulto: [...], cadeira: [...] }, cada item com `table`. */
export function parseActivities(json) {
  const out = {};
  for (const [table, t] of Object.entries(json?.tables ?? {})) out[table] = (t.items ?? []).map((i) => ({ ...i, table }));
  return out;
}

export const findActivity = (all, code, table) => (all?.[table] ?? []).find((a) => a.code === code) ?? null;

// O Compendium não tem tudo o que se pratica no Brasil (forró, capoeira, crossfit...). Estas palavras só ajudam a ACHAR as
// atividades oficiais mais parecidas; o MET usado é sempre o da atividade oficial, e quem quiser salva como favorita com o seu nome.
export const SYNONYMS = {
  "03025": "forro samba pagode axe zouk quadrilha",
  "03033": "forro quadrilha festa junina",
  "03042": "forro gafieira bolero",
  "03090": "forro zouk",
  "15425": "capoeira muay thai",
  "15430": "capoeira muay thai",
  "02035": "crossfit funcional",
  "02210": "crossfit funcional",
  "02214": "crossfit funcional",
  "01019": "pedalar pedalada",
  "01030": "pedalar pedalada",
  "15675": "padel beach tennis",
  "05030": "faxina",
};

/** Busca por nome em português; sem texto, devolve tudo. Ordena começando-com antes de contém. */
export function searchActivities(items, query) {
  const q = norm(query);
  if (!q) return items;
  const hits = items.filter((a) => norm(`${a.pt} ${a.group} ${SYNONYMS[a.code] ?? ""}`).includes(q));
  const starts = (a) => (norm(a.pt).startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b));
}

/** Favoritas com os dados da atividade oficial; a que sumiu da tabela é ignorada. */
export function favoriteList(state, all) {
  return activeFavorites(state).flatMap((f) => {
    const a = findActivity(all, f.code, f.table);
    return a ? [{ ...a, favId: f.id, label: f.alias || a.pt }] : [];
  });
}
