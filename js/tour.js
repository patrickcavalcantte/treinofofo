// Tour pelas telas do app. Cada passo mostra uma tela de verdade, desenhada pelo próprio app com DADOS FICTÍCIOS,
// então nunca fica desatualizada nem mostra informação de ninguém. Sempre dá para pular.
import { esc } from "./dom.js";
import { EXERCISES } from "./data.js";
import {
  emptyState, dayKey, saveMed, toggleDose, saveMeal, setMealStatus, setWeight,
} from "./logic.js";
import { saveNutrition, addFoodEntry } from "./nutrition.js";
import { addActivity, addFavorite } from "./activities.js";
import { activityGlance } from "./activityview.js";
import { nutriGlance } from "./nutriview.js";
import { medsGlance, dietGlance, habitCards } from "./health.js";

// Valores por 100 g da TACO (assets/taco.json), usados só no exemplo.
const FOODS = {
  ovo: { name: "Ovo de galinha, cozido", per100: { energy_kcal: 145.7, protein_g: 13.29, lipids_g: 9.48, carbohydrate_g: 0.61, calcium_mg: 49.22, iron_mg: 1.52, magnesium_mg: 11.24, phosphorus_mg: 184.19, potassium_mg: 138.9, zinc_mg: 1.24 } },
  banana: { name: "Banana prata, crua", per100: { energy_kcal: 98.25, protein_g: 1.27, lipids_g: 0.07, carbohydrate_g: 25.96, dietary_fiber_g: 2.04, calcium_mg: 7.56, iron_mg: 0.38, magnesium_mg: 26.29, potassium_mg: 357.68, vitamin_c_mg: 21.59 } },
  arroz: { name: "Arroz integral, cozido", per100: { energy_kcal: 123.53, protein_g: 2.59, lipids_g: 1, carbohydrate_g: 25.81, dietary_fiber_g: 2.75, calcium_mg: 5.2, iron_mg: 0.26, magnesium_mg: 58.7, potassium_mg: 75.15 } },
  feijao: { name: "Feijão carioca, cozido", per100: { energy_kcal: 76.42, protein_g: 4.78, lipids_g: 0.54, carbohydrate_g: 13.59, dietary_fiber_g: 8.51, calcium_mg: 26.59, iron_mg: 1.29, magnesium_mg: 42.34, potassium_mg: 254.62, vitamin_c_mg: 0 } },
  frango: { name: "Frango, peito grelhado", per100: { energy_kcal: 159.19, protein_g: 32.03, lipids_g: 2.48, carbohydrate_g: 0, calcium_mg: 5.34, iron_mg: 0.33, magnesium_mg: 18.27, potassium_mg: 387.37, vitamin_c_mg: 0 } },
};

