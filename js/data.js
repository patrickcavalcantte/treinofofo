// Catálogo de exercícios e divisão de treino.
// Imagens: free-exercise-db (github.com/yuhonas/free-exercise-db), licença Unlicense.
// Cada pasta tem 0.jpg (posição inicial) e 1.jpg (posição final).

export const MAX_DUMBBELL_KG = 4;

export const EXERCISES = {
  flexao: {
    name: "Flexão de braço",
    muscles: ["peito", "tríceps", "ombro"],
    sets: 3, repMin: 6, repMax: 15,
    type: "bodyweight",
    tempo: "Desce em 3 segundos, sobe firme",
    cues: [
      "Mãos um pouco mais abertas que os ombros.",
      "Corpo em linha reta da cabeça ao calcanhar. Contrai abdômen e glúteo.",
      "Cotovelos a uns 45° do tronco, não abertos em T.",
      "Peito quase encosta no chão (ou na mesa) antes de subir.",
      "Inclinada: mãos numa mesa ou bancada firme. Pés elevados: pés numa cadeira.",
    ],
    // Progressão: o app sugere o próximo nível quando todas as séries batem o máximo.
    levels: [
      { name: "Flexão inclinada", img: "Incline_Push-Up" },
      { name: "Flexão no chão", img: "Pushups" },
      { name: "Flexão com pés elevados", img: "Push-Ups_With_Feet_Elevated" },
    ],
  },
  flexaoFechada: {
    name: "Flexão fechada",
    muscles: ["tríceps", "peito"],
    sets: 3, repMin: 6, repMax: 15,
    type: "bodyweight",
    tempo: "Desce em 3 segundos",
    img: "Push-Ups_-_Close_Triceps_Position",
    cues: [
      "Mãos na largura dos ombros ou um pouco menos.",
      "Cotovelos raspando o tronco na descida.",
      "Se ficar pesado, apoie as mãos numa mesa firme.",
    ],
  },
  supinoChao: {
    name: "Supino no chão com halteres",
    muscles: ["peito", "tríceps"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Desce em 3 s, pausa de 1 s com o tríceps no chão, sobe",
    img: "Dumbbell_Floor_Press",
    cues: [
      "Deitado no chão, joelhos dobrados, pés apoiados.",
      "Desce até o braço encostar no chão, sem quicar.",
      "Aperta o peito no topo, como se fosse juntar os halteres sem encostar.",
    ],
  },
  crucifixoChao: {
    name: "Crucifixo no chão",
    muscles: ["peito"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Abre em 3 segundos",
    img: "Dumbbell_Flyes",
    cues: [
      "A foto mostra banco, mas faça deitado no chão: o chão limita a amplitude e protege o ombro.",
      "Cotovelos levemente dobrados e travados nesse ângulo o tempo todo.",
      "Abre até o braço encostar no chão de leve e fecha pensando em abraçar uma árvore.",
    ],
  },
  desenvolvimento: {
    name: "Desenvolvimento em pé",
    muscles: ["ombro", "tríceps"],
    sets: 3, repMin: 10, repMax: 15,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Standing_Dumbbell_Press",
    cues: [
      "Pés na largura do quadril, glúteo contraído para não arquear a lombar.",
      "Halteres na altura das orelhas, cotovelos um pouco à frente do corpo.",
      "Empurra para cima até quase estender, sem bater os halteres.",
    ],
  },
  desenvolvimentoNeutro: {
    name: "Desenvolvimento com pegada neutra",
    muscles: ["ombro", "tríceps"],
    sets: 3, repMin: 12, repMax: 15,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Standing_Palms-In_Dumbbell_Press",
    cues: [
      "Palmas viradas uma para a outra o movimento inteiro.",
      "Costuma ser mais confortável para o ombro que a pegada aberta.",
      "Não incline o tronco para trás no fim da série.",
    ],
  },
  elevacaoLateral: {
    name: "Elevação lateral",
    muscles: ["ombro"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Sobe em 1 s, segura 1 s, desce em 3 s",
    img: "Side_Lateral_Raise",
    cues: [
      "Sobe até a altura dos ombros, não acima.",
      "Leva o cotovelo para fora, não a mão. Mindinho levemente para cima.",
      "Sem balançar o tronco. Com 4 kg isso vira trapaça rápido.",
    ],
  },
  crucifixoInvertido: {
    name: "Crucifixo invertido sentado",
    muscles: ["ombro posterior", "costas"],
    sets: 3, repMin: 15, repMax: 20,
    type: "dumbbell",
    tempo: "Segura 1 s no topo",
    img: "Seated_Bent-Over_Rear_Delt_Raise",
    cues: [
      "Sentado na ponta da cadeira, tronco inclinado sobre as coxas.",
      "Abre os braços para os lados, cotovelos levemente dobrados.",
      "Equilibra o volume de empurrar do resto do treino. Não pule.",
    ],
  },
  roscaDireta: {
    name: "Rosca direta",
    muscles: ["bíceps"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Dumbbell_Bicep_Curl",
    cues: [
      "Cotovelos colados ao lado do corpo, eles não sobem.",
      "Gira a palma para cima enquanto sobe.",
      "Estica quase todo o braço embaixo antes da próxima.",
    ],
  },
  roscaMartelo: {
    name: "Rosca martelo",
    muscles: ["bíceps", "antebraço"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Hammer_Curls",
    cues: [
      "Palmas viradas para o corpo o movimento inteiro.",
      "Sem jogar o corpo para trás para ajudar.",
    ],
  },
  roscaConcentrada: {
    name: "Rosca concentrada",
    muscles: ["bíceps"],
    sets: 3, repMin: 10, repMax: 15,
    type: "dumbbell",
    unilateral: true,
    tempo: "Segura 1 s no topo, desce em 3 s",
    img: "Concentration_Curls",
    cues: [
      "Sentado numa cadeira, cotovelo apoiado na parte interna da coxa.",
      "Faz todas as reps de um braço, depois troca. Anote as reps de um lado só.",
    ],
  },
  tricepsFrances: {
    name: "Tríceps francês",
    muscles: ["tríceps"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Standing_Dumbbell_Triceps_Extension",
    cues: [
      "Um halter seguro com as duas mãos acima da cabeça.",
      "Cotovelos apontando para frente, perto da cabeça.",
      "Desce o halter atrás da nuca até alongar bem o tríceps.",
    ],
  },
  tricepsCoice: {
    name: "Tríceps coice",
    muscles: ["tríceps"],
    sets: 2, repMin: 12, repMax: 20,
    type: "dumbbell",
    unilateral: true,
    tempo: "Segura 1 s com o braço esticado",
    img: "Tricep_Dumbbell_Kickback",
    cues: [
      "Mão e joelho apoiados numa cadeira ou no sofá.",
      "Braço paralelo ao chão e parado. Só o antebraço se move.",
    ],
  },
  mergulhoCadeira: {
    name: "Mergulho na cadeira",
    muscles: ["tríceps", "peito"],
    sets: 3, repMin: 8, repMax: 15,
    type: "bodyweight",
    tempo: "Desce em 3 segundos",
    img: "Bench_Dips",
    cues: [
      "Use uma cadeira firme, encostada na parede para não deslizar.",
      "Joelhos dobrados facilitam. Pernas esticadas dificultam.",
      "Desce até o cotovelo fazer 90°. Mais que isso força o ombro.",
    ],
  },
  // ---- Inferiores, costas e core ----
  agachamentoLivre: {
    name: "Agachamento livre",
    muscles: ["quadríceps", "glúteo"],
    sets: 3, repMin: 12, repMax: 20,
    type: "bodyweight",
    tempo: "Desce em 3 segundos, sobe firme",
    img: "Bodyweight_Squat",
    cues: [
      "Pés na largura dos ombros, pontas levemente para fora.",
      "Leva o quadril para trás e para baixo, como se fosse sentar numa cadeira.",
      "Joelhos acompanham a direção dos pés, sem cair para dentro. Calcanhar no chão e peito aberto.",
      "Desce até as coxas ficarem paralelas ao chão, ou até onde der sem dor.",
    ],
  },
  agachamentoHalteres: {
    name: "Agachamento com halteres",
    muscles: ["quadríceps", "glúteo"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Desce em 3 segundos, sobe firme",
    img: "Dumbbell_Squat",
    cues: [
      "Halteres ao lado do corpo, braços esticados e relaxados.",
      "Mesmo movimento do agachamento livre: quadril para trás, costas retas.",
      "Use peso leve. O foco aqui é manter a postura em todas as repetições.",
    ],
  },
  afundo: {
    name: "Afundo com halteres",
    muscles: ["quadríceps", "glúteo"],
    sets: 3, repMin: 10, repMax: 15,
    type: "dumbbell",
    unilateral: true,
    tempo: "Desce em 3 segundos",
    img: "Dumbbell_Lunges",
    cues: [
      "Dá um passo largo à frente e desce até o joelho de trás ficar perto do chão.",
      "Joelho da frente alinhado com o pé. Tronco reto, olhar para frente.",
      "Empurra com o calcanhar da frente para voltar. Troca de perna a cada série.",
      "Se perder o equilíbrio, apoie uma mão na parede.",
    ],
  },
  ponteGluteo: {
    name: "Ponte de glúteo",
    muscles: ["glúteo", "posterior de coxa"],
    sets: 3, repMin: 12, repMax: 20,
    type: "bodyweight",
    tempo: "Sobe firme, segura 1 segundo no topo, desce em 3",
    cues: [
      "Deitado de barriga para cima, joelhos dobrados e pés apoiados na largura do quadril.",
      "Sobe o quadril apertando o glúteo, até formar uma linha do ombro ao joelho.",
      "Não arqueie a lombar para subir mais. Segura 1 segundo no topo.",
      "Com uma perna: a outra fica esticada no ar e o quadril não pode cair para o lado. Faça o mesmo número de repetições nos dois lados.",
    ],
    levels: [
      { name: "Ponte de glúteo", img: "Butt_Lift_Bridge" },
      { name: "Ponte com uma perna", img: "Single_Leg_Glute_Bridge" },
    ],
  },
  extensaoQuadril: {
    name: "Extensão de quadril em quatro apoios",
    muscles: ["glúteo"],
    sets: 3, repMin: 12, repMax: 20,
    type: "bodyweight",
    unilateral: true,
    tempo: "Sobe em 1 segundo, desce em 3",
    img: "Glute_Kickback",
    cues: [
      "Mãos e joelhos no chão, costas retas e abdômen firme.",
      "Estica uma perna para trás e para cima, apertando o glúteo.",
      "Não arqueie a lombar para subir mais. Volta devagar, sem encostar o joelho no chão.",
    ],
  },
  panturrilha: {
    name: "Panturrilha sentado com halter",
    muscles: ["panturrilha"],
    sets: 3, repMin: 15, repMax: 25,
    type: "dumbbell",
    unilateral: true,
    tempo: "Sobe em 1 s, segura 1 s, desce em 3 s",
    img: "Dumbbell_Seated_One-Leg_Calf_Raise",
    cues: [
      "Sentado numa cadeira firme, com o pé no chão e o halter apoiado no joelho.",
      "Sobe o calcanhar o máximo que conseguir e desce devagar, sentindo alongar.",
      "Faz todas as repetições de uma perna antes de trocar.",
    ],
  },
  stiff: {
    name: "Stiff com halteres",
    muscles: ["posterior de coxa", "glúteo", "lombar"],
    sets: 3, repMin: 12, repMax: 15,
    type: "dumbbell",
    tempo: "Desce em 3 segundos",
    img: "Stiff-Legged_Dumbbell_Deadlift",
    cues: [
      "Pés na largura do quadril, joelhos levemente dobrados e quase parados.",
      "Leva o quadril para trás, como se fosse fechar uma porta com o glúteo. Costas retas o tempo todo.",
      "Os halteres deslizam perto das pernas. Desce até sentir alongar atrás da coxa, em geral perto da canela.",
      "Se a lombar arredondar, desça menos. Sobe apertando o glúteo.",
    ],
  },
  remadaCurvada: {
    name: "Remada curvada com halteres",
    muscles: ["costas", "bíceps"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    tempo: "Puxa em 1 s, segura 1 s, desce em 3 s",
    img: "Bent_Over_Two-Dumbbell_Row",
    cues: [
      "Tronco inclinado para frente com as costas retas e os joelhos levemente dobrados.",
      "Puxa os halteres em direção ao umbigo, levando os cotovelos para trás.",
      "Aperta as escápulas no topo. Mantém o pescoço alinhado, sem levantar a cabeça.",
    ],
  },
  remadaUnilateral: {
    name: "Remada unilateral com halter",
    muscles: ["costas", "bíceps"],
    sets: 3, repMin: 12, repMax: 20,
    type: "dumbbell",
    unilateral: true,
    tempo: "Puxa em 1 s, segura 1 s, desce em 3 s",
    img: "One-Arm_Dumbbell_Row",
    cues: [
      "A foto mostra um banco. Em casa, apoie uma mão e o joelho do mesmo lado numa cadeira ou sofá firme.",
      "Costas retas, paralelas ao chão. Puxa o halter em direção ao quadril, com o cotovelo rente ao corpo.",
      "Não gire o tronco. Faz todas as repetições de um lado antes de trocar.",
    ],
  },
  agachamentoApoiado: {
    name: "Agachamento com pé de trás apoiado",
    muscles: ["quadríceps", "glúteo"],
    sets: 3, repMin: 10, repMax: 15,
    type: "dumbbell",
    unilateral: true,
    tempo: "Desce em 3 segundos",
    img: "Split_Squat_with_Dumbbells",
    cues: [
      "Apoia o pé de trás numa cadeira firme ou num sofá e dá um passo grande para frente.",
      "Desce até a coxa da frente ficar quase paralela ao chão. O joelho da frente acompanha o pé.",
      "Exercício de equilíbrio: comece sem peso e apoie uma mão na parede se precisar.",
      "Empurra com o calcanhar da frente para subir. Faz todas as repetições de um lado antes de trocar.",
    ],
  },
  deadBug: {
    name: "Inseto morto (dead bug)",
    muscles: ["abdômen"],
    sets: 3, repMin: 8, repMax: 16,
    type: "bodyweight",
    tempo: "Lento e controlado",
    img: "Dead_Bug",
    cues: [
      "Deitado de barriga para cima, braços esticados para o teto e joelhos dobrados a 90°.",
      "Baixa um braço e a perna do lado oposto, devagar, sem a lombar sair do chão.",
      "Volta e troca de lado. Uma repetição é um lado direito mais um esquerdo.",
    ],
  },
  abdominalInvertido: {
    name: "Abdominal invertido",
    muscles: ["abdômen"],
    sets: 3, repMin: 10, repMax: 20,
    type: "bodyweight",
    tempo: "Sobe em 1 s, desce em 3 s",
    img: "Reverse_Crunch",
    cues: [
      "Deitado de barriga para cima, mãos ao lado do corpo, joelhos dobrados e pés no ar.",
      "Levanta o quadril poucos centímetros do chão usando o abdômen, sem balançar.",
      "Desce devagar. Não puxe as pernas com impulso.",
    ],
  },
};

// Quatro treinos. A e B são de membros superiores; C e D, de pernas, glúteos, costas e core.
// Quem alterna entre eles é a rotação do perfil (ver onboarding.js). Sem perfil, o app alterna A e B.
export const WORKOUTS = {
  A: {
    title: "Treino A",
    focus: "Peito e ombro lateral",
    exercises: ["flexao", "supinoChao", "crucifixoChao", "desenvolvimento", "elevacaoLateral", "tricepsFrances", "roscaDireta"],
  },
  B: {
    title: "Treino B",
    focus: "Ombro, bíceps e tríceps",
    exercises: ["flexaoFechada", "supinoChao", "desenvolvimentoNeutro", "crucifixoInvertido", "roscaMartelo", "roscaConcentrada", "mergulhoCadeira", "tricepsCoice"],
  },
  C: {
    title: "Treino C",
    focus: "Pernas e glúteos",
    exercises: ["agachamentoLivre", "agachamentoHalteres", "afundo", "ponteGluteo", "extensaoQuadril", "panturrilha"],
  },
  D: {
    title: "Treino D",
    focus: "Posterior, costas e core",
    exercises: ["stiff", "remadaCurvada", "remadaUnilateral", "agachamentoApoiado", "deadBug", "abdominalInvertido"],
  },
};

export const REST_SECONDS = 75;
export const WEEKLY_GOAL = 3;

// Cardio antes de todo treino, na esteira de casa.
export const CARDIO = {
  name: "Cardio na esteira",
  minutes: 15,
  tip: "Ritmo em que dá para conversar, com esforço leve a moderado. Os últimos 2 minutos podem ser mais leves para a frequência cardíaca baixar antes dos halteres.",
};
