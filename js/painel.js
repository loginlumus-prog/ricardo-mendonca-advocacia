/* ============================================================
   PAINEL — login, lista, editor e exclusão.

   Tudo roda no navegador contra o Firebase. Quem impede que um
   visitante escreva não é este arquivo: são as regras publicadas
   (firestore.rules / storage.rules). Este arquivo só constrói a
   interface de quem já passou pelo login.
   ============================================================ */

import { db, auth, storage, configurado, COLECAO, dataCurta, resumir }
  from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
         query, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const tela = {
  entrada: document.getElementById("tela-entrada"),
  app:     document.getElementById("tela-app"),
  lista:   document.getElementById("tela-lista"),
  editor:  document.getElementById("tela-editor"),
};

let editando = null;   // id do artigo em edição, ou null para novo
let capaURL  = "";     // URL da capa já enviada
let capaPath = "";     // caminho no Storage, para poder apagar depois

/* ══════ configuração ausente ══════ */
if (!configurado) {
  document.body.innerHTML = `
    <div class="entrada"><div class="entrada-cx">
      <h1 class="entrada-h">Firebase ainda não configurado</h1>
      <p class="entrada-p">Abra <code>js/firebase.js</code> e cole os dados do projeto.
      O passo a passo está em <code>FIREBASE.md</code>, na raiz do site.</p>
    </div></div>`;
  throw new Error("Firebase não configurado");
}

/* ══════ ENTRADA ══════ */
const formEntrada = document.getElementById("form-entrada");
const recadoEntrada = document.getElementById("recado-entrada");

formEntrada.addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = formEntrada.querySelector("button[type=submit]");
  botao.disabled = true;
  recadoEntrada.hidden = true;
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("email").value.trim(),
      document.getElementById("senha").value
    );
  } catch (erro) {
    aviso(recadoEntrada, "erro", mensagemDeErro(erro));
    botao.disabled = false;
  }
});

document.getElementById("sair").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (pessoa) => {
  const dentro = !!pessoa;
  tela.entrada.hidden = dentro;
  tela.app.hidden = !dentro;
  formEntrada.querySelector("button[type=submit]").disabled = false;
  if (dentro) {
    document.getElementById("quem").textContent = pessoa.email;
    carregarLista();
  }
});

/* ══════ LISTA ══════ */
const lista = document.getElementById("lista");

async function carregarLista() {
  mostrar("lista");
  lista.innerHTML = `<div class="carregando"><i class="giro"></i>Carregando</div>`;
  try {
    const r = await getDocs(query(collection(db, COLECAO), orderBy("criadoEm", "desc")));
    if (r.empty) {
      lista.innerHTML = `<div class="vazio"><p>Nenhum artigo ainda. Use “Novo artigo” para publicar o primeiro.</p></div>`;
      return;
    }
    lista.innerHTML = r.docs.map((d) => linha(d.id, d.data())).join("");
    lista.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => abrirEditor(b.dataset.editar)));
    lista.querySelectorAll("[data-excluir]").forEach((b) =>
      b.addEventListener("click", () => pedirExclusao(b.dataset.excluir, b.dataset.titulo)));
  } catch (erro) {
    console.error(erro);
    lista.innerHTML = `<div class="recado erro">Não consegui carregar a lista. ${escapar(mensagemDeErro(erro))}</div>`;
  }
}

function linha(id, a) {
  const mini = a.capa
    ? `<img class="linha-mini" src="${escaparAttr(a.capa)}" alt="">`
    : `<div class="linha-mini"></div>`;
  const estado = a.publicado
    ? `<span class="selo-e publicado">No ar</span>`
    : `<span class="selo-e rascunho">Rascunho</span>`;
  return `
  <div class="linha">
    ${mini}
    <div>
      <div class="linha-tit">${escapar(a.titulo || "Sem título")}</div>
      <div class="linha-sub">${estado} &nbsp;${escapar(resumir(a.corpo, 70))}</div>
    </div>
    <span class="linha-data">${escapar(dataCurta(a.criadoEm))}</span>
    <span class="linha-acao">
      <button class="bt mini" data-editar="${id}">Editar</button>
      <button class="bt mini" data-excluir="${id}" data-titulo="${escaparAttr(a.titulo || "")}">Excluir</button>
    </span>
  </div>`;
}

