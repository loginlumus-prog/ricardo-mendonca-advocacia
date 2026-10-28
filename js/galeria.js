/* ============================================================
   Galeria — lista de álbuns (galeria.html).
   Cada álbum é um evento, com data, capa e quantidade de fotos.
   ============================================================ */

import { clientePublico, configurado, dataDoEvento, escapar } from "./supabase.js";

const grade  = document.getElementById("albuns");
const estado = document.getElementById("albuns-estado");

if (grade) montar();

async function montar() {
  if (!configurado) {
    console.warn("[galeria] Supabase ainda não configurado — ver js/supabase.js");
    return vazio();
  }

  try {
    const { data, error } = await clientePublico()
      .from("albuns")
      .select("id, titulo, descricao, data_evento, capa, fotos(count)")
      .eq("publicado", true)
      .order("data_evento", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false });
    if (error) throw error;

    // álbum sem foto não tem o que mostrar
    const albuns = data.filter((a) => (a.fotos?.[0]?.count ?? 0) > 0);
    if (!albuns.length) return vazio();

    grade.innerHTML = albuns.map(cartao).join("");
    estado.remove();
    grade.hidden = false;
    window.RM?.revelar?.(grade);
  } catch (erro) {
    console.error("[galeria]", erro);
    vazio();
  }
}

function cartao(a, i) {
  const total = a.fotos[0].count;
  const capa = /^https:\/\//.test(a.capa || "")
    ? `<img src="${escapar(a.capa)}" alt="" loading="lazy">`
    : "";
  const atraso = ["", " atraso-1", " atraso-2"][i % 3];
  const data = dataDoEvento(a.data_evento);
  return `
  <a class="artigo-c revela${atraso}" href="album.html?id=${encodeURIComponent(a.id)}">
    <div class="artigo-c-foto">${capa}</div>
    <div class="artigo-c-txt">
      <span class="artigo-c-data">${escapar(data || "Álbum")} &middot; ${total} ${total === 1 ? "foto" : "fotos"}</span>
      <h3 class="artigo-c-tit">${escapar(a.titulo)}</h3>
      ${a.descricao ? `<p class="artigo-c-res">${escapar(a.descricao)}</p>` : ""}
      <span class="artigo-c-ler">Ver fotos &rarr;</span>
    </div>
  </a>`;
}

function vazio() {
  estado?.remove();
  grade.hidden = true;
  const cx = document.createElement("div");
  cx.className = "vazio";
  cx.innerHTML = "<p>Ainda não há álbuns publicados. Assim que o primeiro evento entrar, ele aparece aqui.</p>";
  grade.parentElement.appendChild(cx);
}
