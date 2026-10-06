// Telas de nutrição: resumo do dia, metas e registro de alimentos. Só montam HTML; os eventos ficam em app.js.
import { esc } from "./dom.js";
import {
  NUTRIENTS, ACTIVITY, GOALS, FORMULAS, MICRO_REFS, NUTRITION_DISCLAIMER, FOOD_SOURCE, DRI_SOURCE, BRAND_SOURCE,
  dailyTargets, dayTotals, entriesOf, entriesByMeal, kcalBudget, intakeStatus, portionOf, latestWeightKg, searchFoods, unitOf,
} from "./nutrition.js";
import { activeMeals } from "./logic.js";

const STATUS_TEXT = {
  abaixo: "abaixo da meta", quase: "quase na meta", "na-meta": "na meta", acima: "acima da meta",
  dentro: "dentro do limite", perto: "perto do limite", "sem-meta": "",
};

/** Número para leitura: inteiro quando é grande, uma casa decimal quando é pequeno. */
export function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return (Math.abs(n) >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)).replace(".", ",");
}

const entryKcal = (e) => ((e.n?.energy_kcal ?? 0) * e.g) / 100;

function dayLabel(key, todayKey) {
  if (key === todayKey) return "Hoje";
  const d = new Date(`${key}T12:00:00`);
  const t = new Date(`${todayKey}T12:00:00`);
  if (Math.round((t - d) / 86_400_000) === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** Lista de alimentos de uma refeição, usada dentro do cartão da Dieta. */
export function mealFoodsHtml(entries, hideNumbers, dayKey) {
  if (!entries.length) return "";
  return `<ul class="food-list">${entries.map((e) => `
    <li><span>${esc(e.name)} <span class="small">${num(e.g)} ${unitOf(e)}${hideNumbers ? "" : ` · ${num(entryKcal(e))} kcal`}</span></span>
      <button type="button" class="switch danger" data-action="food-remove" data-day="${esc(dayKey)}" data-id="${esc(e.id)}" aria-label="Remover ${esc(e.name)}">Remover</button></li>`).join("")}
  </ul>`;
}

function meterRow({ label, value, target, unit, limit = false, hide, missing = 0, count = 0 }) {
  const status = intakeStatus(value, target, { limit });
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const over = target && value / target > 1.15 && !limit;
  const cls = limit ? (value > target ? "over" : value >= target * 0.8 ? "near" : "ok") : status === "na-meta" ? "ok" : over ? "over" : "under";
  const figures = hide ? STATUS_TEXT[status] : `${num(value)} / ${num(target)} ${unit}${limit ? " (limite)" : ""}`;
  const aria = hide ? `${label}: ${STATUS_TEXT[status]}` : `${label}: ${num(value)} de ${num(target)} ${unit}${limit ? ", limite" : ""}, ${pct}%`;
  const note = missing > 0 && count > 0
    ? `<span class="incomplete" title="A TACO não mediu este nutriente em ${missing} alimento(s) registrado(s). O total pode estar maior.">sem dado em ${missing} de ${count}</span>` : "";
  return `
    <div class="meter-row" role="img" aria-label="${esc(aria)}">
      <div class="meter-head"><span>${esc(label)}</span><span class="small">${esc(figures)}</span></div>
      <div class="meter ${cls}"><span style="width:${pct}%"></span></div>
      ${note}
    </div>`;
}

// ---------- Resumo do dia ----------

export function renderNutri(state, now, day, todayKey) {
  const profile = state.nutrition;
  const hide = profile?.hideNumbers === true;
  const weight = latestWeightKg(state);
  const head = `
    <div class="bar"><button class="back" data-action="go" data-view="diet">‹ Dieta</button><span></span></div>
    <h1 class="display">Nutrientes</h1>`;

  if (!profile) {
    return `${head}
      <p class="lede">Registre o que você comeu e acompanhe calorias, macros, vitaminas e minerais do dia contra as suas metas.</p>
      <p class="small">Para calcular as metas, o app precisa da sua altura, do ano de nascimento, do seu peso, do seu nível de atividade e do seu objetivo.</p>
      <button class="cta" type="button" data-action="nutri-setup">Calcular minhas metas</button>
      ${disclaimer()}`;
  }

  const result = dailyTargets(profile, weight, now);
  if (!result.ok) {
    return `${head}
      <ul class="errors">${result.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      <button class="cta" type="button" data-action="nutri-setup">Editar metas</button>
      ${weight === null ? `<button class="cta ghost" type="button" data-action="go" data-view="weight">Registrar peso</button>` : ""}`;
  }

  const { totals, missing, count } = dayTotals(state, day);
  const t = result.targets;
  const kcal = totals.energy_kcal;
  const pct = Math.min(100, Math.round((kcal / t.energy_kcal) * 100));
  const kcalStatus = intakeStatus(kcal, t.energy_kcal);
  const meals = new Map(activeMeals(state).map((m) => [m.id, m.name]));
  const entries = entriesOf(state, day);
  const row = (id, extra = {}) => {
    const n = NUTRIENTS.find((x) => x.id === id);
    return meterRow({ label: n.label, value: totals[id], target: t[id], unit: n.unit, hide, missing: missing[id], count, limit: n.limit, ...extra });
  };

  return `${head}
    <div class="day-nav" role="group" aria-label="Escolher o dia">
      <button type="button" class="switch" data-action="nutri-day" data-delta="-1" aria-label="Dia anterior">‹</button>
      <strong>${esc(dayLabel(day, todayKey))}</strong>
      <button type="button" class="switch" data-action="nutri-day" data-delta="1" aria-label="Próximo dia" ${day >= todayKey ? "disabled" : ""}>›</button>
    </div>

    <div class="ring-wrap">
      <div class="ring" style="--pct:${pct}" role="img" aria-label="${hide ? esc(`Calorias: ${STATUS_TEXT[kcalStatus]}`) : `Calorias: ${num(kcal)} de ${num(t.energy_kcal)}`}">
        <div class="ring-inner">${hide ? `<strong>${esc(STATUS_TEXT[kcalStatus])}</strong>` : `<strong>${num(kcal)}</strong><span class="small">de ${num(t.energy_kcal)} kcal</span>`}</div>
      </div>
    </div>
    ${budgetLine(kcalBudget(state, now, day), hide)}
    ${result.warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join("")}

    <h2 class="section">Macros</h2>
    ${row("protein_g")}${row("carbohydrate_g")}${row("lipids_g")}${row("dietary_fiber_g")}

    <h2 class="section">Vitaminas e minerais</h2>
    ${NUTRIENTS.filter((n) => n.kind === "micro").map((n) => row(n.id)).join("")}
    <p class="small">Os totais contam só o que a TACO mediu. Quando um alimento não tem dado de um nutriente, aparece "sem dado": o total pode estar maior do que o mostrado.</p>

    <h2 class="section">Alimentos do dia</h2>
    ${entries.length ? entriesByMeal(state, day, activeMeals(state)).map((g) => `
      <section class="meal-group">
        <h3>${esc(g.name)}${hide ? "" : ` <span class="meal-kcal">${num(g.kcal)} kcal</span>`}</h3>
        ${mealFoodsHtml(g.entries, hide, day)}
      </section>`).join("") : `<p class="small">Nenhum alimento registrado neste dia.</p>`}    <button class="cta" type="button" data-action="food-add" data-day="${esc(day)}">Adicionar alimento</button>
    <button class="cta ghost" type="button" data-action="nutri-setup">Editar metas</button>

    <details class="how"><summary>Como as metas foram calculadas</summary>
      <p class="small">${hide
        ? `As metas partem do gasto de energia estimado (${esc(FORMULAS[profile.formula].label.toLowerCase())}), com a atividade escolhida e o ajuste para o objetivo "${esc(GOALS[profile.goal].label.toLowerCase())}". Você escolheu esconder os números.`
        : result.source === "manual" ? `Você digitou a meta de ${num(t.energy_kcal)} kcal.` : `Gasto basal de ${num(result.bmr)} kcal (${esc(FORMULAS[profile.formula].label.toLowerCase())}), gasto total de ${num(result.tdee)} kcal com a atividade escolhida e ajuste para o objetivo "${esc(GOALS[profile.goal].label.toLowerCase())}".`}
      Proteínas por quilo de peso, gorduras em 25% das calorias, carboidratos no restante e fibras em 14 g por 1.000 kcal.</p>
    </details>
    ${disclaimer()}`;
}

/** Linha "Restam X kcal" abaixo do anel. Com números escondidos, só a situação. */
export function budgetLine(b, hide) {
  if (!b.ok) return "";
  if (hide) return `<p class="budget-line" role="status">${esc(STATUS_TEXT[b.status] ? `Hoje você está ${STATUS_TEXT[b.status]}.` : "")}</p>`;
  const goalText = b.goal === "perder" || b.goal === "perder_devagar" ? "para perder peso" : b.goal === "ganhar" || b.goal === "ganhar_devagar" ? "para ganhar massa" : "para manter o peso";
  return `<p class="budget-line" role="status"><strong>${b.over ? `${num(-b.remaining)} kcal acima da meta` : `Restam ${num(b.remaining)} kcal`}</strong><br>
    <span class="small">Meta de ${num(b.target)} kcal ${esc(goalText)} · ${num(b.eaten)} registradas</span></p>`;
}

function disclaimer() {
  return `<p class="disclaimer" role="note"><strong>Importante:</strong> ${esc(NUTRITION_DISCLAIMER)}</p>
    <p class="small">${esc(DRI_SOURCE)}</p><p class="small">Alimentos: ${esc(FOOD_SOURCE)}</p>`;
}

// ---------- Metas ----------

export function renderNutriSetup(state, now, values = null, errors = []) {
  const v = values ?? state.nutrition ?? {};
  const weight = latestWeightKg(state);
  const sel = (cur, id) => (cur === id ? "checked" : "");
  return `
    <div class="bar"><button class="back" data-action="nutri-back" type="button">‹ Voltar</button><span></span></div>
    <h1 class="display">Minhas metas</h1>
    <p class="lede">Com estes dados o app estima suas metas diárias. Você pode mudar quando quiser.</p>
    ${weight === null ? `<p class="notice">Falta o seu peso. <button class="switch" type="button" data-action="go" data-view="weight">Registrar peso</button></p>` : `<p class="small">Peso usado no cálculo: ${num(weight)} kg (último registro).</p>`}
    ${errors.length ? `<ul class="errors" role="alert">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
    <form class="login nutri-form" data-action="nutri-save" novalidate>
      <label class="field-block">Altura (cm)
        <input name="heightCm" type="number" inputmode="numeric" min="120" max="230" value="${esc(v.heightCm ?? "")}" required>
      </label>
      <label class="field-block">Ano de nascimento
        <input name="birthYear" type="number" inputmode="numeric" min="1900" max="${now.getFullYear()}" placeholder="ex.: 1996" value="${esc(v.birthYear ?? "")}" required>
      </label>
      <label class="field-block">Nível de atividade
        <select name="activity">${Object.entries(ACTIVITY).map(([id, a]) => `<option value="${id}" ${v.activity === id ? "selected" : ""}>${esc(a.label)}: ${esc(a.desc)}</option>`).join("")}</select>
      </label>
      <label class="field-block">Objetivo
        <select name="goal">${Object.entries(GOALS).map(([id, g]) => `<option value="${id}" ${(v.goal ?? "manter") === id ? "selected" : ""}>${esc(g.label)}</option>`).join("")}</select>
      </label>

      <fieldset class="choice">
        <legend>Estimativa de gasto de energia</legend>
        <p class="small" style="margin:0">A fórmula usada tem um termo que depende de sexo. Não há diretriz validada para pessoas trans, então a escolha é sua. Se você tem acompanhamento, vale conversar com o seu profissional. Ou digite abaixo a meta que ele passou.</p>
        ${Object.entries(FORMULAS).map(([id, f]) => `<label><input type="radio" name="formula" value="${id}" ${sel(v.formula ?? "", id)}> ${esc(f.label)}</label>`).join("")}
      </fieldset>

      <fieldset class="choice">
        <legend>Referência de vitaminas e minerais</legend>
        <p class="small" style="margin:0">As referências oficiais são separadas por sexo (o ferro, por exemplo, é bem diferente). Escolha a coluna que faz mais sentido para você.</p>
        ${Object.entries(MICRO_REFS).map(([id, label]) => `<label><input type="radio" name="microRef" value="${id}" ${sel(v.microRef ?? "", id)}> ${esc(label)}</label>`).join("")}
      </fieldset>

      <label class="field-block">Meta de calorias digitada (opcional)
        <input name="kcalManual" type="number" inputmode="numeric" min="800" max="6000" placeholder="deixe vazio para usar a estimativa" value="${esc(v.kcalManual ?? "")}">
      </label>
      <label class="choice-row"><input type="checkbox" name="hideNumbers" ${v.hideNumbers ? "checked" : ""}> Esconder os números de calorias e nutrientes (mostra só se está abaixo, na meta ou acima)</label>
      <p class="login-msg" role="status"></p>
      <button class="cta" type="submit">Salvar metas</button>
      <button class="cta ghost" type="button" data-action="nutri-back">Cancelar</button>
    </form>
    ${disclaimer()}`;
}

// ---------- Registro de alimentos ----------

export function renderFoodResults(foods, query, hide = false, limit = 30) {
  const found = searchFoods(foods, query, limit);
  if (!String(query).trim()) return `<p class="small">Digite o nome de um alimento, por exemplo "arroz" ou "banana".</p>`;
  if (!found.length) return `<p class="small">Nenhum alimento encontrado. Você pode cadastrar o seu.</p>`;
  return `<ul class="food-results">${found.map((f) => `
    <li><button type="button" data-action="food-pick" data-id="${esc(f.id)}">
      <strong>${esc(f.name)}</strong>
      <span class="small">${esc(f.category)}${hide ? "" : ` · ${num(f.per100.energy_kcal ?? 0)} kcal por 100 ${unitOf(f)}`}</span>
    </button></li>`).join("")}</ul>`;
}

export function foodPreview(per100, g, hide, unit = "g") {
  const grams = Number(String(g).replace(",", "."));
  if (!Number.isFinite(grams) || grams <= 0) return `<p class="small">Informe a quantidade em gramas.</p>`;
  const p = portionOf(per100, grams);
  if (hide) return `<p class="small">${num(grams)} ${unit}</p>`;
  return `<p class="small"><strong>${num(p.energy_kcal ?? 0)} kcal</strong> · proteínas ${num(p.protein_g ?? 0)} g · carboidratos ${num(p.carbohydrate_g ?? 0)} g · gorduras ${num(p.lipids_g ?? 0)} g</p>`;
}

export function renderFood(state, ctx, foods, loading) {
  const meals = activeMeals(state);
  const hide = state.nutrition?.hideNumbers === true;
  const back = `<div class="bar"><button class="back" type="button" data-action="food-back">‹ Voltar</button><span></span></div>`;

  if (ctx.mode === "custom") {
    const f = ctx.custom ?? {};
    return `${back}
      <h1 class="display">Novo alimento</h1>
      <p class="lede">Digite os valores do rótulo, por 100 ${f.unit === "ml" ? "ml" : "g"} do alimento.</p>
      ${ctx.error ? `<p class="login-msg" role="alert">${esc(ctx.error)}</p>` : ""}
      <form class="login" data-action="food-custom-save" novalidate>
        <input type="hidden" name="unit" value="${esc(f.unit === "ml" ? "ml" : "g")}">
        <label class="field-block">Nome<input name="name" type="text" maxlength="80" value="${esc(f.name ?? "")}" required></label>
        <label class="field-block">Calorias (kcal)<input name="energy_kcal" inputmode="decimal" value="${esc(f.energy_kcal ?? "")}"></label>
        <label class="field-block">Proteínas (g)<input name="protein_g" inputmode="decimal" value="${esc(f.protein_g ?? "")}"></label>
        <label class="field-block">Carboidratos (g)<input name="carbohydrate_g" inputmode="decimal" value="${esc(f.carbohydrate_g ?? "")}"></label>
        <label class="field-block">Gorduras (g)<input name="lipids_g" inputmode="decimal" value="${esc(f.lipids_g ?? "")}"></label>
        <label class="field-block">Fibras (g, opcional)<input name="dietary_fiber_g" inputmode="decimal" value="${esc(f.dietary_fiber_g ?? "")}"></label>
        <label class="field-block">Sódio (mg, opcional)<input name="sodium_mg" inputmode="decimal" value="${esc(f.sodium_mg ?? "")}"></label>
        <button class="cta" type="submit">Salvar alimento</button>
        <button class="cta ghost" type="button" data-action="food-custom-cancel">Cancelar</button>
      </form>`;
  }

  if (ctx.selected) {
    const s = ctx.selected;
    return `${back}
      <h1 class="display">${esc(s.name)}</h1>
      <p class="small">${esc(s.category)}${hide ? "" : ` · ${num(s.per100.energy_kcal ?? 0)} kcal por 100 ${unitOf(s)}`}</p>
      ${s.source === "marca" ? `<p class="notice">Valores do rótulo, de uma base aberta com dados enviados por usuários. O sabor e o lote podem mudar os números: confira a sua embalagem. <button type="button" class="switch" data-action="food-copy">Os meus valores são diferentes</button></p>` : ""}
      ${ctx.error ? `<p class="login-msg" role="alert">${esc(ctx.error)}</p>` : ""}
      <form class="login" data-action="food-save" novalidate>
        <label class="field-block">Quantidade (${unitOf(s)})
          <input name="g" id="food-g" inputmode="decimal" value="${esc(ctx.g ?? "100")}" required>
        </label>
        <div class="quick" role="group" aria-label="Quantidades comuns">${[50, 100, 150, 200].map((q) => `<button type="button" class="chip" data-action="food-qty" data-g="${q}">${q} ${unitOf(s)}</button>`).join("")}</div>
        <div id="food-preview" aria-live="polite">${foodPreview(s.per100, ctx.g ?? "100", hide, unitOf(s))}</div>
        <label class="field-block">Refeição
          <select name="mealId"><option value="">Sem refeição</option>${meals.map((m) => `<option value="${esc(m.id)}" ${ctx.mealId === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        </label>
        <button class="cta" type="submit">Adicionar ao dia</button>
        <button class="cta ghost" type="button" data-action="food-unpick">Escolher outro</button>
      </form>`;
  }

  return `${back}
    <h1 class="display">Adicionar alimento</h1>
    <label class="field-block">Buscar
      <input name="q" id="food-q" type="search" autocomplete="off" placeholder="ex.: arroz, frango, banana" value="${esc(ctx.query ?? "")}">
    </label>
    <div id="food-results" aria-live="polite">${loading ? `<p class="small">Carregando a tabela de alimentos...</p>` : renderFoodResults(foods, ctx.query ?? "", hide)}</div>
    <button class="cta ghost" type="button" data-action="food-custom">Cadastrar um alimento meu</button>
    <p class="small">Alimentos: ${esc(FOOD_SOURCE)}</p>
    <p class="small">${esc(BRAND_SOURCE)}</p>`;
}
