/* ============================================================
   PAINEL — login, lista, editor e exclusão.

   Tudo roda no navegador contra o Supabase. Quem impede que um
   visitante escreva não é este arquivo: são as políticas do banco
   (supabase/esquema.sql). Este arquivo só constrói a interface de
   quem já passou pelo login.
   ============================================================ */

import { clienteDoPainel, configurado, TABELA, BUCKET, dataCurta, resumir, escapar }
  from "./supabase.js";

const tela = {
  entrada: document.getElementById("tela-entrada"),
  app:     document.getElementById("tela-app"),
  lista:   document.getElementById("tela-lista"),
  editor:  document.getElementById("tela-editor"),
};

/* ══════ configuração ausente ══════ */
if (!configurado) {
  document.body.innerHTML = `
    <div class="entrada"><div class="entrada-cx">
      <h1 class="entrada-h">Painel ainda não ligado</h1>
      <p class="entrada-p">Falta conectar o banco de dados em <code>js/supabase.js</code>.
      O passo a passo está em <code>SUPABASE.md</code>, na raiz do site.</p>
    </div></div>`;
  throw new Error("Supabase não configurado");
}

const sb = clienteDoPainel();
const artigos = new Map();   // o que está na lista, por id
let editando = null;         // artigo aberto no editor, ou null para novo
let capaNova = null;         // imagem já reduzida, esperando o "Publicar"
let logado = null;

/* ══════ ENTRADA ══════ */
const formEntrada = document.getElementById("form-entrada");
const recadoEntrada = document.getElementById("recado-entrada");
const botaoEntrar = formEntrada.querySelector("button[type=submit]");

formEntrada.addEventListener("submit", async (e) => {
  e.preventDefault();
  botaoEntrar.disabled = true;
  recadoEntrada.hidden = true;
  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("senha").value,
  });
  if (error) {
    aviso(recadoEntrada, "erro", mensagemDeErro(error));
    botaoEntrar.disabled = false;
  }
});

document.getElementById("sair").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_evento, sessao) => {
  // O SDK trava se outra chamada ao Supabase roda dentro deste callback;
  // por isso a reação vai para a próxima volta do laço de eventos.
  setTimeout(() => mudouSessao(sessao), 0);
});

async function mudouSessao(sessao) {
  const dentro = !!sessao;
  if (dentro === logado) return;   // renovação de token: nada mudou
  logado = dentro;

  if (!dentro) {
    tela.app.hidden = true;
    tela.entrada.hidden = false;
    botaoEntrar.disabled = false;
    return;
  }

  // Login certo não basta: o e-mail precisa estar na lista de editores.
  // Sem isso a pessoa entraria num painel onde nada salva.
  const { data } = await sb.from("editores").select("email").maybeSingle();
  if (!data) {
    await sb.auth.signOut();
    aviso(recadoEntrada, "erro", "Este e-mail não tem permissão para publicar. Fale com quem administra o site.");
    return;
  }

  document.getElementById("quem").textContent = sessao.user.email;
  tela.entrada.hidden = true;
  tela.app.hidden = false;
  carregarLista();
}

/* ══════ LISTA ══════ */
const lista = document.getElementById("lista");

async function carregarLista() {
  mostrar("lista");
  lista.innerHTML = `<div class="carregando"><i class="giro"></i>Carregando</div>`;
  const { data, error } = await sb
    .from(TABELA)
    .select("id, titulo, resumo, capa, capa_path, publicado, criado_em")
    .order("criado_em", { ascending: false });

  if (error) {
    console.error(error);
    lista.innerHTML = `<div class="recado erro">Não consegui carregar a lista. ${escapar(mensagemDeErro(error))}</div>`;
    return;
  }

  artigos.clear();
  data.forEach((a) => artigos.set(a.id, a));

  if (!data.length) {
    lista.innerHTML = `<div class="vazio"><p>Nenhum artigo ainda. Use “Novo artigo” para publicar o primeiro.</p></div>`;
    return;
  }
  lista.innerHTML = data.map(linha).join("");
  lista.querySelectorAll("[data-editar]").forEach((b) =>
    b.addEventListener("click", () => abrirEditor(b.dataset.editar)));
  lista.querySelectorAll("[data-excluir]").forEach((b) =>
    b.addEventListener("click", () => pedirExclusao(b.dataset.excluir)));
}

