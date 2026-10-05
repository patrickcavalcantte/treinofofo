import { EXERCISES, WORKOUTS, REST_SECONDS, WEEKLY_GOAL, CARDIO } from "./data.js";
import {
  createStore, nextWorkoutKey, restWarning, newDraft, draftProgress,
  finishSession, evaluateSets, lastEntryFor, imageFor, displayName, parseReps, parseKg,
  startOfWeek, dayKey, trainedDays, toggleMark, weeklyCounts, weekStreak, mergeStates, parseWeight, setWeight, weightLoggedThisWeek,
} from "./logic.js";
import * as sync from "./sync.js";
import { initChat } from "./chatui.js";
import { GOOGLE_LOGIN } from "./config.js";

const app = document.getElementById("app");
const store = createStore(safeLocalStorage());
let state = store.load();
let view = state.draft ? "workout" : "home";
let chosenKey = null; // permite trocar A/B manualmente na home

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

function persist() {
  state = { ...state, savedAt: new Date().toISOString() };
  if (!store.save(state)) console.warn("Não foi possível salvar. O progresso fica só nesta aba.");
  sync.schedulePush(state, (err) => console.warn("Não foi possível sincronizar agora.", err));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const img = (folder, n) => `assets/ex/${encodeURIComponent(folder)}/${n}.jpg`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const fmtKg = (kg) => (kg ?? "") === "" ? "" : String(kg).replace(".", ",");

// ---------- Views ----------

function renderHome() {
  const key = chosenKey ?? nextWorkoutKey(state.history);
  const other = key === "A" ? "B" : "A";
  const w = WORKOUTS[key];
  const now = new Date();
  const done = weeklyCounts(state, now, 1)[0].count;
  const streak = weekStreak(state, now);
  const warning = restWarning(state.history, new Date());

  const plates = Array.from({ length: WEEKLY_GOAL }, (_, i) =>
    `<span class="plate ${i < done ? "full" : ""}" aria-hidden="true"></span>`).join("");

  app.innerHTML = `
    <h1 class="display">${esc(w.title)}</h1>
    <p class="lede">${esc(w.focus)}</p>

    <div class="week" role="img" aria-label="${done} de ${WEEKLY_GOAL} treinos nesta semana">
      ${plates}<span class="week-text">${Math.min(done, 99)} de ${WEEKLY_GOAL} na semana</span>
    </div>

    ${warning ? `<p class="notice">${esc(warning)}</p>` : ""}
    ${weightLoggedThisWeek(state, now) ? "" : `<p class="notice">${now.getDay() === 1 ? "Hoje é dia de pesagem." : "A pesagem da semana ainda não foi feita."} Suba na balança de manhã, em jejum e depois de ir ao banheiro. <button class="switch" data-action="go" data-view="weight">Registrar peso</button></p>`}

    <button class="cta" data-action="start" data-key="${key}">Começar ${esc(w.title)}</button>
    <button class="switch" data-action="switch" data-key="${other}">Fazer o treino ${other} hoje</button>

    <ul class="preview">
      <li><span>${esc(CARDIO.name)}</span><span>${CARDIO.minutes} min</span></li>
      ${w.exercises.map((id) => {
        const ex = EXERCISES[id];
        return `<li><span>${esc(ex.name)}</span><span>${ex.sets} × ${ex.repMin} a ${ex.repMax}</span></li>`;
      }).join("")}
    </ul>

    <button class="cta ghost habit-link" data-action="go" data-view="habit">Hábito${streak > 0 ? ` · ${streak} ${streak === 1 ? "semana" : "semanas"} na meta` : ""}</button>

    <div class="links">
      <button class="cta ghost" data-action="go" data-view="guide">Antes de começar</button>
      <button class="cta ghost" data-action="go" data-view="weight">Peso</button>
      <button class="cta ghost" data-action="go" data-view="history">Histórico</button>
    </div>

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

function renderHistory() {
  const items = [...state.history].reverse();
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Histórico</h1>
    ${items.length ? `<ul class="history">${items.map((s) => {
      const lines = Object.entries(s.entries)
        .filter(([, e]) => e.sets.some((x) => x.done))
        .map(([id, e]) => `${esc(displayName(id, e.level))}: ${e.sets.filter((x) => x.done).map((x) => x.reps).join(", ")}`);
      return `<li><strong>${esc(WORKOUTS[s.workout].title)}</strong> <span class="small">${esc(fmtDate(s.date))}</span>
        <p class="small" style="margin:.375rem 0 0">${lines.join("<br>")}</p></li>`;
    }).join("")}</ul>` : `<p class="lede">Nenhum treino concluído ainda. O primeiro aparece aqui assim que você terminar.</p>`}
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
  const max = Math.max(WEEKLY_GOAL, 7, ...real.map((w) => w.count));
  const x = (i) => PAD.l + (i * (SVG_W - PAD.l - PAD.r)) / (weeks.length - 1);
  const y = (v) => SVG_H - PAD.b - (v * (SVG_H - PAD.t - PAD.b)) / max;
  const pts = weeks.flatMap((w, i) => w.count === null ? [] : [`${x(i).toFixed(1)},${y(w.count).toFixed(1)}`]);
  const label = (w) => w.start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const alt = `Treinos por semana desde ${label(weeks[0])}: ${real.map((w) => w.count).join(", ")}. Meta: ${WEEKLY_GOAL}.`;
  return `
    <svg class="chart" viewBox="0 0 ${SVG_W} ${SVG_H}" role="img" aria-label="${esc(alt)}">
      <line class="goal" x1="${PAD.l}" x2="${SVG_W - PAD.r}" y1="${y(WEEKLY_GOAL)}" y2="${y(WEEKLY_GOAL)}"/>
      <text class="axis" x="${PAD.l - 4}" y="${y(WEEKLY_GOAL) + 3}" text-anchor="end">${WEEKLY_GOAL}</text>
      <text class="axis" x="${PAD.l - 4}" y="${y(0) + 3}" text-anchor="end">0</text>
      <polyline class="line" points="${pts.join(" ")}"/>
      ${weeks.map((w, i) => w.count === null ? "" : `<circle class="dot ${w.count >= WEEKLY_GOAL ? "hit" : ""}" cx="${x(i).toFixed(1)}" cy="${y(w.count).toFixed(1)}" r="3.5"/>`).join("")}
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

function renderHabit() {
  const now = new Date();
  const done = weeklyCounts(state, now, Math.min(weeksSinceStart(now), CHART_SLOTS));
  const weeks = [...done];
  while (weeks.length < 6) { // espaço reservado para as próximas semanas
    const next = new Date(weeks[weeks.length - 1].start); next.setDate(next.getDate() + 7);
    weeks.push({ start: next, count: null });
  }
  const streak = weekStreak(state, now);
  const total = trainedDays(state).size;
  const best = Math.max(...done.map((w) => w.count));
  app.innerHTML = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Hábito</h1>
    <p class="lede">${streak > 0
      ? `${streak} ${streak === 1 ? "semana seguida" : "semanas seguidas"} batendo a meta de ${WEEKLY_GOAL} treinos.`
      : `Meta: ${WEEKLY_GOAL} treinos por semana. A sequência começa quando você fechar a primeira semana.`}</p>

    <div class="stats">
      <div><strong>${streak}</strong><span>semanas na meta</span></div>
      <div><strong>${total}</strong><span>treinos no total</span></div>
      <div><strong>${best}</strong><span>melhor semana</span></div>
    </div>

    <h2 class="section">Treinos por semana</h2>
    ${renderChart(weeks)}

    <h2 class="section">Calendário</h2>
    <p class="small" style="margin:0 0 .75rem">Treinos concluídos no app entram sozinhos. Treinou fora do app? Toque no dia para marcar.</p>
    ${renderCalendar(now)}
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
  else if (view === "newpassword") renderNewPassword();
  else if (view === "workout" && state.draft) renderWorkout();
  else if (view === "history") renderHistory();
  else if (view === "guide") renderGuide();
  else if (view === "habit") renderHabit();
  else if (view === "weight") renderWeight();
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
    case "go":
      view = t.dataset.view; render(); window.scrollTo(0, 0);
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
    view = state.draft ? "workout" : "home";
    await reconcile();
    render();
  } catch (err) {
    renderLogin(loginError(err), { email });
  }
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
    view = state.draft ? "workout" : "home";
    await reconcile();
    render();
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
  if (!sync.enabled) return;
  try {
    const user = await sync.start();
    if (user && sync.isRecovery()) { view = "newpassword"; render(); }
    else if (user) { await reconcile(); render(); }
    else { view = "login"; renderLogin(sync.linkExpired() ? "O link expirou. Toque em Esqueci minha senha para receber outro." : ""); }
  } catch (err) {
    console.warn("Sem conexão com o servidor. O app segue com os dados deste aparelho.", err);
  }
}
initChat(() => {
  const now = new Date();
  return {
    done: weeklyCounts(state, now, 1)[0].count,
    goal: WEEKLY_GOAL,
    streak: weekStreak(state, now),
    weightDue: !weightLoggedThisWeek(state, now),
  };
});

boot();