/* ══════ EDITOR ══════ */
const formArtigo = document.getElementById("form-artigo");
const recadoArtigo = document.getElementById("recado-artigo");
const campoTitulo = document.getElementById("titulo");
const campoCorpo = document.getElementById("corpo");
const campoAutor = document.getElementById("autor");
const campoPublicado = document.getElementById("publicado");
const previa = document.getElementById("previa");
const barra = document.getElementById("barra-envio");
const tituloEditor = document.getElementById("titulo-editor");

document.getElementById("novo").addEventListener("click", () => abrirEditor(null));
document.getElementById("voltar").addEventListener("click", carregarLista);

async function abrirEditor(id) {
  editando = id;
  capaURL = ""; capaPath = "";
  formArtigo.reset();
  recadoArtigo.hidden = true;
  barra.firstElementChild.style.width = "0";
  previa.innerHTML = `<span>Nenhuma capa escolhida</span>`;
  tituloEditor.textContent = id ? "Editar artigo" : "Novo artigo";
  mostrar("editor");

  if (!id) return;
  try {
    const d = await getDoc(doc(db, COLECAO, id));
    if (!d.exists()) { aviso(recadoArtigo, "erro", "Este artigo não existe mais."); return; }
    const a = d.data();
    campoTitulo.value = a.titulo || "";
    campoCorpo.value = a.corpo || "";
    campoAutor.value = a.autor || "";
    campoPublicado.checked = a.publicado !== false;
    capaURL = a.capa || "";
    capaPath = a.capaPath || "";
    if (capaURL) previa.innerHTML = `<img src="${escaparAttr(capaURL)}" alt="">`;
  } catch (erro) {
    aviso(recadoArtigo, "erro", mensagemDeErro(erro));
  }
}

/* upload da capa */
document.getElementById("capa").addEventListener("change", async (e) => {
  const arquivo = e.target.files?.[0];
  if (!arquivo) return;

  if (!arquivo.type.startsWith("image/")) {
    aviso(recadoArtigo, "erro", "A capa precisa ser uma imagem."); return;
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    aviso(recadoArtigo, "erro", "A imagem tem mais de 5 MB. Reduza antes de enviar."); return;
  }

  const caminho = `capas/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
  const tarefa = uploadBytesResumable(ref(storage, caminho), arquivo, { contentType: arquivo.type });

  tarefa.on("state_changed",
    (s) => { barra.firstElementChild.style.width = `${(s.bytesTransferred / s.totalBytes) * 100}%`; },
    (erro) => aviso(recadoArtigo, "erro", mensagemDeErro(erro)),
    async () => {
      capaURL = await getDownloadURL(tarefa.snapshot.ref);
      capaPath = caminho;
      previa.innerHTML = `<img src="${escaparAttr(capaURL)}" alt="">`;
      aviso(recadoArtigo, "ok", "Capa enviada.");
      barra.firstElementChild.style.width = "0";
    });
});

formArtigo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = campoTitulo.value.trim();
  const corpo = campoCorpo.value.trim();
  if (!titulo || !corpo) {
    aviso(recadoArtigo, "erro", "Título e texto são obrigatórios."); return;
  }

  const botao = formArtigo.querySelector("button[type=submit]");
  botao.disabled = true;

  const dados = {
    titulo, corpo,
    autor: campoAutor.value.trim() || "Ricardo Mendonça & Advogados Associados",
    resumo: resumir(corpo, 160),
    capa: capaURL, capaPath,
    publicado: campoPublicado.checked,
    atualizadoEm: serverTimestamp(),
  };

  try {
    if (editando) {
      await updateDoc(doc(db, COLECAO, editando), dados);
    } else {
      // criadoEm só na criação: editar um artigo não pode jogá-lo
      // para o topo da lista como se fosse novo.
      await addDoc(collection(db, COLECAO), { ...dados, criadoEm: serverTimestamp() });
    }
    carregarLista();
  } catch (erro) {
    aviso(recadoArtigo, "erro", mensagemDeErro(erro));
    botao.disabled = false;
  }
});

/* ══════ FORMATAÇÃO ══════ */
document.querySelectorAll("[data-marca]").forEach((b) => {
  b.addEventListener("click", () => envolver(b.dataset.marca));
});

function envolver(tipo) {
  const t = campoCorpo;
  const ini = t.selectionStart, fim = t.selectionEnd;
  const sel = t.value.slice(ini, fim) || "texto";
  const moldes = {
    negrito:  `**${sel}**`,
    italico:  `*${sel}*`,
    titulo2:  `\n## ${sel}\n`,
    titulo3:  `\n### ${sel}\n`,
    citacao:  `\n> ${sel}\n`,
    lista:    `\n- ${sel}\n`,
    link:     `[${sel}](https://)`,
  };
  const novo = moldes[tipo] || sel;
  t.setRangeText(novo, ini, fim, "end");
  t.focus();
}

