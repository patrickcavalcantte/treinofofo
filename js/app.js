import { EXERCISES, WORKOUTS, REST_SECONDS, WEEKLY_GOAL, CARDIO } from "./data.js";
import {
  createStore, nextWorkoutKey, restWarning, newDraft, draftProgress,
  finishSession, evaluateSets, lastEntryFor, imageFor, displayName, parseReps, parseKg,
  startOfWeek, dayKey, trainedDays, toggleMark, weeklyCounts, weekStreak,
} from "./logic.js";

const app = document.getElementById("app");
const store = createStore(safeLocalStorage());
let state = store.load();
let view = state.draft ? "workout" : "home";
let chosenKey = null; // permite trocar A/B manualmente na home

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

function persist() {
  if (!store.save(state)) console.warn("Não foi possível salvar. O progresso fica só nesta aba.");
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
      <button class="cta ghost" data-action="go" data-view="history">Histórico</button>
    </div>
  `;
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
  if (view === "workout" && state.draft) renderWorkout();
  else if (view === "history") renderHistory();
  else if (view === "guide") renderGuide();
  else if (view === "habit") renderHabit();
  else { view = "home"; renderHome(); }
}

// ---------- Timer de descanso ----------

const restEl = document.getElementById("rest");
const restTime = document.getElementById("rest-time");
let restEnd = 0;
let restTick = null;

function startRest(seconds = REST_SECONDS) {
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

render();
if (view === "workout") keepAwake(true);
