// Telas de remédios e dieta. Só montam HTML a partir do estado; os eventos ficam em app.js.
import { esc } from "./dom.js";
import { entriesOf, kcalBudget, mealKcal } from "./nutrition.js";
import { mealFoodsHtml, num } from "./nutriview.js";
import { parseMealPlan } from "./dietplan.js";
import {
  SLOTS, UNITS, doseHistory, activeMeds, activeMeals, activeDietPlan, todayDoses, intervalStatus, medAdherence, medDay,
  dietAdherence, dietDay, dayKey, startOfWeek,
} from "./logic.js";

const fmtDay = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtShort = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const everyText = ({ n, unit }) => `${n} ${n === 1 ? UNITS[unit] : unit === "month" ? "meses" : `${UNITS[unit]}s`}`;
const pct = (v) => (v === null ? "–" : `${v}%`);

/** Grade das últimas 4 semanas (segunda a domingo). `cellFor(key)` devolve { cls, title }. */
function renderStrip(now, cellFor) {
  const start = startOfWeek(now);
  start.setDate(start.getDate() - 21);
  const today = dayKey(now);
  const names = ["S", "T", "Q", "Q", "S", "S", "D"].map((n) => `<span class="strip-name" aria-hidden="true">${n}</span>`).join("");
  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = dayKey(d);
    if (key > today) return `<span class="strip-cell future" aria-hidden="true"></span>`;
    const { cls, title } = cellFor(key);
    return `<span class="strip-cell ${cls} ${key === today ? "today" : ""}" title="${esc(`${fmtShort(key)}: ${title}`)}" role="img" aria-label="${esc(`${fmtShort(key)}: ${title}`)}"></span>`;
  }).join("");
  return `<div class="strip">${names}${cells}</div>
    <p class="small strip-legend"><span class="strip-cell full"></span> tudo <span class="strip-cell part"></span> em parte <span class="strip-cell miss"></span> nada</p>`;
}

/** "Última: … · Próxima: … (em N dias)" para remédios de intervalo. */
function intervalInfo(st) {
  if (st.status === "primeira") return "Nenhuma dose registrada ainda. Marque quando tomar a próxima.";
  const when = st.daysLeft < 0 ? `(atrasada ${-st.daysLeft} ${-st.daysLeft === 1 ? "dia" : "dias"})`
    : st.daysLeft === 0 ? "(hoje)" : `(em ${st.daysLeft} ${st.daysLeft === 1 ? "dia" : "dias"})`;
  return `Última: ${fmtDay(st.last)} · Próxima: ${fmtDay(st.next)} ${when}`;
}

function stats(a7, a30, note) {
  return `<div class="stats two">
    <div><strong>${pct(a7.pct)}</strong><span>últimos 7 dias</span></div>
    <div><strong>${pct(a30.pct)}</strong><span>últimos 30 dias</span></div>
  </div>${note ? `<p class="small" style="margin:.5rem 0 0">${esc(note)}</p>` : ""}`;
}

// ---------- Remédios ----------

function medForm(med) {
  const kind = med?.kind ?? "daily";
  const every = med?.every ?? { n: 90, unit: "day" };
  return `
    <form class="login med-form" data-action="med-save" novalidate>
      <h2>${med ? "Editar remédio" : "Novo remédio"}</h2>
      <label class="field-block">Nome
        <input name="name" type="text" autocomplete="off" maxlength="80" value="${esc(med?.name ?? "")}" required>
      </label>
      <label class="field-block">Dose (opcional)
        <input name="dose" type="text" autocomplete="off" maxlength="60" placeholder="ex.: 1 comprimido, 50 mg" value="${esc(med?.dose ?? "")}">
      </label>
      <fieldset class="choice">
        <legend>Quando toma</legend>
        <label><input type="radio" name="kind" value="daily" ${kind === "daily" ? "checked" : ""}> Todo dia</label>
        <label><input type="radio" name="kind" value="interval" ${kind === "interval" ? "checked" : ""}> A cada algum tempo (ex.: hormônio)</label>
      </fieldset>
      <fieldset class="choice kind-daily" ${kind === "daily" ? "" : "hidden"}>
        <legend>Em quais horários</legend>
        ${SLOTS.map((s) => `<label><input type="checkbox" name="times" value="${s}" ${(med?.times ?? []).includes(s) ? "checked" : ""}> ${s}</label>`).join("")}
      </fieldset>
      <div class="kind-interval every" ${kind === "interval" ? "" : "hidden"}>
        <label class="field-block">A cada
          <input name="n" type="number" inputmode="numeric" min="1" max="365" value="${every.n}">
        </label>
        <label class="field-block">Unidade
          <select name="unit">
            ${Object.entries(UNITS).map(([u, label]) => `<option value="${u}" ${every.unit === u ? "selected" : ""}>${label === "mês" ? "mês (meses)" : `${label}(s)`}</option>`).join("")}
          </select>
        </label>
      </div>
      <p class="login-msg" role="status"></p>
      <button class="cta" type="submit">${med ? "Salvar alterações" : "Adicionar remédio"}</button>
      <button class="cta ghost" type="button" data-action="med-cancel">Cancelar</button>
    </form>`;
}

