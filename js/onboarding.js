// Onboarding: perfil, objetivos e sugestão de treino. Funções puras, testadas em tests/onboarding.test.js.
// A sugestão usa os quatro treinos do app: A e B (membros superiores) e C e D (pernas, glúteos, costas e core).

export const DISCLAIMER =
  "Este aplicativo não substitui um profissional de educação física. A sugestão é geral e não considera seu histórico de lesões, sua saúde nem seu nível real. Para um treino feito para você, procure um profissional.";

export const GENDERS = [
  { id: "feminino", label: "Feminino" },
  { id: "masculino", label: "Masculino" },
  { id: "mulher-trans", label: "Mulher trans" },
  { id: "homem-trans", label: "Homem trans" },
  { id: "nao-binario", label: "Não binário" },
  { id: "nao-informar", label: "Prefiro não informar" },
];

export const LEVELS = [
  { id: "iniciante", label: "Estou começando", desc: "Nunca treinei, ou estou parado há bastante tempo." },
  { id: "intermediario", label: "Já treino", desc: "Treino com regularidade há alguns meses." },
];

export const GOALS = {
  consistencia: { label: "Criar o hábito de treinar", desc: "Aparecer toda semana, sem pressa de aumentar a carga." },
  hipertrofia: { label: "Ganhar massa muscular", desc: "Mais volume muscular, com peso leve e esforço perto da falha." },
  forca: { label: "Ficar mais forte", desc: "Aumentar carga e repetições aos poucos." },
  definicao: { label: "Definição e queima de gordura", desc: "Mais dias de treino, com cardio e treino de força." },
  bracos: { label: "Braços definidos", desc: "Foco em bíceps, tríceps e ombros." },
  postura: { label: "Ombros, costas e postura", desc: "Ombros estáveis e costas fortes." },
  gluteos: { label: "Glúteos e pernas", desc: "Pernas e glúteos mais fortes e definidos." },
  completo: { label: "Treino completo", desc: "Um pouco de tudo: braços, pernas, costas e core." },
};

// Os objetivos que aparecem primeiro para cada gênero. Todos continuam disponíveis em "Ver todos".
const FEATURED = {
  feminino: ["gluteos", "definicao", "completo", "consistencia"],
  masculino: ["hipertrofia", "forca", "definicao", "bracos"],
  "mulher-trans": ["gluteos", "definicao", "completo", "consistencia"],
  "homem-trans": ["hipertrofia", "bracos", "forca", "definicao"],
  default: ["consistencia", "completo", "forca", "definicao"],
};

export function goalsFor(genderId, showAll = false) {
  const featured = FEATURED[genderId] ?? FEATURED.default;
  const ids = showAll ? [...featured, ...Object.keys(GOALS).filter((g) => !featured.includes(g))] : featured;
  return ids.map((id) => ({ id, ...GOALS[id] }));
}

// Ênfase do treino. A rotação é a ordem em que o app propõe os treinos, um depois do outro.
export const EMPHASES = {
  superiores: { label: "Superiores", desc: "Treinos A e B: peito, ombros, bíceps e tríceps.", rotation: ["A", "B"] },
  inferiores: { label: "Inferiores", desc: "Treinos C e D: pernas, glúteos, posterior, costas e core.", rotation: ["C", "D"] },
  completo: { label: "Corpo todo", desc: "Os quatro treinos em sequência: A, C, B e D.", rotation: ["A", "C", "B", "D"] },
};

/** Ênfase sugerida. O objetivo manda primeiro; depois, o que é mais comum para o gênero. A pessoa pode trocar. */
export function defaultEmphasis(genderId, goalId) {
  if (goalId === "gluteos") return "inferiores";
  if (goalId === "bracos" || goalId === "postura") return "superiores";
  if (goalId === "completo") return "completo";
  if (genderId === "homem-trans") return "superiores";
  if (genderId === "mulher-trans") return "inferiores";
  return "completo";
}

// Objetivos que preferem começar por um treino específico, quando ele está na rotação.
const START_PREF = { bracos: "B", postura: "B", gluteos: "C" };

export function rotationFor(emphasisId, goalId) {
  const base = EMPHASES[emphasisId]?.rotation;
  if (!base) throw new Error("Escolha a ênfase do treino.");
  const pref = START_PREF[goalId];
  const i = base.indexOf(pref);
  return i > 0 ? [...base.slice(i), ...base.slice(0, i)] : [...base];
}

const BASE_PER_WEEK = { consistencia: 2, hipertrofia: 3, forca: 3, definicao: 4, bracos: 3, postura: 3, gluteos: 3, completo: 3 };

