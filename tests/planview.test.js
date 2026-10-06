import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { splitPlan, parseBlocks, parseMealPlan } from "../js/dietplan.js";
import { mealPlanHtml, renderPlanView, renderDietView } from "../js/health.js";
import { emptyState, saveMeal, setDietPlan, activeMeals } from "../js/logic.js";

const NOW = new Date(2026, 10, 3, 10, 0);
const types = (blocks) => blocks.map((b) => b.type);

// Texto no mesmo formato que a leitura do PDF produz, com conteúdo inventado.
const SAMPLE = [
  "Horário: 08:00",
  "-Pão integral (2 Fatias) ou Tapioca (40g)",
  "-Ovo (2 Unidades) ou Ovo (1 Unidade) + Queijo",
  "-Fruta da preferência",
  "-Café com leite desnatado com adoçante",
  "VARIAÇÕES DE PREPARAÇÕES SIMILARES COM O OVO",
  "\"Patê de Ovo\"",
  "Modo de preparo: cozinhe o ovo e amasse",
  "com o requeijão e os temperos.",
  "Ou",
  "\"Crepioca\"",
  "Modo de preparo: bata o ovo e a tapioca.",
  "Coloque o queijo no meio.",
  "Substituição 1",
  "-Pão integral (2 Fatias) ou 1 Pão francês",
  "-Queijo cottage (70g)",
  "Substituição 2",
  "-Farelo de aveia (35g)",
  "-Banana (1 Unidade)",
  "*OU REPETIR QUALQUER SUBSTITUIÇÃO DO ALMOÇO.",
].join("\n");

describe("splitPlan", () => {
  test("separa a parte principal das substituições", () => {
    const { main, subs } = splitPlan(SAMPLE);
    assert.match(main, /^Horário: 08:00/);
    assert.equal(subs.length, 2);
    assert.deepEqual(subs.map((s) => s.title), ["Substituição 1", "Substituição 2"]);
    assert.match(subs[0].body, /Queijo cottage/);
  });
  test("aceita o título sem acento e texto sem substituições", () => {
    assert.equal(splitPlan("-A\nSubstituicao 1\n-B").subs.length, 1);
    assert.deepEqual(splitPlan("-A\n-B").subs, []);
    assert.deepEqual(splitPlan(null), { main: "", subs: [] });
  });
});

describe("parseBlocks", () => {
  test("linhas com hífen viram itens, e o texto de cada item não é reescrito", () => {
    const [items] = parseBlocks(["-Torrada (4 Unidades) ou Pão (1 Unidade)", "-Fruta da preferência"]);
    assert.equal(items.type, "items");
    assert.deepEqual(items.items.map((i) => i.raw), ["Torrada (4 Unidades) ou Pão (1 Unidade)", "Fruta da preferência"]);
  });
  test("traço duplo e outros marcadores também valem", () => {
    const [items] = parseBlocks(["--Proteína da preferência", "•Tomate"]);
    assert.deepEqual(items.items.map((i) => i.raw), ["Proteína da preferência", "Tomate"]);
  });
  test("linha quebrada pelo PDF continua o item anterior", () => {
    const [items] = parseBlocks(["-Torrada (4 Unidades) ou Tapioca de", "goma (40g) ou Polvilho (40g)", "ou Abóbora (100g)"]);
    assert.equal(items.items.length, 1);
    assert.equal(items.items[0].raw, "Torrada (4 Unidades) ou Tapioca de goma (40g) ou Polvilho (40g) ou Abóbora (100g)");
  });
  test("frase que começa com maiúscula depois dos itens é observação, não continuação", () => {
    const blocks = parseBlocks(["-Pão (2 Fatias)", "O queijo cottage substitui o ovo."]);
    assert.deepEqual(types(blocks), ["items", "note"]);
  });
  test("receita: título entre aspas e modo de preparo, que continua nas linhas seguintes, inclusive com maiúscula", () => {
    const blocks = parseBlocks(["\"Crepioca\"", "Modo de preparo: bata o ovo.", "Coloque o queijo no meio."]);
    assert.deepEqual(blocks, [{ type: "prep", title: "Crepioca", how: "bata o ovo. Coloque o queijo no meio." }]);
  });
  test("aspas curvas funcionam, e 'Ou' entre receitas vira separador", () => {
    const blocks = parseBlocks(["“Patê de Ovo”", "Modo de preparo: amasse.", "Ou", "“Crepioca”", "Modo de preparo: bata."]);
    assert.deepEqual(types(blocks), ["prep", "or", "prep"]);
    assert.equal(blocks[0].title, "Patê de Ovo");
  });
  test("título em caixa alta, mesmo com minúsculas entre parênteses, vira título", () => {
    const [h] = parseBlocks(["VARIAÇÕES DE PREPARAÇÕES SIMILARES COM O OVO + CARBOIDRATO (tapioca/polvilho/pão)"]);
    assert.equal(h.type, "heading");
  });
  test("nota com asterisco; linha vazia separa grupos de itens", () => {
    const blocks = parseBlocks(["*OU REPETIR QUALQUER SUBSTITUIÇÃO.", "-A", "", "-B"]);
    assert.deepEqual(types(blocks), ["note", "items", "items"]);
  });
  test("receita sem título ainda mostra o modo de preparo", () => {
    assert.deepEqual(parseBlocks(["Modo de preparo: misture tudo."]), [{ type: "prep", title: "", how: "misture tudo." }]);
  });
  test("lista vazia e linhas em branco não geram blocos", () => {
    assert.deepEqual(parseBlocks([]), []);
    assert.deepEqual(parseBlocks(["", "  "]), []);
  });
});

