import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { VERSION, STAGE, versionLabel } from "../js/version.js";

describe("versão do app", () => {
  test("o selo mostra o estágio e o número, como 'Versão Beta v0.1'", () => {
    assert.equal(versionLabel(), `Versão ${STAGE} v${VERSION}`);
    assert.match(versionLabel(), /^Versão \w+ v\d+\.\d+(\.\d+)?$/);
  });
  test("esta é a versão Beta v0.1", () => {
    assert.equal(versionLabel(), "Versão Beta v0.1");
  });
});