const TITLES = {
  consistencia: "Constância primeiro", hipertrofia: "Ganho de massa", forca: "Mais força",
  definicao: "Definição com treino e cardio", bracos: "Braços em foco", postura: "Ombros, costas e postura",
  gluteos: "Glúteos e pernas", completo: "Treino completo",
};

const GOAL_POINTS = {
  consistencia: [
    "Seu objetivo agora é terminar os treinos, não carregar peso. Pare sempre antes de sentir dor.",
    "Quando 2 semanas seguidas estiverem fáceis de cumprir, passe para 3 treinos.",
  ],
  hipertrofia: [
    "Em cada série, pare quando restarem 1 ou 2 repetições possíveis. Revisões mostram que peso leve constrói músculo parecido com peso pesado, desde que a série chegue perto da falha.",
    "Quando todas as séries chegarem ao topo da faixa de repetições, o app indica o próximo passo: mais peso, descida mais lenta ou uma variação mais difícil.",
    "Sono e comida pesam tanto quanto o treino. Procure um nutricionista para a alimentação.",
  ],
  forca: [
    "Para força máxima, cargas mais altas funcionam melhor. Com halteres de até 4 kg, o ganho de força tem limite: o app compensa com variações mais difíceis. Se a carga ficar leve demais, um profissional pode indicar equipamento mais pesado.",
    "Se precisar, use o botão +15 s no descanso. Descansar um pouco mais ajuda a manter a qualidade da série.",
    "Anote as repetições. Uma repetição a mais do que na última vez já é progresso.",
  ],
  definicao: [
    "Com 4 treinos por semana, deixe pelo menos um dia livre de treino.",
    "O cardio de 15 minutos antes do treino já está no app. É ele, junto com a alimentação, que mais pesa para queimar gordura.",
  ],
  bracos: [
    "Controle a descida de cada repetição, em 2 a 3 segundos. Isso aumenta o esforço sem precisar de mais peso.",
  ],
  postura: [
    "Mantenha o peito aberto, o pescoço longo e os ombros para baixo durante os exercícios.",
    "O crucifixo invertido e as remadas trabalham a parte de trás dos ombros e as costas.",
  ],
  gluteos: [
    "Aperte o glúteo no topo da ponte e da extensão de quadril, e segure 1 segundo.",
    "Halteres de até 4 kg são leves para as pernas. Compense com a descida lenta, mais repetições e as variações mais difíceis que o app sugerir, como a ponte com uma perna.",
  ],
  completo: [
    "A ordem A, C, B e D equilibra superiores, pernas, costas e core. O app segue essa ordem sozinho.",
  ],
};

const EMPHASIS_POINT = {
  superiores: "Ênfase em superiores: o app alterna o Treino A (peito e ombro lateral) e o Treino B (ombro, bíceps e tríceps).",
  inferiores: "Ênfase em inferiores: o app alterna o Treino C (pernas e glúteos) e o Treino D (posterior, costas e core).",
  completo: "Treino completo: o app propõe A, C, B e D, nessa ordem. Com 3 treinos por semana, cada semana começa em um ponto diferente do ciclo.",
};

// Fontes consultadas em 06/10/2026. Os números abaixo vêm dos próprios artigos.
export const SOURCES = [
  {
    id: 1, short: "Nørlund et al., 2025",
    text: "Nørlund MK et al. Muscle strength changes and physical activity during gender-affirming hormone therapy: a systematic review. Andrology, 2025. 15 estudos, 1.206 pessoas trans; nenhum estudo foi classificado como de baixo risco de viés, e nenhum testou treino de musculação.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12670482/",
  },
  {
    id: 2, short: "Wiik et al., 2020",
    text: "Wiik A et al. Muscle strength, size, and composition following 12 months of gender-affirming treatment in transgender individuals. J Clin Endocrinol Metab, 2020. 12 homens trans e 11 mulheres trans.",
    url: "https://academic.oup.com/jcem/article/105/3/e805/5651219",
  },
  {
    id: 3, short: "Cheung et al., 2024",
    text: "Cheung AS et al. Impact of gender-affirming hormone therapy on physical performance. J Clin Endocrinol Metab, 2024. Revisão narrativa.",
    url: "https://academic.oup.com/jcem/article/109/2/e455/7223439",
  },
  {
    id: 4, short: "Lopez et al., 2021",
    text: "Lopez P et al. Resistance training load effects on muscle hypertrophy and strength gain: systematic review and network meta-analysis. Med Sci Sports Exerc, 2021. Estudos com a população em geral, não específicos para pessoas trans.",
    url: "https://research-repository.uwa.edu.au/en/publications/resistance-training-load-effects-on-muscle-hypertrophy-and-streng/",
  },
];

