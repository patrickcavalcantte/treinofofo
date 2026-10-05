import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  startOfWeek, sessionsThisWeek, nextWorkoutKey, restWarning, parseReps, parseKg,
  evaluateSets, finishSession, newDraft, createStore, emptyState, lastEntryFor, STORAGE_KEY,
  dayKey, trainedDays, toggleMark, weeklyCounts, weekStreak,
} from "../js/logic.js";

const sets = (...reps) => reps.map((r) => ({ reps: r, kg: 4, done: true }));
// Datas em horário local. 5/out/2026 é uma segunda-feira.
const MON = new Date(2026, 9, 5, 19, 0);
const day = (d, h = 19) => new Date(2026, 9, d, h, 0);

describe("datas e agenda", () => {
  test("semana começa na segunda", () => {
    assert.equal(startOfWeek(day(7)).getDate(), 5);
    assert.equal(startOfWeek(MON).getDate(), 5);
  });

  test("domingo pertence à semana que começou na segunda anterior", () => {
    assert.equal(startOfWeek(day(11)).getDate(), 5);
  });

  test("conta só sessões da semana atual", () => {
    const history = [{ date: day(2).toISOString() }, { date: day(5).toISOString() }, { date: day(7).toISOString() }];
    assert.equal(sessionsThisWeek(history, day(8)), 2);
  });

  test("alterna A e B começando por A", () => {
    assert.equal(nextWorkoutKey([]), "A");
    assert.equal(nextWorkoutKey([{ workout: "A" }]), "B");
    assert.equal(nextWorkoutKey([{ workout: "A" }, { workout: "B" }]), "A");
  });

  test("avisa treino no mesmo dia e em dia seguido, não após folga", () => {
    const h = [{ date: day(5, 7).toISOString() }];
    assert.match(restWarning(h, day(5, 22)), /hoje/);
    assert.match(restWarning(h, day(6, 6)), /ontem/);
    assert.equal(restWarning(h, day(7)), null);
    assert.equal(restWarning([], day(7)), null);
  });
});

describe("entrada de dados", () => {
  test("reps aceita inteiros e rejeita lixo", () => {
    assert.equal(parseReps("12"), 12);
    assert.equal(parseReps(" 8 "), 8);
    for (const bad of ["", "abc", "-3", "1.5", "1000", null, undefined]) assert.equal(parseReps(bad), null, String(bad));
  });

  test("kg aceita vírgula e arredonda para 0,5", () => {
    assert.equal(parseKg("2,5"), 2.5);
    assert.equal(parseKg("3.7"), 3.5);
    assert.equal(parseKg("4"), 4);
    for (const bad of ["", "x", "-1", "99", "1,234"]) assert.equal(parseKg(bad), null, bad);
  });
});

describe("evaluateSets", () => {
  test("incompleto quando faltam séries", () => {
    assert.equal(evaluateSets("roscaDireta", sets(15, 15)).status, "incompleto");
  });

  test("ignora séries não marcadas", () => {
    const s = [...sets(20, 20), { reps: 20, kg: 4, done: false }];
    assert.equal(evaluateSets("roscaDireta", s).status, "incompleto");
  });

  test("flexão no teto sobe de nível", () => {
    const v = evaluateSets("flexao", sets(15, 15, 16), 0);
    assert.equal(v.status, "progredir");
    assert.equal(v.nextLevel, 1);
  });

  test("flexão no último nível sugere tempo, não nível inexistente", () => {
    const v = evaluateSets("flexao", sets(15, 15, 15), 2);
    assert.equal(v.status, "progredir");
    assert.equal(v.nextLevel, undefined);
  });

  test("halter abaixo de 4 kg manda subir peso", () => {
    const s = sets(20, 20, 20).map((x) => ({ ...x, kg: 2 }));
    assert.match(evaluateSets("roscaDireta", s).message, /Suba o peso/);
  });

  test("halter já em 4 kg sugere técnica, não peso", () => {
    assert.match(evaluateSets("roscaDireta", sets(20, 20, 20)).message, /limite dos 4 kg/);
  });

  test("abaixo do mínimo pede ajuste e, na flexão, nível anterior", () => {
    assert.equal(evaluateSets("roscaDireta", sets(12, 10, 9)).status, "ajustar");
    assert.equal(evaluateSets("flexao", sets(5, 4, 4), 1).prevLevel, 0);
  });

  test("dentro da faixa mantém", () => {
    assert.equal(evaluateSets("roscaDireta", sets(15, 14, 13)).status, "manter");
  });

  test("exercício desconhecido lança erro", () => {
    assert.throws(() => evaluateSets("nada", []), /desconhecido/);
  });
});