/* ══════ EXCLUSÃO ══════ */
const confirma = document.getElementById("confirma");
const confirmaTexto = document.getElementById("confirma-texto");
let paraExcluir = null;

function pedirExclusao(id, titulo) {
  paraExcluir = id;
  confirmaTexto.textContent = titulo
    ? `“${titulo}” sai do ar e não tem como desfazer.`
    : "O artigo sai do ar e não tem como desfazer.";
  confirma.hidden = false;
}
document.getElementById("cancela").addEventListener("click", () => {
  confirma.hidden = true; paraExcluir = null;
});
document.getElementById("confirma-sim").addEventListener("click", async () => {
  if (!paraExcluir) return;
  const botao = document.getElementById("confirma-sim");
  botao.disabled = true;
  try {
    // A capa some junto: Storage cobra por armazenamento, e imagem
    // órfã de artigo apagado nunca mais é encontrada por ninguém.
    const d = await getDoc(doc(db, COLECAO, paraExcluir));
    const caminho = d.exists() ? d.data().capaPath : null;
    await deleteDoc(doc(db, COLECAO, paraExcluir));
    if (caminho) { try { await deleteObject(ref(storage, caminho)); } catch (e) { /* já não existia */ } }
    confirma.hidden = true;
    carregarLista();
  } catch (erro) {
    alert(mensagemDeErro(erro));
  } finally {
    botao.disabled = false; paraExcluir = null;
  }
});

/* ══════ utilidades ══════ */
function mostrar(qual) {
  tela.lista.hidden  = qual !== "lista";
  tela.editor.hidden = qual !== "editor";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function aviso(el, tipo, texto) {
  el.className = `recado ${tipo}`;
  el.textContent = texto;
  el.hidden = false;
}

/** Mensagens do Firebase são em inglês e falam de "credential". */
function mensagemDeErro(erro) {
  const c = erro?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "E-mail ou senha incorretos.";
  if (c.includes("too-many-requests"))
    return "Muitas tentativas seguidas. Aguarde alguns minutos.";
  if (c.includes("invalid-email"))   return "Esse e-mail não parece válido.";
  if (c.includes("network"))         return "Sem conexão com a internet.";
  if (c.includes("permission-denied") || c.includes("unauthorized"))
    return "Sem permissão. Confira se as regras do Firebase foram publicadas.";
  return erro?.message || "Algo deu errado. Tente de novo.";
}

function escapar(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escaparAttr(s) {
  return escapar(s).replace(/"/g, "&quot;");
}