function linha(a) {
  const mini = a.capa
    ? `<img class="linha-mini" src="${escapar(a.capa)}" alt="">`
    : `<div class="linha-mini"></div>`;
  const estado = a.publicado
    ? `<span class="selo-e publicado">No ar</span>`
    : `<span class="selo-e rascunho">Rascunho</span>`;
  return `
  <div class="linha">
    ${mini}
    <div>
      <div class="linha-tit">${escapar(a.titulo || "Sem título")}</div>
      <div class="linha-sub">${estado} &nbsp;${escapar(resumir(a.resumo, 70))}</div>
    </div>
    <span class="linha-data">${escapar(dataCurta(a.criado_em))}</span>
    <span class="linha-acao">
      <button class="bt mini" data-editar="${a.id}">Editar</button>
      <button class="bt mini" data-excluir="${a.id}">Excluir</button>
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
const campoCapa = document.getElementById("capa");
const previa = document.getElementById("previa");
const tituloEditor = document.getElementById("titulo-editor");
const botaoPublicar = formArtigo.querySelector("button[type=submit]");

document.getElementById("novo").addEventListener("click", () => abrirEditor(null));
document.getElementById("voltar").addEventListener("click", carregarLista);

async function abrirEditor(id) {
  editando = null;
  capaNova = null;
  formArtigo.reset();
  recadoArtigo.hidden = true;
  botaoPublicar.disabled = false;
  mostrarPrevia("");
  tituloEditor.textContent = id ? "Editar artigo" : "Novo artigo";
  mostrar("editor");

  if (!id) return;
  const { data, error } = await sb.from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    aviso(recadoArtigo, "erro", error ? mensagemDeErro(error) : "Este artigo não existe mais.");
    return;
  }
  editando = data;
  campoTitulo.value = data.titulo || "";
  campoCorpo.value = data.corpo || "";
  campoAutor.value = data.autor || "";
  campoPublicado.checked = data.publicado !== false;
  mostrarPrevia(data.capa || "");
}

function mostrarPrevia(src) {
  previa.innerHTML = src
    ? `<img src="${escapar(src)}" alt="">`
    : `<span>Nenhuma capa escolhida</span>`;
}

/* A capa é reduzida aqui mesmo, no navegador: foto de celular chega com
   4 a 8 MB e o site só precisa de 1600 px. Ela só sobe no "Publicar" —
   assim quem desiste do artigo não deixa imagem perdida no servidor. */
campoCapa.addEventListener("change", async () => {
  const arquivo = campoCapa.files?.[0];
  if (!arquivo) return;

  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
    aviso(recadoArtigo, "erro", "A capa precisa ser JPG, PNG ou WebP.");
    campoCapa.value = "";
    return;
  }
  try {
    capaNova = await reduzir(arquivo);
    mostrarPrevia(URL.createObjectURL(capaNova));
    aviso(recadoArtigo, "ok", "Capa pronta. Ela vai para o site quando você clicar em Publicar.");
  } catch (erro) {
    console.error(erro);
    capaNova = null;
    aviso(recadoArtigo, "erro", "Não consegui abrir essa imagem. Tente outro arquivo.");
  }
});

async function reduzir(arquivo, maxL = 1600, maxA = 1200) {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, maxL / bmp.width, maxA / bmp.height);
  const quadro = document.createElement("canvas");
  quadro.width = Math.round(bmp.width * escala);
  quadro.height = Math.round(bmp.height * escala);
  quadro.getContext("2d").drawImage(bmp, 0, 0, quadro.width, quadro.height);
  bmp.close?.();

  const gerar = (tipo, q) => new Promise((ok) => quadro.toBlob(ok, tipo, q));
  const webp = await gerar("image/webp", 0.82);
  if (webp?.type === "image/webp") return webp;
  // Safari antigo não gera WebP e devolve PNG pesado; JPEG resolve
  const jpeg = await gerar("image/jpeg", 0.85);
  if (!jpeg) throw new Error("Falha ao converter a imagem");
  return jpeg;
}

formArtigo.addEventListener("submit", async (e) => {
  e.preventDefault();
  const titulo = campoTitulo.value.trim();
  const corpo = campoCorpo.value.trim();
  if (!titulo || !corpo) {
    aviso(recadoArtigo, "erro", "Título e texto são obrigatórios."); return;
  }

  botaoPublicar.disabled = true;
  let caminhoNovo = null;

  try {
    let capa = editando?.capa ?? null;
    let capa_path = editando?.capa_path ?? null;

    if (capaNova) {
      aviso(recadoArtigo, "ok", "Enviando a capa…");
      caminhoNovo = `${crypto.randomUUID()}.${capaNova.type === "image/webp" ? "webp" : "jpg"}`;
      const envio = await sb.storage.from(BUCKET).upload(caminhoNovo, capaNova, {
        contentType: capaNova.type, cacheControl: "31536000", upsert: false,
      });
      if (envio.error) throw envio.error;
      capa = sb.storage.from(BUCKET).getPublicUrl(caminhoNovo).data.publicUrl;
      capa_path = caminhoNovo;
    }

    const dados = {
      titulo, corpo,
      autor: campoAutor.value.trim() || null,
      resumo: resumir(corpo, 160),
      capa, capa_path,
      publicado: campoPublicado.checked,
    };

    // .select() devolve as linhas afetadas: sem permissão, o banco não
    // dá erro no update, só não altera nada — e isso tem que aparecer.
    const { data, error } = editando
      ? await sb.from(TABELA).update(dados).eq("id", editando.id).select("id")
      : await sb.from(TABELA).insert(dados).select("id");
    if (error) throw error;
    if (!data?.length) throw { code: "42501" };

    // a capa antiga saiu do artigo; sem isso ela ficaria no servidor para sempre
    if (caminhoNovo && editando?.capa_path) {
      await sb.storage.from(BUCKET).remove([editando.capa_path]);
    }
    carregarLista();
  } catch (erro) {
    console.error(erro);
    if (caminhoNovo) sb.storage.from(BUCKET).remove([caminhoNovo]);
    aviso(recadoArtigo, "erro", mensagemDeErro(erro));
    botaoPublicar.disabled = false;
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
const botaoConfirma = document.getElementById("confirma-sim");
let paraExcluir = null;

function pedirExclusao(id) {
  paraExcluir = artigos.get(id) || null;
  if (!paraExcluir) return;
  confirmaTexto.textContent = paraExcluir.titulo
    ? `“${paraExcluir.titulo}” sai do ar e não tem como desfazer.`
    : "O artigo sai do ar e não tem como desfazer.";
  confirma.hidden = false;
}
document.getElementById("cancela").addEventListener("click", () => {
  confirma.hidden = true; paraExcluir = null;
});
botaoConfirma.addEventListener("click", async () => {
  if (!paraExcluir) return;
  botaoConfirma.disabled = true;
  try {
    const { data, error } = await sb.from(TABELA).delete().eq("id", paraExcluir.id).select("id");
    if (error) throw error;
    if (!data?.length) throw { code: "42501" };
    // a capa vai junto: imagem de artigo apagado ninguém mais encontra
    if (paraExcluir.capa_path) await sb.storage.from(BUCKET).remove([paraExcluir.capa_path]);
    confirma.hidden = true;
    carregarLista();
  } catch (erro) {
    alert(mensagemDeErro(erro));
  } finally {
    botaoConfirma.disabled = false; paraExcluir = null;
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

/** As mensagens do Supabase vêm em inglês e em três formatos diferentes
    (login, banco e arquivos). Aqui viram uma frase só, em português. */
function mensagemDeErro(erro) {
  const codigo = String(erro?.code || "");
  const texto = String(erro?.message || "");
  const status = Number(erro?.status || erro?.statusCode || 0);

  if (codigo === "invalid_credentials" || /invalid login/i.test(texto))
    return "E-mail ou senha incorretos.";
  if (codigo === "email_not_confirmed")
    return "Este e-mail ainda não foi confirmado. Confirme o usuário no Supabase.";
  if (status === 429 || /rate limit/i.test(texto))
    return "Muitas tentativas seguidas. Aguarde alguns minutos.";
  if (/failed to fetch|network/i.test(texto))
    return "Sem conexão com a internet.";
  if (codigo === "42501" || status === 403 || /row-level security|permission/i.test(texto))
    return "Sem permissão para publicar com este e-mail.";
  if (status === 413 || /too large|maximum allowed size/i.test(texto))
    return "A imagem ficou grande demais. Tente outra.";
  if (codigo === "23514")
    return "O título passa de 160 caracteres ou o texto está vazio.";
  return texto || "Algo deu errado. Tente de novo.";
}
