import { EXERCISES, WORKOUTS, REST_SECONDS, CARDIO } from "./data.js";
import {
  createStore, nextWorkoutKey, restWarning, newDraft, draftProgress,
  finishSession, evaluateSets, lastEntryFor, imageFor, displayName, parseReps, parseKg,
  startOfWeek, dayKey, trainedDays, toggleMark, weeklyCounts, weekStreak, mergeStates, weeklyGoal, rotationFor, parseWeight, setWeight, weightLoggedThisWeek,
  saveMed, removeMed, toggleDose, activeMeds, saveMeal, removeMeal, setMealStatus, activeMeals, dietDay, todayDoses, importMeals, setDietPlan, clearDietPlan, activeDietPlan,
} from "./logic.js";
import * as sync from "./sync.js";
import { initChat } from "./chatui.js";
import { esc } from "./dom.js";
import { renderNutri, renderNutriSetup, renderFood, renderFoodResults, foodPreview } from "./nutriview.js";
import { saveNutrition, dailyTargets, addFoodEntry, removeFoodEntry, saveCustomFood, activeCustomFoods, parseTaco, parseMarcas, latestWeightKg, unitOf } from "./nutrition.js";
import { loadPdfjs, extractLayout, mealsFromLayout, validatePdf } from "./dietplan.js";
import { renderOnboarding, freshOnboarding, prevStep, nextStep } from "./onboardingview.js";
import { GOALS, DISCLAIMER, SOURCES, EVIDENCE_LIMIT, buildProfile, skippedProfile, needsOnboarding, cleanName, greeting } from "./onboarding.js";
import {
  renderMedsView, renderDietView, healthNotices, habitCards, renderMedsHabit, renderHormonesHabit, renderDietHabit,
} from "./health.js";
import { GOOGLE_LOGIN } from "./config.js";

const app = document.getElementById("app");
const store = createStore(safeLocalStorage());
let state = store.load();
let view = state.draft ? "workout" : "home";
// Nutrição: dia em exibição, tela de busca de alimentos e a tabela TACO (carregada só quando alguém abre a busca).
let nutriDay = null; // null = hoje
let setupDraft = null; // { values, errors } enquanto o formulário de metas tem erro
let foodCtx = null; // { from, day, mealId, query, selected, g, mode, custom, error }
let tacoFoods = null; // TACO + marcas, carregadas juntas
let tacoLoading = null;
const todayKey = () => dayKey(new Date());
const allFoods = () => [...activeCustomFoods(state), ...(tacoFoods ?? [])];
const fetchJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

async function loadTaco() {
  if (tacoFoods) return;
  tacoLoading ??= Promise.all([
    fetchJson("assets/taco.json"),
    fetchJson("assets/marcas.json").catch(() => ({ items: [] })), // as marcas são um extra: sem elas a busca ainda funciona
  ])
    .then(([taco, marcas]) => { tacoFoods = [...parseMarcas(marcas), ...parseTaco(taco)]; })
    .catch((err) => { tacoLoading = null; throw err; });
  await tacoLoading;
}