/** Estado de exemplo: remédios, dieta, alimentos e peso inventados para as telas do tour. */
export function demoState(now = new Date()) {
  const day = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return dayKey(d); };
  const start = new Date(now); start.setDate(start.getDate() - 40);
  let s = emptyState();

  s = saveMed(s, { name: "Vitamina D", dose: "2.000 UI", kind: "daily", times: ["Manhã"] }, "demo-vitd", start);
  s = saveMed(s, { name: "Ômega 3", dose: "", kind: "daily", times: ["Manhã", "Noite"] }, "demo-omega", start);
  s = saveMed(s, { name: "Hormônio", dose: "1 ampola", kind: "interval", every: { n: 90, unit: "day" } }, "demo-horm", start);
  for (let i = 1; i <= 27; i++) {
    if (i % 9 !== 0) s = toggleDose(s, "demo-vitd", "Manhã", day(-i));
    if (i % 4 !== 0) s = toggleDose(s, "demo-omega", "Manhã", day(-i));
    if (i % 3 !== 0 && i % 7 !== 0) s = toggleDose(s, "demo-omega", "Noite", day(-i));
  }
  s = toggleDose(s, "demo-vitd", "Manhã", day(0));
  s = toggleDose(s, "demo-omega", "Manhã", day(0));
  s = toggleDose(s, "demo-horm", "dose", day(-62)); // próxima dose em cerca de 4 semanas

  s = saveMeal(s, { name: "Café da manhã", text: "" }, "demo-m1", start);
  s = saveMeal(s, { name: "Almoço", text: "" }, "demo-m2", start);
  s = saveMeal(s, { name: "Jantar", text: "" }, "demo-m3", start);
  for (let i = 1; i <= 27; i++) {
    const status = i % 5 === 0 ? "fora" : i % 3 === 0 ? "parcial" : "ok";
    for (const id of ["demo-m1", "demo-m2", "demo-m3"]) s = setMealStatus(s, id, day(-i), status);
  }
  s = setMealStatus(s, "demo-m1", day(0), "ok");
  s = setMealStatus(s, "demo-m2", day(0), "ok");

  s = setWeight(s, 72.4, now);
  s = saveNutrition(s, {
    heightCm: 170, birthYear: now.getFullYear() - 30, activity: "moderado", goal: "perder",
    formula: "media", microRef: "masculina", kcalManual: "", hideNumbers: false,
  }, now);
  const eat = (mealId, food, g, id) => { s = addFoodEntry(s, { mealId, name: food.name, per100: food.per100, g }, day(0), id, now); };
  eat("demo-m1", FOODS.ovo, 100, "demo-e1");
  eat("demo-m1", FOODS.banana, 100, "demo-e2");
  eat("demo-m2", FOODS.arroz, 150, "demo-e3");
  eat("demo-m2", FOODS.feijao, 100, "demo-e4");
  eat("demo-m2", FOODS.frango, 120, "demo-e5");
  // Valores de MET do Compendium (03025 e 05060); os nomes são só o apelido que a pessoa daria.
  s = addActivity(s, { code: "03025", name: "Forró de sábado", met: 4.5, table: "adulto", minutes: 60 }, day(0), "demo-a1", now);
  s = addActivity(s, { code: "05060", name: "Compras no mercado", met: 3.3, table: "adulto", minutes: 20 }, day(0), "demo-a2", now);
  s = addFavorite(s, { code: "03025", table: "adulto", alias: "Forró de sábado" }, "demo-f1", now);
  s = addFavorite(s, { code: "17082", table: "adulto", alias: "Trilha com a turma" }, "demo-f2", now);
  return s;
}

// ---------- Passos ----------

function exercisePreview() {
  const ex = EXERCISES.flexao;
  const level = ex.levels[1]; // Flexão no chão
  return `
    <section class="exercise">
      <div class="frame">
        <img src="assets/ex/${encodeURIComponent(level.img)}/0.jpg" alt="" width="640" height="427">
        <img class="end" src="assets/ex/${encodeURIComponent(level.img)}/1.jpg" alt="" width="640" height="427">
      </div>
      <h2>${esc(level.name)}</h2>
      <p class="target">${ex.sets} séries de ${ex.repMin} a ${ex.repMax}</p>
      <p class="tempo">${esc(ex.tempo)}</p>
      <ul class="tour-cues">${ex.cues.slice(0, 2).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
    </section>`;
}

function habitPreview(state, now) {
  const c = habitCards(state, now);
  const cards = [
    { name: "Treino", value: "2/3", label: "treinos esta semana", status: "" },
    { name: "Remédios", value: `${c.meds.pct ?? "–"}%`, label: "doses, 7 dias", status: "" },
    { name: "Hormônios", value: c.hormones.value, label: c.hormones.label, status: c.hormones.status },
    { name: "Dieta", value: `${c.diet.pct ?? "–"}%`, label: "plano, 7 dias", status: "" },
  ];
  return `<div class="habit-cards">${cards.map((k) => `
    <span class="habit-card ${k.status}"><span class="habit-name">${esc(k.name)}</span><strong>${esc(k.value)}</strong><span class="small">${esc(k.label)}</span></span>`).join("")}</div>`;
}

