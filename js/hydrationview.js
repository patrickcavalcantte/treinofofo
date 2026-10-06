// Tela de hidratação. Só monta HTML; os eventos ficam em app.js.
import { esc } from "./dom.js";
import {
  ML_PER_KG, WORKOUT_EXTRA_ML, MIN_GOAL_ML, MAX_GOAL_ML, QUICK_ML, MAX_SINGLE_ML, HYDRATION_DISCLAIMER, HYDRATION_SOURCE,
  fmtVolume, waterGoal, waterEntries, waterTotal, waterStatus, waterWeek,
} from "./hydration.js";

const STATUS_TEXT = { falta: "Ainda falta bastante", quase: "Está chegando lá", "na-meta": "Meta batida", acima: "Acima da meta", "sem-meta": "" };

const clock = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Texto "Faltam 1,3 L" ou "Meta batida", a partir do total e da meta. */
export function remainingText(total, goal) {
  if (total >= goal) return total > goal * 1.3 ? "Acima da meta" : "Meta batida";
  return `Faltam ${fmtVolume(goal - total)}`;
}

/** Resumo para o cartão da home: { value, label }. */
export function waterCard(state, now, key) {
  const goal = waterGoal(state, now);
  const total = waterTotal(state, key);
  if (!goal.ok) return { value: total ? fmtVolume(total) : "–", label: total ? "registrado hoje" : "registre o peso para a meta" };
  return { value: fmtVolume(total), label: `de ${fmtVolume(goal.ml)} hoje` };
}

function weekBars(week) {
  return `<div class="water-week" role="img" aria-label="Água nos últimos 7 dias: ${week.map((d) => (d.pct === null ? "sem meta" : `${d.pct}%`)).join(", ")}">
    ${week.map((d, i) => `<div class="water-day ${i === week.length - 1 ? "today" : ""}">
      <div class="water-bar"><span class="${d.pct !== null && d.pct >= 100 ? "full" : ""}" style="height:${Math.min(100, d.pct ?? 0)}%"></span></div>
      <span class="small">${esc(d.label)}</span></div>`).join("")}
  </div>`;
}

export function renderWater(state, now, key) {
  const goal = waterGoal(state, now);
  const total = waterTotal(state, key);
  const entries = waterEntries(state, key);
  const pct = goal.ok ? Math.min(100, Math.round((total / goal.ml) * 100)) : 0;
  const manual = goal.ok && goal.source === "manual";

  const how = !goal.ok ? "" : manual
    ? `<p class="small">Você digitou a meta de ${fmtVolume(goal.ml)}.</p>`
    : `<p class="small">${ML_PER_KG} ml por kg de peso (${String(goal.weightKg).replace(".", ",")} kg), arredondado para 50 ml: <strong>${fmtVolume(goal.base)}</strong>.
        ${goal.extra ? ` Hoje você treinou, então somamos ${fmtVolume(WORKOUT_EXTRA_ML)}.` : ` Em dia de treino concluído no app, somamos ${fmtVolume(WORKOUT_EXTRA_ML)}.`}
        A meta fica entre ${fmtVolume(MIN_GOAL_ML)} e ${fmtVolume(MAX_GOAL_ML)}.</p>`;

  return `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Hidratação</h1>

    ${goal.ok ? `
      <div class="ring-wrap"><div class="ring water" style="--pct:${pct}" role="img" aria-label="Água de hoje: ${esc(fmtVolume(total))} de ${esc(fmtVolume(goal.ml))}">
        <div class="ring-inner"><strong>${esc(fmtVolume(total))}</strong><span class="small">de ${esc(fmtVolume(goal.ml))}</span></div>
      </div></div>
      <p class="budget-line" role="status"><strong>${esc(remainingText(total, goal.ml))}</strong><br><span class="small">${esc(STATUS_TEXT[waterStatus(total, goal.ml)])}</span></p>` : `
      <p class="notice">Para calcular a sua meta, o app usa o seu peso. <button class="switch" type="button" data-action="go" data-view="weight">Registrar peso</button></p>
      ${total ? `<p class="lede">Hoje: ${esc(fmtVolume(total))}</p>` : ""}`}

    <h2 class="section">Adicionar</h2>
    <div class="water-quick" role="group" aria-label="Adicionar água">
      ${QUICK_ML.map((ml) => `<button type="button" class="chip" data-action="water-add" data-ml="${ml}">+ ${ml} ml</button>`).join("")}
    </div>
    <form class="water-custom" data-action="water-custom" novalidate>
      <label class="field-block">Outra quantidade (ml)
        <input name="ml" inputmode="numeric" autocomplete="off" placeholder="ex.: 350" aria-describedby="water-max">
      </label>
      <button class="cta ghost" type="submit">Adicionar</button>
    </form>
    <p class="small" id="water-max" style="margin:0.5rem 0 0">Até ${fmtVolume(MAX_SINGLE_ML)} por registro. Conta água, chá, café, suco e outros líquidos.</p>
    <p class="login-msg" id="water-msg" role="status"></p>

    <h2 class="section">Hoje</h2>
    ${entries.length ? `<ul class="food-list">${entries.map((e) => `
      <li><span>${esc(fmtVolume(e.ml))} <span class="small">${esc(clock(e.at))}</span></span>
        <button type="button" class="switch danger" data-action="water-remove" data-day="${esc(key)}" data-id="${esc(e.id)}" aria-label="Remover ${esc(fmtVolume(e.ml))} das ${esc(clock(e.at))}">Remover</button></li>`).join("")}</ul>` : `<p class="small">Nada registrado hoje.</p>`}

    <h2 class="section">Últimos 7 dias</h2>
    ${weekBars(waterWeek(state, now, 7))}
    <p class="small">Cada barra mostra quanto da meta base você bebeu no dia. Barra verde: meta batida.</p>

    <details class="how"><summary>Como a meta é calculada</summary>
      ${how}
      <p class="small">A altura não entra na conta: as referências de hidratação se baseiam no peso e no nível de atividade, e não na altura.</p>
    </details>

    <h2 class="section">Minha meta</h2>
    <form class="login" data-action="water-goal" novalidate>
      <label class="field-block">Digitar a minha meta (ml, opcional)
        <input name="goalMl" inputmode="numeric" autocomplete="off" placeholder="deixe vazio para usar o cálculo" value="${esc(state.hydration?.goalMl ?? "")}">
      </label>
      <button class="cta ghost" type="submit">Salvar meta</button>
    </form>

    <p class="disclaimer" role="note"><strong>Importante:</strong> ${esc(HYDRATION_DISCLAIMER)}</p>
    <p class="small">${esc(HYDRATION_SOURCE)}</p>
  `;
}
