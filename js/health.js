// Telas de remédios e dieta. Só montam HTML a partir do estado; os eventos ficam em app.js.
import { esc } from "./dom.js";
import {
  SLOTS, UNITS, activeMeds, activeMeals, todayDoses, intervalStatus, medAdherence, medDay,
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

function stats(a7, a30, note) {
  return `<div class="stats two">
    <div><strong>${pct(a7.pct)}</strong><span>últimos 7 dias</span></div>
    <div><strong>${pct(a30.pct)}</strong><span>últimos 30 dias</span></div>
  </div>${note ? `<p class="small" style="margin:.5rem 0 0">${esc(note)}</p>` : ""}`;
}

// ---------- Remédios ----------

function medForm(med) {
  const kind = med?.kind ?? "daily";
  const every = med?.every ?? { n: 3, unit: "month" };
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
          <input name="n" type="number" inputmode="numeric" min="1" max="60" value="${every.n}">
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
    const info = st.status === "primeira"
      ? "Nenhuma dose registrada ainda. Marque quando tomar a próxima."
      : `Última: ${fmtDay(st.last)} · Próxima: ${fmtDay(st.next)} ${st.daysLeft < 0 ? `(atrasada ${-st.daysLeft} ${-st.daysLeft === 1 ? "dia" : "dias"})` : st.daysLeft === 0 ? "(hoje)" : `(em ${st.daysLeft} ${st.daysLeft === 1 ? "dia" : "dias"})`}`;
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
        <textarea name="text" rows="9" maxlength="2000" placeholder="ex.: 2 ovos mexidos, 1 fatia de pão integral, 1 fruta">${esc(meal?.text ?? "")}</textarea>
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

  const todayHtml = meals.map((m) => `
    <section class="meal">
      <h3>${esc(m.name)}</h3>
      <div class="meal-choices" role="group" aria-label="Como foi: ${esc(m.name)}">
        ${options.map(([v, label]) => `<button type="button" class="meal-btn ${v}" data-action="meal" data-id="${esc(m.id)}" data-status="${v}" aria-pressed="${log[m.id] === v}">${label}</button>`).join("")}
      </div>
      ${m.text ? `<details class="meal-details"><summary>Ver o plano desta refeição</summary><p class="meal-text">${esc(m.text)}</p></details>` : ""}
    </section>`).join("");

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

  return `
    <div class="bar"><button class="back" data-action="go" data-view="home">‹ Voltar</button><span></span></div>
    <h1 class="display">Dieta</h1>
    ${meals.length ? "" : `<p class="lede">Cadastre as refeições do seu plano e marque, a cada dia, como foi.</p>`}
    ${editing?.type === "meal" ? mealForm(editingMeal) : `
      ${meals.length ? `<h2 class="section">Hoje</h2>${todayHtml}
      <h2 class="section">Adesão</h2>${stats(a7, a30, "Segui vale 100%, em parte 50% e fora 0%. Dias sem marcação contam como 0%. O dia de hoje só entra depois da primeira marcação.")}${strip}` : ""}
      <h2 class="section">Minhas refeições</h2>
      ${manage ? `<ul class="manage">${manage}</ul>` : ""}
      <button class="cta ${meals.length ? "ghost" : ""}" type="button" data-action="meal-new">Adicionar refeição</button>
      <label class="cta ghost file-btn">Importar plano de um arquivo (.json)
        <input type="file" accept="application/json,.json" data-action="meal-import" hidden>
      </label>`}
  `;
}

// ---------- Avisos na home ----------

export function healthNotices(state, now) {
  const out = [];
  const doses = todayDoses(state, now);
  const taken = doses.filter((d) => d.taken).length;
  if (doses.length && taken < doses.length) {
    out.push(`Remédios de hoje: ${taken} de ${doses.length} tomados. <button class="switch" data-action="go" data-view="meds">Abrir</button>`);
  }
  for (const m of activeMeds(state).filter((x) => x.kind === "interval")) {
    const st = intervalStatus(state, m, now);
    if (st.status === "atrasado") out.push(`${esc(m.name)}: a dose estava prevista para ${fmtDay(st.next)}. <button class="switch" data-action="go" data-view="meds">Abrir</button>`);
    else if (st.status === "perto") out.push(`${esc(m.name)}: próxima dose em ${st.daysLeft} ${st.daysLeft === 1 ? "dia" : "dias"} (${fmtDay(st.next)}).`);
  }
  const meals = activeMeals(state);
  const { marked } = dietDay(state, dayKey(now));
  if (meals.length && marked < meals.length) {
    out.push(`Dieta de hoje: ${marked} de ${meals.length} refeições marcadas. <button class="switch" data-action="go" data-view="diet">Abrir</button>`);
  }
  return out.map((html) => `<p class="notice">${html}</p>`).join("");
}