let pendingPlan = null; // PDF escolhido, à espera da confirmação do usuário
let onb = null; // respostas do onboarding em andamento
let editing = null; // { type: "med" | "meal", id } enquanto um formulário de remédio ou refeição está aberto
/** Decide a primeira tela depois de entrar: onboarding (se ainda não há perfil), treino em andamento ou home. */
function enterApp() {
  if (needsOnboarding(state) && !state.draft) { onb = freshOnboarding(state.profile?.name ?? ""); view = "onboarding"; }
  else view = state.draft ? "workout" : "home";
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
let chosenKey = null; // permite trocar A/B manualmente na home

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

function persist() {
  state = { ...state, savedAt: new Date().toISOString() };
  if (!store.save(state)) console.warn("Não foi possível salvar. O progresso fica só nesta aba.");
  sync.schedulePush(state, (err) => console.warn("Não foi possível sincronizar agora.", err));
}

const img = (folder, n) => `assets/ex/${encodeURIComponent(folder)}/${n}.jpg`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const fmtKg = (kg) => (kg ?? "") === "" ? "" : String(kg).replace(".", ",");

// ---------- Views ----------

/** Tela do treino: o resumo do treino do dia, com o botão de começar. */
function renderTreino() {
  const rotation = rotationFor(state);
  const key = chosenKey ?? nextWorkoutKey(state.history, rotation);
  const others = rotation.filter((k) => k !== key);
  const w = WORKOUTS[key];
  const now = new Date();
  const done = weeklyCounts(state, now, 1)[0].count;
  const warning = restWarning(state.history, now);

  const plates = Array.from({ length: weeklyGoal(state) }, (_, i) =>
    `<span class="plate ${i < done ? "full" : ""}" aria-hidden="true"></span>`).join("");

  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">${esc(w.title)}</h1>
    <p class="lede">${esc(w.focus)}</p>

    <div class="week" role="img" aria-label="${done} de ${weeklyGoal(state)} treinos nesta semana">
      ${plates}<span class="week-text">${Math.min(done, 99)} de ${weeklyGoal(state)} na semana</span>
    </div>

    ${warning ? `<p class="notice">${esc(warning)}</p>` : ""}

    <button class="cta" data-action="start" data-key="${key}">Começar ${esc(w.title)}</button>
    <div class="switches">${others.map((k) => `<button class="switch" data-action="switch" data-key="${k}">Fazer o ${esc(WORKOUTS[k].title)} hoje</button>`).join("")}</div>

    <ul class="preview">
      <li><span>${esc(CARDIO.name)}</span><span>${CARDIO.minutes} min</span></li>
      ${w.exercises.map((id) => {
        const ex = EXERCISES[id];
        return `<li><span>${esc(ex.name)}</span><span>${ex.sets} × ${ex.repMin} a ${ex.repMax}</span></li>`;
      }).join("")}
    </ul>
  `;
}

/** Painel inicial: um cartão por área, cada um com um resumo do dia. */
function renderHome() {
  const now = new Date();
  const goal = weeklyGoal(state);
  const done = weeklyCounts(state, now, 1)[0].count;
  const streak = weekStreak(state, now);
  const rotation = rotationFor(state);
  const next = WORKOUTS[chosenKey ?? nextWorkoutKey(state.history, rotation)];

  const doses = todayDoses(state, now);
  const dosesTaken = doses.filter((d) => d.taken).length;
  const meals = activeMeals(state);
  const mealsMarked = dietDay(state, dayKey(now)).marked;
  const lastWeight = (state.weights ?? []).at(-1);
  const weighed = weightLoggedThisWeek(state, now);

  const card = (view, name, value, label, extra = "") => `
    <button type="button" class="home-card ${extra}" data-action="go" data-view="${view}">
      <span class="home-card-name">${name}</span>
      <strong>${esc(value)}</strong>
      <span class="small">${esc(label)}</span>
    </button>`;

  const draftWorkout = state.draft ? WORKOUTS[state.draft.workout] : null;
  const progress = state.draft ? draftProgress(state.draft) : null;
  const treino = draftWorkout
    ? `<button type="button" class="home-card hero treino resume" data-action="go" data-view="workout">
        <span class="home-card-name">Treino em andamento</span>
        <strong>${esc(draftWorkout.title)}</strong>
        <span class="small">${progress.finished} de ${progress.total} exercícios · toque para continuar</span>
      </button>`
    : `<button type="button" class="home-card hero treino" data-action="go" data-view="treino">
        <span class="home-card-name">Treino</span>
        <strong>${esc(next.title)}</strong>
        <span class="small">${esc(next.focus)} · ${Math.min(done, 99)} de ${goal} na semana</span>
      </button>`;

  const today = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  app.innerHTML = `
    <h1 class="display">${esc(greeting(state.profile?.name, now))}</h1>
    <p class="lede" style="text-transform:capitalize">${esc(today)}</p>

    ${healthNotices(state, now, { hormonesOnly: true })}

    <div class="home-cards">
      ${treino}
      ${card("habit", "Hábito", streak > 0 ? `${streak} ${streak === 1 ? "semana" : "semanas"}` : `${Math.min(done, 99)}/${goal}`, streak > 0 ? "seguidas na meta" : "treinos esta semana", "habito")}
      ${card("diet", "Dieta", meals.length ? `${mealsMarked}/${meals.length}` : "–", meals.length ? "refeições marcadas hoje" : "anexe seu plano", "dieta")}
      ${card("meds", "Remédios", doses.length ? `${dosesTaken}/${doses.length}` : "–", doses.length ? "doses de hoje" : "cadastre seus remédios", "remedios")}
      ${card("weight", "Peso", lastWeight ? `${fmtKg(lastWeight.kg)} kg` : "–", lastWeight ? (weighed ? "pesado nesta semana" : "pesagem da semana pendente") : "registre seu peso", "peso")}
    </div>

    <button class="cta ghost" style="margin-top:1.25rem" data-action="go" data-view="guide">Antes de começar</button>

    ${state.profile?.goal ? `<p class="small account">Objetivo: ${esc(GOALS[state.profile.goal].label)} · ${goal} treinos por semana. <button class="switch" data-action="onb-restart">Refazer</button></p>` : `<p class="small account"><button class="switch" data-action="onb-restart">Receber uma sugestão de treino</button></p>`}
    ${sync.signedIn() ? `<p class="account small">Sincronizado como ${esc(sync.email())} · <button class="switch" data-action="signout">Sair</button></p>` : ""}
  `;
}
function passwordField(name, autocomplete, label) {
  return `<label class="field-block">${label}
    <span class="pw">
      <input name="${name}" type="password" autocomplete="${autocomplete}" minlength="8" required>
      <button type="button" class="pw-toggle" data-action="togglepw" aria-pressed="false" aria-label="Mostrar senha">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
          <line class="pw-slash" x1="3" y1="3" x2="21" y2="21"/>
        </svg>
      </button>
    </span>
  </label>`;
}

function renderForgot(message = "", { email = "", sent = false } = {}) {
  if (sent) {
    app.innerHTML = `
      <h1 class="display">Confira seu e-mail</h1>
      <div class="sent" role="status">
        <p><strong>Se existir uma conta com ${esc(email)}, enviamos um link para criar uma nova senha.</strong></p>
        <p>O link vale por pouco tempo. Se não achar, olhe o spam ou a aba Promoções.</p>
      </div>
      <button class="cta" type="button" data-action="relogin" data-email="${esc(email)}">Voltar para entrar</button>
    `;
    return;
  }
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="relogin" data-email="${esc(email)}">‹ Voltar</button><span></span></div>
    <h1 class="display">Esqueci a senha</h1>
    <p class="lede">Digite o e-mail da sua conta. Enviamos um link para você criar uma senha nova.</p>
    <form class="login" data-action="forgot" novalidate>
      <label class="field-block">E-mail
        <input name="email" type="email" autocomplete="email" inputmode="email" value="${esc(email)}" required>
      </label>
      <p class="login-msg" role="status">${esc(message)}</p>
      <button class="cta" type="submit">Enviar link</button>
    </form>
  `;
}

function renderNewPassword(message = "") {
  app.innerHTML = `
    <h1 class="display">Nova senha</h1>
    <p class="lede">Escolha uma senha nova, com pelo menos 8 caracteres.</p>
    <form class="login" data-action="newpassword" novalidate>
      ${passwordField("password", "new-password", "Nova senha")}
      <p class="login-msg" role="status">${esc(message)}</p>
      <button class="cta" type="submit">Salvar senha</button>
    </form>
  `;
}

function renderLogin(message = "", { email = "", sent = false } = {}) {
  if (sent) {
    app.innerHTML = `
      <h1 class="display">Confira seu e-mail</h1>
      <div class="sent" role="status">
        <p><strong>Enviamos um e-mail para ${esc(email)}.</strong></p>
        <p>Abra a mensagem e clique no link para ativar a conta. Se não achar, olhe o spam ou a aba Promoções.</p>
      </div>
      <button class="cta" type="button" data-action="relogin" data-email="${esc(email)}">Já confirmei, entrar</button>
    `;
    return;
  }
  app.innerHTML = `
    <h1 class="display">Entrar</h1>
    <p class="lede">Entre com a sua conta para o progresso aparecer igual no celular e no computador.</p>
    ${GOOGLE_LOGIN ? `<button class="cta google" type="button" data-action="google">Entrar com Google</button>
    <p class="or small">ou com e-mail e senha</p>` : ""}
    <form class="login" data-action="login" novalidate>
      <label class="field-block">E-mail
        <input name="email" type="email" autocomplete="email" inputmode="email" value="${esc(email)}" required>
      </label>
      ${passwordField("password", "current-password", "Senha")}
      <p class="login-msg" role="status">${esc(message)}</p>
      <button class="switch forgot" type="button" data-action="forgot">Esqueci minha senha</button>
      <button class="cta" type="submit" name="mode" value="signin">Entrar</button>
      <button class="cta ghost" type="submit" name="mode" value="signup">Criar conta</button>
    </form>
  `;
}
function loginError(err) {
  const known = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Falta confirmar o e-mail. Abra a mensagem que enviamos e clique no link.",
    "User already registered": "Este e-mail já tem conta. Toque em Entrar.",
    "New password should be different from the old password.": "A nova senha precisa ser diferente da antiga.",
    "Auth session missing!": "O link expirou. Volte e peça um novo em Esqueci minha senha.",
  };
  return known[err.message] ?? err.message;
}

