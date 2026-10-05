// Sincronização com o Supabase. Sem URL/chave em config.js, o app segue só com localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client = null;
let user = null;
let timer = null;

async function getClient() {
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export const email = () => user?.email ?? null;
export const signedIn = () => user !== null;

/** Restaura a sessão salva neste aparelho. Devolve o usuário ou null. */
export async function start() {
  const c = await getClient();
  const { data } = await c.auth.getSession();
  user = data.session?.user ?? null;
  return user;
}

export async function signIn(emailAddr, password) {
  const c = await getClient();
  const { data, error } = await c.auth.signInWithPassword({ email: emailAddr, password });
  if (error) throw error;
  user = data.user;
}

/** Redireciona para o Google e volta para esta mesma página já com a sessão. */
export async function signInWithGoogle() {
  const c = await getClient();
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

/** Devolve true se o Supabase pediu confirmação por e-mail antes do primeiro login. */
export async function signUp(emailAddr, password) {
  const c = await getClient();
  const { data, error } = await c.auth.signUp({ email: emailAddr, password });
  if (error) throw error;
  user = data.session?.user ?? null;
  return data.session === null;
}

export async function signOut() {
  clearTimeout(timer);
  const c = await getClient();
  await c.auth.signOut();
  user = null;
}

export async function pull() {
  const c = await getClient();
  const { data, error } = await c.from("app_state").select("state").maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

export async function push(state) {
  const c = await getClient();
  const { error } = await c.from("app_state").upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Envia depois de 1 s sem novas alterações, para não gravar a cada toque. */
export function schedulePush(state, onError) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => push(state).catch(onError), 1000);
}
