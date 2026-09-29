/* ============================================================
   SUPABASE — conexão única, usada por todas as páginas.

   URL e chave abaixo NÃO são segredo: a chave publicável foi feita
   para ficar no navegador. Quem protege os dados são as políticas
   de acesso do banco (supabase/esquema.sql), não a chave.
   ============================================================ */

import { createClient }
  from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

const URL_PROJETO = "<URL_DO_PROJETO>";
const CHAVE       = "<CHAVE_PUBLICAVEL>";

/** Ainda não configurado? As telas avisam em vez de quebrar em silêncio. */
export const configurado = !URL_PROJETO.startsWith("<");

export const TABELA = "artigos";
export const BUCKET = "capas";

let publico = null;

/** Visitante não faz login, então as páginas públicas não guardam sessão —
    o aviso de privacidade promete que o navegador só guarda a escolha do aviso. */
export function clientePublico() {
  publico ??= createClient(URL_PROJETO, CHAVE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return publico;
}

/** O painel guarda a sessão, para o editor não digitar a senha a cada visita. */
export function clienteDoPainel() {
  return createClient(URL_PROJETO, CHAVE, { auth: { storageKey: "rm-painel" } });
}

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

/** 2026-03-12T… — para o atributo datetime e o Schema.org */
export function dataISO(valor) {
  const d = paraData(valor);
  return d ? d.toISOString() : "";
}

function paraData(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return isNaN(d) ? null : d;
}

/** Texto puro a partir do corpo, para resumo e meta description. */
export function resumir(texto, limite = 160) {
  const limpo = String(texto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*(#{2,3}|>|[-•*]|\d+[.)])\s+/gm, "")
    .replace(/\*\*?|\[|\]\([^)]*\)/g, "")
    .replace(/\s+/g, " ").trim();
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

export function escapar(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
