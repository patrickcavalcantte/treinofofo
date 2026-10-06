import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  GENDERS, GOALS, LEVELS, EMPHASES, SOURCES, DISCLAIMER, EVIDENCE_LIMIT,
  goalsFor, planFor, buildProfile, skippedProfile, needsOnboarding, defaultEmphasis, rotationFor as profileRotation, cleanName, greeting,
} from "../js/onboarding.js";
import {
  emptyState, weeklyGoal, weekStreak, mergeStates, nextWorkoutKey, rotationFor,
} from "../js/logic.js";
import { WORKOUTS } from "../js/data.js";

const NOW = new Date(2026, 9, 6, 10, 0);

describe("opções", () => {
  test("os gêneros incluem mulher trans e homem trans, com ids únicos", () => {
    assert.deepEqual(GENDERS.map((g) => g.label), ["Feminino", "Masculino", "Mulher trans", "Homem trans", "Não binário", "Prefiro não informar"]);
    assert.equal(new Set(GENDERS.map((g) => g.id)).size, GENDERS.length);
  });
  test("o aviso diz que o app não substitui um profissional de educação física", () => {
    assert.match(DISCLAIMER, /não substitui um profissional de educação física/);
  });
});

describe("objetivos por gênero", () => {
  test("cada gênero vê 4 objetivos em destaque, todos existentes", () => {
    for (const g of GENDERS) {
      const list = goalsFor(g.id);
      assert.equal(list.length, 4, g.id);
      assert.ok(list.every((x) => GOALS[x.id]), g.id);
    }
  });
  test("glúteos e pernas aparece em destaque para feminino e mulher trans, e homem trans vê hipertrofia primeiro", () => {
    assert.ok(goalsFor("feminino").some((g) => g.id === "gluteos"));
    assert.ok(goalsFor("mulher-trans").some((g) => g.id === "gluteos"));
    assert.equal(goalsFor("homem-trans")[0].id, "hipertrofia");
  });
  test("ver todos mostra todos os objetivos sem repetir", () => {
    for (const g of GENDERS) {
      const ids = goalsFor(g.id, true).map((x) => x.id);
      assert.equal(ids.length, Object.keys(GOALS).length);
      assert.equal(new Set(ids).size, ids.length);
    }
  });
  test("gênero desconhecido cai na lista padrão", () => {
    assert.equal(goalsFor("qualquer").length, 4);
  });
});

describe("ênfase e rotação", () => {
  test("a sugestão segue o objetivo primeiro e o gênero depois", () => {
    assert.equal(defaultEmphasis("homem-trans", "forca"), "superiores");
    assert.equal(defaultEmphasis("mulher-trans", "forca"), "inferiores");
    assert.equal(defaultEmphasis("feminino", "forca"), "completo");
    assert.equal(defaultEmphasis("masculino", "forca"), "completo");
    assert.equal(defaultEmphasis("nao-binario", "forca"), "completo");
    assert.equal(defaultEmphasis("homem-trans", "gluteos"), "inferiores");
    assert.equal(defaultEmphasis("mulher-trans", "bracos"), "superiores");
    assert.equal(defaultEmphasis("mulher-trans", "completo"), "completo");
  });
  test("a pessoa pode escolher qualquer ênfase, independentemente do gênero", () => {
    for (const g of GENDERS) for (const e of Object.keys(EMPHASES)) {
      assert.equal(planFor("forca", "intermediario", g.id, e).emphasis, e, `${g.id}/${e}`);
    }
  });
  test("a rotação só usa treinos que existem", () => {
    for (const e of Object.values(EMPHASES)) assert.ok(e.rotation.every((k) => WORKOUTS[k]));
    assert.deepEqual(EMPHASES.completo.rotation, ["A", "C", "B", "D"]);
  });
  test("objetivos com treino preferido começam por ele, quando está na rotação", () => {
    assert.deepEqual(profileRotation("superiores", "bracos"), ["B", "A"]);
    assert.deepEqual(profileRotation("inferiores", "gluteos"), ["C", "D"]);
    assert.deepEqual(profileRotation("completo", "gluteos"), ["C", "B", "D", "A"]);
    assert.deepEqual(profileRotation("inferiores", "bracos"), ["C", "D"]); // B não está na rotação
  });
  test("ênfase inválida é recusada", () => {
    assert.throws(() => profileRotation("braços", "forca"), /ênfase/);
  });
});