describe("parseMealPlan", () => {
  const plan = parseMealPlan(SAMPLE);
  test("tira o horário e o tira do conteúdo", () => {
    assert.equal(plan.time, "08:00");
    assert.doesNotMatch(JSON.stringify(plan.main), /Horário/);
  });
  test("a parte principal tem itens, título, receitas e separador", () => {
    assert.deepEqual(types(plan.main), ["items", "heading", "prep", "or", "prep"]);
    assert.equal(plan.main[0].items.length, 4);
    assert.equal(plan.main[4].title, "Crepioca");
  });
  test("cada substituição vem com os seus blocos, e a nota final fica na última", () => {
    assert.equal(plan.subs.length, 2);
    assert.deepEqual(types(plan.subs[0].blocks), ["items"]);
    assert.deepEqual(types(plan.subs[1].blocks), ["items", "note"]);
    assert.equal(plan.subs[0].blocks[0].items[1].raw, "Queijo cottage (70g)");
  });
  test("sem horário, o horário é nulo", () => {
    assert.equal(parseMealPlan("-A\n-B").time, null);
  });
});

describe("visualização do plano", () => {
  test("destaca o ou e as quantidades sem mudar o texto", () => {
    const html = mealPlanHtml("-Torrada (4 Unidades) ou Pão (1 Unidade)");
    assert.match(html, /Torrada <span class="dbox-qty">4 Unidades<\/span> <span class="dbox-or">ou<\/span> Pão <span class="dbox-qty">1 Unidade<\/span>/);
    assert.equal(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), "Torrada 4 Unidades ou Pão 1 Unidade");
  });
  test("só destaca parênteses que têm número, e o resto fica como está", () => {
    const html = mealPlanHtml("-Frutas tipo B (Abacaxi/Pêra) (80g)");
    assert.match(html, /\(Abacaxi\/Pêra\)/);
    assert.match(html, /<span class="dbox-qty">80g<\/span>/);
  });
  test("escapa HTML que venha no PDF", () => {
    const html = mealPlanHtml("-<img src=x onerror=alert(1)> (2 un)\n\"<b>Receita</b>\"\nModo de preparo: <script>x</script>");
    assert.doesNotMatch(html, /<img|<script|<b>Receita/);
    assert.match(html, /&lt;img/);
  });
  test("cartão do dia: itens à vista, receitas e substituições recolhidas", () => {
    const html = mealPlanHtml(SAMPLE);
    assert.match(html, /<ul class="dbox-items">/);
    assert.match(html, /Receitas e observações \(3\)/);
    assert.match(html, /<summary>Substituições \(2\)<\/summary>/);
    assert.match(html, /Substituição 1/);
  });
  test("tela completa: tudo à vista, com as substituições em cartões numerados", () => {
    const html = mealPlanHtml(SAMPLE, { compact: false });
    assert.doesNotMatch(html, /<details/);
    assert.match(html, /Patê de Ovo/);
    assert.equal((html.match(/class="dbox-sub"/g) ?? []).length, 2);
  });
  test("texto que não é de plano alimentar aparece como texto simples", () => {
    assert.match(mealPlanHtml("Comer bem e beber água."), /<p class="meal-text">Comer bem/);
  });
  test("a tela Meu plano mostra o horário, o aviso e só as refeições com texto", () => {
    let s = saveMeal(emptyState(), { name: "Café", text: SAMPLE }, "m1", NOW);
    s = saveMeal(s, { name: "Almoço", text: "" }, "m2", NOW);
    const html = renderPlanView(s);
    assert.match(html, /<h2>Café<\/h2>/);
    assert.match(html, /dbox-time">08:00/);
    assert.doesNotMatch(html, /<h2>Almoço<\/h2>/);
    assert.match(html, /pode ter erros/);
  });
  test("sem texto nenhum, a tela convida a anexar o PDF", () => {
    const html = renderPlanView(saveMeal(emptyState(), { name: "Café", text: "" }, "m1", NOW));
    assert.match(html, /Nenhuma refeição tem o texto do plano/);
    assert.match(html, /Ir para a Dieta/);
  });
});

