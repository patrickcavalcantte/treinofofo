import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  reply, intentFromText, contextLine, spotifyUrl, audibleUrl, BOOKS, MORE_BOOKS, PHRASES, MUSIC, pick,
} from "../js/chat.js";

describe("intentFromText", () => {
  test("entende palavras-chave, com ou sem acento e maiúscula", () => {
    assert.equal(intentFromText("Quero ouvir ROCK"), "music:rock");
    assert.equal(intentFromText("algum metal pesado?"), "music:metal");
    assert.equal(intentFromText("pop internacional"), "music:pop");
    assert.equal(intentFromText("me indica uma playlist"), "music");
    assert.equal(intentFromText("um audiolivro bom"), "book");
    assert.equal(intentFromText("preciso de motivação"), "motivate");
    assert.equal(intentFromText("Olá"), "start");
  });
  test("texto sem relação vira unknown", () => {
    assert.equal(intentFromText("qual a capital da França"), "unknown");
  });
});

describe("links", () => {
  test("codificam a busca", () => {
    assert.equal(spotifyUrl("rock treino"), "https://open.spotify.com/search/rock%20treino/playlists");
    assert.equal(audibleUrl("Angústia Graciliano Ramos"), "https://www.audible.com.br/search?keywords=Ang%C3%BAstia%20Graciliano%20Ramos");
  });
});

describe("reply", () => {
  test("cada estilo de música devolve links do Spotify", () => {
    for (const id of Object.keys(MUSIC)) {
      const r = reply(`music:${id}`);
      assert.equal(r.links.length, 2);
      assert.ok(r.links.every((l) => l.url.startsWith("https://open.spotify.com/search/")));
    }
  });
  test("estilo desconhecido volta ao menu de música", () => {
    assert.equal(reply("music:forro").chips.length, Object.keys(MUSIC).length);
  });
  test("livros pedidos têm um botão cada, mais o Surpreenda-me", () => {
    assert.equal(reply("book").chips.length, BOOKS.length + 1);
  });
  test("livro escolhido leva ao Audible; Laços não leva autor inventado", () => {
    const lacos = reply("book:2");
    assert.equal(lacos.links[0].url, audibleUrl("Laços"));
    assert.equal(reply("book:3").links[0].url, audibleUrl("Angústia Graciliano Ramos"));
  });
  test("surpreenda-me sorteia entre os clássicos", () => {
    const r = reply("book:random", {}, () => 0);
    assert.match(r.text, new RegExp(MORE_BOOKS[0].title));
  });
  test("índice de livro inválido volta ao menu", () => {
    assert.equal(reply("book:99").chips.length, BOOKS.length + 1);
  });
  test("motivação sorteia uma frase da lista", () => {
    const r = reply("motivate", { done: 1, goal: 3 }, () => 0);
    assert.ok(r.text.startsWith(PHRASES[0]));
  });
  test("desconhecido responde com o menu principal", () => {
    assert.equal(reply("unknown").chips.length, 3);
  });
  test("pick nunca sai da lista", () => {
    assert.ok(PHRASES.includes(pick(PHRASES, () => 0.999999)));
  });
});

describe("contextLine", () => {
  test("semana vazia, em andamento e fechada", () => {
    assert.match(contextLine({ done: 0, goal: 3 }), /ainda não começou/);
    assert.match(contextLine({ done: 2, goal: 3 }), /Falta 1 treino para fechar/);
    assert.match(contextLine({ done: 1, goal: 3 }), /Faltam 2 treinos/);
    assert.match(contextLine({ done: 3, goal: 3 }), /bateu a meta/);
  });
  test("inclui sequência e pesagem pendente", () => {
    const s = contextLine({ done: 3, goal: 3, streak: 2, weightDue: true });
    assert.match(s, /2 semanas seguidas/);
    assert.match(s, /pesagem/);
  });
});