export const SLIDES = [
  {
    id: "treino", title: "Treinos com fotos",
    text: "Cada exercício mostra a foto da posição inicial e da final, com dicas de como fazer. Marque as séries, anote o peso e o app avisa quando for hora de subir a carga.",
    caption: "Exemplo. As duas fotos se alternam sozinhas, para você ver o movimento.",
    preview: () => exercisePreview(),
  },
  {
    id: "dieta", title: "Dieta e check das refeições",
    text: "Anexe o PDF do plano alimentar ou cadastre as refeições. A cada dia, marque Segui, Em parte ou Fora e veja quanto resta de calorias.",
    preview: (s, now) => dietGlance(s, now),
  },
  {
    id: "nutrientes", title: "Calorias, macros e vitaminas",
    text: "Registre o que você comeu, com a tabela TACO e produtos de marca, e acompanhe calorias, proteínas, carboidratos, gorduras, vitaminas e minerais contra as suas metas.",
    preview: (s, now) => nutriGlance(s, now, dayKey(now)),
  },
  {
    id: "atividades", title: "Todo movimento conta",
    text: "Dança, trilha, escalada, faxina, compras no mercado: registre qualquer atividade e o gasto vira crédito de calorias no dia. Salve as suas favoritas com o seu nome e ache rápido. Tem tabela própria para quem usa cadeira de rodas.",
    caption: "Exemplo com dados fictícios. Foto: Força Aérea dos EUA, domínio público.",
    preview: (s, now) => `<img class="tour-photo" src="assets/cadeirante-basquete.jpg" alt="Pessoas jogando basquete em cadeira de rodas em uma quadra" width="720" height="481">${activityGlance(s, dayKey(now))}`,
  },
  {
    id: "remedios", title: "Remédios e adesão",
    text: "Marque cada dose do dia e veja a adesão em um calendário. Remédios espaçados, como um hormônio a cada 90 dias, mostram a data da próxima dose.",
    preview: (s, now) => medsGlance(s, now),
  },
  {
    id: "habito", title: "Hábito, peso e Papo Fofo",
    text: "Acompanhe a constância de treino, dieta e remédios num só lugar, registre o peso toda semana e converse com o Papo Fofo para ter música, audiolivro e motivação.",
    preview: (s, now) => habitPreview(s, now),
  },
];

export function renderTour(step, now = new Date()) {
  const n = SLIDES.length;
  const i = Math.min(Math.max(Number(step) || 0, 0), n - 1);
  const slide = SLIDES[i];
  const last = i === n - 1;
  const demo = demoState(now);
  const dots = SLIDES.map((_, k) => `<span class="tour-dot ${k === i ? "on" : ""}"></span>`).join("");
  return `
    <div class="tour">
      <div class="tour-top">
        <p class="tour-dots" role="img" aria-label="Passo ${i + 1} de ${n}">${dots}</p>
        <button type="button" class="switch" data-action="tour-skip">Pular</button>
      </div>
      <h1 class="display">${esc(slide.title)}</h1>
      <p class="lede">${esc(slide.text)}</p>
      <div class="tour-preview" inert aria-hidden="true">${slide.preview(demo, now)}</div>
      <p class="small tour-caption">${esc(slide.caption ?? "Exemplo com dados fictícios.")}</p>
      <div class="tour-nav">
        ${i > 0 ? `<button type="button" class="cta ghost" data-action="tour-back">Voltar</button>` : ""}
        <button type="button" class="cta" data-action="${last ? "tour-done" : "tour-next"}">${last ? "Começar" : "Próximo"}</button>
      </div>
    </div>`;
}

// ---------- Quando mostrar ----------

/** O tour aparece uma vez para quem ainda não o viu (nem pulou). */
export const needsTour = (state) => !state.tour;

export function finishTour(state, skipped, now) {
  return { ...state, tour: { skipped: skipped === true, updatedAt: new Date(now).toISOString() } };
}
