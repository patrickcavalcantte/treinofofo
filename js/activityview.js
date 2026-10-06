// Tela de atividades físicas. Só monta HTML; os eventos ficam em app.js.
import { esc } from "./dom.js";
import {
  TABLES, CREDIT_OPTIONS, MIN_MINUTES, MAX_MINUTES, ACTIVITY_SOURCE, ACTIVITY_DISCLAIMER,
  activityPrefs, activityEntries, activityTotals, activityCredit, activityKcal, favoriteList, searchActivities,
} from "./activities.js";

const MAX_RESULTS = 40;
const QUICK_MIN = [15, 30, 45, 60];
const clock = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const met = (v) => String(v).replace(".", ",");

/** Resumo para o cartão da home: { value, label }. */
export function activityCard(state, key) {
  const t = activityTotals(state, key);
  if (!t.count) return { value: "–", label: "registre uma atividade" };
  return { value: `${t.minutes} min`, label: `${t.kcal} kcal gastas hoje` };
}

/** Prévia de gasto de uma atividade escolhida, para o formulário. */
export function activityPreview(activity, minutes, kg) {
  const min = Number(String(minutes).replace(",", "."));
  if (!activity || !Number.isFinite(min) || min < MIN_MINUTES) return `<p class="small">Digite a duração (a partir de ${MIN_MINUTES} min).</p>`;
  if (!kg) return `<p class="small">Registre o seu peso para ver o gasto.</p>`;
  const kcal = activityKcal({ met: activity.met, minutes: min, kg, factor: TABLES[activity.table].factor });
  return `<p class="budget-line"><strong>≈ ${kcal} kcal</strong><br><span class="small">gasto além do repouso, em ${Math.round(min)} min</span></p>`;
}

/** Resumo do dia em poucas linhas, com as favoritas, sem botões. Usado no tour. */
export function activityGlance(state, key) {
  const t = activityTotals(state, key);
  const entries = activityEntries(state, key);
  const favs = (state.favActivities ?? []).filter((f) => !f.deleted && f.alias);
  return `
    <p class="budget-line"><strong>${t.kcal} kcal gastas · ${t.minutes} min</strong><br><span class="small">Crédito de ${activityCredit(state, key)} kcal na meta de hoje.</span></p>
    ${favs.length ? `<div class="water-quick">${favs.map((f) => `<span class="chip">★ ${esc(f.alias)}</span>`).join("")}</div>` : ""}
    <ul class="food-list">${entries.map((e) => `<li><span>${esc(e.name)} <span class="small">${e.minutes} min · ${e.kcal} kcal</span></span></li>`).join("")}</ul>`;
}

function item(a, label) {
  return `<li><button type="button" class="food-pick" data-action="act-pick" data-code="${esc(a.code)}" data-table="${esc(a.table)}" data-label="${esc(label ?? "")}">
    <span>${esc(label ?? a.pt)}</span><span class="small">${esc(a.group)} · ${met(a.met)} MET</span></button></li>`;
}

/** Lista de resultados da busca (também usada quando a pessoa digita). */
export function renderActivityResults(items, query) {
  const found = searchActivities(items, query);
  if (!found.length) return `<p class="small">Nada encontrado. Tente outra palavra, como "dança", "caminhada" ou "limpeza".</p>`;
  const shown = found.slice(0, MAX_RESULTS);
  return `<ul class="food-results">${shown.map((a) => item(a)).join("")}</ul>
    ${found.length > shown.length ? `<p class="small">Mostrando ${shown.length} de ${found.length}. Digite mais letras para afinar.</p>` : ""}
    ${norm(query) ? `<p class="small">Não achou exatamente a sua? Escolha a mais parecida e salve como favorita com o seu nome. O valor usado é o da atividade oficial.</p>` : ""}`;
}

