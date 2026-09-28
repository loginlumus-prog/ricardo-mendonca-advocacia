/* ============================================================
   FIREBASE — inicialização única, usada por todas as páginas.

   COMO LIGAR (leia FIREBASE.md para o passo a passo completo):
   1. Crie o projeto em console.firebase.google.com
   2. Adicione um app Web e copie o objeto de configuração
   3. Cole abaixo, no lugar dos valores entre <>
   4. Publique as regras de firestore.rules e storage.rules

   As chaves abaixo NÃO são segredo — o Firebase as expõe no
   navegador por projeto. Quem protege os dados são as REGRAS,
   não a chave. Por isso o passo 4 não é opcional.
   ============================================================ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getStorage }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export const config = {
  apiKey:            "<API_KEY>",
  authDomain:        "<PROJETO>.firebaseapp.com",
  projectId:         "<PROJETO>",
  storageBucket:     "<PROJETO>.firebasestorage.app",
  messagingSenderId: "<SENDER_ID>",
  appId:             "<APP_ID>"
};

/** Ainda não configurado? As telas avisam em vez de quebrar em silêncio. */
export const configurado = !String(config.apiKey).startsWith("<");

let app = null, db = null, auth = null, storage = null;

if (configurado) {
  app     = initializeApp(config);
  db      = getFirestore(app);
  auth    = getAuth(app);
  storage = getStorage(app);
}

export { app, db, auth, storage };

/** Coleção única dos artigos. */
export const COLECAO = "artigos";

/* ---- utilidades compartilhadas ---------------------------------- */

/** 12 de março de 2026 */
export function dataLonga(valor) {
  const d = paraData(valor);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

/** 12/03/2026 */
export function dataCurta(valor) {
  const d = paraData(valor);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

/** 2026-03-12 — para o atributo datetime e o Schema.org */
export function dataISO(valor) {
  const d = paraData(valor);
  return d ? d.toISOString() : "";
}

/** Aceita Timestamp do Firestore, Date, número ou string. */
function paraData(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const d = valor instanceof Date ? valor : new Date(valor);
  return isNaN(d) ? null : d;
}

/** Texto puro a partir do corpo, para resumo e meta description. */
export function resumir(texto, limite = 160) {
  const limpo = String(texto || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  return limpo.slice(0, limpo.lastIndexOf(" ", limite)) + "…";
}

/**
 * Converte o texto do editor em HTML.
 *
 * O cliente escreve em texto corrido com marcações simples; não é um
 * editor rico. Isso é decisão de projeto: editor rico gera HTML sujo
 * quando se cola do Word, e aí o artigo entra no ar com fonte Calibri
 * e fundo branco no meio do site escuro.
 *
 * ## título   → h2          **negrito**  → strong
 * ### título  → h3          *itálico*    → em
 * > citação   → blockquote  - item       → lista
 * [texto](url) → link
 */
export function paraHTML(texto) {
  const escapar = (s) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const linha = (s) => escapar(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
             '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const saida = [];
  let lista = null;

  const fecharLista = () => { if (lista) { saida.push(`<${lista.tag}>${lista.itens.join("")}</${lista.tag}>`); lista = null; } };

  for (const bruta of String(texto || "").split(/\r?\n/)) {
    const l = bruta.trim();
    if (!l) { fecharLista(); continue; }

    const ol = l.match(/^\d+[.)]\s+(.*)$/);
    const ul = l.match(/^[-•*]\s+(.*)$/);
    if (ol || ul) {
      const tag = ol ? "ol" : "ul";
      if (!lista || lista.tag !== tag) { fecharLista(); lista = { tag, itens: [] }; }
      lista.itens.push(`<li>${linha((ol || ul)[1])}</li>`);
      continue;
    }
    fecharLista();

    if (l.startsWith("### ")) saida.push(`<h3>${linha(l.slice(4))}</h3>`);
    else if (l.startsWith("## ")) saida.push(`<h2>${linha(l.slice(3))}</h2>`);
    else if (l.startsWith("> ")) saida.push(`<blockquote>${linha(l.slice(2))}</blockquote>`);
    else saida.push(`<p>${linha(l)}</p>`);
  }
  fecharLista();
  return saida.join("\n");
}
