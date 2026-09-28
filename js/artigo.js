/* ============================================================
   Artigo individual — lê o id da URL e monta a página.
   Também preenche título, meta description, Open Graph e o
   Schema.org do tipo Article, que só existem depois do fetch.
   ============================================================ */

import { db, configurado, COLECAO, dataLonga, dataISO, resumir, paraHTML }
  from "./firebase.js";
import { doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const BASE  = location.origin + location.pathname.replace(/artigo\.html$/, "");
const ESCRITORIO = "Ricardo Mendonça & Advogados Associados";

const el = {
  carregando: document.getElementById("carregando"),
  artigo:     document.getElementById("artigo"),
  erro:       document.getElementById("erro"),
  titulo:     document.getElementById("art-titulo"),
  data:       document.getElementById("art-data"),
  autor:      document.getElementById("art-autor"),
  capa:       document.getElementById("art-capa"),
  corpo:      document.getElementById("art-corpo"),
};

abrir();

async function abrir() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id || !configurado) return falhar();

  try {
    const instantaneo = await getDoc(doc(db, COLECAO, id));
    if (!instantaneo.exists()) return falhar();

    const a = instantaneo.data();
    if (a.publicado === false) return falhar();

    render(a, id);
  } catch (erro) {
    console.error("[artigo]", erro);
    falhar();
  }
}

function render(a, id) {
  const titulo = a.titulo || "Artigo";
  const resumo = a.resumo || resumir(a.corpo, 160);
  const autor  = a.autor || ESCRITORIO;

  el.titulo.textContent = titulo;
  el.autor.textContent  = autor;
  el.data.textContent   = dataLonga(a.criadoEm);
  el.data.setAttribute("datetime", dataISO(a.criadoEm));

  if (a.capa) {
    el.capa.innerHTML = `<img src="${a.capa}" alt="${escaparAttr(titulo)}">`;
    el.capa.hidden = false;
  }

  // paraHTML escapa o texto antes de aplicar as marcações, então o
  // conteúdo do editor não consegue injetar HTML próprio.
  el.corpo.innerHTML = paraHTML(a.corpo);

  el.carregando.remove();
  el.artigo.hidden = false;

  cabecalho({ titulo, resumo, autor, capa: a.capa, criadoEm: a.criadoEm, id });
}

/** Título, meta description, Open Graph e Schema — só dá para preencher
    depois que o artigo chega, por isso não estão no HTML estático. */
function cabecalho({ titulo, resumo, autor, capa, criadoEm, id }) {
  const url = `${BASE}artigo.html?id=${encodeURIComponent(id)}`;
  const imagem = capa || `${BASE}img/og.jpg`;

  document.title = `${titulo} | ${ESCRITORIO}`;

  const meta = (seletor, valor) => {
    const e = document.head.querySelector(seletor);
    if (e) e.setAttribute("content", valor);
  };
  meta('meta[name="description"]',        resumo);
  meta('meta[property="og:title"]',       titulo);
  meta('meta[property="og:description"]', resumo);
  meta('meta[property="og:image"]',       imagem);
  meta('meta[property="og:url"]',         url);
  meta('meta[name="twitter:title"]',       titulo);
  meta('meta[name="twitter:description"]', resumo);
  meta('meta[name="twitter:image"]',       imagem);

  const canonica = document.head.querySelector('link[rel="canonical"]');
  if (canonica) canonica.href = url;

  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titulo,
    description: resumo,
    image: imagem ? [imagem] : undefined,
    datePublished: dataISO(criadoEm),
    dateModified: dataISO(criadoEm),
    author:    { "@type": "Organization", name: autor },
    publisher: {
      "@type": "Organization",
      name: ESCRITORIO,
      logo: { "@type": "ImageObject", url: `${BASE}img/logo.webp` }
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "pt-BR"
  });
  document.head.appendChild(schema);
}

function falhar() {
  el.carregando?.remove();
  el.artigo.hidden = true;
  el.erro.hidden = false;
  document.title = `Artigo não encontrado | ${ESCRITORIO}`;
}

function escaparAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
