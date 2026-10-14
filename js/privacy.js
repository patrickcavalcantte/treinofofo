// Política de privacidade e o texto do aceite. Dado de saúde é dado pessoal sensível (LGPD, arts. 5º e 11):
// a base é o consentimento da própria pessoa, dado ao criar a conta e revogável a qualquer momento.
import { esc } from "./dom.js";

/** Mude quando o texto mudar de forma relevante: fica registrado junto do aceite de cada conta. */
export const PRIVACY_VERSION = "2026-10";

export const CONSENT_LABEL = "Li e aceito a Política de Privacidade e concordo que meus dados de saúde (peso, remédios, hormônios, refeições, água e atividades) sejam guardados para o app funcionar.";

export const CONSENT_ERROR = "Para criar a conta, marque que leu e aceita a Política de Privacidade.";

const SECTIONS = [
  ["O que o app guarda", [
    "E-mail e senha da conta (a senha fica protegida pelo serviço de login, o app nunca a vê em texto).",
    "O que você registra: treinos, peso, remédios e hormônios, refeições, água, atividades, check-ins, objetivo e nome.",
    "Foto de perfil e, se você enviar, o PDF do plano alimentar.",
  ]],
  ["Por que e com qual base", [
    "Guardar esses dados é o que faz o app funcionar e aparecer igual no celular e no computador.",
    "Peso, remédios e hormônios são dados de saúde, considerados sensíveis pela LGPD. A base para guardá-los é o seu consentimento, dado ao criar a conta.",
  ]],
  ["Onde ficam e quem vê", [
    "Ficam no serviço Supabase, numa área só da sua conta: outra conta não consegue ler os seus dados. Uma cópia também fica no navegador deste aparelho.",
    "Não vendemos, não compartilhamos e não usamos seus dados para anúncios. O app não tem rastreadores nem ferramentas de análise.",
    "Quem mantém o app tem acesso técnico ao banco para manutenção. Isso não é usado para olhar seus registros.",
  ]],
  ["Seus direitos", [
    "Ver e corrigir: tudo o que está na conta aparece no app e pode ser editado ou apagado por você.",
    "Excluir: o botão \"Excluir minha conta e meus dados\" apaga a conta, o estado do app e o PDF do plano alimentar. Não dá para desfazer.",
    "Revogar o consentimento: excluir a conta é revogar. Sem o consentimento, o app não tem como funcionar com sincronização.",
  ]],
  ["Limites", [
    "O app está em teste (beta) e pode ter falhas. Não substitui orientação de médico, nutricionista ou educador físico.",
    "Esta política pode mudar. Quando mudar de forma relevante, o app avisa e a versão fica registrada.",
  ]],
];

export function renderPrivacy(backAction) {
  return `
    <div class="bar"><button class="back" data-action="${esc(backAction)}">‹ Voltar</button><span></span></div>
    <article class="guide">
      <h1 class="display">Política de Privacidade</h1>
      <p class="small">Versão ${esc(PRIVACY_VERSION)}. Escrita em linguagem simples, para quem usa o app.</p>
      ${SECTIONS.map(([title, items]) => `
      <h2>${esc(title)}</h2>
      <ul>${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`).join("")}
    </article>`;
}