function renderExercise(id, entry) {
  const ex = EXERCISES[id];
  const folder = imageFor(id, entry.level);
  const name = displayName(id, entry.level);
  const last = lastEntryFor(state.history, id);
  const usesKg = ex.type === "dumbbell";
  const complete = entry.sets.every((s) => s.done);
  const verdict = complete ? evaluateSets(id, entry.sets, entry.level) : null;

  const lastText = last
    ? `Última vez: ${last.sets.filter((s) => s.done).map((s) => s.reps).join(", ")} reps${usesKg && last.sets[0]?.kg != null ? ` com ${fmtKg(last.sets[0].kg)} kg` : ""}`
    : usesKg
      ? "Primeira vez. Use um peso em que as últimas reps fiquem difíceis."
      : "Primeira vez. Pare cada série quando sobrarem 1 ou 2 reps.";

  const levelPicker = ex.levels ? `
    <label class="level small">Variação
      <select data-action="level" data-id="${id}">
        ${ex.levels.map((l, i) => `<option value="${i}" ${i === entry.level ? "selected" : ""}>${esc(l.name)}</option>`).join("")}
      </select>
    </label>` : "";

  const rows = entry.sets.map((s, i) => `
    <div class="set ${usesKg ? "" : "no-kg"}">
      <span class="set-n">Série ${i + 1}</span>
      <label class="field"><span>reps</span>
        <input inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="Repetições da série ${i + 1}"
          data-action="reps" data-id="${id}" data-i="${i}" value="${s.reps ?? ""}" placeholder="${ex.repMax}">
      </label>
      ${usesKg ? `<label class="field"><span>kg</span>
        <input inputmode="decimal" enterkeyhint="done" autocomplete="off" aria-label="Peso em kg da série ${i + 1}"
          data-action="kg" data-id="${id}" data-i="${i}" value="${fmtKg(s.kg)}" placeholder="4">
      </label>` : ""}
      <button class="check" type="button" data-action="check" data-id="${id}" data-i="${i}"
        aria-pressed="${s.done}" aria-label="Marcar série ${i + 1} como feita">✓</button>
    </div>`).join("");

  return `
    <section class="exercise ${complete ? "complete" : ""}" id="ex-${id}">
      <div class="frame">
        <img src="${img(folder, 0)}" alt="${esc(name)}: posição inicial" loading="lazy" width="640" height="427">
        <img class="end" src="${img(folder, 1)}" alt="${esc(name)}: posição final" loading="lazy" width="640" height="427">
        <button class="frame-btn" type="button" data-action="pause">Pausar</button>
      </div>
      <h2>${esc(name)}</h2>
      <p class="target">${ex.sets} séries de ${ex.repMin} a ${ex.repMax}${ex.unilateral ? " (cada lado)" : ""}</p>
      <p class="tempo">${esc(ex.tempo)}</p>
      <p class="last">${esc(lastText)}</p>
      ${levelPicker}
      <details><summary>Como fazer</summary><ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></details>
      <div class="sets">${rows}</div>
      ${verdict ? `<p class="verdict ${verdict.status}">${esc(verdict.message)}</p>` : ""}
    </section>`;
}

function renderWorkout() {
  const d = state.draft;
  const w = WORKOUTS[d.workout];
  const { finished, total } = draftProgress(d);
  app.innerHTML = `
    <div class="bar">
      <button class="back" data-action="leave">‹ Sair</button>
      <span class="count">${finished} de ${total} exercícios</span>
    </div>
    <h1 class="display">${esc(w.title)}</h1>
    <p class="lede" style="margin-bottom:1.5rem">${esc(w.focus)}. Depois do cardio, faça uma série leve de flexão e rotação de braço para aquecer.</p>
    <section class="cardio ${d.cardio ? "complete" : ""}">
      <div>
        <h2>${esc(CARDIO.name)}</h2>
        <p class="target">${CARDIO.minutes} minutos antes dos halteres</p>
        <p class="tempo">${esc(CARDIO.tip)}</p>
      </div>
      <button class="check" type="button" data-action="cardio" aria-pressed="${d.cardio === true}" aria-label="Marcar cardio como feito">✓</button>
    </section>
    ${w.exercises.map((id) => renderExercise(id, d.entries[id])).join("")}
    <button class="cta" data-action="finish">Concluir treino</button>
    <button class="switch" data-action="discard">Descartar este treino</button>
  `;
}

const HABIT_START = new Date(2026, 9, 1); // o calendário começa em outubro de 2026
const CHART_SLOTS = 12;

function weeksSinceStart(now) {
  return Math.round((startOfWeek(now) - startOfWeek(HABIT_START)) / (7 * 86_400_000)) + 1;
}
const SVG_W = 320, SVG_H = 140, PAD = { l: 22, r: 8, t: 12, b: 22 };

function renderChart(weeks) {
  const real = weeks.filter((w) => w.count !== null);
  const max = Math.max(weeklyGoal(state), 7, ...real.map((w) => w.count));
  const x = (i) => PAD.l + (i * (SVG_W - PAD.l - PAD.r)) / (weeks.length - 1);
  const y = (v) => SVG_H - PAD.b - (v * (SVG_H - PAD.t - PAD.b)) / max;
  const pts = weeks.flatMap((w, i) => w.count === null ? [] : [`${x(i).toFixed(1)},${y(w.count).toFixed(1)}`]);
  const label = (w) => w.start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const alt = `Treinos por semana desde ${label(weeks[0])}: ${real.map((w) => w.count).join(", ")}. Meta: ${weeklyGoal(state)}.`;
  return `
    <svg class="chart" viewBox="0 0 ${SVG_W} ${SVG_H}" role="img" aria-label="${esc(alt)}">
      <line class="goal" x1="${PAD.l}" x2="${SVG_W - PAD.r}" y1="${y(weeklyGoal(state))}" y2="${y(weeklyGoal(state))}"/>
      <text class="axis" x="${PAD.l - 4}" y="${y(weeklyGoal(state)) + 3}" text-anchor="end">${weeklyGoal(state)}</text>
      <text class="axis" x="${PAD.l - 4}" y="${y(0) + 3}" text-anchor="end">0</text>
      <polyline class="line" points="${pts.join(" ")}"/>
      ${weeks.map((w, i) => w.count === null ? "" : `<circle class="dot ${w.count >= weeklyGoal(state) ? "hit" : ""}" cx="${x(i).toFixed(1)}" cy="${y(w.count).toFixed(1)}" r="3.5"/>`).join("")}
      <text class="axis" x="${x(0)}" y="${SVG_H - 6}" text-anchor="start">${label(weeks[0])}</text>
      <text class="axis" x="${x(weeks.length - 1)}" y="${SVG_H - 6}" text-anchor="end">${label(weeks[weeks.length - 1])}</text>
    </svg>`;
}