describe("sessão", () => {
  test("rascunho herda o peso da última vez", () => {
    let state = emptyState();
    const draft = newDraft("A", state, MON);
    draft.entries.roscaDireta.sets.forEach((s) => { s.reps = 12; s.kg = 3; s.done = true; });
    state = finishSession(state, draft, MON);
    const next = newDraft("A", state, day(7));
    assert.equal(next.entries.roscaDireta.sets[0].kg, 3);
    assert.equal(next.entries.roscaDireta.sets[0].done, false);
  });

  test("não conclui treino vazio", () => {
    const state = emptyState();
    assert.throws(() => finishSession(state, newDraft("B", state, MON), MON), /pelo menos uma/);
  });

  test("concluir avança nível da flexão e limpa rascunho", () => {
    const state = emptyState();
    const draft = newDraft("A", state, MON);
    draft.entries.flexao.sets = sets(15, 15, 15);
    const after = finishSession(state, draft, MON);
    assert.equal(after.levels.flexao, 1);
    assert.equal(after.draft, null);
    assert.equal(after.history.length, 1);
    assert.equal(state.history.length, 0, "não muta o estado original");
  });

  test("lastEntryFor pula sessões sem o exercício", () => {
    const history = [
      { date: "a", entries: { roscaDireta: { sets: sets(10, 10, 10) } } },
      { date: "b", entries: { roscaMartelo: { sets: sets(12, 12, 12) } } },
    ];
    assert.equal(lastEntryFor(history, "roscaDireta").date, "a");
    assert.equal(lastEntryFor(history, "flexao"), null);
  });
});

describe("persistência", () => {
  const memory = (initial) => {
    const m = new Map(initial ? [[STORAGE_KEY, initial]] : []);
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m };
  };

  test("ida e volta preserva o estado", () => {
    const mem = memory();
    const store = createStore(mem);
    const s = { ...emptyState(), levels: { flexao: 2 } };
    assert.equal(store.save(s), true);
    assert.deepEqual(store.load(), s);
  });

  test("JSON corrompido ou versão errada volta ao estado vazio", () => {
    assert.deepEqual(createStore(memory("{oops")).load(), emptyState());
    assert.deepEqual(createStore(memory(JSON.stringify({ version: 99, history: [] }))).load(), emptyState());
  });

  test("storage indisponível ou cheio não derruba o app", () => {
    const broken = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); } };
    assert.deepEqual(createStore(broken).load(), emptyState());
    assert.equal(createStore(broken).save(emptyState()), false);
    assert.deepEqual(createStore(null).load(), emptyState());
  });
});

describe("hábito", () => {
  const session = (d) => ({ workout: "A", date: day(d).toISOString(), entries: {} });
  const st = (days, marks = []) => ({ ...emptyState(), history: days.map(session), marks });

  test("dayKey usa data local", () => {
    assert.equal(dayKey(new Date(2026, 9, 5, 23, 59)), "2026-10-05");
  });

  test("dias treinados juntam sessões e marcações sem duplicar", () => {
    const days = trainedDays(st([5], ["2026-10-05", "2026-10-07"]));
    assert.deepEqual([...days].sort(), ["2026-10-05", "2026-10-07"]);
  });

  test("toggleMark liga e desliga, mas não mexe em dia com sessão", () => {
    let s = toggleMark(emptyState(), "2026-10-06");
    assert.deepEqual(s.marks, ["2026-10-06"]);
    s = toggleMark(s, "2026-10-06");
    assert.deepEqual(s.marks, []);
    const withSession = st([5]);
    assert.equal(toggleMark(withSession, "2026-10-05"), withSession);
  });

  test("weeklyCounts conta dias por semana, da mais antiga para a atual", () => {
    const w = weeklyCounts(st([5, 7, 9, 12]), day(14), 3);
    assert.deepEqual(w.map((x) => x.count), [0, 3, 1]);
  });

  test("weekStreak conta semanas seguidas com a meta batida", () => {
    // datas <= 0 caem em setembro (0 = 30/09). Semanas de 21/09 e 28/09 completas; semana atual (5/10) em andamento com 1 treino
    const s = st([-9, -7, -5, -2, 0, 2, 5]);
    assert.equal(weekStreak(s, day(6)), 2);
  });

  test("weekStreak soma a semana atual quando já bateu a meta", () => {
    const s = st([-2, 0, 2, 5, 7, 9]);
    assert.equal(weekStreak(s, day(10)), 2);
  });

  test("weekStreak quebra quando uma semana passada falhou", () => {
    const s = st([-2, 0, 5, 7, 9]);
    assert.equal(weekStreak(s, day(10)), 1);
  });

  test("sem treino, sequência zero", () => {
    assert.equal(weekStreak(emptyState(), day(10)), 0);
  });
});

