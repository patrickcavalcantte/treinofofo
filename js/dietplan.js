// Leitura de um plano alimentar em PDF. O texto é lido no próprio navegador; nada é enviado a lugar nenhum nesta etapa.
// Os nomes das refeições são detectados, e o texto de cada uma é montado pela POSIÇÃO na página (colunas incluídas),
// não pela ordem em que o leitor entrega o texto. PDFs de nutricionistas variam muito, então o resultado sempre passa
// por uma revisão editável antes de ser salvo: é dado de saúde, e quem decide o que está certo é a pessoa.

export const PDFJS_VERSION = "6.4.299";
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

const strip = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Nomes de refeição reconhecidos, na ordem em que costumam acontecer no dia.
const KNOWN = [
  { rank: 1, rx: /^(desjejum|jejum)$/, label: "Desjejum" },
  { rank: 2, rx: /^(cafe da manha|cafe)$/, label: "Café da manhã" },
  { rank: 3, rx: /^(colacao|lanche da manha|lanche 1|merenda da manha)$/, label: null },
  { rank: 4, rx: /^(almoco)$/, label: "Almoço" },
  { rank: 5, rx: /^(lanche da tarde|lanche 2|lanche|merenda da tarde|merenda)$/, label: null },
  { rank: 6, rx: /^(pre[- ]?treino)$/, label: "Pré-treino" },
  { rank: 7, rx: /^(pos[- ]?treino)$/, label: "Pós-treino" },
  { rank: 8, rx: /^(jantar)$/, label: "Jantar" },
  { rank: 9, rx: /^(ceia|lanche da noite)$/, label: null },
];

// Aceita um horário depois do nome, como "Almoço - 12:30" ou "Jantar 20h".
const TIME_TAIL = /\s*[-–—:]?\s*\d{1,2}\s*(?::\s*\d{2}|h\s*\d{0,2})\s*(?:h|hs)?\s*$/;