function renderCalendar(now) {
  const days = trainedDays(state);
  const sessionDays = new Set(state.history.map((s) => dayKey(s.date)));
  const start = startOfWeek(HABIT_START);
  const startKey = dayKey(HABIT_START);
  const today = dayKey(now);
  const names = ["S", "T", "Q", "Q", "S", "S", "D"];
  const weekDate = (w, d) => { const x = new Date(start); x.setDate(start.getDate() + w * 7 + d); return x; };
  // Semanas em linhas, da mais antiga (topo) para a atual (embaixo). O mês aparece na linha em que ele começa.
  const rows = Array.from({ length: weeksSinceStart(now) }, (_, w) => {
    const week = Array.from({ length: 7 }, (_, d) => weekDate(w, d));
    const anchor = week.find((x) => x.getDate() === 1) ?? (w === 0 ? week[0] : null);
    const month = anchor
      ? anchor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + (anchor.getMonth() === 0 ? ` ${String(anchor.getFullYear()).slice(2)}` : "")
      : "";
    const cells = week.map((date) => {
      const key = dayKey(date);
      const alt = date.getMonth() % 2 ? "alt" : "";
      if (key < startKey) return `<span aria-hidden="true"></span>`;
      if (key > today) return `<span class="cal-day future ${alt}" aria-hidden="true">${date.getDate()}</span>`;
      const on = days.has(key);
      const locked = sessionDays.has(key);
      const label = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
      return `<button type="button" class="cal-day ${alt} ${on ? "on" : ""} ${key === today ? "today" : ""}" data-action="mark" data-day="${key}"
        aria-pressed="${on}" aria-label="${esc(label)}${locked ? " (treino registrado)" : ""}" ${locked ? "disabled" : ""}>${date.getDate()}</button>`;
    }).join("");
    return `<span class="cal-month">${month}</span>${cells}`;
  }).join("");
  return `<div class="cal"><span></span>${names.map((n) => `<span class="cal-name" aria-hidden="true">${n}</span>`).join("")}${rows}</div>`;
}

let habitTab = "treino";

function renderTrainingHabit(now) {
  const done = weeklyCounts(state, now, Math.min(weeksSinceStart(now), CHART_SLOTS));
  const weeks = [...done];
  while (weeks.length < 6) { // espaço reservado para as próximas semanas
    const next = new Date(weeks[weeks.length - 1].start); next.setDate(next.getDate() + 7);
    weeks.push({ start: next, count: null });
  }
  const streak = weekStreak(state, now);
  const total = trainedDays(state).size;
  const best = Math.max(...done.map((w) => w.count));
  return `
    <p class="lede">${streak > 0
      ? `${streak} ${streak === 1 ? "semana seguida" : "semanas seguidas"} batendo a meta de ${weeklyGoal(state)} treinos.`
      : `Meta: ${weeklyGoal(state)} treinos por semana. A sequência começa quando você fechar a primeira semana.`}</p>

    <div class="stats">
      <div><strong>${streak}</strong><span>semanas na meta</span></div>
      <div><strong>${total}</strong><span>treinos no total</span></div>
      <div><strong>${best}</strong><span>melhor semana</span></div>
    </div>

    <h2 class="section">Treinos por semana</h2>
    ${renderChart(weeks)}

    <h2 class="section">Calendário</h2>
    <p class="small" style="margin:0 0 .75rem">Treinos concluídos no app entram sozinhos. Treinou fora do app? Toque no dia para marcar.</p>
    ${renderCalendar(now)}`;
}

function renderHabit() {
  const now = new Date();
  const cards = habitCards(state, now);
  const doneWeek = weeklyCounts(state, now, 1)[0].count;
  const pct = (v) => (v === null ? "–" : `${v}%`);
  const items = [
    { id: "treino", name: "Treino", value: `${Math.min(doneWeek, 99)}/${weeklyGoal(state)}`, label: "treinos esta semana", status: doneWeek >= weeklyGoal(state) ? "ok" : "" },
    { id: "remedios", name: "Remédios", value: cards.meds.has ? pct(cards.meds.pct) : "–", label: cards.meds.has ? "doses, 7 dias" : "nenhum cadastrado", status: "" },
    { id: "hormonios", name: "Hormônios", value: cards.hormones.value, label: cards.hormones.label, status: cards.hormones.status },
    { id: "dieta", name: "Dieta", value: cards.diet.has ? pct(cards.diet.pct) : "–", label: cards.diet.has ? "plano, 7 dias" : "nenhuma cadastrada", status: "" },
  ];
  const detail = {
    treino: () => renderTrainingHabit(now),
    remedios: () => renderMedsHabit(state, now),
    hormonios: () => renderHormonesHabit(state, now),
    dieta: () => renderDietHabit(state, now),
  }[habitTab]();
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Hábito</h1>
    <div class="habit-cards" role="group" aria-label="Escolha o hábito">
      ${items.map((i) => `<button type="button" class="habit-card ${i.status}" data-action="habit-tab" data-tab="${i.id}" aria-pressed="${habitTab === i.id}">
        <span class="habit-name">${i.name}</span><strong>${esc(i.value)}</strong><span class="small">${esc(i.label)}</span></button>`).join("")}
    </div>
    <div class="habit-detail">${detail}</div>
  `;
}
function renderWeightChart(entries) {
  const W = 320, H = 150, pad = { l: 34, r: 10, t: 12, b: 22 };
  const kgs = entries.map((e) => e.kg);
  const lo = Math.floor(Math.min(...kgs) - 1), hi = Math.ceil(Math.max(...kgs) + 1);
  const x = (i) => entries.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (entries.length - 1);
  const y = (v) => H - pad.b - ((v - lo) * (H - pad.t - pad.b)) / (hi - lo);
  const pts = entries.map((e, i) => `${x(i).toFixed(1)},${y(e.kg).toFixed(1)}`).join(" ");
  const short = (e) => new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const alt = `Peso por semana: ${entries.map((e) => `${short(e)} ${fmtKg(e.kg)} kg`).join(", ")}.`;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}">
      <text class="axis" x="${pad.l - 4}" y="${y(hi) + 3}" text-anchor="end">${hi}</text>
      <text class="axis" x="${pad.l - 4}" y="${y(lo) + 3}" text-anchor="end">${lo}</text>
      <line class="goal" x1="${pad.l}" x2="${W - pad.r}" y1="${y(lo)}" y2="${y(lo)}"/>
      <polyline class="line" points="${pts}"/>
      ${entries.map((e, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(e.kg).toFixed(1)}" r="3.5"/>`).join("")}
      <text class="axis" x="${x(0)}" y="${H - 6}" text-anchor="${entries.length === 1 ? "middle" : "start"}">${short(entries[0])}</text>
      ${entries.length > 1 ? `<text class="axis" x="${x(entries.length - 1)}" y="${H - 6}" text-anchor="end">${short(entries[entries.length - 1])}</text>` : ""}
    </svg>`;
}

function renderWeight(message = "", ok = false) {
  const now = new Date();
  const entries = state.weights ?? [];
  const current = entries.find((w) => w.week === dayKey(startOfWeek(now)));
  const rows = [...entries].reverse().map((w, i, arr) => {
    const prev = arr[i + 1];
    const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
    const d = diff === null ? "" : diff === 0 ? "igual" : `${diff > 0 ? "+" : "−"}${fmtKg(Math.abs(diff))} kg`;
    return `<li><span>${esc(fmtDate(w.date + "T12:00:00"))}</span><strong>${fmtKg(w.kg)} kg</strong><span class="small">${d}</span></li>`;
  }).join("");
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Peso</h1>
    <p class="lede">Pese uma vez por semana, de preferência na segunda de manhã, em jejum e depois de ir ao banheiro. Assim os números ficam comparáveis.</p>
    <form class="login" data-action="weight" novalidate>
      <label class="field-block">${current ? "Peso desta semana (pode corrigir)" : "Peso de hoje"}
        <span class="pw">
          <input name="kg" inputmode="decimal" autocomplete="off" placeholder="ex.: 68,4" value="${current ? fmtKg(current.kg) : ""}" required>
          <span class="unit" aria-hidden="true">kg</span>
        </span>
      </label>
      <p class="login-msg ${ok ? "ok" : ""}" role="status">${esc(message)}</p>
      <button class="cta" type="submit">${current ? "Atualizar peso" : "Salvar peso"}</button>
    </form>
    ${entries.length ? `<h2 class="section">Evolução</h2>${renderWeightChart(entries)}
    <ul class="weights">${rows}</ul>` : `<p class="small" style="margin-top:1.5rem">Nenhum peso registrado ainda. O primeiro aparece aqui.</p>`}
  `;
}

