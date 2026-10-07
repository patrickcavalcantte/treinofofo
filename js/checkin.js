// Check-in diário: um olhar rápido sobre o que falta no dia. Não é ofensiva: não há sequência nem penalidade,
// e fazer o check-in não marca nenhuma dose nem refeição. Funções puras, testadas em tests/checkin.test.js.
import { dayKey, todayDoses, dietDay, activeMeals, weightLoggedThisWeek } from "./logic.js";
import { waterGoal, waterTotal, fmtVolume } from "./hydration.js";
import { esc } from "./dom.js";

const iso = (now) => new Date(now).toISOString();

export const hasCheckedIn = (state, key) => Boolean(state.checkins?.[key] && !state.checkins[key].deleted);

/** Registra que a pessoa olhou o dia. Não altera mais nada. */
export function doCheckin(state, key, now) {
  if (hasCheckedIn(state, key)) return state;
  return { ...state, checkins: { ...(state.checkins ?? {}), [key]: { at: iso(now), updatedAt: iso(now) } } };
}

/** Dias com check-in no mês do `now`. Só um número informativo, sem "dias seguidos". */
export function checkinsThisMonth(state, now) {
  const d = new Date(now);
  const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-`;
  return Object.keys(state.checkins ?? {}).filter((k) => k.startsWith(prefix) && hasCheckedIn(state, k)).length;
}

/** O que ainda falta hoje: [{ id, text, view }]. Lista vazia = tudo em dia. */
export function pendingItems(state, now) {
  const key = dayKey(now);
  const items = [];

  const doses = todayDoses(state, now);
  const missing = doses.filter((d) => !d.taken).length;
  if (missing) items.push({ id: "meds", text: `${missing} ${missing === 1 ? "dose" : "doses"} de remédio para marcar`, view: "meds" });

  const goal = waterGoal(state, now);
  if (goal.ok) {
    const left = goal.ml - waterTotal(state, key);
    if (left > 0) items.push({ id: "agua", text: `Água: faltam ${fmtVolume(left)} para a meta`, view: "agua" });
  }

  const meals = activeMeals(state);
  if (meals.length) {
    const day = dietDay(state, key);
    const open = day.expected - day.marked;
    if (open > 0) items.push({ id: "diet", text: `${open} ${open === 1 ? "refeição" : "refeições"} para marcar`, view: "diet" });
  }

  if (!weightLoggedThisWeek(state, now)) items.push({ id: "weight", text: "Pesagem da semana", view: "weight" });
  return items;
}

/** Cartão da home. */
export function renderCheckin(state, now) {
  const key = dayKey(now);
  const done = hasCheckedIn(state, key);
  const items = pendingItems(state, now);
  const list = items.length
    ? `<ul class="checkin-list">${items.map((i) => `<li><button type="button" class="switch" data-action="go" data-view="${esc(i.view)}">${esc(i.text)}</button></li>`).join("")}</ul>`
    : `<p class="small">Tudo em dia por enquanto.</p>`;
  const month = checkinsThisMonth(state, now);
  return `
    <section class="checkin ${done ? "done" : ""}" aria-label="Check-in de hoje">
      <h2 class="section">${done ? "Check-in de hoje feito" : "Check-in de hoje"}</h2>
      ${list}
      ${done ? "" : `<button type="button" class="cta ghost" data-action="checkin-done">Fazer check-in</button>`}
      ${month ? `<p class="small">${month} ${month === 1 ? "dia" : "dias"} com check-in neste mês.</p>` : ""}
    </section>`;
}