describe("sugestão de treino", () => {
  test("todo objetivo, nível e ênfase gera um plano com treinos que existem", () => {
    for (const goal of Object.keys(GOALS)) for (const level of LEVELS) for (const emphasis of Object.keys(EMPHASES)) {
      const p = planFor(goal, level.id, "feminino", emphasis);
      assert.ok(p.rotation.every((k) => WORKOUTS[k]), `${goal}/${level.id}/${emphasis}`);
      assert.equal(p.start, p.rotation[0]);
      assert.ok(p.perWeek >= 2 && p.perWeek <= 4);
      assert.ok(p.points.length >= 3);
    }
  });
  test("sem ênfase informada, usa a sugerida", () => {
    assert.equal(planFor("forca", "iniciante", "mulher-trans").emphasis, "inferiores");
  });
  test("quem está começando faz no máximo 3 treinos e recebe aviso de cargas leves", () => {
    const p = planFor("definicao", "iniciante", "masculino", "completo");
    assert.equal(p.perWeek, 3);
    assert.match(p.points.join(" "), /cargas bem leves/);
    assert.equal(planFor("definicao", "intermediario", "masculino", "completo").perWeek, 4);
  });
  test("nota sobre terapia hormonal só para mulher trans, homem trans e não binário", () => {
    for (const g of ["mulher-trans", "homem-trans", "nao-binario"]) assert.equal(planFor("forca", "iniciante", g).notes.length, 1, g);
    for (const g of ["feminino", "masculino", "nao-informar"]) assert.equal(planFor("forca", "iniciante", g).notes.length, 0, g);
  });
  test("objetivo desconhecido é recusado", () => {
    assert.throws(() => planFor("flexibilidade", "iniciante", "feminino"), /objetivo/);
  });
  test("o objetivo de força admite o limite dos halteres leves", () => {
    assert.match(planFor("forca", "iniciante", "feminino").points.join(" "), /4 kg.*limite/);
  });
});

