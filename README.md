# Treino Fofo

App web de treino de membros superiores (peito, ombro, bÃ­ceps e trÃ­ceps) para fazer em casa com halteres de atÃ© 4 kg e sem banco. HTML, CSS e JavaScript puros, sem build.

## Rodar local

```bash
npm run dev      # serve a pasta em http://localhost:3000
npm test         # roda os testes (Node 21+)
```

Abrir o `index.html` direto pelo arquivo nÃ£o funciona: mÃ³dulos ES exigem um servidor.

## Deploy na Vercel

Suba a pasta para um repositÃ³rio e importe na Vercel. Framework preset: **Other**. Sem build command, output directory na raiz. Ou, pelo terminal: `npx vercel`.

## Estrutura

- `js/data.js`: exercÃ­cios, faixas de reps e a divisÃ£o A/B. Ã‰ o Ãºnico arquivo que vocÃª precisa editar para mudar o treino.
- `js/logic.js`: regras puras (alternÃ¢ncia A/B, aviso de descanso, progressÃ£o, persistÃªncia). Testado.
- `js/app.js`: interface e eventos.
- `assets/ex/`: fotos de inÃ­cio e fim de cada exercÃ­cio.

Os dados ficam no `localStorage` do navegador. Trocar de celular ou limpar dados do site apaga o histÃ³rico.

## CrÃ©ditos

Imagens do [free-exercise-db](https://github.com/yuhonas/free-exercise-db), publicado sob a licenÃ§a Unlicense.
