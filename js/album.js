/* ============================================================
   Álbum — fotos de um evento (album.html?id=...).
   As fotos abrem ampliadas pelo lightbox de site.js; a legenda de
   cada uma vem do <figcaption>.
   ============================================================ */

import { clientePublico, configurado, dataDoEvento, escapar } from "./supabase.js";

const BASE = location.origin + location.pathname.replace(/album\.html$/, "");
const ESCRITORIO = "Ricardo Mendonça & Advogados Associados";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const el = {
  cab:    document.getElementById("album-cab"),
  titulo: document.getElementById("album-titulo"),
  data:   document.getElementById("album-data"),
  desc:   document.getElementById("album-desc"),
  estado: document.getElementById("album-estado"),
  fotos:  document.getElementById("album-fotos"),
  erro:   document.getElementById("album-erro"),
};

abrir();

async function abrir() {
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!UUID.test(id) || !configurado) return falhar();

  try {
    const sb = clientePublico();
    const [album, fotos] = await Promise.all([
      sb.from("albuns")
        .select("id, titulo, descricao, data_evento, capa, criado_em")
        .eq("id", id).eq("publicado", true).maybeSingle(),
      sb.from("fotos")
        .select("id, url, legenda, largura, altura")
        .eq("album_id", id)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: true }),
    ]);
    if (album.error) throw album.error;
    if (fotos.error) throw fotos.error;
    if (!album.data || !fotos.data.length) return falhar();
    render(album.data, fotos.data);
  } catch (erro) {
    console.error("[album]", erro);
    falhar();
  }
}

function render(a, fotos) {
  el.titulo.textContent = a.titulo;
  const data = dataDoEvento(a.data_evento);
  el.data.textContent = [data, `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`].filter(Boolean).join(" · ");
  if (a.descricao) { el.desc.textContent = a.descricao; el.desc.hidden = false; }
  el.cab.hidden = false;

  el.fotos.innerHTML = fotos.map((f) => {
    if (!/^https:\/\//.test(f.url)) return "";
    const proporcao = f.largura && f.altura ? ` width="${f.largura}" height="${f.altura}"` : "";
    const alt = f.legenda || `Foto do evento ${a.titulo}`;
    return `
    <figure class="f-item">
      <a href="${escapar(f.url)}">
        <img src="${escapar(f.url)}"${proporcao} loading="lazy" alt="${escapar(alt)}">
      </a>
      ${f.legenda ? `<figcaption>${escapar(f.legenda)}</figcaption>` : ""}
    </figure>`;
  }).join("");
  el.estado.remove();
  el.fotos.hidden = false;

  cabecalho(a, fotos);
}

/** Título, descrição, Open Graph e Schema — dependem do álbum, que só chega depois. */
function cabecalho(a, fotos) {
  const url = `${BASE}album.html?id=${encodeURIComponent(a.id)}`;
  const resumo = a.descricao || `Fotos do evento ${a.titulo}, do escritório ${ESCRITORIO}.`;
  const imagem = /^https:\/\//.test(a.capa || "") ? a.capa : `${BASE}img/og.jpg`;

  document.title = `${a.titulo} | Galeria | ${ESCRITORIO}`;
  const meta = (seletor, valor) => document.head.querySelector(seletor)?.setAttribute("content", valor);
  meta('meta[name="description"]', resumo);
  meta('meta[property="og:title"]', a.titulo);
  meta('meta[property="og:description"]', resumo);
  meta('meta[property="og:image"]', imagem);
  meta('meta[property="og:url"]', url);
  meta('meta[name="twitter:title"]', a.titulo);
  meta('meta[name="twitter:description"]', resumo);
  meta('meta[name="twitter:image"]', imagem);
  const canonica = document.head.querySelector('link[rel="canonical"]');
  if (canonica) canonica.href = url;

  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: a.titulo,
    description: resumo,
    url,
    inLanguage: "pt-BR",
    dateCreated: a.data_evento || undefined,
    publisher: { "@type": "LawFirm", name: ESCRITORIO, url: `${BASE}` },
    image: fotos.slice(0, 12).map((f) => ({
      "@type": "ImageObject", contentUrl: f.url, caption: f.legenda || undefined,
    })),
  });
  document.head.appendChild(schema);
}

function falhar() {
  el.estado?.remove();
  el.fotos.hidden = true;
  el.erro.hidden = false;
  document.title = `Álbum não encontrado | ${ESCRITORIO}`;
}
