import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SLIDES, demoState, renderTour, needsTour, finishTour } from "../js/tour.js";
import { emptyState, mergeStates, dayKey, activeMeds, activeMeals } from "../js/logic.js";
import { kcalBudget, dayTotals, entriesOf } from "../js/nutrition.js";
import { EXERCISES } from "../js/data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date(2026, 9, 6, 10, 0);
const bad = (html) => /undefined|NaN|\[object|Infinity/.test(html);
const flat = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("passos do tour", () => {
  test("são seis, e cobrem fotos dos exercícios, atividades, dieta, nutrientes, remédios e hábito", () => {
    assert.equal(SLIDES.length, 6);
    assert.deepEqual(SLIDES.map((s) => s.id), ["treino", "atividades", "dieta", "nutrientes", "remedios", "habito"]);
    for (const s of SLIDES) { assert.ok(s.title && s.text.length > 40, s.id); assert.equal(typeof s.preview, "function"); }
  });
  test("todo passo tem o botão Pular, e só o primeiro não tem Voltar", () => {
    SLIDES.forEach((_, i) => {
      const html = renderTour(i, NOW);
      assert.match(html, /data-action="tour-skip"/, `passo ${i}`);
      assert.equal(/data-action="tour-back"/.test(html), i > 0, `passo ${i}`);
    });
  });
  test("o último passo termina em Começar; os outros avançam em Próximo", () => {
    const last = renderTour(SLIDES.length - 1, NOW);
    assert.match(last, /data-action="tour-done">Começar/);
    assert.doesNotMatch(last, /data-action="tour-next"/);
    for (let i = 0; i < SLIDES.length - 1; i++) assert.match(renderTour(i, NOW), /data-action="tour-next">Próximo/);
  });
  test("a prévia é só para olhar: não recebe toque nem leitura de tela, e avisa que é exemplo", () => {
    for (let i = 0; i < SLIDES.length; i++) {
      const html = renderTour(i, NOW);
      assert.match(html, /class="tour-preview" inert aria-hidden="true"/);
      assert.match(flat(html), /Exemplo/);
    }
  });
  test("indica o passo atual para leitores de tela e fica dentro dos limites", () => {
    assert.match(renderTour(0, NOW), /aria-label="Passo 1 de 6"/);
    assert.match(renderTour(5, NOW), /aria-label="Passo 6 de 6"/);
    assert.match(renderTour(-3, NOW), /Passo 1 de 6/);
    assert.match(renderTour(99, NOW), /Passo 6 de 6/);
    assert.match(renderTour("x", NOW), /Passo 1 de 6/);
  });
  test("nenhuma tela do tour traz undefined, NaN ou objeto solto", () => {
    for (let i = 0; i < SLIDES.length; i++) assert.equal(bad(renderTour(i, NOW)), false, `passo ${i}`);
  });
});

describe("prévia dos treinos com fotos", () => {
  test("usa as duas fotos reais do exercício, que existem no projeto", () => {
    const html = renderTour(0, NOW);
    const level = EXERCISES.flexao.levels[1];
    assert.match(html, new RegExp(`assets/ex/${level.img}/0\\.jpg`));
    assert.match(html, new RegExp(`assets/ex/${level.img}/1\\.jpg`));
    for (const n of [0, 1]) assert.ok(existsSync(join(root, "assets/ex", level.img, `${n}.jpg`)));
    assert.match(html, /class="frame"/);
    assert.match(html, /séries de 6 a 15/);
  });
});

describe("dados fictícios", () => {
  const demo = demoState(NOW);
  test("têm remédios diários, um remédio espaçado, refeições e alimentos de hoje", () => {
    const meds = activeMeds(demo);
    assert.equal(meds.filter((m) => m.kind === "daily").length, 2);
    assert.equal(meds.filter((m) => m.kind === "interval").length, 1);
    assert.equal(activeMeals(demo).length, 3);
    assert.equal(entriesOf(demo, dayKey(NOW)).length, 5);
  });
  test("o orçamento de calorias de exemplo é plausível e ainda sobra para comer", () => {
    const b = kcalBudget(demo, NOW, dayKey(NOW));
    assert.equal(b.ok, true);
    assert.ok(b.target > 1500 && b.target < 2500, String(b.target));
    assert.ok(b.eaten > 400 && b.eaten < b.target);
    assert.ok(b.remaining > 0);
    assert.equal(b.goal, "perder");
  });
  test("os alimentos de exemplo somam nutrientes de verdade", () => {
    const { totals } = dayTotals(demo, dayKey(NOW));
    assert.ok(totals.protein_g > 40 && totals.carbohydrate_g > 50 && totals.iron_mg > 1);
  });
  test("não carregam nada pessoal: nomes e ids de exemplo", () => {
    const text = JSON.stringify(demo);
    assert.doesNotMatch(text, /@|Patrick|Cavalcante/);
    assert.equal(demo.profile, null); // sem nome, e-mail ou perfil
    assert.equal(demo.dietPlan, null); // e sem nenhum PDF
    assert.ok(activeMeds(demo).every((m) => m.id.startsWith("demo-")));
  });
  test("são sempre os mesmos para o mesmo dia, e não mexem em nenhum estado real", () => {
    assert.deepEqual(demoState(NOW), demoState(NOW));
    const real = emptyState();
    demoState(NOW);
    assert.deepEqual(real, emptyState());
  });
  test("o passo das atividades mostra a foto livre, o crédito e as favoritas", () => {
    const html = renderTour(1, NOW);
    assert.match(html, /assets\/cadeirante-basquete\.jpg/);
    assert.ok(existsSync(join(root, "assets/cadeirante-basquete.jpg")));
    assert.match(flat(html), /domínio público/);
    assert.match(flat(html), /Crédito de \d+ kcal/);
    assert.match(flat(html), /Forró de sábado/);
    assert.match(flat(html), /cadeira de rodas/);
  });
  test("as telas de exemplo mostram números", () => {
    assert.match(flat(renderTour(3, NOW)), /de \d[\d.]* kcal/);
    assert.match(flat(renderTour(3, NOW)), /Restam/);
    assert.match(flat(renderTour(2, NOW)), /Meta .*Registrado .*Restam/);
    assert.match(flat(renderTour(4, NOW)), /Hormônio/);
    assert.match(flat(renderTour(4, NOW)), /em \d+ dias/);
    assert.match(flat(renderTour(5, NOW)), /\d+%/);
  });
});

describe("quando o tour aparece", () => {
  test("aparece para quem ainda não viu, e deixa de aparecer depois de ver ou pular", () => {
    assert.equal(needsTour(emptyState()), true);
    assert.equal(needsTour({ version: 1, history: [], levels: {}, draft: null }), true);
    assert.equal(needsTour(finishTour(emptyState(), false, NOW)), false);
    assert.equal(needsTour(finishTour(emptyState(), true, NOW)), false);
  });
  test("guarda se foi pulado e quando", () => {
    assert.equal(finishTour(emptyState(), true, NOW).tour.skipped, true);
    assert.equal(finishTour(emptyState(), false, NOW).tour.skipped, false);
    assert.equal(finishTour(emptyState(), "sim", NOW).tour.skipped, false); // só `true` conta como pulo
    assert.match(finishTour(emptyState(), false, NOW).tour.updatedAt, /^2026-10-06/);
  });
  test("na sincronização, quem já viu o tour em um aparelho não vê de novo no outro", () => {
    const seen = { ...finishTour(emptyState(), false, new Date(2026, 9, 5)), savedAt: "2026-10-05T10:00:00Z" };
    const fresh = { ...emptyState(), savedAt: "2026-10-06T10:00:00Z" };
    assert.equal(needsTour(mergeStates(fresh, seen)), false);
    assert.equal(needsTour(mergeStates(seen, fresh)), false);
  });
  test("o campo novo não quebra estados antigos", () => {
    const legacy = { version: 1, history: [], levels: {}, draft: null, savedAt: "2026-10-01T10:00:00Z" };
    assert.equal(mergeStates(legacy, { ...emptyState(), savedAt: "2026-10-02T10:00:00Z" }).tour, null);
  });
});
