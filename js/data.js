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
};

// Dois treinos alternados (A, B, A / B, A, B...) em 3 dias não consecutivos.
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
};

export const REST_SECONDS = 75;
export const WEEKLY_GOAL = 3;

// Cardio antes de todo treino, na esteira de casa.
export const CARDIO = {
  name: "Cardio na esteira",
  minutes: 15,
  tip: "Ritmo em que dá para conversar, com esforço leve a moderado. Os últimos 2 minutos podem ser mais leves para a frequência cardíaca baixar antes dos halteres.",
};