export function renderMedsView(state, now, editing) {
  const meds = activeMeds(state);
  const doses = todayDoses(state, now);
  const intervals = meds.filter((m) => m.kind === "interval");
  const today = dayKey(now);
  const a7 = medAdherence(state, now, 7);
  const a30 = medAdherence(state, now, 30);

  const todayHtml = SLOTS.map((slot) => {
    const rows = doses.filter((d) => d.slot === slot);
    if (!rows.length) return "";
    return `<h3 class="slot">${slot}</h3><ul class="dose-list">${rows.map((d) => `
      <li><button type="button" class="dose" data-action="dose" data-med="${esc(d.med.id)}" data-slot="${esc(slot)}" aria-pressed="${d.taken}">
        <span class="dose-check" aria-hidden="true">✓</span>
        <span><strong>${esc(d.med.name)}</strong>${d.med.dose ? ` <span class="small">${esc(d.med.dose)}</span>` : ""}</span>
      </button></li>`).join("")}</ul>`;
  }).join("");

  const intervalsHtml = intervals.map((m) => {
    const st = intervalStatus(state, m, now);
    const takenToday = state.medLog?.[today]?.[`${m.id}|dose`] === true;
    const info = intervalInfo(st);
    return `<li class="interval ${st.status}">
      <div><strong>${esc(m.name)}</strong>${m.dose ? ` <span class="small">${esc(m.dose)}</span>` : ""}
        <p class="small" style="margin:.25rem 0 0">A cada ${everyText(m.every)}</p>
        <p style="margin:.25rem 0 0">${esc(info)}</p></div>
      <button type="button" class="dose-btn" data-action="dose" data-med="${esc(m.id)}" data-slot="dose" aria-pressed="${takenToday}">${takenToday ? "Tomado hoje ✓ (desfazer)" : "Tomei hoje"}</button>
    </li>`;
  }).join("");

  const strip = renderStrip(now, (key) => {
    const d = medDay(state, key);
    if (!d.expected) return { cls: "empty", title: "sem doses" };
    if (d.taken === d.expected) return { cls: "full", title: `${d.taken} de ${d.expected} doses` };
    if (d.taken > 0) return { cls: "part", title: `${d.taken} de ${d.expected} doses` };
    return { cls: key === today ? "empty" : "miss", title: `0 de ${d.expected} doses` };
  });

  const manage = meds.map((m) => `
    <li><div><strong>${esc(m.name)}</strong>${m.dose ? ` <span class="small">${esc(m.dose)}</span>` : ""}
      <p class="small" style="margin:.125rem 0 0">${m.kind === "interval" ? `A cada ${everyText(m.every)}` : m.times.join(", ")}</p></div>
      <span class="row-actions">
        <button type="button" class="switch" data-action="med-edit" data-id="${esc(m.id)}">Editar</button>
        <button type="button" class="switch danger" data-action="med-delete" data-id="${esc(m.id)}">Apagar</button>
      </span></li>`).join("");

  const editingMed = editing?.type === "med" ? meds.find((m) => m.id === editing.id) ?? null : null;

  return `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Remédios</h1>
    ${meds.length ? "" : `<p class="lede">Cadastre seus remédios para marcar o que tomou a cada dia e ver sua constância.</p>`}
    ${editing?.type === "med" ? medForm(editingMed) : `
      ${doses.length ? `<h2 class="section">Hoje</h2>${todayHtml}` : ""}
      ${intervals.length ? `<h2 class="section">Remédios espaçados</h2><ul class="intervals">${intervalsHtml}</ul>` : ""}
      ${doses.length ? `<h2 class="section">Adesão</h2>${stats(a7, a30, "Dias sem marcação contam como dose não tomada. O dia de hoje só entra depois da primeira marcação.")}${strip}` : ""}
      <h2 class="section">Meus remédios</h2>
      ${manage ? `<ul class="manage">${manage}</ul>` : ""}
      <button class="cta ${meds.length ? "ghost" : ""}" type="button" data-action="med-new">Adicionar remédio</button>`}
  `;
}

