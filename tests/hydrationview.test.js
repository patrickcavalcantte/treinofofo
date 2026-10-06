import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderWater, remainingText, waterCard } from "../js/hydrationview.js";
import { addWater, saveHydration } from "../js/hydration.js";
import { emptyState, setWeight, dayKey } from "../js/logic.js";

const NOW = new Date(2026, 10, 3, 14, 5);
const KEY = dayKey(NOW);
const withKg = (kg) => setWeight(emptyState(), kg, NOW);
const flat = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const bad = (h) => /undefined|NaN|\[object|Infinity/.test(h);

describe("texto do que falta", () => {
  test("falta, meta batida e acima", () => {
    assert.equal(remainingText(500, 2450), "Faltam 1,95 L");
    assert.equal(remainingText(2450, 2450), "Meta batida");
    assert.equal(remainingText(2900, 2450), "Meta batida");
    assert.equal(remainingText(3300, 2450), "Acima da meta");
    assert.equal(remainingText(1900, 2000), "Faltam 100 ml");
  });
});

describe("cartão da home", () => {
  test("mostra o total e a meta, ou pede o peso", () => {
    assert.deepEqual(waterCard(addWater(withKg(70), 500, KEY, "a", NOW), NOW, KEY), { value: "500 ml", label: "de 2,45 L hoje" });
    assert.deepEqual(waterCard(emptyState(), NOW, KEY), { value: "–", label: "registre o peso para a meta" });
    assert.deepEqual(waterCard(addWater(emptyState(), 300, KEY, "a", NOW), NOW, KEY), { value: "300 ml", label: "registrado hoje" });
  });
});

describe("tela de hidratação", () => {
  test("com peso: anel, o que falta, botões rápidos, semana e explicação sem a altura", () => {
    const html = renderWater(addWater(withKg(70), 700, KEY, "a", NOW), NOW, KEY);
    assert.equal(bad(html), false);
    const text = flat(html);
    assert.match(text, /700 ml de 2,45 L/);
    assert.match(text, /Faltam 1,75 L/);
    for (const ml of [200, 300, 500]) assert.match(html, new RegExp(`data-action="water-add" data-ml="${ml}"`));
    assert.match(html, /data-action="water-custom"/);
    assert.match(html, /class="water-week"/);
    assert.match(text, /35 ml por kg de peso \(70 kg\)/);
    assert.match(text, /A altura não entra na conta/);
    assert.match(text, /Beber demais também faz mal/);
    assert.match(text, /EFSA/);
  });
  test("lista os registros do dia com horário e botão de remover", () => {
    const html = renderWater(addWater(withKg(70), 250, KEY, "abc", NOW), NOW, KEY);
    assert.match(html, /data-action="water-remove" data-day="2026-11-03" data-id="abc"/);
    assert.match(flat(html), /250 ml/);
  });
  test("sem registros, diz que não há nada hoje", () => {
    assert.match(flat(renderWater(withKg(70), NOW, KEY)), /Nada registrado hoje/);
  });
  test("sem peso: pede o peso, mas deixa registrar", () => {
    const html = renderWater(emptyState(), NOW, KEY);
    assert.equal(bad(html), false);
    assert.match(flat(html), /usa o seu peso/);
    assert.match(html, /data-view="weight"/);
    assert.match(html, /data-action="water-add"/);
  });
  test("com meta digitada, explica e preenche o campo", () => {
    const html = renderWater(saveHydration(withKg(70), { goalMl: 3000 }, NOW), NOW, KEY);
    assert.match(flat(html), /Você digitou a meta de 3 L/);
    assert.match(html, /name="goalMl"[^>]*value="3000"/);
    assert.match(flat(html), /de 3 L/);
  });
  test("meta batida mostra o estado e a barra do anel cheia", () => {
    let s = withKg(60); // meta de 2,1 L
    for (const id of ["a", "b", "c", "d", "e"]) s = addWater(s, 450, KEY, id, NOW); // 2.250 ml
    const html = renderWater(s, NOW, KEY);
    assert.match(flat(html), /Meta batida/);
    assert.match(html, /--pct:100/);
  });
});
