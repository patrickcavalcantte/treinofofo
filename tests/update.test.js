import { test } from "node:test";
import assert from "node:assert/strict";
import { loadedAssets, isStaleDeployHost } from "../js/update.js";

test("loadedAssets junta index, estilos e módulos da mesma origem, sem repetir", () => {
  const perf = { getEntriesByType: () => [
    { name: "https://x.app/js/app.js?v=1" }, { name: "https://x.app/js/app.js" },
    { name: "https://x.app/js/logic.js" }, { name: "https://fonts.googleapis.com/a.css" }, { name: "https://x.app/assets/a.png" },
  ] };
  const got = loadedAssets(perf, new URL("https://x.app/"));
  assert.deepEqual(got, ["https://x.app/index.html", "https://x.app/js/app.js", "https://x.app/js/logic.js", "https://x.app/styles.css"]);
});

test("isStaleDeployHost só pega endereços de deploy, não o principal nem localhost", () => {
  assert.equal(isStaleDeployHost("treinofofo-abc123-patrick.vercel.app"), true);
  assert.equal(isStaleDeployHost("treinofofo.vercel.app"), false);
  assert.equal(isStaleDeployHost("localhost"), false);
});