describe("evidência científica", () => {
  test("toda fonte citada existe e tem link seguro", () => {
    for (const g of GENDERS) for (const goal of Object.keys(GOALS)) {
      for (const e of planFor(goal, "iniciante", g.id).evidence) {
        for (const id of e.sources) assert.ok(SOURCES.some((s) => s.id === id), `${g.id}: fonte ${id}`);
      }
    }
    for (const s of SOURCES) { assert.match(s.url, /^https:\/\//); assert.ok(s.text.length > 40 && s.short); }
  });
  test("homem trans e mulher trans recebem achados diferentes, coerentes com os estudos", () => {
    const man = planFor("forca", "iniciante", "homem-trans").evidence.map((e) => e.text).join(" ");
    const woman = planFor("forca", "iniciante", "mulher-trans").evidence.map((e) => e.text).join(" ");
    assert.match(man, /aumento de massa e de força/);
    assert.match(man, /cerca de 18%/);
    assert.match(woman, /queda de cerca de 5% na massa muscular da coxa/);
    assert.match(woman, /em 3 de 6 estudos, queda de 6 a 8% na força/);
    assert.notEqual(man, woman);
  });
  test("a preferência por pernas e glúteos é apresentada como preferência, não como achado", () => {
    const text = planFor("forca", "iniciante", "mulher-trans").evidence.map((e) => e.text).join(" ");
    assert.match(text, /preferência comum.*não vem de um estudo/);
  });
  test("todo plano traz o achado geral sobre cargas e o limite das pesquisas", () => {
    for (const g of GENDERS) assert.match(planFor("forca", "iniciante", g.id).evidence.at(-1).text, /cargas leves ou pesadas/);
    assert.match(EVIDENCE_LIMIT, /Nenhum desses estudos testou um programa de musculação em pessoas trans/);
  });
  test("pessoas sem dados específicos recebem só o achado geral", () => {
    assert.equal(planFor("forca", "iniciante", "feminino").evidence.length, 1);
    assert.equal(planFor("forca", "iniciante", "masculino").evidence.length, 1);
  });
});

describe("perfil", () => {
  test("buildProfile guarda as escolhas, a rotação e a meta semanal sugerida", () => {
    const p = buildProfile({ gender: "mulher-trans", goal: "gluteos", level: "intermediario", emphasis: "inferiores" }, NOW);
    assert.deepEqual([p.gender, p.goal, p.level, p.emphasis, p.perWeek, p.start], ["mulher-trans", "gluteos", "intermediario", "inferiores", 3, "C"]);
    assert.deepEqual(p.rotation, ["C", "D"]);
  });
  test("recusa escolhas inválidas", () => {
    assert.throws(() => buildProfile({ gender: "x", goal: "forca", level: "iniciante", emphasis: "completo" }, NOW), /gênero/);
    assert.throws(() => buildProfile({ gender: "feminino", goal: "forca", level: "x", emphasis: "completo" }, NOW), /nível/);
    assert.throws(() => buildProfile({ gender: "feminino", goal: "x", level: "iniciante", emphasis: "completo" }, NOW), /objetivo/);
    assert.throws(() => buildProfile({ gender: "feminino", goal: "forca", level: "iniciante", emphasis: "x" }, NOW), /ênfase/);
  });
  test("needsOnboarding é verdadeiro até existir perfil ou pulo", () => {
    assert.equal(needsOnboarding(emptyState()), true);
    assert.equal(needsOnboarding({ ...emptyState(), profile: skippedProfile(NOW) }), false);
    assert.equal(needsOnboarding({ version: 1, history: [], levels: {}, draft: null }), true);
  });
});

describe("rotação de treinos no app", () => {
  const sess = (workout, d) => ({ workout, date: new Date(2026, 9, d, 19).toISOString(), entries: {} });
  test("sem perfil, alterna A e B como antes", () => {
    assert.deepEqual(rotationFor(emptyState()), ["A", "B"]);
    assert.equal(nextWorkoutKey([]), "A");
    assert.equal(nextWorkoutKey([sess("A", 1)]), "B");
    assert.equal(nextWorkoutKey([sess("B", 1)]), "A");
  });
  test("com perfil de corpo todo, segue A, C, B, D e dá a volta", () => {
    const rot = ["A", "C", "B", "D"];
    assert.equal(nextWorkoutKey([], rot), "A");
    assert.equal(nextWorkoutKey([sess("A", 1)], rot), "C");
    assert.equal(nextWorkoutKey([sess("C", 1)], rot), "B");
    assert.equal(nextWorkoutKey([sess("D", 1)], rot), "A");
  });
  test("se o último treino não está na rotação nova, volta ao começo dela", () => {
    assert.equal(nextWorkoutKey([sess("A", 1)], ["C", "D"]), "C");
  });
  test("rotationFor ignora rotação inválida e salva no perfil usa a escolhida", () => {
    assert.deepEqual(rotationFor({ ...emptyState(), profile: { rotation: ["C", "D"] } }), ["C", "D"]);
    assert.deepEqual(rotationFor({ ...emptyState(), profile: { rotation: ["Z"] } }), ["A", "B"]);
    assert.deepEqual(rotationFor({ ...emptyState(), profile: { rotation: [] } }), ["A", "B"]);
    assert.deepEqual(rotationFor({ ...emptyState(), profile: { skipped: true } }), ["A", "B"]);
  });
});

describe("meta semanal", () => {
  test("weeklyGoal usa o perfil e cai no padrão sem ele", () => {
    assert.equal(weeklyGoal(emptyState()), 3);
    assert.equal(weeklyGoal({ ...emptyState(), profile: skippedProfile(NOW) }), 3);
    assert.equal(weeklyGoal({ ...emptyState(), profile: { perWeek: 4 } }), 4);
    assert.equal(weeklyGoal({ ...emptyState(), profile: { perWeek: 99 } }), 3);
  });
  test("a sequência de semanas usa a meta do perfil", () => {
    const sess = (m, d) => ({ workout: "A", date: new Date(2026, m - 1, d, 19).toISOString(), entries: {} });
    const history = [sess(9, 28), sess(9, 30), sess(10, 2)];
    const base = { ...emptyState(), history };
    assert.equal(weekStreak(base, new Date(2026, 9, 6)), 1);
    assert.equal(weekStreak({ ...base, profile: { perWeek: 4 } }, new Date(2026, 9, 6)), 0);
  });
});

describe("sincronização do perfil", () => {
  test("o perfil vem do estado mais recente; se só um lado tem, esse vale", () => {
    const a = { ...emptyState(), savedAt: "2026-10-06T10:00:00Z", profile: { perWeek: 2 } };
    const b = { ...emptyState(), savedAt: "2026-10-05T10:00:00Z", profile: { perWeek: 4 } };
    assert.equal(mergeStates(a, b).profile.perWeek, 2);
    const none = { ...emptyState(), savedAt: "2026-10-07T10:00:00Z", profile: null };
    assert.equal(mergeStates(none, b).profile.perWeek, 4);
    assert.equal(mergeStates({ ...none, profile: undefined }, { ...b, profile: undefined }).profile, null);
  });
});

describe("nome e saudação", () => {
  test("cleanName tira espaços sobrando e controle, e limita o tamanho", () => {
    assert.equal(cleanName("  Patrick   Silva  "), "Patrick Silva");
    assert.equal(cleanName("Pat\nrick\t"), "Pat rick");
    assert.equal(cleanName("x".repeat(80)).length, 40);
    for (const empty of ["", "   ", null, undefined]) assert.equal(cleanName(empty), null);
  });
  test("a saudação muda pelo horário e usa o nome quando existe", () => {
    const at = (h) => new Date(2026, 9, 6, h, 30);
    assert.equal(greeting("Patrick", at(8)), "Bom dia, Patrick!");
    assert.equal(greeting("Patrick", at(12)), "Boa tarde, Patrick!");
    assert.equal(greeting("Patrick", at(17)), "Boa tarde, Patrick!");
    assert.equal(greeting("Patrick", at(18)), "Boa noite, Patrick!");
    assert.equal(greeting("Patrick", at(2)), "Boa noite, Patrick!");
    assert.equal(greeting("Patrick", at(5)), "Bom dia, Patrick!");
  });
  test("sem nome, a saudação não deixa vírgula sobrando", () => {
    assert.equal(greeting(null, new Date(2026, 9, 6, 9)), "Bom dia!");
    assert.equal(greeting("   ", new Date(2026, 9, 6, 9)), "Bom dia!");
  });
  test("o perfil guarda o nome limpo, e pular o onboarding mantém o nome", () => {
    const p = buildProfile({ name: "  Ana  ", gender: "feminino", goal: "forca", level: "iniciante", emphasis: "completo" }, NOW);
    assert.equal(p.name, "Ana");
    assert.equal(buildProfile({ gender: "feminino", goal: "forca", level: "iniciante", emphasis: "completo" }, NOW).name, null);
    assert.equal(skippedProfile(NOW, " Ana ").name, "Ana");
    assert.equal(skippedProfile(NOW).name, null);
  });
});