/** Reconhece se um trecho de texto é só o nome de uma refeição. Devolve o nome para exibir, ou null. */
export function mealNameOf(text) {
  const raw = String(text ?? "").trim();
  if (!raw || raw.length > 40) return null;
  const s = strip(raw.replace(/^[\s\-–—•*#\d.)]+(?=[a-zA-ZÀ-ÿ])/, "").replace(TIME_TAIL, "").replace(/[:\s]+$/, ""));
  for (const k of KNOWN) {
    if (k.rx.test(s)) return k.label ?? raw.replace(TIME_TAIL, "").replace(/^[\s\-–—•*#\d.)]+/, "").replace(/[:\s]+$/, "").replace(/^./, (c) => c.toUpperCase());
  }
  return null;
}

/** Refeições encontradas em uma lista de trechos de texto, sem repetir e na ordem do dia. */
export function detectMeals(strings) {
  const found = new Map();
  for (const text of strings) {
    const name = mealNameOf(text);
    if (!name) continue;
    const key = strip(name);
    if (found.has(key)) continue;
    const rank = KNOWN.find((k) => k.rx.test(strip(name.replace(TIME_TAIL, "")))).rank;
    found.set(key, { name, rank, order: found.size });
  }
  return [...found.values()].sort((a, b) => a.rank - b.rank || a.order - b.order).map((m) => m.name);
}

/** Posição e texto de cada trecho de um PDF, página por página. `pdfjs` é o módulo pdf.js. */
export async function extractLayout(data, pdfjs) {
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { width: pageW, height: pageH } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (typeof item.str !== "string" || !item.str.trim()) continue;
      out.push({ page: n, str: item.str, x: item.transform[4], y: pageH - item.transform[5], w: item.width ?? 0, pageW, pageH });
    }
  }
  return out;
}

/** Todos os trechos de texto de um PDF, na ordem em que o leitor os entrega. `pdfjs` é o módulo pdf.js. */
export async function extractTextItems(data, pdfjs) {
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) if (typeof item.str === "string" && item.str.trim()) out.push(item.str);
  }
  return out;
}

// ---------- Texto de cada refeição, pela posição ----------

const TIME_ONLY = /^\d{1,2}\s*(?::\s*\d{2}|h\s*\d{0,2})$/;
const NOISE = /^(plano alimentar|plano v[aá]lido)/i;
const TOUCH = 8; // distância, em pontos, para um trecho ser continuação do anterior na mesma linha
const ROW_TOLERANCE = 2.5;
const MARGIN = 25; // texto colado na borda de cima ou de baixo é cabeçalho ou rodapé
const SPACE_GAP = 1; // folga maior que isso entre dois trechos encostados é um espaço que o leitor não entregou

const rankOf = (name) => (KNOWN.find((k) => k.rx.test(strip(name.replace(TIME_TAIL, "")))) ?? { rank: 99 }).rank;

/**
 * Refeições do PDF com o texto de cada uma. `items` vem de extractLayout.
 * O texto é lido em uma sequência só, de cima para baixo, página por página (planos de nutricionistas costumam ter uma
 * coluna, com títulos como "Substituição 1" centralizados). O cabeçalho de cada refeição é um trecho com só o nome; tudo
 * o que vem depois dele, até o próximo cabeçalho, é dessa refeição. Trechos que se encostam na mesma linha são um só,
 * porque o leitor às vezes parte uma palavra em dois (negrito no meio da linha, por exemplo).
 */
export function mealsFromLayout(items) {
  // 1) Junta trechos que se encostam na mesma linha.
  const cells = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const onPage = items.filter((i) => i.page === page && String(i.str).trim());
    if (!onPage.length) continue;
    const { pageH } = onPage[0];
    const rows = [];
    for (const it of [...onPage].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const row = rows.find((r) => Math.abs(r.y - it.y) <= ROW_TOLERANCE);
      if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
    }
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let last = null;
      for (const it of row.items) {
        const gap = last ? it.x - last.end : null;
        if (last && gap <= TOUCH && gap >= -2) {
          const needsSpace = gap > SPACE_GAP && !/\s$/.test(last.raw) && !/^\s/.test(it.str);
          last.raw += (needsSpace ? " " : "") + it.str;
          last.end = it.x + it.w;
          continue;
        }
        last = { page, y: row.y, x: it.x, end: it.x + it.w, raw: it.str, pageH };
        cells.push(last);
      }
    }
  }
  for (const c of cells) c.text = c.raw.replace(/\s+/g, " ").trim();

  // 2) Cabeçalhos, horários soltos logo acima deles e ruído de cabeçalho e rodapé.
  const headings = new Set(cells.filter((c) => mealNameOf(c.text)));
  const times = new Map();
  const dropped = new Set();
  for (const h of headings) {
    const t = cells.find((c) => c.page === h.page && TIME_ONLY.test(c.text) && c.y < h.y && h.y - c.y <= 25);
    if (t) { times.set(h, t.text.replace(/\s+/g, "")); dropped.add(t); }
  }
  for (const c of cells) if (!headings.has(c) && (NOISE.test(c.text) || c.y < MARGIN || c.y > c.pageH - MARGIN)) dropped.add(c);

  // 3) Cada trecho vai para a última refeição que apareceu antes dele.
  const meals = new Map();
  let current = null;
  for (const c of [...cells].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)) {
    if (headings.has(c)) {
      const name = mealNameOf(c.text);
      const key = strip(name);
      if (!meals.has(key)) meals.set(key, { name, time: null, order: meals.size, lines: [] });
      current = meals.get(key);
      current.time ??= times.get(c) ?? null;
    } else if (current && !dropped.has(c)) {
      current.lines.push(c.text);
    }
  }

  return [...meals.values()]
    .sort((a, b) => rankOf(a.name) - rankOf(b.name) || a.order - b.order)
    .map((m) => ({
      name: m.name,
      time: m.time,
      text: [m.time ? `Horário: ${m.time}` : "", m.lines.join("\n")].filter(Boolean).join("\n\n"),
    }));
}
/** Carrega o pdf.js do CDN, só quando alguém anexa um PDF. O trabalhador roda a partir de um blob, porque o navegador exige a mesma origem. */
export async function loadPdfjs() {
  const base = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;
  const pdfjs = await import(`${base}/pdf.min.mjs`);
  const worker = new Blob([`import "${base}/pdf.worker.min.mjs";`], { type: "text/javascript" });
  pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(worker);
  return pdfjs;
}

export function validatePdf(file) {
  if (!file) throw new Error("Escolha um arquivo.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name ?? "");
  if (!isPdf) throw new Error("O arquivo precisa ser um PDF.");
  if (file.size > MAX_PDF_BYTES) throw new Error("O PDF passou de 10 MB. Envie uma versão menor.");
  if (file.size === 0) throw new Error("O arquivo está vazio.");
}
