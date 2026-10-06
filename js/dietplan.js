// Leitura de um plano alimentar em PDF. O texto é lido no próprio navegador; nada é enviado a lugar nenhum nesta etapa.
// Só os NOMES das refeições são detectados. O conteúdo de cada refeição fica no PDF, que a pessoa pode abrir quando quiser:
// PDFs de nutricionistas têm layouts muito diferentes (colunas, tabelas), e copiar o texto errado para a refeição errada
// seria pior do que não copiar.

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