describe("refeição sem texto, com o PDF guardado", () => {
  const withPlan = (text) => {
    const s = saveMeal(emptyState(), { name: "Almoço", text }, "m1", NOW);
    return setDietPlan(s, { name: "plano.pdf", size: 1000, path: "u/dieta.pdf" }, NOW);
  };
  test("o cartão avisa e oferece preencher a partir do PDF", () => {
    const html = renderDietView(withPlan(""), NOW, null);
    assert.match(html, /ainda não tem o texto do plano/);
    assert.match(html, /data-action="plan-reread">Preencher a partir do PDF/);
  });
  test("com o texto preenchido, o cartão traz só um botão para o plano, e não os itens", () => {
    const html = renderDietView(withPlan("-Arroz (70g)\n-Feijão (70g)"), NOW, null);
    assert.doesNotMatch(html, /ainda não tem o texto do plano/);
    assert.match(html, /data-action="plan-view" data-meal="m1">Ver plano alimentar completo/);
    assert.doesNotMatch(html, /dbox-items|dbox-qty|Arroz/); // nada que pareça adicionável ao lado de "+ Adicionar alimento"
    assert.match(html, /data-view="plano">Ver plano completo/);
  });
  test("o botão do plano vem depois de + Adicionar alimento, e o cartão não repete o texto do plano", () => {
    const html = renderDietView(withPlan("-Arroz (70g)"), NOW, null);
    const add = html.indexOf("+ Adicionar alimento");
    const view = html.indexOf("Ver plano alimentar completo");
    assert.ok(add > 0 && view > add);
    assert.doesNotMatch(html.slice(add, view + 80), /70g/);
  });
  test("cada refeição com texto tem o seu botão, apontando para ela", () => {
    let s = saveMeal(emptyState(), { name: "Café", text: "-Pão (2 Fatias)" }, "m1", NOW);
    s = saveMeal(s, { name: "Almoço", text: "-Arroz (70g)" }, "m2", NOW);
    s = saveMeal(s, { name: "Jantar", text: "" }, "m3", NOW);
    const html = renderDietView(s, NOW, null);
    assert.match(html, /data-action="plan-view" data-meal="m1"/);
    assert.match(html, /data-action="plan-view" data-meal="m2"/);
    assert.doesNotMatch(html, /data-action="plan-view" data-meal="m3"/); // sem texto: nada para ver
  });
  test("o cartão do PDF ganha 'Reler o texto'", () => {
    assert.match(renderDietView(withPlan("-A"), NOW, null), /data-action="plan-reread">Reler o texto/);
  });
  test("sem PDF guardado, não oferece preencher", () => {
    const s = saveMeal(emptyState(), { name: "Almoço", text: "" }, "m1", NOW);
    assert.doesNotMatch(renderDietView(s, NOW, null), /Preencher a partir do PDF/);
  });
  test("a revisão de um PDF relido mostra refeições já cadastradas, marcando só as sem texto", () => {
    const s = withPlan("");
    const html = renderDietView(s, NOW, {
      type: "plan", stored: true, canStore: false,
      meals: [
        { name: "Almoço", text: "-Arroz", existingId: "m1", current: "", checked: true },
        { name: "Jantar", text: "-Sopa", existingId: "m9", current: "-Já tinha texto", checked: false },
        { name: "Ceia", text: "-Fruta", existingId: null, current: "", checked: true },
      ],
    });
    assert.match(html, /Sem texto/);
    assert.match(html, /Já cadastrada/);
    assert.match(html, /Marque para preencher com o que está no PDF/);
    assert.match(html, /Marque para substituir pelo que está no PDF/);
    assert.match(html, /O PDF já está guardado na sua conta/);
    assert.doesNotMatch(html, /name="store"/);
    assert.equal((html.match(/name="meal"[^>]*checked/g) ?? []).length, 2); // Almoço e Ceia
    assert.equal((html.match(/name="meal"/g) ?? []).length, 3);
  });
});

describe("tela do plano, só para consulta", () => {
  const state = () => {
    let s = saveMeal(emptyState(), { name: "Café", text: "-Pão (2 Fatias)" }, "m1", NOW);
    return saveMeal(s, { name: "Almoço", text: "-Arroz (70g) ou -Feijão (70g)" }, "m2", NOW);
  };
  test("avisa que é só para consulta e diz como registrar o que comeu", () => {
    const html = renderPlanView(state());
    assert.match(html, /Só para consulta/);
    assert.match(html, /volte à Dieta e use "\+ Adicionar alimento"/);
  });
  test("não tem nenhum botão de marcar nem de adicionar alimento: nada que pareça registrar", () => {
    const html = renderPlanView(state());
    assert.doesNotMatch(html, /data-action="meal"|data-action="food-add"|data-action="food-pick"|data-action="plan-view"/);
  });
  test("cada refeição tem um id para o botão levar direto a ela", () => {
    const html = renderPlanView(state());
    assert.match(html, /<section class="dbox-meal" id="plano-m1">/);
    assert.match(html, /<section class="dbox-meal" id="plano-m2">/);
  });
  test("tem o botão de voltar à Dieta no topo e no fim", () => {
    const html = renderPlanView(state());
    assert.match(html, /data-view="diet">‹ Voltar à Dieta/);
    assert.match(html, /<button class="cta" type="button" data-action="go" data-view="diet">Voltar à Dieta/);
  });
});