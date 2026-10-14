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

## Privacidade e banco de dados

O app guarda dado de saúde (dado pessoal sensível na LGPD). No Supabase, rode uma vez cada arquivo em `supabase/`:

- `schema.sql`: tabela `app_state` com RLS (cada conta só enxerga a própria linha).
- `storage.sql`: bucket privado `planos` para o PDF do plano alimentar.
- `excluir-conta.sql`: função `delete_my_account`, usada pelo botão "Excluir minha conta e meus dados".

Teste de isolamento entre contas, com duas contas **descartáveis** (grava uma linha de teste na conta A):

```bash
TEST_A_EMAIL=... TEST_A_PASS=... TEST_B_EMAIL=... TEST_B_PASS=... npm run test:rls
```

O texto da política fica em `js/privacy.js`; mude `PRIVACY_VERSION` quando ele mudar de forma relevante.

## CrÃ©ditos

Imagens do [free-exercise-db](https://github.com/yuhonas/free-exercise-db), publicado sob a licenÃ§a Unlicense.
