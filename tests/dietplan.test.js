import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mealNameOf, detectMeals, extractTextItems, extractLayout, mealsFromLayout, validatePdf, MAX_PDF_BYTES } from "../js/dietplan.js";
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

describe("mealsFromLayout (texto pela posição)", () => {
  // Item de texto como o leitor de PDF entrega: x e y em pontos, w é a largura do trecho. Página A4 (596 x 842).
  const it = (page, y, str, x = 60, w = str.length * 3) => ({ page, str, x, y, w, pageW: 596, pageH: 842 });
  const text = (meals, name) => meals.find((m) => m.name === name)?.text;

  const basic = [
    it(1, 100, "Plano alimentar para Fulano"), // ruído de cabeçalho: ignorado
    it(1, 150, "Café da manhã"),
    it(1, 165, "-Pão integral (2 fatias)"),
    it(1, 180, "-Ovo (2 unidades)"),
    it(1, 210, "Substituição 1", 275, 43),
    it(1, 225, "-Tapioca (40g)"),
    it(1, 300, "Almoço"),
    it(1, 315, "-Arroz (70g)"),
  ];

  test("cada refeição fica com o que vem depois do nome dela, e o rótulo centralizado entra no lugar certo", () => {
    const meals = mealsFromLayout(basic);
    assert.deepEqual(meals.map((m) => m.name), ["Café da manhã", "Almoço"]);
    assert.equal(text(meals, "Café da manhã"), "-Pão integral (2 fatias)\n-Ovo (2 unidades)\nSubstituição 1\n-Tapioca (40g)");
    assert.equal(text(meals, "Almoço"), "-Arroz (70g)");
  });

  test("a ordem em que o leitor entrega os trechos não importa", () => {
    const shuffled = [...basic].reverse();
    assert.deepEqual(mealsFromLayout(shuffled), mealsFromLayout(basic));
  });

  test("palavra partida em dois trechos encostados volta a ser uma só", () => {
    const meals = mealsFromLayout([
      it(1, 100, "Almoço"),
      it(1, 120, "-Pã", 60, 10), it(1, 120, "o integral", 70, 30), // encostados, sem espaço
    ]);
    assert.equal(text(meals, "Almoço"), "-Pão integral");
  });

  test("trechos separados por um espaço que o leitor não entregou ganham o espaço", () => {
    const meals = mealsFromLayout([
      it(1, 100, "Almoço"),
      it(1, 120, "-Arroz ou", 60, 30), it(1, 120, "feijão", 93, 18), // folga de 3 pontos
    ]);
    assert.equal(text(meals, "Almoço"), "-Arroz ou feijão");
  });

  test("trechos longe um do outro na mesma linha continuam separados", () => {
    const meals = mealsFromLayout([it(1, 100, "Almoço"), it(1, 120, "-Arroz", 60, 20), it(1, 120, "Observação", 300, 40)]);
    assert.equal(text(meals, "Almoço"), "-Arroz\nObservação");
  });

  test("horário solto logo acima do nome vira o horário da refeição e não suja a anterior", () => {
    const meals = mealsFromLayout([
      it(1, 100, "Almoço"), it(1, 115, "-Arroz"),
      it(1, 190, "20:00"), it(1, 208, "Jantar"), it(1, 223, "-Sopa"),
    ]);
    assert.equal(text(meals, "Almoço"), "-Arroz");
    assert.equal(meals.find((m) => m.name === "Jantar").time, "20:00");
    assert.equal(text(meals, "Jantar"), "Horário: 20:00\n\n-Sopa");
  });

  test("cabeçalho, rodapé e linhas de ruído ficam de fora", () => {
    const meals = mealsFromLayout([
      it(1, 10, "Topo da página"), it(1, 100, "Almoço"), it(1, 120, "-Arroz"),
      it(1, 130, "Plano válido até 01/01/2027"), it(1, 830, "Rodapé"),
    ]);
    assert.equal(text(meals, "Almoço"), "-Arroz");
  });

  test("a refeição continua na página seguinte até aparecer o próximo nome", () => {
    const meals = mealsFromLayout([
      it(1, 100, "Jantar"), it(1, 780, "-Sopa"),
      it(2, 60, "Substituição 1", 275), it(2, 80, "-Omelete"),
      it(2, 200, "Ceia"), it(2, 220, "-Fruta"),
    ]);
    assert.equal(text(meals, "Jantar"), "-Sopa\nSubstituição 1\n-Omelete");
    assert.equal(text(meals, "Ceia"), "-Fruta");
  });

  test("o que vem antes do primeiro nome é descartado, e nome repetido junta o texto", () => {
    const meals = mealsFromLayout([
      it(1, 100, "Todos os dias"), it(1, 120, "Nutricionista Fulana"),
      it(1, 150, "Almoço"), it(1, 165, "-Arroz"),
      it(1, 300, "Almoço"), it(1, 315, "-Feijão"),
    ]);
    assert.equal(meals.length, 1);
    assert.equal(text(meals, "Almoço"), "-Arroz\n-Feijão");
  });

  test("devolve as refeições na ordem do dia", () => {
    const meals = mealsFromLayout([it(1, 100, "Ceia"), it(1, 150, "Jantar"), it(1, 200, "Café da manhã"), it(1, 250, "Almoço")]);
    assert.deepEqual(meals.map((m) => m.name), ["Café da manhã", "Almoço", "Jantar", "Ceia"]);
  });

  test("sem nenhum nome de refeição, devolve lista vazia", () => {
    assert.deepEqual(mealsFromLayout([it(1, 100, "Plano de treino"), it(1, 120, "-Agachamento")]), []);
    assert.deepEqual(mealsFromLayout([]), []);
  });

  test("extractLayout traz a posição de cada trecho, com a origem no topo da página", async () => {
    const pdfjs = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: () => ({ width: 596, height: 842 }),
            getTextContent: async () => ({ items: [{ str: "Almoço", transform: [1, 0, 0, 1, 60, 700], width: 30 }, { str: " ", transform: [1, 0, 0, 1, 0, 0], width: 3 }] }),
          }),
        }),
      }),
    };
    assert.deepEqual(await extractLayout(new Uint8Array(1), pdfjs), [{ page: 1, str: "Almoço", x: 60, y: 142, w: 30, pageW: 596, pageH: 842 }]);
  });
});