// ---------- Dieta ----------

function mealForm(meal) {
  return `
    <form class="login meal-form" data-action="meal-save" novalidate>
      <h2>${meal ? "Editar refeição" : "Nova refeição"}</h2>
      <label class="field-block">Nome
        <input name="name" type="text" autocomplete="off" maxlength="60" placeholder="ex.: Café da manhã" value="${esc(meal?.name ?? "")}" required>
      </label>
      <label class="field-block">O que o plano manda comer
        <textarea name="text" rows="9" maxlength="4000" placeholder="ex.: 2 ovos mexidos, 1 fatia de pão integral, 1 fruta">${esc(meal?.text ?? "")}</textarea>
      </label>
      <p class="login-msg" role="status"></p>
      <button class="cta" type="submit">${meal ? "Salvar alterações" : "Adicionar refeição"}</button>
      <button class="cta ghost" type="button" data-action="meal-cancel">Cancelar</button>
    </form>`;
}

export function renderDietView(state, now, editing) {
  const meals = activeMeals(state).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const today = dayKey(now);
  const log = state.dietLog?.[today] ?? {};
  const a7 = dietAdherence(state, now, 7);
  const a30 = dietAdherence(state, now, 30);
  const options = [["ok", "Segui"], ["parcial", "Em parte"], ["fora", "Fora"]];

  const hideNumbers = state.nutrition?.hideNumbers === true;
  const storedPlan = activeDietPlan(state);
  const todayHtml = meals.map((m) => { const mealEntries = entriesOf(state, today).filter((e) => e.mealId === m.id); return `
    <section class="meal">
      <h3>${esc(m.name)}${mealEntries.length && !hideNumbers ? ` <span class="meal-kcal">${num(mealKcal(mealEntries))} kcal</span>` : ""}</h3>
      <div class="meal-choices" role="group" aria-label="Como foi: ${esc(m.name)}">
        ${options.map(([v, label]) => `<button type="button" class="meal-btn ${v}" data-action="meal" data-id="${esc(m.id)}" data-status="${v}" aria-pressed="${log[m.id] === v}">${label}</button>`).join("")}
      </div>
      ${mealFoodsHtml(mealEntries, hideNumbers, today)}
      <button type="button" class="switch" data-action="food-add" data-meal="${esc(m.id)}" data-day="${today}">+ Adicionar alimento</button>
      ${m.text ? mealPlanHtml(m.text) : storedPlan ? `<p class="small plan-hint">Esta refeição ainda não tem o texto do plano. <button type="button" class="switch" data-action="plan-reread">Preencher a partir do PDF</button></p>` : ""}
    </section>`; }).join("");

  const strip = renderStrip(now, (key) => {
    const d = dietDay(state, key);
    if (!d.expected) return { cls: "empty", title: "sem refeições" };
    if (d.marked === 0) return { cls: key === today ? "empty" : "miss", title: "sem marcação" };
    const ratio = d.score / d.expected;
    return { cls: ratio >= 0.99 ? "full" : ratio > 0 ? "part" : "miss", title: `${Math.round(ratio * 100)}% do plano` };
  });

  const manage = meals.map((m) => `
    <li><div><strong>${esc(m.name)}</strong>${m.text ? `<p class="small meal-text" style="margin:.125rem 0 0">${esc(m.text)}</p>` : ""}</div>
      <span class="row-actions">
        <button type="button" class="switch" data-action="meal-edit" data-id="${esc(m.id)}">Editar</button>
        <button type="button" class="switch danger" data-action="meal-delete" data-id="${esc(m.id)}">Apagar</button>
      </span></li>`).join("");

  const editingMeal = editing?.type === "meal" ? meals.find((m) => m.id === editing.id) ?? null : null;

  const plan = activeDietPlan(state);
  const planCard = plan ? `
      <div class="plan-card">
        <div><strong>${esc(plan.name)}</strong><p class="small" style="margin:.125rem 0 0">${formatSize(plan.size)} · anexado em ${fmtDay(dayKey(new Date(plan.at)))}</p></div>
        <span class="row-actions">
          <button type="button" class="switch" data-action="plan-open">Abrir</button>
          <button type="button" class="switch" data-action="plan-reread">Reler o texto</button>
          <label class="switch file-link">Trocar<input type="file" accept="application/pdf,.pdf" data-action="plan-file" hidden></label>
          <button type="button" class="switch danger" data-action="plan-remove">Remover</button>
        </span>
      </div>` : `
      <p class="small" style="margin:0 0 0.75rem">Anexe o PDF do seu plano alimentar. O app lê os nomes das refeições para você marcar a cada dia e guarda o arquivo na sua conta, para você abrir quando quiser.</p>
      <label class="cta ghost file-btn">Anexar plano em PDF<input type="file" accept="application/pdf,.pdf" data-action="plan-file" hidden></label>`;

  const body = editing?.type === "plan" ? planReview(editing)
    : editing?.type === "meal" ? mealForm(editingMeal)
    : `
      ${meals.length ? `<h2 class="section">Hoje</h2>
      <button type="button" class="switch" data-action="go" data-view="nutri">Ver nutrientes do dia</button>
      ${meals.some((m) => m.text) ? `<button type="button" class="switch" data-action="go" data-view="plano">Ver plano completo</button>` : ""}
      ${budgetBanner(state, now, today)}${todayHtml}
      <h2 class="section">Adesão</h2>${stats(a7, a30, "Segui vale 100%, em parte 50% e fora 0%. Dias sem marcação contam como 0%. O dia de hoje só entra depois da primeira marcação.")}${strip}` : ""}
      <h2 class="section">Nutrientes</h2>
      <p class="small" style="margin:0 0 0.75rem">Registre o que você comeu e acompanhe calorias, macros, vitaminas e minerais contra as suas metas.</p>
      <button class="cta ghost" type="button" data-action="go" data-view="nutri">Nutrientes e metas</button>
      <h2 class="section">Meu plano em PDF</h2>
      ${planCard}
      <h2 class="section">Minhas refeições</h2>
      ${manage ? `<ul class="manage">${manage}</ul>` : ""}
      <button class="cta ${meals.length ? "ghost" : ""}" type="button" data-action="meal-new">Adicionar refeição</button>`;

  return `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Dieta</h1>
    ${meals.length || editing ? "" : `<p class="lede">Anexe o PDF do seu plano ou cadastre as refeições, e marque a cada dia como foi.</p>`}
    ${body}
  `;
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Quanto resta de calorias hoje, logo acima das refeições. Sem metas, convida a calcular. */
function budgetBanner(state, now, today) {
  const b = kcalBudget(state, now, today);
  if (b.reason === "sem-perfil") {
    return `<div class="budget"><p class="small" style="margin:0">Quer saber quantas calorias pode comer por dia? <button type="button" class="switch" data-action="nutri-setup">Calcular minha meta</button></p></div>`;
  }
  if (!b.ok) return `<div class="budget"><p class="small" style="margin:0">Falta completar as suas metas. <button type="button" class="switch" data-action="nutri-setup">Abrir metas</button></p></div>`;
  const cls = b.over ? "over" : b.pct >= 85 ? "near" : "ok";
  if (b.hide) {
    return `<div class="budget"><p class="small" style="margin:0 0 .375rem" role="status">${b.over ? "Hoje você passou da meta de calorias." : b.pct >= 85 ? "Hoje você está chegando na meta de calorias." : "Hoje você está dentro da meta de calorias."}</p>
      <div class="meter ${cls}"><span style="width:${b.pct}%"></span></div></div>`;
  }
  return `<div class="budget ${b.over ? "over" : ""}" role="status" aria-label="${b.over ? `${num(-b.remaining)} calorias acima da meta` : `Restam ${num(b.remaining)} calorias hoje`}">
      <div class="budget-nums">
        <span>Meta <strong>${num(b.target)}</strong></span>
        <span>Registrado <strong>${num(b.eaten)}</strong></span>
        <span>${b.over ? "Acima" : "Restam"} <strong>${num(Math.abs(b.remaining))}</strong></span>
      </div>
      <div class="meter ${cls}"><span style="width:${b.pct}%"></span></div>
      <p class="small" style="margin:.375rem 0 0">calorias (kcal) de hoje</p>
    </div>`;
}

/** Remédios do dia, remédio espaçado e adesão em poucas linhas, sem botões. Usado no tour. */
export function medsGlance(state, now) {
  const doses = todayDoses(state, now);
  const rows = SLOTS.flatMap((slot) => doses.filter((d) => d.slot === slot)).map((d) => `
    <li><span class="dose" aria-pressed="${d.taken}"><span class="dose-check">✓</span>
      <span><strong>${esc(d.med.name)}</strong> <span class="small">${esc(d.slot)}</span></span></span></li>`).join("");
  const hormones = activeMeds(state).filter((m) => m.kind === "interval").map((m) => {
    const st = intervalStatus(state, m, now);
    return `<div class="interval ${st.status}" style="margin-top:.75rem"><div><strong>${esc(m.name)}</strong>
      <p class="small" style="margin:.25rem 0 0">A cada ${everyText(m.every)}</p>
      <p style="margin:.25rem 0 0">${esc(intervalInfo(st))}</p></div></div>`;
  }).join("");
  return `<ul class="dose-list">${rows}</ul>${hormones}${renderMedsHabit(state, now)}`;
}

/** Refeições do dia com os botões de check e o quadro de calorias, sem botões de ação. Usado no tour. */
export function dietGlance(state, now) {
  const today = dayKey(now);
  const log = state.dietLog?.[today] ?? {};
  const options = [["ok", "Segui"], ["parcial", "Em parte"], ["fora", "Fora"]];
  const meals = activeMeals(state).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((m) => {
    const entries = entriesOf(state, today).filter((e) => e.mealId === m.id);
    return `<section class="meal"><h3>${esc(m.name)}${entries.length ? ` <span class="meal-kcal">${num(mealKcal(entries))} kcal</span>` : ""}</h3>
      <div class="meal-choices">${options.map(([v, label]) => `<span class="meal-btn ${v}" aria-pressed="${log[m.id] === v}">${label}</span>`).join("")}</div>
      ${mealFoodsHtml(entries, false, today).replace(/<button[\s\S]*?<\/button>/g, "")}</section>`;
  }).join("");
  return `${budgetBanner(state, now, today)}${meals}`;
}

/** Revisão depois de ler o PDF: escolhe quais refeições criar, corrige o texto de cada uma e decide se guarda o arquivo. */
function planReview(editing) {
  if (editing.loading) return `<h2>Lendo o PDF...</h2><p class="small" role="status">Isso leva alguns segundos.</p>`;
  const meals = editing.meals ?? [];
  return `
    <form class="login" data-action="plan-save" novalidate>
      <h2>Plano em PDF</h2>
      ${meals.length ? `<p class="small" style="margin:0 0 .75rem">Encontrei estas refeições. Confira o texto de cada uma e corrija o que precisar: ele aparece na hora de marcar a refeição do dia.</p>
      ${meals.map((m, i) => `
        <fieldset class="review-meal">
          <label class="review-name"><input type="checkbox" name="meal" value="${i}" ${m.checked === false ? "" : "checked"}> <strong>${esc(m.name)}</strong>${m.existingId ? ` <span class="tag">${m.current ? "Já cadastrada" : "Sem texto"}</span>` : ""}</label>
          ${m.existingId ? `<p class="small" style="margin:0">${m.current ? "Já tem texto. Marque para substituir pelo que está no PDF." : "Está sem o texto do plano. Marque para preencher com o que está no PDF."}</p>` : ""}
          <textarea name="text-${i}" rows="7" maxlength="4000" aria-label="Texto de ${esc(m.name)}">${esc(m.text)}</textarea>
        </fieldset>`).join("")}` : `<p>${editing.skipped?.length ? "As refeições do PDF já estão cadastradas." : "Não encontrei os nomes das refeições nesse PDF. Você pode guardar o arquivo e adicionar as refeições à mão."}</p>`}
      ${editing.note ? `<p class="small">${esc(editing.note)}</p>` : ""}
      ${editing.stored ? `<p class="small">O PDF já está guardado na sua conta.</p>` : `<fieldset class="choice">
        <label><input type="checkbox" name="store" ${editing.canStore ? "checked" : "disabled"}> Guardar o PDF na minha conta</label>
        <p class="small" style="margin:0">${editing.canStore ? "Só você acessa o arquivo. Ele pode ter dados pessoais, como o nome do profissional. Dá para remover quando quiser." : "Entre na sua conta para guardar o arquivo."}</p>
      </fieldset>`}
      <p class="login-msg" role="status">${esc(editing.error ?? "")}</p>
      <button class="cta" type="submit">Confirmar</button>
      <button class="cta ghost" type="button" data-action="plan-cancel">Cancelar</button>
    </form>`;
}

/** Um item do plano com o texto exatamente como está escrito: o "ou" e as quantidades ganham destaque, nada é reescrito. */
function itemHtml(raw) {
  return esc(raw)
    .replace(/\s+ou\s+/gi, ' <span class="dbox-or">ou</span> ')
    .replace(/\(([^()]*\d[^()]*)\)/g, '<span class="dbox-qty">$1</span>');
}

function blockHtml(b) {
  if (b.type === "items") return `<ul class="dbox-items">${b.items.map((i) => `<li>${itemHtml(i.raw)}</li>`).join("")}</ul>`;
  if (b.type === "prep") {
    return `<div class="dbox-prep">${b.title ? `<strong>${esc(b.title)}</strong>` : ""}${b.how ? `<p>${esc(b.how)}</p>` : ""}</div>`;
  }
  if (b.type === "or") return `<p class="dbox-ou" aria-hidden="true">ou</p>`;
  if (b.type === "heading") return `<p class="dbox-heading">${esc(b.text)}</p>`;
  return `<p class="dbox-note">${esc(b.text)}</p>`;
}

/**
 * Os blocos de uma parte do plano. No modo compacto (cartão do dia) só os itens aparecem; receitas e observações
 * ficam recolhidas, para o cartão não virar uma página.
 */
function blocksHtml(blocks, compact) {
  const shown = compact ? blocks.filter((b) => b.type === "items") : blocks;
  const hidden = compact ? blocks.filter((b) => b.type !== "items" && b.type !== "or") : [];
  return `${shown.map(blockHtml).join("")}${hidden.length ? `<details class="meal-details"><summary>Receitas e observações (${hidden.length})</summary>${hidden.map(blockHtml).join("")}</details>` : ""}`;
}

/**
 * O plano de uma refeição, montado a partir do texto lido do PDF: o que comer à vista e as substituições em cartões.
 * `compact`: usado no cartão do dia (substituições recolhidas). Sem compact: a tela completa, tudo aberto.
 */
export function mealPlanHtml(text, { compact = true } = {}) {
  const plan = parseMealPlan(text);
  // Sem itens com hífen nem substituições, o texto não é um plano estruturado: mostra inteiro, como foi lido.
  const structured = plan.main.some((b) => b.type === "items") || plan.subs.length > 0;
  if (!structured) return `<p class="meal-text">${esc(text)}</p>`;
  const subs = plan.subs.map((s, i) => `
    <div class="dbox-sub"><div class="dbox-sub-title"><span>Substituição ${i + 1}</span></div>${blocksHtml(s.blocks, false)}</div>`).join("");
  return `<div class="meal-plan dbox">
    ${blocksHtml(plan.main, compact)}
    ${plan.subs.length ? (compact
      ? `<details class="meal-details"><summary>Substituições (${plan.subs.length})</summary>${subs}</details>`
      : `<h3 class="dbox-subs-h">Substituições</h3>${subs}`) : ""}
  </div>`;
}

/** Tela "Meu plano": o plano alimentar completo, refeição por refeição, como em um app de nutricionista. */
export function renderPlanView(state) {
  const meals = activeMeals(state).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((m) => m.text);
  const section = (m) => {
    const time = parseMealPlan(m.text).time;
    return `<section class="dbox-meal">
      <header class="dbox-head"><h2>${esc(m.name)}</h2>${time ? `<span class="dbox-time">${esc(time)}</span>` : ""}</header>
      ${mealPlanHtml(m.text, { compact: false })}
    </section>`;
  };
  return `
    <div class="bar"><button class="back" data-action="go" data-view="diet">‹ Dieta</button><span></span></div>
    <h1 class="display">Meu plano</h1>
    ${meals.length ? `<p class="small" style="margin:0.5rem 0 0">Montado a partir do PDF do seu plano alimentar. Toque numa refeição em Dieta para marcar como foi.</p>${meals.map(section).join("")}` : `
      <p class="lede">Nenhuma refeição tem o texto do plano ainda.</p>
      <p class="small">Em Dieta, anexe o PDF do plano para o app ler o que comer em cada refeição.</p>
      <button class="cta" type="button" data-action="go" data-view="diet">Ir para a Dieta</button>`}
    <p class="disclaimer" role="note"><strong>Importante:</strong> este plano foi lido automaticamente do seu PDF e pode ter erros. Confira com o arquivo original e siga a orientação de quem fez o plano.</p>
  `;
}
// ---------- Avisos na home ----------

/** Avisos da home. Com `hormonesOnly`, só os de remédios espaçados: o resto já aparece nos cartões do painel. */
export function healthNotices(state, now, { hormonesOnly = false } = {}) {
  const out = [];
  const doses = todayDoses(state, now);
  const taken = doses.filter((d) => d.taken).length;
  if (!hormonesOnly && doses.length && taken < doses.length) {
    out.push(`Remédios de hoje: ${taken} de ${doses.length} tomados. <button class="switch" data-action="go" data-view="meds">Abrir</button>`);
  }
  for (const m of activeMeds(state).filter((x) => x.kind === "interval")) {
    const st = intervalStatus(state, m, now);
    if (st.status === "atrasado") out.push(`${esc(m.name)}: a dose estava prevista para ${fmtDay(st.next)}. <button class="switch" data-action="go" data-view="meds">Abrir</button>`);
    else if (st.status === "perto") out.push(`${esc(m.name)}: próxima dose em ${st.daysLeft} ${st.daysLeft === 1 ? "dia" : "dias"} (${fmtDay(st.next)}).`);
  }
  const meals = activeMeals(state);
  const { marked } = dietDay(state, dayKey(now));
  if (!hormonesOnly && meals.length && marked < meals.length) {
    out.push(`Dieta de hoje: ${marked} de ${meals.length} refeições marcadas. <button class="switch" data-action="go" data-view="diet">Abrir</button>`);
  }
  return out.map((html) => `<p class="notice">${html}</p>`).join("");
}

// ---------- Painel de hábitos ----------

/** Números dos cartões-resumo do Hábito: remédios, hormônios (remédios de intervalo) e dieta. */
export function habitCards(state, now) {
  const meds = activeMeds(state);
  const hasMeds = meds.some((m) => m.kind === "daily");
  const hormones = meds.filter((m) => m.kind === "interval").map((m) => ({ med: m, st: intervalStatus(state, m, now) }));
  // Mostra o que vence primeiro; remédio sem nenhuma dose registrada vem por último.
  hormones.sort((a, b) => (a.st.daysLeft ?? Infinity) - (b.st.daysLeft ?? Infinity));
  const next = hormones[0] ?? null;
  const hormone = !next ? { has: false, value: "–", label: "Nenhum cadastrado", status: "ok" }
    : next.st.status === "primeira" ? { has: true, value: "–", label: `${next.med.name}: registre a 1ª dose`, status: "primeira" }
    : next.st.daysLeft < 0 ? { has: true, value: `${-next.st.daysLeft} d`, label: `${next.med.name}: atrasado`, status: "atrasado" }
    : { has: true, value: next.st.daysLeft === 0 ? "Hoje" : `${next.st.daysLeft} d`, label: `${next.med.name}: próxima dose`, status: next.st.status };
  return {
    meds: { has: hasMeds, pct: medAdherence(state, now, 7).pct },
    hormones: hormone,
    diet: { has: activeMeals(state).length > 0, pct: dietAdherence(state, now, 7).pct },
  };
}

const goTo = (view, text) => `<button class="cta ghost" type="button" data-action="go" data-view="${view}">${text}</button>`;

export function renderMedsHabit(state, now) {
  if (!habitCards(state, now).meds.has) {
    return `<p class="lede">Nenhum remédio diário cadastrado ainda.</p>${goTo("meds", "Cadastrar remédios")}`;
  }
  const today = dayKey(now);
  const strip = renderStrip(now, (key) => {
    const d = medDay(state, key);
    if (!d.expected) return { cls: "empty", title: "sem doses" };
    if (d.taken === d.expected) return { cls: "full", title: `${d.taken} de ${d.expected} doses` };
    if (d.taken > 0) return { cls: "part", title: `${d.taken} de ${d.expected} doses` };
    return { cls: key === today ? "empty" : "miss", title: `0 de ${d.expected} doses` };
  });
  return `${stats(medAdherence(state, now, 7), medAdherence(state, now, 30), "Porcentagem de doses tomadas. Dias sem marcação contam como não tomadas; hoje só entra depois da primeira marcação.")}
    ${strip}${goTo("meds", "Abrir Remédios")}`;
}

export function renderHormonesHabit(state, now) {
  const meds = activeMeds(state).filter((m) => m.kind === "interval");
  if (!meds.length) {
    return `<p class="lede">Nenhum hormônio cadastrado. Em Remédios, escolha "A cada algum tempo" (por exemplo, a cada 3 meses).</p>${goTo("meds", "Cadastrar em Remédios")}`;
  }
  return meds.map((m) => {
    const st = intervalStatus(state, m, now);
    const dates = doseHistory(state, m.id);
    const rows = dates.map((d, i) => {
      const prev = dates[i + 1];
      const gap = prev ? Math.round((new Date(`${d}T12:00:00`) - new Date(`${prev}T12:00:00`)) / 86_400_000) : null;
      return `<li><span>${fmtDay(d)}</span><span class="small">${gap === null ? "primeira dose registrada" : `${gap} dias depois da anterior`}</span></li>`;
    }).join("");
    return `<section class="interval ${st.status}" style="margin-top:.75rem">
      <div><strong>${esc(m.name)}</strong>${m.dose ? ` <span class="small">${esc(m.dose)}</span>` : ""}
        <p class="small" style="margin:.25rem 0 0">A cada ${everyText(m.every)}</p>
        <p style="margin:.25rem 0 0">${esc(intervalInfo(st))}</p></div>
      ${rows ? `<ul class="dose-history">${rows}</ul>` : ""}
    </section>`;
  }).join("") + goTo("meds", "Registrar dose em Remédios");
}

export function renderDietHabit(state, now) {
  if (!habitCards(state, now).diet.has) {
    return `<p class="lede">Nenhuma refeição cadastrada ainda.</p>${goTo("diet", "Cadastrar dieta")}`;
  }
  const today = dayKey(now);
  const strip = renderStrip(now, (key) => {
    const d = dietDay(state, key);
    if (!d.expected) return { cls: "empty", title: "sem refeições" };
    if (d.marked === 0) return { cls: key === today ? "empty" : "miss", title: "sem marcação" };
    const ratio = d.score / d.expected;
    return { cls: ratio >= 0.99 ? "full" : ratio > 0 ? "part" : "miss", title: `${Math.round(ratio * 100)}% do plano` };
  });
  return `${stats(dietAdherence(state, now, 7), dietAdherence(state, now, 30), "Segui vale 100%, em parte 50% e fora 0%. Dias sem marcação contam como 0%; hoje só entra depois da primeira marcação.")}
    ${strip}${goTo("diet", "Abrir Dieta")}`;
}