function settings(state) {
  const p = activityPrefs(state);
  return `<details class="how"><summary>Como o gasto vira crédito</summary>
    <p class="small">O gasto é calculado por MET (quanto a atividade pede em relação ao repouso), pelo seu peso e pelo tempo. Descontamos o repouso, que já está na sua meta, e o que sobra soma na meta de calorias do dia.</p>
    <form class="login" data-action="act-prefs" novalidate>
      <label class="field-block">Tabela de referência
        <select name="table">${Object.entries(TABLES).map(([id, t]) => `<option value="${id}" ${p.table === id ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
      </label>
      <label class="field-block">Quanto do gasto vira crédito
        <select name="creditPct">${CREDIT_OPTIONS.map((n) => `<option value="${n}" ${p.creditPct === n ? "selected" : ""}>${n}%${n === 100 ? " (tudo)" : ""}</option>`).join("")}</select>
      </label>
      <p class="small">Quem quer ir com mais cuidado pode contar só 50% ou 75%, já que toda estimativa tem margem de erro.</p>
      <button class="cta ghost" type="submit">Salvar</button>
    </form></details>`;
}

export function renderActivities(state, ctx, all, loading, now, key) {
  const prefs = activityPrefs(state);
  const kg = (state.weights ?? []).at(-1)?.kg ?? null;
  const head = `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Atividades</h1>`;
  const items = all?.[prefs.table] ?? [];

  if (ctx.selected) {
    const a = ctx.selected;
    return `${head}
      <button type="button" class="switch" data-action="act-unpick">‹ Escolher outra</button>
      <h2 class="section">${esc(a.label ?? a.pt)}</h2>
      <p class="small">${esc(a.group)} · ${met(a.met)} MET${a.table === "cadeira" ? " · tabela de cadeira de rodas" : ""}</p>
      <form class="login" data-action="act-save" novalidate>
        <label class="field-block">Duração (minutos)
          <input id="act-min" name="minutes" inputmode="numeric" autocomplete="off" placeholder="ex.: 30" value="${esc(ctx.minutes ?? "")}">
        </label>
        <div class="water-quick" role="group" aria-label="Durações rápidas">
          ${QUICK_MIN.map((m) => `<button type="button" class="chip" data-action="act-min" data-min="${m}">${m} min</button>`).join("")}
        </div>
        <div id="act-preview">${activityPreview(a, ctx.minutes, kg)}</div>
        ${ctx.error ? `<p class="login-msg" role="alert">${esc(ctx.error)}</p>` : `<p class="login-msg" role="status"></p>`}
        <button class="cta" type="submit">Registrar</button>
      </form>
      <h2 class="section">Favorita</h2>
      <form class="login" data-action="act-fav" novalidate>
        <label class="field-block">Nome da favorita (opcional)
          <input name="alias" autocomplete="off" maxlength="60" placeholder="ex.: Forró de sábado" value="${esc(ctx.alias ?? "")}">
        </label>
        <button class="cta ghost" type="submit">Salvar como favorita</button>
      </form>
      <p class="small">A favorita usa o mesmo valor de MET da atividade oficial: só o nome muda, para você achar rápido.</p>`;
  }

  const entries = activityEntries(state, key);
  const totals = activityTotals(state, key);
  const credit = activityCredit(state, key);
  const favs = favoriteList(state, all);

  return `${head}
    <p class="lede">Registre o que você fez além do treino do app: caminhada, dança, trilha, faxina, compras. O gasto vira crédito de calorias no dia.</p>
    ${totals.count ? `<p class="budget-line" role="status"><strong>${totals.kcal} kcal gastas · ${totals.minutes} min</strong><br>
      <span class="small">${credit ? `Crédito de ${credit} kcal na meta de hoje (${prefs.creditPct}%).` : "Sem crédito hoje."}</span></p>` : ""}
    ${kg ? "" : `<p class="notice">Para calcular o gasto, o app usa o seu peso. <button class="switch" type="button" data-action="go" data-view="weight">Registrar peso</button></p>`}

    ${favs.length ? `<h2 class="section">Favoritas</h2>
      <ul class="food-results">${favs.map((a) => `<li class="fav-row">${item(a, a.label).replace("<li>", "").replace("</li>", "")}
        <button type="button" class="switch danger" data-action="act-unfav" data-id="${esc(a.favId)}" aria-label="Tirar ${esc(a.label)} das favoritas">Tirar</button></li>`).join("")}</ul>` : ""}

    <h2 class="section">Registrar atividade</h2>
    <label class="field-block">Buscar
      <input id="act-q" type="search" autocomplete="off" placeholder="ex.: forró, escalada, trilha, mercado" value="${esc(ctx.query ?? "")}">
    </label>
    <div id="act-results">${loading ? `<p class="small">Carregando a tabela de atividades...</p>` : renderActivityResults(items, ctx.query)}</div>
    ${ctx.error ? `<p class="login-msg" role="alert">${esc(ctx.error)}</p>` : ""}

    <h2 class="section">Hoje</h2>
    ${entries.length ? `<ul class="food-list">${entries.map((e) => `
      <li><span>${esc(e.name)} <span class="small">${e.minutes} min · ${e.kcal} kcal · ${esc(clock(e.at))}</span></span>
        <button type="button" class="switch danger" data-action="act-remove" data-day="${esc(key)}" data-id="${esc(e.id)}" aria-label="Remover ${esc(e.name)}">Remover</button></li>`).join("")}</ul>` : `<p class="small">Nada registrado hoje.</p>`}

    ${settings(state)}
    <p class="disclaimer" role="note"><strong>Importante:</strong> ${esc(ACTIVITY_DISCLAIMER)}</p>
    <p class="small">${esc(ACTIVITY_SOURCE)}</p>`;
}
