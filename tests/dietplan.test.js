import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mealNameOf, detectMeals, extractTextItems, validatePdf, MAX_PDF_BYTES } from "../js/dietplan.js";
import { emptyState, setDietPlan, clearDietPlan, activeDietPlan, mergeStates } from "../js/logic.js";

describe("mealNameOf", () => {
  test("reconhece os nomes comuns, com ou sem acento e maiúscula", () => {
    assert.equal(mealNameOf("Café da manhã"), "Café da manhã");
    assert.equal(mealNameOf("CAFE DA MANHA"), "Café da manhã");
    assert.equal(mealNameOf("Almoço "), "Almoço");
    assert.equal(mealNameOf("almoco"), "Almoço");
    assert.equal(mealNameOf("Jantar"), "Jantar");
    assert.equal(mealNameOf("Ceia"), "Ceia");
    assert.equal(mealNameOf("Desjejum"), "Desjejum");
  });
  test("mantém o nome como está escrito nos lanches e colações", () => {
    assert.equal(mealNameOf("Lanche da manhã"), "Lanche da manhã");
    assert.equal(mealNameOf("Lanche da tarde "), "Lanche da tarde");
    assert.equal(mealNameOf("Colação"), "Colação");
    assert.equal(mealNameOf("lanche da tarde"), "Lanche da tarde");
  });
  test("aceita horário e marcadores ao lado do nome", () => {
    assert.equal(mealNameOf("Almoço - 12:30"), "Almoço");
    assert.equal(mealNameOf("Jantar 20h"), "Jantar");
    assert.equal(mealNameOf("Café da manhã: 07:00"), "Café da manhã");
    assert.equal(mealNameOf("1. Almoço"), "Almoço");
    assert.equal(mealNameOf("• Ceia"), "Ceia");
  });
  test("não confunde com linhas de alimento nem com frases", () => {
    for (const text of [
      "-Café com leite desnatado com adoçante", "Café com leite", "Almoço e jantar com salada", "Substituição 1",
      "Lanche da tarde: pão com ovo ou queijo cottage com tomate", "21:00", "Plano alimentar", "", null, undefined,
      "Pão no jantar", "x".repeat(60),
    ]) assert.equal(mealNameOf(text), null, String(text));
  });
});

describe("detectMeals", () => {
  test("devolve as refeições na ordem do dia, mesmo que o PDF as entregue embaralhadas", () => {
    const found = detectMeals(["Jantar", "texto", "Almoço", "Café da manhã", "Ceia", "Lanche da tarde", "Lanche da manhã"]);
    assert.deepEqual(found, ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia"]);
  });
  test("não repete uma refeição que aparece várias vezes", () => {
    assert.deepEqual(detectMeals(["Almoço", "-arroz", "Almoço", "ALMOÇO", "Jantar"]), ["Almoço", "Jantar"]);
  });
  test("sem nenhum nome reconhecido, a lista é vazia", () => {
    assert.deepEqual(detectMeals(["Plano alimentar", "Substituição 1", "-Pão integral"]), []);
    assert.deepEqual(detectMeals([]), []);
  });
  test("pré e pós-treino entram no lugar certo", () => {
    assert.deepEqual(detectMeals(["Jantar", "Pós-treino", "Almoço", "Pré-treino"]), ["Almoço", "Pré-treino", "Pós-treino", "Jantar"]);
  });
});

describe("extractTextItems", () => {
  const fakePdfjs = (pages) => ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n) => ({ getTextContent: async () => ({ items: pages[n - 1] }) }),
      }),
    }),
  });
  test("junta o texto de todas as páginas, sem trechos vazios", async () => {
    const pdfjs = fakePdfjs([[{ str: "Café da manhã" }, { str: "  " }, { str: "-pão" }], [{ str: "Almoço" }, { type: "beginMarkedContent" }]]);
    assert.deepEqual(await extractTextItems(new Uint8Array(1), pdfjs), ["Café da manhã", "-pão", "Almoço"]);
  });
  test("PDF sem texto (só imagem) devolve lista vazia", async () => {
    assert.deepEqual(await extractTextItems(new Uint8Array(1), fakePdfjs([[]])), []);
  });
});

describe("validatePdf", () => {
  test("aceita PDF pelo tipo ou pela extensão", () => {
    validatePdf({ name: "a.pdf", type: "application/pdf", size: 1000 });
    validatePdf({ name: "PLANO.PDF", type: "", size: 1000 });
  });
  test("recusa outros arquivos, arquivo vazio e arquivo grande demais", () => {
    assert.throws(() => validatePdf(null), /Escolha/);
    assert.throws(() => validatePdf({ name: "a.png", type: "image/png", size: 10 }), /PDF/);
    assert.throws(() => validatePdf({ name: "a.pdf", type: "application/pdf", size: 0 }), /vazio/);
    assert.throws(() => validatePdf({ name: "a.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }), /10 MB/);
  });
});

describe("plano em PDF no estado", () => {
  const NOW = new Date(2026, 9, 6, 10, 0);
  test("setDietPlan guarda os dados do arquivo, e só eles", () => {
    const s = setDietPlan(emptyState(), { name: "  meu plano.pdf ", size: 526808, path: "u1/dieta.pdf" }, NOW);
    assert.deepEqual(Object.keys(s.dietPlan).sort(), ["at", "name", "path", "size"]);
    assert.equal(s.dietPlan.name, "meu plano.pdf");
    assert.equal(activeDietPlan(s).path, "u1/dieta.pdf");
  });
  test("remover deixa um marcador e o plano deixa de estar ativo", () => {
    const s = clearDietPlan(setDietPlan(emptyState(), { name: "a.pdf", size: 1, path: "u1/dieta.pdf" }, NOW), new Date(2026, 9, 7));
    assert.equal(activeDietPlan(s), null);
    assert.equal(s.dietPlan.removed, true);
  });
  test("sem plano, nada está ativo", () => {
    assert.equal(activeDietPlan(emptyState()), null);
    assert.equal(activeDietPlan({ ...emptyState(), dietPlan: undefined }), null);
  });
  test("na sincronização vale o anexo ou a remoção mais recente", () => {
    const attached = { ...setDietPlan(emptyState(), { name: "a.pdf", size: 1, path: "u1/dieta.pdf" }, new Date(2026, 9, 6)), savedAt: "2026-10-06T10:00:00Z" };
    const removed = { ...clearDietPlan(attached, new Date(2026, 9, 7)), savedAt: "2026-10-07T10:00:00Z" };
    assert.equal(activeDietPlan(mergeStates(attached, removed)), null);
    assert.equal(activeDietPlan(mergeStates(removed, attached)), null);
    const replaced = { ...setDietPlan(removed, { name: "b.pdf", size: 2, path: "u1/dieta.pdf" }, new Date(2026, 9, 8)), savedAt: "2026-10-08T10:00:00Z" };
    assert.equal(activeDietPlan(mergeStates(removed, replaced)).name, "b.pdf");
  });
  test("se só um lado tem o plano, ele vale", () => {
    const withPlan = { ...setDietPlan(emptyState(), { name: "a.pdf", size: 1, path: "p" }, NOW), savedAt: "2026-10-06T10:00:00Z" };
    const without = { ...emptyState(), savedAt: "2026-10-07T10:00:00Z" };
    assert.equal(activeDietPlan(mergeStates(without, withPlan)).name, "a.pdf");
    assert.equal(mergeStates({ ...without, dietPlan: undefined }, { ...without, dietPlan: undefined }).dietPlan, null);
  });
});
