/* ============================================================
   Artigo individual — lê o id da URL e monta a página.
   Também preenche título, meta description, Open Graph e o
   Schema.org do tipo Article, que só existem depois do fetch.
   ============================================================ */

import { clientePublico, configurado, TABELA, dataLonga, dataISO, resumir, paraHTML }
  from "./supabase.js";

const BASE  = location.origin + location.pathname.replace(/artigo\.html$/, "");
const ESCRITORIO = "Ricardo Mendonça & Advogados Associados";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!UUID.test(id) || !configurado) return falhar();

  try {
    const { data, error } = await clientePublico()
      .from(TABELA)
      .select("id, titulo, corpo, resumo, autor, capa, criado_em, atualizado_em")
      .eq("id", id)
      .eq("publicado", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return falhar();
    render(data);
  } catch (erro) {
    console.error("[artigo]", erro);
    falhar();
  }
}

function render(a) {
  const titulo = a.titulo || "Artigo";
  const resumo = a.resumo || resumir(a.corpo, 160);
  const autor  = a.autor || ESCRITORIO;
  const capa   = /^https:\/\//.test(a.capa || "") ? a.capa : "";

  el.titulo.textContent = titulo;
  el.autor.textContent  = autor;
  el.data.textContent   = dataLonga(a.criado_em);
  el.data.setAttribute("datetime", dataISO(a.criado_em));

  if (capa) {
    const img = document.createElement("img");
    img.src = capa;
    img.alt = titulo;
    el.capa.replaceChildren(img);
    el.capa.hidden = false;
  }

  // paraHTML escapa o texto antes de aplicar as marcações, então o
  // conteúdo do editor não consegue injetar HTML próprio.
  el.corpo.innerHTML = paraHTML(a.corpo);

  el.carregando.remove();
  el.artigo.hidden = false;

  cabecalho({ titulo, resumo, autor, capa, id: a.id,
              criado: a.criado_em, alterado: a.atualizado_em || a.criado_em });
}

/** Título, meta description, Open Graph e Schema — só dá para preencher
    depois que o artigo chega, por isso não estão no HTML estático. */
function cabecalho({ titulo, resumo, autor, capa, id, criado, alterado }) {
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
    image: [imagem],
    datePublished: dataISO(criado),
    dateModified: dataISO(alterado),
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
