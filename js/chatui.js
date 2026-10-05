// Interface do chat. Monta tudo com createElement/textContent: nada digitado vira HTML.
import { reply, intentFromText } from "./chat.js";

export function initChat(getContext) {
  const fab = el("button", { class: "chat-fab", type: "button", "aria-label": "Abrir o Papo Fofo", "aria-expanded": "false" });
  fab.append(el("img", { src: "assets/logo.png", alt: "", width: "44", height: "44" }));

  const log = el("div", { class: "chat-log", role: "log", "aria-live": "polite" });
  const chips = el("div", { class: "chat-chips" });
  const input = el("input", { class: "chat-input", type: "text", autocomplete: "off", placeholder: "Escreva ou toque numa opção", "aria-label": "Mensagem" });
  const send = el("button", { class: "chat-send", type: "submit" }, "Enviar");
  const form = el("form", { class: "chat-form" }, input, send);
  const close = el("button", { class: "chat-close", type: "button", "aria-label": "Fechar o chat" }, "✕");
  const panel = el("section", { class: "chat", hidden: "", "aria-label": "Papo Fofo" },
    el("header", { class: "chat-head" }, el("strong", {}, "Papo Fofo"), close), log, chips, form);

  document.body.append(fab, panel);

  function say(from, text, links = []) {
    const bubble = el("div", { class: `bubble ${from}` }, text);
    for (const l of links) {
      bubble.append(el("a", { class: "bubble-link", href: l.url, target: "_blank", rel: "noopener noreferrer" }, `${l.label} ↗`));
    }
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  }

  function showChips(list) {
    chips.replaceChildren(...list.map((c) => {
      const b = el("button", { class: "chip", type: "button" }, c.label);
      b.addEventListener("click", () => ask(c.id, c.label));
      return b;
    }));
  }

  function ask(intent, said) {
    say("me", said);
    const r = reply(intent, getContext());
    say("bot", r.text, r.links);
    showChips(r.chips);
  }

  function open() {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    if (!log.children.length) {
      const r = reply("start", getContext());
      say("bot", r.text);
      showChips(r.chips);
    }
    input.focus();
  }
  function shut() {
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }

  fab.addEventListener("click", () => (panel.hidden ? open() : shut()));
  close.addEventListener("click", shut);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    ask(intentFromText(text), text);
  });
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}