function renderGuide() {
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <article class="guide">
      <h1 class="display">Antes de começar</h1>

      <h2>O app não substitui um profissional</h2>
      <p>${esc(DISCLAIMER)}</p>

      <h2>De onde vêm as sugestões de treino</h2>
      <p>${esc(EVIDENCE_LIMIT)}</p>
      <ol class="sources">${SOURCES.map((s) => `<li>${esc(s.text)} <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Abrir o artigo</a></li>`).join("")}</ol>

      <h2>Prepare o ambiente</h2>
      <ul class="checklist">
        <li>Pegue a sua garrafa d'água e deixe por perto.</li>
        <li>Escolha uma playlist de rock no Spotify e dê o play.</li>
        <li>Abra um vídeo no YouTube para ver a execução ou fazer companhia.</li>
        <li>Coloque os halteres e a toalha ao alcance da mão.</li>
        <li>Separe um espaço livre, com o celular apoiado onde você enxergue o app.</li>
        <li>Roupa confortável e tênis para a esteira.</li>
      </ul>
      <h2>Como progredir com 4 kg</h2>
      <p>Peso leve ainda constrói músculo se a série chegar perto da falha. Pare cada série quando sobrarem 1 ou 2 reps no tanque. Quando todas as séries baterem o topo da faixa, o app sugere o próximo passo: mais peso, descida mais lenta, pausa no meio do movimento ou uma variação mais difícil da flexão.</p>

      <h2>Dias de treino</h2>
      <p>Três vezes por semana com um dia de folga entre eles. Segunda, quarta e sexta funciona bem. O app alterna A e B sozinho.</p>

      <h2>Dor que manda parar</h2>
      <p>Queimação no músculo é normal. Dor pontuda na articulação, formigamento ou estalo com dor não são. Nesses casos, pare o exercício e troque pela versão mais fácil.</p>

      <p class="credit">Imagens: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a>, em domínio público. Algumas fotos mostram banco de academia. As instruções de cada exercício dizem como adaptar.</p>
    </article>
  `;
}

function render() {
  if (view === "login") renderLogin();
  else if (view === "onboarding") app.innerHTML = renderOnboarding(onb);
  else if (view === "newpassword") renderNewPassword();
  else if (view === "workout" && state.draft) renderWorkout();
  else if (view === "guide") renderGuide();
  else if (view === "habit") renderHabit();
  else if (view === "weight") renderWeight();
  else if (view === "treino") renderTreino();
  else if (view === "nutri") app.innerHTML = renderNutri(state, new Date(), nutriDay ?? todayKey(), todayKey());
  else if (view === "nutri-setup") app.innerHTML = renderNutriSetup(state, new Date(), setupDraft?.values ?? null, setupDraft?.errors ?? []);
  else if (view === "food" && foodCtx) app.innerHTML = renderFood(state, foodCtx, allFoods(), !tacoFoods && !foodCtx.loadError);
  else if (view === "meds") app.innerHTML = renderMedsView(state, new Date(), editing);
  else if (view === "diet") app.innerHTML = renderDietView(state, new Date(), editing);
  else { view = "home"; renderHome(); }
}

// ---------- Timer de descanso ----------

const restEl = document.getElementById("rest");
const restTime = document.getElementById("rest-time");
let restEnd = 0;
let restTick = null;

// Aviso sonoro: o navegador só libera áudio depois de um toque, então o contexto nasce no toque que inicia o descanso.
let audioCtx = null;
let soundOn = (() => { try { return localStorage.getItem("treino-casa:som") !== "off"; } catch { return true; } })();

function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
  } catch { /* sem áudio: segue só com a vibração */ }
}

function beep() {
  if (!soundOn || !audioCtx) return;
  [0, 0.3, 0.6].forEach((delay, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = i === 2 ? 1175 : 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  });
}

const soundBtn = document.getElementById("rest-sound");
function paintSound() {
  soundBtn.textContent = soundOn ? "🔔" : "🔕";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
  soundBtn.setAttribute("aria-label", soundOn ? "Som do descanso ligado" : "Som do descanso desligado");
}
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem("treino-casa:som", soundOn ? "on" : "off"); } catch { /* sem storage: vale só nesta sessão */ }
  if (soundOn) { unlockAudio(); beep(); }
  paintSound();
});
paintSound();

function startRest(seconds = REST_SECONDS) {
  unlockAudio();
  restEnd = Date.now() + seconds * 1000; // baseado em relógio, não em contagem, para sobreviver a aba em segundo plano
  restEl.hidden = false;
  restEl.classList.remove("done");
  clearInterval(restTick);
  tickRest();
  restTick = setInterval(tickRest, 250);
}

function tickRest() {
  const left = Math.max(0, Math.round((restEnd - Date.now()) / 1000));
  restTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (left === 0) {
    clearInterval(restTick);
    restEl.classList.add("done");
    restTime.textContent = "Bora";
    navigator.vibrate?.([200, 100, 200]);
    beep();
    setTimeout(stopRest, 4000);
  }
}

function stopRest() {
  clearInterval(restTick);
  restEl.hidden = true;
}

document.getElementById("rest-add").addEventListener("click", () => { restEnd += 15_000; restEl.classList.remove("done"); });
document.getElementById("rest-skip").addEventListener("click", stopRest);

// Mantém a tela acesa durante o treino, quando o navegador suporta.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* sem suporte ou negado: segue sem */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && view === "workout") { wakeLock = null; keepAwake(true); }
});

// ---------- Eventos ----------

app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const { action, id } = t.dataset;
  const i = Number(t.dataset.i);

  switch (action) {
    case "start":
      state = { ...state, draft: newDraft(t.dataset.key, state, new Date()) };
      chosenKey = null;
      view = "workout";
      persist(); render(); keepAwake(true); window.scrollTo(0, 0);
      break;
    case "cardio":
      state.draft.cardio = !state.draft.cardio;
      persist();
      { const y = window.scrollY; render(); window.scrollTo(0, y); }
      break;
    case "togglepw": {
      const input = t.closest(".pw").querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      t.setAttribute("aria-pressed", String(show));
      t.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      break;
    }
    case "forgot": {
      const typed = t.closest("form")?.elements.email?.value.trim() ?? "";
      renderForgot("", { email: typed });
      break;
    }
    case "relogin":
      renderLogin("", { email: t.dataset.email });
      break;
    case "google":
      sync.signInWithGoogle().catch((err) => renderLogin(err.message));
      break;
    case "signout":
      sync.signOut().finally(() => { view = "login"; render(); });
      break;
    case "mark":
      state = toggleMark(state, t.dataset.day);
      persist(); render();
      break;
    case "switch":
      chosenKey = t.dataset.key; render();
      break;
    case "dose": {
      state = toggleDose(state, t.dataset.med, t.dataset.slot, dayKey(new Date()));
      persist();
      const y = window.scrollY; render(); window.scrollTo(0, y);
      break;
    }
    case "meal": {
      state = setMealStatus(state, t.dataset.id, dayKey(new Date()), t.dataset.status);
      persist();
      const y = window.scrollY; render(); window.scrollTo(0, y);
      break;
    }
    case "nutri-setup": setupDraft = null; view = "nutri-setup"; render(); window.scrollTo(0, 0); break;
    case "nutri-back": setupDraft = null; view = "nutri"; render(); window.scrollTo(0, 0); break;
    case "nutri-day": {
      const d = new Date(`${nutriDay ?? todayKey()}T12:00:00`);
      d.setDate(d.getDate() + Number(t.dataset.delta));
      nutriDay = dayKey(d) > todayKey() ? null : dayKey(d);
      render();
      break;
    }
    case "food-add":
      foodCtx = { from: view, day: t.dataset.day || todayKey(), mealId: t.dataset.meal || null, query: "", selected: null, g: "100", mode: "search", error: null };
      view = "food"; render(); window.scrollTo(0, 0);
      loadTaco()
        .then(() => { if (view === "food") render(); })
        .catch(() => { if (foodCtx) { foodCtx.loadError = true; foodCtx.error = "Não foi possível carregar a tabela de alimentos. Você ainda pode cadastrar um alimento seu."; } if (view === "food") render(); });
      break;
    case "food-back":
      view = foodCtx?.from === "nutri" ? "nutri" : "diet"; foodCtx = null; render(); window.scrollTo(0, 0);
      break;
    case "food-pick":
      foodCtx.selected = allFoods().find((f) => f.id === t.dataset.id) ?? null; foodCtx.error = null; foodCtx.g = "100";
      render(); window.scrollTo(0, 0);
      break;
    case "food-unpick": foodCtx.selected = null; foodCtx.error = null; render(); break;
    case "food-qty": {
      foodCtx.g = t.dataset.g;
      const input = document.getElementById("food-g");
      if (input) input.value = foodCtx.g;
      document.getElementById("food-preview").innerHTML = foodPreview(foodCtx.selected.per100, foodCtx.g, state.nutrition?.hideNumbers === true, unitOf(foodCtx.selected));
      break;
    }
    case "food-custom": foodCtx.mode = "custom"; foodCtx.custom = {}; foodCtx.error = null; render(); window.scrollTo(0, 0); break;
    case "food-copy": // a embalagem da pessoa é diferente: vira um alimento próprio, já com os valores para ela corrigir
      foodCtx.custom = { name: foodCtx.selected.name, unit: unitOf(foodCtx.selected), ...foodCtx.selected.per100 };
      foodCtx.mode = "custom"; foodCtx.error = null; render(); window.scrollTo(0, 0);
      break;
    case "food-custom-cancel": foodCtx.mode = "search"; foodCtx.error = null; render(); break;
    case "food-remove":
      state = removeFoodEntry(state, t.dataset.day, t.dataset.id, new Date());
      persist();
      { const y = window.scrollY; render(); window.scrollTo(0, y); }
      break;
    case "plan-cancel": pendingPlan = null; editing = null; render(); break;
    case "plan-open": {
      const plan = activeDietPlan(state);
      if (!plan) break;
      const tab = window.open("", "_blank"); // abre já, no toque, para o navegador não bloquear
      sync.planUrl(plan.path)
        .then((url) => { if (tab) tab.location.href = url; else window.location.href = url; })
        .catch(() => { tab?.close(); alert("Não foi possível abrir o PDF agora."); });
      break;
    }
    case "plan-remove": {
      const plan = activeDietPlan(state);
      if (plan && confirm("Remover o PDF da sua conta? As refeições cadastradas continuam.")) {
        sync.removePlan(plan.path)
          .then(() => { state = clearDietPlan(state, new Date()); persist(); render(); })
          .catch(() => alert("Não foi possível remover o PDF agora."));
      }
      break;
    }
    case "onb-pick": {
      const { field, value } = t.dataset;
      // Mudar uma resposta anterior invalida as seguintes, que dependem dela.
      if (field === "gender" && onb.gender !== value) { onb.goal = null; onb.emphasis = null; onb.showAll = false; }
      if (field === "goal" && onb.goal !== value) onb.emphasis = null;
      onb[field] = value;
      onb.step = nextStep(onb.step);
      render(); window.scrollTo(0, 0);
      break;
    }
    case "onb-more": onb.showAll = true; render(); break;
    case "onb-back": onb.step = prevStep(onb.step); render(); window.scrollTo(0, 0); break;
    case "onb-skip":
      // Se a pessoa já digitou o nome nesta tela, guarda mesmo pulando o resto.
      state = { ...state, profile: skippedProfile(new Date(), app.querySelector('input[name="name"]')?.value ?? onb?.name) };
      persist(); onb = null; view = "home"; render(); window.scrollTo(0, 0);
      break;
    case "onb-finish":
      state = { ...state, profile: buildProfile(onb, new Date()) };
      chosenKey = state.profile.start;
      persist(); onb = null; view = "home"; render(); window.scrollTo(0, 0);
      break;
    case "onb-restart":
      onb = freshOnboarding(state.profile?.name ?? ""); view = "onboarding"; render(); window.scrollTo(0, 0);
      break;
    case "habit-tab":
      habitTab = t.dataset.tab;
      { const y = window.scrollY; render(); window.scrollTo(0, y); }
      break;
    case "med-new": editing = { type: "med", id: null }; render(); window.scrollTo(0, 0); break;
    case "med-edit": editing = { type: "med", id: t.dataset.id }; render(); window.scrollTo(0, 0); break;
    case "meal-new": editing = { type: "meal", id: null }; render(); window.scrollTo(0, 0); break;
    case "meal-edit": editing = { type: "meal", id: t.dataset.id }; render(); window.scrollTo(0, 0); break;
    case "med-cancel":
    case "meal-cancel":
      editing = null; render();
      break;
    case "med-delete": {
      const med = activeMeds(state).find((m) => m.id === t.dataset.id);
      if (med && confirm(`Apagar "${med.name}"? O histórico de doses dele deixa de contar na adesão.`)) {
        state = removeMed(state, med.id, new Date()); persist(); render();
      }
      break;
    }
    case "meal-delete": {
      const meal = activeMeals(state).find((m) => m.id === t.dataset.id);
      if (meal && confirm(`Apagar "${meal.name}"?`)) {
        state = removeMeal(state, meal.id, new Date()); persist(); render();
      }
      break;
    }
    case "go":
      editing = null;
      if (t.dataset.view === "nutri") nutriDay = null;
      view = t.dataset.view; render(); window.scrollTo(0, 0);
      if (view === "workout") keepAwake(true); // voltando para um treino em andamento
      break;
    case "leave":
      view = "home"; render(); keepAwake(false); stopRest(); // rascunho continua salvo
      break;
    case "pause": {
      const frame = t.closest(".frame");
      frame.classList.toggle("paused");
      t.textContent = frame.classList.contains("paused") ? "Animar" : "Pausar";
      break;
    }
    case "check": {
      const set = state.draft.entries[id].sets[i];
      if (!set.done && set.reps == null) set.reps = EXERCISES[id].repMax; // marcou sem digitar: assume o alvo
      set.done = !set.done;
      persist();
      const y = window.scrollY;
      render(); window.scrollTo(0, y);
      if (set.done) startRest();
      break;
    }
    case "finish":
      try {
        state = finishSession(state, state.draft, new Date());
        persist(); stopRest(); keepAwake(false);
        view = "home"; render(); window.scrollTo(0, 0);
      } catch (err) {
        alert(err.message);
      }
      break;
    case "discard":
      if (confirm("Descartar este treino? As séries marcadas serão perdidas.")) {
        state = { ...state, draft: null };
        persist(); stopRest(); keepAwake(false);
        view = "home"; render();
      }
      break;
  }
});

app.addEventListener("change", (e) => {
  const t = e.target;
  const { action, id } = t.dataset;
  const i = Number(t.dataset.i);
  if (!state.draft || !id) return;

  if (action === "reps" || action === "kg") {
    const parsed = action === "reps" ? parseReps(t.value) : parseKg(t.value);
    const empty = t.value.trim() === "";
    t.setAttribute("aria-invalid", String(!empty && parsed === null));
    if (empty || parsed !== null) {
      const sets = state.draft.entries[id].sets;
      sets[i][action] = empty ? null : parsed;
      // Peso digitado na série 1 propaga para as seguintes vazias. Economiza digitação.
      if (action === "kg" && parsed !== null) sets.forEach((s, j) => { if (j > i && !s.done) s.kg = parsed; });
      persist();
      if (action === "kg") {
        document.querySelectorAll(`input[data-action="kg"][data-id="${id}"]`).forEach((el) => {
          const j = Number(el.dataset.i);
          if (j > i) el.value = fmtKg(sets[j].kg);
        });
      }
    }
  }

  if (action === "level") {
    state.draft.entries[id].level = Number(t.value);
    state = { ...state, levels: { ...state.levels, [id]: Number(t.value) } };
    persist();
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }
});

// O logo leva para a tela inicial. No login e no onboarding ele não faz nada, para ninguém pular essas etapas sem querer.
document.querySelector(".brand-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  if (view === "login" || view === "onboarding" || view === "home") { if (view === "home") window.scrollTo(0, 0); return; }
  if (view === "workout") { keepAwake(false); stopRest(); } // o treino em andamento fica salvo e aparece como cartão na home
  editing = null; pendingPlan = null;
  view = "home"; render(); window.scrollTo(0, 0);
});

// ---------- Conta e sincronização ----------

// Junta o que está neste aparelho com o que está no Supabase e grava o resultado nos dois lados.
async function reconcile() {
  try {
    const remote = await sync.pull();
    const merged = mergeStates(state, remote);
    const changedHere = JSON.stringify(merged) !== JSON.stringify(state);
    state = merged;
    if (changedHere) store.save(state);
    if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) await sync.push(state);
    if (view === "workout" && !state.draft) view = "home";
    if (changedHere && view !== "login") render();
  } catch (err) {
    console.warn("Não foi possível sincronizar agora. O app segue com os dados deste aparelho.", err);
  }
}

app.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-action='login']");
  if (!form) return;
  e.preventDefault();
  const mode = e.submitter?.value ?? "signin";
  const data = new FormData(form);
  const email = String(data.get("email")).trim();
  const password = String(data.get("password"));
  if (!email || password.length < 8) return renderLogin("Informe o e-mail e uma senha de pelo menos 8 caracteres.", { email });
  try {
    if (mode === "signup") {
      const needsConfirmation = await sync.signUp(email, password);
      if (needsConfirmation) return renderLogin("", { email, sent: true });
    } else {
      await sync.signIn(email, password);
    }
    await reconcile();
    enterApp();
    render(); window.scrollTo(0, 0);
  } catch (err) {
    renderLogin(loginError(err), { email });
  }
});

app.addEventListener("submit", async (e) => {
  const planForm = e.target.closest("form[data-action='plan-save']");
  if (!planForm) return;
  e.preventDefault();
  const fd = new FormData(planForm);
  // Cada refeição marcada vai com o texto como ficou na revisão, já corrigido pela pessoa se ela quis.
  const chosen = fd.getAll("meal").map((i) => ({ name: editing.meals[Number(i)].name, text: String(fd.get(`text-${i}`) ?? "") }));
  const store = fd.get("store") === "on" && pendingPlan?.file;
  const msg = planForm.querySelector(".login-msg");
  const button = planForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    let next = state;
    if (chosen.length) next = importMeals(next, chosen, new Date(), newId).state;
    if (store) {
      msg.textContent = "Enviando o PDF...";
      const path = await sync.uploadPlan(pendingPlan.file);
      next = setDietPlan(next, { name: pendingPlan.file.name, size: pendingPlan.file.size, path }, new Date());
    }
    state = next; // só aplica no fim: se o envio falhar, nada fica pela metade
    persist(); pendingPlan = null; editing = null;
    render(); window.scrollTo(0, 0);
  } catch (err) {
    button.disabled = false;
    msg.textContent = `Não foi possível guardar o PDF agora. ${err.message ?? ""}`.trim();
  }
});

app.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-action='nutri-save'], form[data-action='food-save'], form[data-action='food-custom-save']");
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const now = new Date();
  if (form.dataset.action === "nutri-save") {
    const values = {
      heightCm: fd.get("heightCm"), birthYear: fd.get("birthYear"), activity: fd.get("activity"), goal: fd.get("goal"),
      formula: fd.get("formula"), microRef: fd.get("microRef"), kcalManual: fd.get("kcalManual"), hideNumbers: fd.get("hideNumbers") === "on",
    };
    const check = dailyTargets(values, latestWeightKg(state), now);
    if (!check.ok) { setupDraft = { values, errors: check.errors }; render(); window.scrollTo(0, 0); return; }
    state = saveNutrition(state, values, now);
    persist(); setupDraft = null; view = "nutri"; render(); window.scrollTo(0, 0);
    return;
  }
  if (form.dataset.action === "food-custom-save") {
    const raw = Object.fromEntries(fd.entries());
    try {
      const id = newId();
      state = saveCustomFood(state, raw, id, now);
      persist();
      foodCtx.selected = activeCustomFoods(state).find((f) => f.id === `custom:${id}`);
      foodCtx.mode = "search"; foodCtx.error = null; foodCtx.g = "100";
    } catch (err) { foodCtx.custom = raw; foodCtx.error = err.message; }
    render(); window.scrollTo(0, 0);
    return;
  }
  // food-save
  try {
    foodCtx.g = String(fd.get("g") ?? "");
    foodCtx.mealId = fd.get("mealId") || null;
    state = addFoodEntry(state, { mealId: foodCtx.mealId, name: foodCtx.selected.name, per100: foodCtx.selected.per100, g: foodCtx.g, unit: unitOf(foodCtx.selected) }, foodCtx.day, newId(), now);
    persist();
    view = foodCtx.from === "nutri" ? "nutri" : "diet"; foodCtx = null;
  } catch (err) { foodCtx.error = err.message; }
  render(); window.scrollTo(0, 0);
});

app.addEventListener("input", (e) => {
  if (view !== "food" || !foodCtx) return;
  if (e.target.id === "food-q") {
    foodCtx.query = e.target.value;
    document.getElementById("food-results").innerHTML = tacoFoods || activeCustomFoods(state).length
      ? renderFoodResults(allFoods(), foodCtx.query, state.nutrition?.hideNumbers === true) : `<p class="small">Carregando a tabela de alimentos...</p>`;
  } else if (e.target.id === "food-g" && foodCtx.selected) {
    foodCtx.g = e.target.value;
    document.getElementById("food-preview").innerHTML = foodPreview(foodCtx.selected.per100, foodCtx.g, state.nutrition?.hideNumbers === true, unitOf(foodCtx.selected));
  }
});

app.addEventListener("submit", (e) => {
  const nameForm = e.target.closest("form[data-action='onb-name']");
  if (!nameForm) return;
  e.preventDefault();
  onb.name = cleanName(new FormData(nameForm).get("name")) ?? "";
  onb.step = nextStep(onb.step);
  render(); window.scrollTo(0, 0);
});

app.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-action='med-save'], form[data-action='meal-save']");
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const msg = form.querySelector(".login-msg");
  try {
    if (form.dataset.action === "med-save") {
      state = saveMed(state, {
        name: fd.get("name"), dose: fd.get("dose"), kind: fd.get("kind"),
        times: fd.getAll("times"), every: { n: fd.get("n"), unit: fd.get("unit") },
      }, editing?.id ?? newId(), new Date());
    } else {
      state = saveMeal(state, { name: fd.get("name"), text: fd.get("text") }, editing?.id ?? newId(), new Date());
    }
    persist();
    editing = null;
    render(); window.scrollTo(0, 0);
  } catch (err) {
    msg.textContent = err.message;
  }
});

app.addEventListener("change", async (e) => {
  if (e.target.dataset.action === "plan-file") {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    try { validatePdf(file); } catch (err) { alert(err.message); return; }
    pendingPlan = { file };
    editing = { type: "plan", loading: true };
    render(); window.scrollTo(0, 0);
    let found = [];
    let note = "";
    try {
      const items = await extractLayout(new Uint8Array(await file.arrayBuffer()), await loadPdfjs());
      found = mealsFromLayout(items);
      if (!items.length) note = "Esse PDF não tem texto que dê para ler (pode ser uma foto). Guarde o arquivo e cadastre as refeições à mão.";
    } catch (err) {
      console.warn("Não foi possível ler o PDF.", err);
      note = "Não consegui ler o PDF agora. Você ainda pode guardar o arquivo e cadastrar as refeições à mão.";
    }
    const have = new Set(activeMeals(state).map((m) => m.name.toLowerCase()));
    editing = {
      type: "plan", note, canStore: sync.signedIn(),
      meals: found.filter((m) => !have.has(m.name.toLowerCase())), skipped: found.filter((m) => have.has(m.name.toLowerCase())).map((m) => m.name),
    };
    render();
    return;
  }  if (e.target.name !== "kind") return;
  const form = e.target.closest("form");
  const interval = e.target.value === "interval";
  form.querySelector(".kind-daily").hidden = interval;
  form.querySelector(".kind-interval").hidden = !interval;
});

app.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-action='weight']");
  if (!form) return;
  e.preventDefault();
  const kg = parseWeight(new FormData(form).get("kg"));
  if (kg === null) return renderWeight("Digite o peso em kg, por exemplo 68,4.");
  state = setWeight(state, kg, new Date());
  persist();
  renderWeight("Peso salvo.", true);
});

app.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-action]");
  const kind = form?.dataset.action;
  if (kind !== "forgot" && kind !== "newpassword") return;
  e.preventDefault();
  if (kind === "forgot") {
    const email = String(new FormData(form).get("email")).trim();
    if (!email) return renderForgot("Informe o e-mail da conta.", { email });
    try {
      await sync.resetPassword(email);
      renderForgot("", { email, sent: true });
    } catch (err) {
      renderForgot(loginError(err), { email });
    }
    return;
  }
  const password = String(new FormData(form).get("password"));
  if (password.length < 8) return renderNewPassword("A senha precisa ter pelo menos 8 caracteres.");
  try {
    await sync.updatePassword(password);
    await reconcile();
    enterApp();
    render(); window.scrollTo(0, 0);
  } catch (err) {
    renderNewPassword(loginError(err));
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && sync.signedIn() && !sync.isRecovery() && view !== "workout") reconcile();
});

async function boot() {
  render();
  if (view === "workout") keepAwake(true);
  if (!sync.enabled) { if (needsOnboarding(state) && !state.draft) { enterApp(); render(); } return; }
  try {
    const user = await sync.start();
    if (user && sync.isRecovery()) { view = "newpassword"; render(); }
    else if (user) { await reconcile(); if (needsOnboarding(state) && !state.draft) enterApp(); render(); }
    else { view = "login"; renderLogin(sync.linkExpired() ? "O link expirou. Toque em Esqueci minha senha para receber outro." : ""); }
  } catch (err) {
    console.warn("Sem conexão com o servidor. O app segue com os dados deste aparelho.", err);
  }
}
initChat(() => {
  const now = new Date();
  return {
    done: weeklyCounts(state, now, 1)[0].count,
    goal: weeklyGoal(state),
    streak: weekStreak(state, now),
    weightDue: !weightLoggedThisWeek(state, now),
    name: state.profile?.name ?? null,
  };
});

boot();
