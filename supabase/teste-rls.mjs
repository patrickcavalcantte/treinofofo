// Teste de isolamento entre contas (RLS), de ponta a ponta contra o seu Supabase.
// Use DUAS contas descartáveis: o teste grava uma linha de teste em app_state da conta A.
//   TEST_A_EMAIL=... TEST_A_PASS=... TEST_B_EMAIL=... TEST_B_PASS=... npm run test:rls
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";

const env = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Falta a variável ${k}.`); process.exit(2); }
  return v;
};
const A = { email: env("TEST_A_EMAIL"), password: env("TEST_A_PASS") };
const B = { email: env("TEST_B_EMAIL"), password: env("TEST_B_PASS") };

async function login({ email, password }) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Login falhou para ${email}: ${j.msg ?? j.error_description ?? r.status}`);
  return { token: j.access_token, id: j.user.id };
}

async function rest(token, path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "OK    " : "FALHOU"} ${name}${ok ? "" : ` ${extra}`}`);
  if (!ok) failed++;
};
const merge = { Prefer: "resolution=merge-duplicates,return=representation" };

const a = await login(A);
const b = await login(B);
if (a.id === b.id) { console.error("As duas contas são a mesma. Use contas diferentes."); process.exit(2); }

const marker = { rls_test: `marcador-${Date.now()}` };
const put = await rest(a.token, "app_state?on_conflict=user_id", {
  method: "POST", headers: merge, body: JSON.stringify({ user_id: a.id, state: marker }),
});
check("A grava a própria linha", put.status < 300, JSON.stringify(put));

const own = await rest(a.token, `app_state?select=state&user_id=eq.${a.id}`);
check("A lê a própria linha", own.body?.[0]?.state?.rls_test === marker.rls_test, JSON.stringify(own));

const all = await rest(b.token, "app_state?select=user_id,state");
check("B listando tudo não vê a linha de A", Array.isArray(all.body) && !all.body.some((r) => r.user_id === a.id), JSON.stringify(all));

const peek = await rest(b.token, `app_state?select=state&user_id=eq.${a.id}`);
check("B pedindo a linha de A recebe lista vazia", Array.isArray(peek.body) && peek.body.length === 0, JSON.stringify(peek));

const patch = await rest(b.token, `app_state?user_id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ state: { invadido: true } }) });
check("B não consegue alterar a linha de A", Array.isArray(patch.body) && patch.body.length === 0, JSON.stringify(patch));

const forged = await rest(b.token, "app_state?on_conflict=user_id", {
  method: "POST", headers: merge, body: JSON.stringify({ user_id: a.id, state: { invadido: true } }),
});
check("B não consegue gravar com o user_id de A", forged.status >= 400, JSON.stringify(forged));

const del = await rest(b.token, `app_state?user_id=eq.${a.id}`, { method: "DELETE" });
check("B não consegue apagar a linha de A", Array.isArray(del.body) ? del.body.length === 0 : del.status >= 400, JSON.stringify(del));

const anon = await rest(null, "app_state?select=user_id");
check("Sem login a tabela vem vazia", Array.isArray(anon.body) && anon.body.length === 0, JSON.stringify(anon));

const after = await rest(a.token, `app_state?select=state&user_id=eq.${a.id}`);
check("A linha de A continua intacta", after.body?.[0]?.state?.rls_test === marker.rls_test, JSON.stringify(after));

console.log(failed ? `\n${failed} verificação(ões) falharam.` : "\nIsolamento entre contas confirmado.");
process.exit(failed ? 1 : 0);
