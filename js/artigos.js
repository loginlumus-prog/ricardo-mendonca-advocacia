/* ============================================================
   Vitrine de artigos — usada em artigos.html e na home.
   O elemento de destino diz quantos quer pelo data-limite.
   ============================================================ */

import { clientePublico, configurado, TABELA, dataLonga, escapar } from "./supabase.js";

const grade   = document.getElementById("artigos");
const estado  = document.getElementById("artigos-estado");
const secao   = document.getElementById("secao-artigos");

if (grade) montar();

async function montar() {
  const teto = Number(grade.dataset.limite || 0);

  if (!configurado) {
    // Sem banco ligado a seção inteira sai de cena em vez de exibir
    // um erro para o visitante. O aviso vai para o console, para mim.
    console.warn("[artigos] Supabase ainda não configurado — ver js/supabase.js");
    esconder();
    return;
  }

  try {
    let consulta = clientePublico()
      .from(TABELA)
      .select("id, titulo, resumo, capa, criado_em")
      .eq("publicado", true)
      .order("criado_em", { ascending: false });
    if (teto) consulta = consulta.limit(teto);

    const { data, error } = await consulta;
    if (error) throw error;

    // Na home, seção vazia some inteira — "nenhum artigo ainda" na página
    // principal de um escritório parece abandono. Em artigos.html, avisa.
    if (!data.length) { secao ? secao.remove() : vazio(); return; }

    grade.innerHTML = data.map(cartao).join("");
    if (estado) estado.remove();
    grade.hidden = false;
    // os cards chegaram depois do observador de site.js — registra agora
    window.RM?.revelar?.(grade);
  } catch (erro) {
    console.error("[artigos]", erro);
    esconder();
  }
}

function cartao(a, i) {
  const capa = /^https:\/\//.test(a.capa || "")
    ? `<img src="${escapar(a.capa)}" alt="" loading="lazy">`
    : "";
  // escalonamento por coluna: os três de uma linha entram em cascata
  const atraso = ["", " atraso-1", " atraso-2"][i % 3];
  return `
  <a class="artigo-c revela${atraso}" href="artigo.html?id=${encodeURIComponent(a.id)}">
    <div class="artigo-c-foto">${capa}</div>
    <div class="artigo-c-txt">
      <span class="artigo-c-data">${escapar(dataLonga(a.criado_em))}</span>
      <h3 class="artigo-c-tit">${escapar(a.titulo || "Sem título")}</h3>
      <p class="artigo-c-res">${escapar(a.resumo || "")}</p>
      <span class="artigo-c-ler">Ler artigo &rarr;</span>
    </div>
  </a>`;
}

function vazio() {
  if (estado) estado.remove();
  grade.hidden = true;
  const cx = document.createElement("div");
  cx.className = "vazio";
  cx.innerHTML = "<p>Nenhum artigo publicado ainda. Assim que o primeiro entrar no ar, ele aparece aqui.</p>";
  grade.parentElement.appendChild(cx);
}

/** Na home a seção some por inteiro; na página de artigos, mostra o vazio. */
function esconder() {
  if (secao) secao.remove();
  else vazio();
}
