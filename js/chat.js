// Chatbot por regras: sem IA e sem rede. Funções puras, testadas em tests/chat.test.js.

const enc = encodeURIComponent;
export const spotifyUrl = (q) => `https://open.spotify.com/search/${enc(q)}/playlists`;
export const audibleUrl = (q) => `https://www.audible.com.br/search?keywords=${enc(q)}`;

export const MUSIC = {
  rock: { label: "Rock", queries: ["rock treino", "rock workout"] },
  metal: { label: "Metal", queries: ["metal treino", "heavy metal workout"] },
  pop: { label: "Pop internacional", queries: ["pop workout", "pop hits gym"] },
};

// Os quatro primeiros são os pedidos do Patrick; o resto são clássicos para o "Surpreenda-me".
export const BOOKS = [
  { title: "Os Supridores", author: "José Falero" },
  { title: "Os Imortais", author: "Paulliny Tort" },
  { title: "Laços", author: "" },
  { title: "Angústia", author: "Graciliano Ramos" },
];
export const MORE_BOOKS = [
  { title: "Vidas Secas", author: "Graciliano Ramos" },
  { title: "São Bernardo", author: "Graciliano Ramos" },
  { title: "Dom Casmurro", author: "Machado de Assis" },
  { title: "Memórias Póstumas de Brás Cubas", author: "Machado de Assis" },
  { title: "A Hora da Estrela", author: "Clarice Lispector" },
  { title: "Grande Sertão: Veredas", author: "Guimarães Rosa" },
  { title: "Torto Arado", author: "Itamar Vieira Junior" },
  { title: "O Cortiço", author: "Aluísio Azevedo" },
];

export const PHRASES = [
  "Você não precisa estar motivado. Só precisa começar.",
  "A série mais difícil é a primeira. Depois o corpo entende.",
  "Peso leve, esforço de verdade. O que conta é chegar perto da falha.",
  "Constância ganha de intensidade. Apareça hoje.",
  "Quinze minutos de esteira já são uma vitória sobre o sofá.",
  "Ninguém se arrepende do treino que fez. Só do que ficou para amanhã.",
  "Hoje você está construindo quem você vai ser daqui a um ano.",
  "Descansar entre as séries também faz parte. Respire e volte.",
  "Mais uma repetição do que da última vez já é progresso.",
  "O hábito é o treino. O resultado é a consequência.",
  "Cansado é diferente de sem vontade. Comece o aquecimento e veja.",
  "Um treino imperfeito vale mais que um treino perfeito que não aconteceu.",
];

export const MAIN_CHIPS = [
  { id: "music", label: "Quero música" },
  { id: "book", label: "Quero um audiolivro" },
  { id: "motivate", label: "Me motiva" },
];

const bookQuery = (b) => [b.title, b.author].filter(Boolean).join(" ");
const bookLabel = (b) => (b.author ? `${b.title}, ${b.author}` : b.title);

export function pick(list, rand = Math.random) {
  return list[Math.floor(rand() * list.length)];
}

/** Uma frase sobre o momento do usuário, a partir de números que o app já tem. */
export function contextLine({ done = 0, goal = 3, streak = 0, weightDue = false } = {}) {
  const parts = [];
  if (done >= goal) parts.push("Você já bateu a meta da semana. Descansar também é treinar.");
  else if (done === 0) parts.push("A semana ainda não começou. O primeiro treino é o mais difícil.");
  else {
    const left = goal - done;
    parts.push(`Falta${left === 1 ? "" : "m"} ${left} treino${left === 1 ? "" : "s"} para fechar a meta da semana.`);
  }
  if (streak > 0) parts.push(`${streak} ${streak === 1 ? "semana seguida" : "semanas seguidas"} na meta.`);
  if (weightDue) parts.push("A pesagem da semana ainda não foi feita.");
  return parts.join(" ");
}

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Transforma texto livre em uma intenção, por palavra-chave. */
export function intentFromText(text) {
  const s = strip(text);
  if (/\brock\b/.test(s)) return "music:rock";
  if (/\bmetal\b/.test(s)) return "music:metal";
  if (/\bpop\b/.test(s)) return "music:pop";
  if (/music|playlist|spotify|som\b|cancao|musicas/.test(s)) return "music";
  if (/livro|audio|audible|ler\b|leitura|literatura/.test(s)) return "book";
  if (/motiv|frase|animo|forca|preguica|desanimo|cansad/.test(s)) return "motivate";
  if (/\b(oi|ola|e ai|bom dia|boa tarde|boa noite)\b/.test(s)) return "start";
  return "unknown";
}

/**
 * Resposta do bot para uma intenção. Devolve { text, links, chips }.
 * Intenções: start, music, music:<estilo>, book, book:<n> (índice em BOOKS), book:random, motivate.
 */
export function reply(intent, ctx = {}, rand = Math.random) {
  if (intent === "start") {
    return { text: `Oi! Eu sou o Papo Fofo. ${contextLine(ctx)} Em que posso ajudar?`, links: [], chips: MAIN_CHIPS };
  }

  if (intent === "music") {
    return {
      text: "Que estilo você quer ouvir hoje?",
      links: [],
      chips: Object.entries(MUSIC).map(([id, m]) => ({ id: `music:${id}`, label: m.label })),
    };
  }
  if (intent.startsWith("music:")) {
    const style = MUSIC[intent.slice(6)];
    if (!style) return reply("music", ctx, rand);
    return {
      text: `${style.label} para treinar. Abre uma dessas e dá o play:`,
      links: style.queries.map((q) => ({ label: `Playlists de “${q}” no Spotify`, url: spotifyUrl(q) })),
      chips: [...MAIN_CHIPS],
    };
  }

  if (intent === "book") {
    return {
      text: "Qual você quer ouvir? A busca mostra se o título tem audiolivro no Audible.",
      links: [],
      chips: [
        ...BOOKS.map((b, i) => ({ id: `book:${i}`, label: b.title })),
        { id: "book:random", label: "Surpreenda-me" },
      ],
    };
  }
  if (intent.startsWith("book:")) {
    const key = intent.slice(5);
    const b = key === "random" ? pick(MORE_BOOKS, rand) : BOOKS[Number(key)];
    if (!b) return reply("book", ctx, rand);
    return {
      text: key === "random" ? `Que tal ${bookLabel(b)}?` : `Boa escolha: ${bookLabel(b)}.`,
      links: [{ label: `Buscar “${b.title}” no Audible`, url: audibleUrl(bookQuery(b)) }],
      chips: [{ id: "book:random", label: "Outra sugestão" }, ...MAIN_CHIPS],
    };
  }

  if (intent === "motivate") {
    return {
      text: `${pick(PHRASES, rand)} ${contextLine(ctx)}`,
      links: [],
      chips: [{ id: "motivate", label: "Outra frase" }, ...MAIN_CHIPS.filter((c) => c.id !== "motivate")],
    };
  }

  return { text: "Não entendi essa. Posso sugerir música, um audiolivro ou uma frase de motivação.", links: [], chips: MAIN_CHIPS };
}
