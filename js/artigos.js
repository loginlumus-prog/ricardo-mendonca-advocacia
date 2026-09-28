/* ============================================================
   Vitrine de artigos — usada em artigos.html e na home.
   O elemento de destino diz quantos quer pelo data-limite.
   ============================================================ */

import { db, configurado, COLECAO, dataLonga, resumir } from "./firebase.js";
import { collection, query, where, orderBy, limit, getDocs }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const grade   = document.getElementById("artigos");
const estado  = document.getElementById("artigos-estado");
const secao   = document.getElementById("secao-artigos");

if (grade) montar();

async function montar() {
  const teto = Number(grade.dataset.limite || 0);

  if (!configurado) {
    // Sem Firebase ligado a seção inteira sai de cena em vez de exibir
    // um erro para o visitante. O aviso vai para o console, para mim.
    console.warn("[artigos] Firebase ainda não configurado — ver js/firebase.js");
    esconder();
    return;
  }

  try {
    const restricoes = [where("publicado", "==", true), orderBy("criadoEm", "desc")];
    if (teto) restricoes.push(limit(teto));
    const resultado = await getDocs(query(collection(db, COLECAO), ...restricoes));

    // Na home, seção vazia some inteira — "nenhum artigo ainda" na página
    // principal de um escritório parece abandono. Em artigos.html, avisa.
    if (resultado.empty) { secao ? secao.remove() : vazio(); return; }

    grade.innerHTML = resultado.docs.map((d, i) => cartao(d.id, d.data(), i)).join("");
    if (estado) estado.remove();
    grade.hidden = false;
    // os cards chegaram depois do observador de site.js — registra agora
    window.RM?.revelar?.(grade);
  } catch (erro) {
    console.error("[artigos]", erro);
    esconder();
  }
}

function cartao(id, a, i) {
  const capa = a.capa
    ? `<img src="${escapar(a.capa)}" alt="" loading="lazy">`
    : "";
  const resumo = escapar(a.resumo || resumir(a.corpo, 150));
  // escalonamento por coluna: os três de uma linha entram em cascata
  const atraso = ["", " atraso-1", " atraso-2"][i % 3];
  return `
  <a class="artigo-c revela${atraso}" href="artigo.html?id=${encodeURIComponent(id)}">
    <div class="artigo-c-foto">${capa}</div>
    <div class="artigo-c-txt">
      <span class="artigo-c-data">${escapar(dataLonga(a.criadoEm))}</span>
      <h3 class="artigo-c-tit">${escapar(a.titulo || "Sem título")}</h3>
      <p class="artigo-c-res">${resumo}</p>
      <span class="artigo-c-ler">Ler artigo &rarr;</span>
    </div>
  </a>`;
}

function vazio() {
  if (estado) estado.remove();
  grade.hidden = true;
  const alvo = grade.parentElement;
  const cx = document.createElement("div");
  cx.className = "vazio";
  cx.innerHTML = "<p>Nenhum artigo publicado ainda. Assim que o primeiro entrar no ar, ele aparece aqui.</p>";
  alvo.appendChild(cx);
}

/** Na home a seção some por inteiro; na página de artigos, mostra o vazio. */
function esconder() {
  if (secao) secao.remove();
  else vazio();
}

function escapar(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
