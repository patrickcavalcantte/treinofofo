// Aviso de versão nova. O app não tem build nem service worker; então, ao voltar para a aba,
// comparamos os ETags dos arquivos que a página carregou com os de quando ela abriu.
// Se mudou, mostramos um aviso para recarregar. Falhas de rede são ignoradas.
const MAIN_HOST = "treinofofo.vercel.app";

/** Endereços (mesma origem) de index, estilos e módulos que esta página carregou. */
export function loadedAssets(perf = performance, loc = location) {
  const urls = new Set([new URL("index.html", loc.href).href, new URL("styles.css", loc.href).href]);
  for (const e of perf.getEntriesByType("resource")) {
    const u = new URL(e.name);
    if (u.origin === loc.origin && /\.(js|css)$/.test(u.pathname)) urls.add(u.origin + u.pathname);
  }
  return [...urls].sort();
}

async function signature(urls) {
  const parts = await Promise.all(urls.map(async (u) => {
    const r = await fetch(u, { method: "HEAD", cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.headers.get("etag") ?? r.headers.get("last-modified") ?? "";
  }));
  return parts.join("|");
}

/** Já abriu por um endereço fixo de deploy (nunca atualiza), em vez do endereço principal? */
export const isStaleDeployHost = (host) => host !== MAIN_HOST && /^treinofofo-.+\.vercel\.app$/.test(host);

function banner(html) {
  if (document.getElementById("update-banner")) return;
  const el = document.createElement("div");
  el.id = "update-banner";
  el.className = "update-banner";
  el.setAttribute("role", "status");
  el.innerHTML = html;
  document.body.append(el);
  el.querySelector("[data-reload]")?.addEventListener("click", () => location.reload());
}

export function watchForUpdates() {
  if (isStaleDeployHost(location.hostname)) {
    banner(`<span>Você está num endereço antigo do app.</span> <a class="switch" href="https://${MAIN_HOST}/">Abrir a versão atual</a>`);
    return;
  }
  let baseline = null;
  const check = async () => {
    try {
      const sig = await signature(loadedAssets());
      if (baseline === null) baseline = sig;
      else if (sig !== baseline) banner(`<span>Tem versão nova do app.</span> <button type="button" class="switch" data-reload>Atualizar</button>`);
    } catch { /* sem rede: tenta de novo na próxima vez */ }
  };
  // Espera a página terminar de carregar os módulos para registrar a base de comparação.
  addEventListener("load", () => setTimeout(check, 1500), { once: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}
