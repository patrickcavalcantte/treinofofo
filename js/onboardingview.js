// Telas do onboarding. Só montam HTML a partir do estado `onb`; os eventos ficam em app.js.
import { esc } from "./dom.js";
import { WORKOUTS } from "./data.js";
import { GENDERS, LEVELS, EMPHASES, SOURCES, EVIDENCE_LIMIT, DISCLAIMER, goalsFor, planFor, defaultEmphasis } from "./onboarding.js";

const STEPS = ["name", "gender", "goal", "level", "emphasis", "result"];

export const freshOnboarding = (name = "") => ({ step: "name", name, gender: null, goal: null, level: null, emphasis: null, showAll: false });
export const prevStep = (step) => STEPS[Math.max(0, STEPS.indexOf(step) - 1)];
export const nextStep = (step) => STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)];

const option = (field, o, selected, tag = "") => `
  <button type="button" class="option" data-action="onb-pick" data-field="${field}" data-value="${esc(o.id)}" aria-pressed="${selected}">
    <strong>${esc(o.label)}</strong>${tag ? `<span class="tag">${esc(tag)}</span>` : ""}${o.desc ? `<span class="small">${esc(o.desc)}</span>` : ""}
  </button>`;

const progress = (n) => `<p class="onb-progress small" aria-label="Passo ${n} de 5">Passo ${n} de 5</p>`;
const back = `<div class="bar"><button class="back" type="button" data-action="onb-back">‹ Voltar</button><span></span></div>`;

export const disclaimerBox = () => `<p class="disclaimer" role="note"><strong>Importante:</strong> ${esc(DISCLAIMER)}</p>`;

function evidenceBox(plan) {
  const used = [...new Set(plan.evidence.flatMap((e) => e.sources))].sort();
  const links = used.map((id) => SOURCES.find((s) => s.id === id)).filter(Boolean)
    .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.short)}</a>`).join(" · ");
  return `
    <section class="evidence" aria-label="O que a pesquisa mostra">
      <h2>O que a pesquisa mostra</h2>
      <ul class="plan-points">${plan.evidence.map((e) => `<li>${esc(e.text)}</li>`).join("")}</ul>
      <p class="small">${esc(EVIDENCE_LIMIT)}</p>
      <p class="small">Fontes: ${links}</p>
    </section>`;
}

export function renderOnboarding(onb) {
  if (onb.step === "name") {
    return `
      <h1 class="display">Vamos montar o seu treino</h1>
      <p class="lede">Responda 5 perguntas rápidas e receba uma sugestão. Você pode refazer quando quiser.</p>
      ${progress(1)}
      <form class="login" data-action="onb-name" novalidate>
        <label class="field-block">Como podemos te chamar?
          <input name="name" type="text" autocomplete="given-name" maxlength="40" placeholder="Seu nome ou apelido" value="${esc(onb.name ?? "")}">
        </label>
        <button class="cta" type="submit">Continuar</button>
      </form>
      ${disclaimerBox()}
      <button type="button" class="switch" data-action="onb-skip">Pular por enquanto</button>`;
  }

  if (onb.step === "gender") {
    return `${back}
      <h1 class="display">Qual é o seu gênero?</h1>
      ${progress(2)}
      <div class="options" role="group" aria-label="Gênero">${GENDERS.map((g) => option("gender", g, onb.gender === g.id)).join("")}</div>`;
  }

  if (onb.step === "goal") {
    return `${back}
      <h1 class="display">Qual é o seu objetivo?</h1>
      ${progress(3)}
      <div class="options" role="group" aria-label="Objetivo">${goalsFor(onb.gender, onb.showAll).map((g) => option("goal", g, onb.goal === g.id)).join("")}</div>
      ${onb.showAll ? "" : `<button type="button" class="switch" data-action="onb-more">Ver todos os objetivos</button>`}`;
  }

  if (onb.step === "level") {
    return `${back}
      <h1 class="display">Como está o seu treino?</h1>
      ${progress(4)}
      <div class="options" role="group" aria-label="Nível">${LEVELS.map((l) => option("level", l, onb.level === l.id)).join("")}</div>`;
  }

  if (onb.step === "emphasis") {
    const suggested = defaultEmphasis(onb.gender, onb.goal);
    return `${back}
      <h1 class="display">Qual ênfase você quer?</h1>
      <p class="lede">Marcamos uma sugestão pelas suas respostas, mas a escolha é sua. Dá para treinar o corpo todo.</p>
      ${progress(5)}
      <div class="options" role="group" aria-label="Ênfase do treino">${Object.entries(EMPHASES).map(([id, e]) => option("emphasis", { id, ...e }, onb.emphasis === id, id === suggested ? "Sugerido para você" : "")).join("")}</div>`;
  }

  const plan = planFor(onb.goal, onb.level, onb.gender, onb.emphasis);
  const workout = WORKOUTS[plan.start];
  return `${back}
    <h1 class="display">Sua sugestão</h1>
    ${disclaimerBox()}
    <section class="plan">
      <p class="small">${esc(plan.goalLabel)}</p>
      <h2>${esc(plan.title)}</h2>
      <p class="plan-meta"><strong>${plan.perWeek} treinos por semana</strong>, começando pelo ${esc(workout.title)} (${esc(workout.focus.toLowerCase())}).</p>
      <ul class="plan-points">${plan.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      ${plan.notes.map((n) => `<p class="plan-note">${esc(n)}</p>`).join("")}
    </section>
    ${evidenceBox(plan)}
    <button class="cta" type="button" data-action="onb-finish">Começar</button>`;
}
