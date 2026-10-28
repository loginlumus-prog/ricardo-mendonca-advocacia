/* ============================================================
   Galeria na página principal — fotos do evento mais recente.
   Mostra até 6 fotos do último álbum publicado; clicar amplia
   (lightbox de site.js). Sem álbum publicado, a seção some.
   ============================================================ */

import { clientePublico, configurado, dataDoEvento, escapar } from "./supabase.js";

const secao = document.getElementById("secao-galeria");
const caixa = document.getElementById("home-album");
const MAX = 6;

if (secao) montar();

async function montar() {
  if (!configurado) return secao.remove();

  try {
    const sb = clientePublico();
    const { data: albuns, error } = await sb
      .from("albuns")
      .select("id, titulo, data_evento, fotos(count)")
      .eq("publicado", true)
      .order("data_evento", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false })
      .limit(5);
    if (error) throw error;

    const album = albuns.find((a) => (a.fotos?.[0]?.count ?? 0) > 0);
    if (!album) return secao.remove();

    const { data: fotos, error: e2 } = await sb
      .from("fotos")
      .select("url, legenda")
      .eq("album_id", album.id)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: true })
      .limit(MAX);
    if (e2) throw e2;
    if (!fotos.length) return secao.remove();

    render(album, fotos);
  } catch (erro) {
    // falha de rede ou banco: a página principal segue sem a seção
    console.error("[galeria-home]", erro);
    secao.remove();
  }
}

function render(a, fotos) {
  const total = a.fotos[0].count;
  const link = `album.html?id=${encodeURIComponent(a.id)}`;
  const data = dataDoEvento(a.data_evento);

  caixa.innerHTML = `
    <div class="home-album-cab revela">
      <a href="${link}" class="home-album-tit">${escapar(a.titulo)}</a>
      <span class="chapeu mudo">${escapar([data, `${total} ${total === 1 ? "foto" : "fotos"}`].filter(Boolean).join(" · "))}</span>
    </div>
    <div class="home-fotos" data-galeria>
      ${fotos.filter((f) => /^https:\/\//.test(f.url)).map((f, i) => `
      <figure class="g-item revela${["", " atraso-1", " atraso-2"][i % 3]}">
        <a href="${escapar(f.url)}">
          <img src="${escapar(f.url)}" loading="lazy" alt="${escapar(f.legenda || `Foto do evento ${a.titulo}`)}">
        </a>
        ${f.legenda ? `<figcaption>${escapar(f.legenda)}</figcaption>` : ""}
      </figure>`).join("")}
    </div>
    ${total > fotos.length ? `<a href="${link}" class="rota home-album-mais">Ver o álbum completo (${total} fotos) &rarr;</a>` : ""}`;
  caixa.hidden = false;
  window.RM?.revelar?.(caixa);
}
