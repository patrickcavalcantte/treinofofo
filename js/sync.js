// Sincronização com o Supabase. Sem URL/chave em config.js, o app segue só com localStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client = null;
let user = null;
let timer = null;

// O link de recuperação de senha volta para o app com type=recovery na URL.
let recovering = /type=recovery/.test(window.location.hash + window.location.search);
export const isRecovery = () => recovering;
export const linkExpired = () => /error_code=otp_expired|error=access_denied/.test(window.location.hash);

async function getClient() {
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") recovering = true; });
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

/** Envia o link para criar nova senha. Não revela se o e-mail tem conta. */
export async function resetPassword(emailAddr) {
  const c = await getClient();
  const { error } = await c.auth.resetPasswordForEmail(emailAddr, { redirectTo: window.location.origin + window.location.pathname });
  if (error) throw error;
}

/** Define a nova senha da sessão aberta pelo link de recuperação. */
export async function updatePassword(password) {
  const c = await getClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
  recovering = false;
  window.history.replaceState(null, "", window.location.pathname);
}

// Plano alimentar em PDF: bucket privado "planos", uma pasta por usuário (ver supabase/storage.sql).
const BUCKET = "planos";

export async function uploadPlan(file) {
  const c = await getClient();
  const path = `${user.id}/dieta.pdf`;
  const { error } = await c.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  return path;
}

/** Baixa o PDF guardado (só a própria pessoa consegue), para reler o texto sem precisar do arquivo de novo. */
export async function downloadPlan(path) {
  const c = await getClient();
  const { data, error } = await c.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

/** Link temporário (5 minutos) para abrir o PDF. */
export async function planUrl(path) {
  const c = await getClient();
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function removePlan(path) {
  const c = await getClient();
  const { error } = await c.storage.from(BUCKET).remove([path]);
  if (error) throw error;
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