export const EVIDENCE_LIMIT =
  "Nenhum desses estudos testou um programa de musculação em pessoas trans. Eles medem o efeito dos hormônios sobre músculo e força. As sugestões combinam esses achados com os princípios gerais do treino de força.";

// O que a pesquisa mostra, por gênero. Só entram achados que aparecem nas fontes acima.
const EVIDENCE_BY_GENDER = {
  "homem-trans": [
    { sources: [1, 2, 3], text: "Em homens trans que usam testosterona, os estudos observaram aumento de massa e de força muscular já no primeiro ano. Na revisão de 2025, a força de pegada subiu cerca de 18% em 12 meses e a de extensão do joelho, cerca de 12%. Por isso, registre suas cargas e repetições e aumente o peso aos poucos." },
  ],
  "mulher-trans": [
    { sources: [1, 2, 3], text: "Em mulheres trans em terapia hormonal feminizante, os estudos observaram queda de cerca de 5% na massa muscular da coxa em 12 meses e, em 3 de 6 estudos, queda de 6 a 8% na força em 6 a 12 meses, com aumento da gordura corporal. Os autores da revisão de 2025 recomendam programas de força para quem corre risco de perder massa muscular." },
    { sources: [1], text: "A ênfase em pernas e glúteos é uma preferência comum entre mulheres trans, mas não vem de um estudo." },
  ],
  "nao-binario": [
    { sources: [1], text: "A maioria dos estudos é sobre homens e mulheres trans. Quase não há dados sobre pessoas não binárias, e o efeito do hormônio, se você usa algum, muda o que esperar." },
  ],
};

const EVIDENCE_GENERAL = { sources: [4], text: "Revisões mostram que o ganho de massa muscular é parecido com cargas leves ou pesadas, desde que a série chegue perto da falha. O ganho de força máxima, porém, é maior com cargas mais altas." };

const HORMONE_NOTE ="Se você faz terapia hormonal, a resposta ao treino e a recuperação podem mudar com o tempo. Vale alinhar com a equipe que acompanha você.";
const HORMONE_GENDERS = ["mulher-trans", "homem-trans", "nao-binario"];

/** Sugestão de treino. Quem está começando faz no máximo 3 treinos por semana. */
export function planFor(goalId, levelId, genderId, emphasisId) {
  if (!GOALS[goalId]) throw new Error("Escolha um objetivo da lista.");
  const emphasis = emphasisId ?? defaultEmphasis(genderId, goalId);
  const rotation = rotationFor(emphasis, goalId);
  const beginner = levelId === "iniciante";
  const perWeek = beginner ? Math.min(BASE_PER_WEEK[goalId], 3) : BASE_PER_WEEK[goalId];
  const points = [
    `Faça ${perWeek} treinos por semana, com um dia de folga entre eles sempre que der.`,
    EMPHASIS_POINT[emphasis],
    ...GOAL_POINTS[goalId],
  ];
  if (beginner) points.push("Como você está começando, use cargas bem leves nas 2 primeiras semanas e aprenda o movimento antes de aumentar.");
  const notes = HORMONE_GENDERS.includes(genderId) ? [HORMONE_NOTE] : [];
  const evidence = [...(EVIDENCE_BY_GENDER[genderId] ?? []), EVIDENCE_GENERAL];
  return {
    goal: goalId, goalLabel: GOALS[goalId].label, title: TITLES[goalId], emphasis, rotation, start: rotation[0], perWeek, points, notes, evidence,
  };
}

/** Nome como a pessoa quer ser chamada: sem espaços sobrando nem caracteres de controle, até 40 letras. */
export function cleanName(value) {
  const s = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
  return s || null;
}

/** Saudação pelo horário, com o nome quando existe. Sem gênero na frase. */
export function greeting(name, now) {
  const h = new Date(now).getHours();
  const base = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
  const n = cleanName(name);
  return n ? `${base}, ${n}!` : `${base}!`;
}

export function buildProfile({ name, gender, goal, level, emphasis }, now) {
  if (!GENDERS.some((g) => g.id === gender)) throw new Error("Escolha uma opção de gênero.");
  if (!LEVELS.some((l) => l.id === level)) throw new Error("Escolha o seu nível.");
  const plan = planFor(goal, level, gender, emphasis);
  return {
    name: cleanName(name), gender, goal, level, emphasis: plan.emphasis, rotation: plan.rotation, start: plan.start, perWeek: plan.perWeek,
    createdAt: new Date(now).toISOString(),
  };
}

/** Quem pula o onboarding não vê a tela de novo. */
export function skippedProfile(now, name = null) {
  return { skipped: true, name: cleanName(name), createdAt: new Date(now).toISOString() };
}

export const needsOnboarding = (state) => !state.profile;
