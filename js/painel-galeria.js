/* ============================================================
   PAINEL — galeria de eventos.

   Um álbum por evento: título, data, descrição e várias fotos, cada
   uma com a sua legenda. As fotos são reduzidas aqui, no navegador, e
   só sobem quando se clica em "Salvar álbum" — quem desiste no meio
   não deixa imagem perdida no servidor.

   Quem protege os dados são as políticas do banco (supabase/esquema.sql);
   este arquivo só monta a tela de quem já passou pelo login.
   ============================================================ */

import { BUCKET_GALERIA, dataDoEvento, escapar } from "./supabase.js";

const MAX_FOTOS = 60;
const LADO_MAX = 1800;

export function iniciarGaleria({ sb, aviso, mensagemDeErro }) {
  const $ = (id) => document.getElementById(id);
  const el = {
    lista:     $("g-lista"),
    albuns:    $("g-albuns"),
    editor:    $("g-editor"),
    titEditor: $("g-titulo-editor"),
    form:      $("g-form"),
    titulo:    $("g-titulo"),
    data:      $("g-data"),
    desc:      $("g-desc"),
    publicado: $("g-publicado"),
    arquivos:  $("g-arquivos"),
    fotos:     $("g-fotos"),
    conta:     $("g-conta"),
    recado:    $("g-recado"),
    salvar:    $("g-salvar"),
    confirma:  $("g-confirma"),
    confTexto: $("g-confirma-texto"),
    confSim:   $("g-confirma-sim"),
  };

  let album = null;       // álbum aberto no editor, ou null para novo
  let itens = [];         // fotos na ordem em que aparecem; a primeira é a capa
  let removidos = [];     // fotos que já estavam salvas e foram retiradas
  let ocupado = false;
  let paraExcluir = null;
  const mapaAlbuns = new Map();

  /* ══════ navegação interna ══════ */
  function mostrar(qual) {
    el.lista.hidden = qual !== "lista";
    el.editor.hidden = qual !== "editor";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function abrir() {
    mostrar("lista");
    await carregarAlbuns();
  }

  /* ══════ LISTA ══════ */
  async function carregarAlbuns() {
    el.albuns.innerHTML = `<div class="carregando"><i class="giro"></i>Carregando</div>`;
    const { data, error } = await sb
      .from("albuns")
      .select("id, titulo, descricao, data_evento, capa, publicado, criado_em, fotos(count)")
      .order("data_evento", { ascending: false, nullsFirst: false })
      .order("criado_em", { ascending: false });

    if (error) {
      console.error(error);
      el.albuns.innerHTML = `<div class="recado erro">Não consegui carregar os álbuns. ${escapar(mensagemDeErro(error))}</div>`;
      return;
    }
    mapaAlbuns.clear();
    data.forEach((a) => mapaAlbuns.set(a.id, a));

    if (!data.length) {
      el.albuns.innerHTML = `<div class="vazio"><p>Nenhum álbum ainda. Use “Novo álbum” para publicar as fotos do primeiro evento.</p></div>`;
      return;
    }
    el.albuns.innerHTML = data.map(linha).join("");
  }

  function linha(a) {
    const total = a.fotos?.[0]?.count ?? 0;
    const mini = a.capa
      ? `<img class="linha-mini" src="${escapar(a.capa)}" alt="">`
      : `<div class="linha-mini"></div>`;
    const estado = a.publicado
      ? `<span class="selo-e publicado">No ar</span>`
      : `<span class="selo-e rascunho">Rascunho</span>`;
    const data = dataDoEvento(a.data_evento, "curta");
    return `
    <div class="linha">
      ${mini}
      <div>
        <div class="linha-tit">${escapar(a.titulo)}</div>
        <div class="linha-sub">${estado} &nbsp;${total} ${total === 1 ? "foto" : "fotos"}</div>
      </div>
      <span class="linha-data">${escapar(data)}</span>
      <span class="linha-acao">
        <button class="bt mini" data-g-editar="${a.id}">Editar</button>
        <button class="bt mini" data-g-excluir="${a.id}">Excluir</button>
      </span>
    </div>`;
  }

  el.albuns.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-g-editar]");
    const ex = e.target.closest("[data-g-excluir]");
    if (ed) abrirEditor(ed.dataset.gEditar);
    if (ex) pedirExclusao(ex.dataset.gExcluir);
  });
  $("g-novo").addEventListener("click", () => abrirEditor(null));
  $("g-voltar").addEventListener("click", () => { if (!ocupado) abrir(); });

  /* ══════ EDITOR ══════ */
  async function abrirEditor(id) {
    liberarPrevias();
    album = null; itens = []; removidos = [];
    el.form.reset();
    el.recado.hidden = true;
    el.salvar.disabled = false;
    el.titEditor.textContent = id ? "Editar álbum" : "Novo álbum";
    desenhar();
    mostrar("editor");
    if (!id) return;

    el.salvar.disabled = true;
    const [a, f] = await Promise.all([
      sb.from("albuns").select("*").eq("id", id).maybeSingle(),
      sb.from("fotos").select("*").eq("album_id", id).order("ordem").order("criado_em"),
    ]);
    el.salvar.disabled = false;
    if (a.error || f.error || !a.data) {
      aviso(el.recado, "erro", a.error || f.error ? mensagemDeErro(a.error || f.error) : "Este álbum não existe mais.");
      return;
    }
    album = a.data;
    el.titulo.value = album.titulo || "";
    el.data.value = album.data_evento || "";
    el.desc.value = album.descricao || "";
    el.publicado.checked = album.publicado !== false;
    itens = f.data.map((x) => ({
      id: x.id, url: x.url, path: x.path, previa: x.url,
      legenda: x.legenda || "", legendaOriginal: x.legenda || "",
      ordemOriginal: x.ordem, largura: x.largura, altura: x.altura,
    }));
    desenhar();
  }

  function liberarPrevias() {
    itens.forEach((f) => { if (f.blob) URL.revokeObjectURL(f.previa); });
  }

  /* ---- cartões de foto ---- */
  function desenhar() {
    el.fotos.innerHTML = itens.map((f, i) => `
      <div class="g-card" data-i="${i}">
        <div class="g-card-img">
          <img src="${escapar(f.previa)}" alt="">
          ${i === 0 ? `<span class="g-capa-tag">Capa</span>` : ""}
        </div>
        <input type="text" maxlength="160" data-legenda placeholder="Legenda (opcional)"
               value="${escapar(f.legenda)}" aria-label="Legenda da foto ${i + 1}">
        <div class="g-card-acoes">
          <button type="button" class="bt mini" data-mover="-1" aria-label="Mover para antes" ${i === 0 ? "disabled" : ""}>&larr;</button>
          <button type="button" class="bt mini" data-mover="1" aria-label="Mover para depois" ${i === itens.length - 1 ? "disabled" : ""}>&rarr;</button>
          <button type="button" class="bt mini" data-remover>Remover</button>
        </div>
      </div>`).join("");
    el.conta.textContent = itens.length
      ? `${itens.length} ${itens.length === 1 ? "foto" : "fotos"} · a primeira é a capa do álbum`
      : "Nenhuma foto ainda";
  }

  // a legenda é lida direto do campo; redesenhar a cada tecla tiraria o cursor
  el.fotos.addEventListener("input", (e) => {
    const campo = e.target.closest("[data-legenda]");
    if (!campo) return;
    itens[Number(campo.closest(".g-card").dataset.i)].legenda = campo.value;
  });

  el.fotos.addEventListener("click", (e) => {
    const cartao = e.target.closest(".g-card");
    if (!cartao || ocupado) return;
    const i = Number(cartao.dataset.i);
    const mover = e.target.closest("[data-mover]");
    if (mover) {
      const j = i + Number(mover.dataset.mover);
      if (j < 0 || j >= itens.length) return;
      [itens[i], itens[j]] = [itens[j], itens[i]];
      desenhar();
    } else if (e.target.closest("[data-remover]")) {
      const [fora] = itens.splice(i, 1);
      if (fora.blob) URL.revokeObjectURL(fora.previa); else removidos.push(fora);
      desenhar();
    }
  });

  /* ---- escolher fotos ---- */
  el.arquivos.addEventListener("change", async () => {
    const escolhidas = [...(el.arquivos.files || [])];
    el.arquivos.value = "";
    if (!escolhidas.length || ocupado) return;

    const livres = MAX_FOTOS - itens.length;
    if (livres <= 0) {
      aviso(el.recado, "erro", `Cada álbum comporta até ${MAX_FOTOS} fotos. Crie outro álbum para as demais.`);
      return;
    }
    const lote = escolhidas.slice(0, livres);
    const invalidas = lote.filter((f) => !/^image\/(jpeg|png|webp)$/.test(f.type));
    const validas = lote.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));

    ocupado = true; el.salvar.disabled = true;
    let falhas = invalidas.length;
    for (let n = 0; n < validas.length; n++) {
      aviso(el.recado, "ok", `Preparando as fotos… ${n + 1} de ${validas.length}`);
      try {
        const r = await reduzir(validas[n]);
        itens.push({
          blob: r.blob, previa: URL.createObjectURL(r.blob), legenda: "",
          largura: r.largura, altura: r.altura,
        });
      } catch (erro) {
        console.error(erro);
        falhas++;
      }
    }
    ocupado = false; el.salvar.disabled = false;
    desenhar();

    const avisos = [];
    if (escolhidas.length > lote.length) avisos.push(`Só couberam ${lote.length} (limite de ${MAX_FOTOS} por álbum).`);
    if (falhas) avisos.push(`${falhas} ${falhas === 1 ? "arquivo foi ignorado" : "arquivos foram ignorados"}: só entram JPG, PNG ou WebP que abram normalmente.`);
    if (avisos.length) aviso(el.recado, "erro", avisos.join(" "));
    else aviso(el.recado, "ok", `${validas.length} ${validas.length === 1 ? "foto pronta" : "fotos prontas"}. Escreva as legendas e clique em Salvar álbum.`);
  });

  /** Foto de celular chega com 4 a 8 MB; o site precisa de 1800 px. */
  async function reduzir(arquivo) {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / bmp.width, LADO_MAX / bmp.height);
    const quadro = document.createElement("canvas");
    quadro.width = Math.max(1, Math.round(bmp.width * escala));
    quadro.height = Math.max(1, Math.round(bmp.height * escala));
    quadro.getContext("2d").drawImage(bmp, 0, 0, quadro.width, quadro.height);
    bmp.close?.();
    const gerar = (tipo, q) => new Promise((ok) => quadro.toBlob(ok, tipo, q));
    let blob = await gerar("image/webp", 0.82);
    // Safari antigo não gera WebP e devolve PNG pesado; JPEG resolve
    if (blob?.type !== "image/webp") blob = await gerar("image/jpeg", 0.85);
    if (!blob) throw new Error("Falha ao converter a imagem");
    return { blob, largura: quadro.width, altura: quadro.height };
  }

  /* ---- salvar ---- */
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (ocupado) return;
    const titulo = el.titulo.value.trim();
    if (!titulo) return aviso(el.recado, "erro", "Dê um título ao álbum, por exemplo “Halloween 2026”.");
    if (!itens.length) return aviso(el.recado, "erro", "Escolha pelo menos uma foto.");

    ocupado = true; el.salvar.disabled = true;
    const enviadosNovos = [];   // caminhos subidos nesta tentativa, para limpar se um álbum novo falhar
    const eraNovo = !album;

    try {
      const campos = {
        titulo,
        descricao: el.desc.value.trim() || null,
        data_evento: el.data.value || null,
        publicado: el.publicado.checked,
      };

      // .select() devolve as linhas afetadas: sem permissão o banco não dá
      // erro no update, só não altera nada — e isso tem que aparecer.
      let res;
      if (album) res = await sb.from("albuns").update(campos).eq("id", album.id).select("id");
      else       res = await sb.from("albuns").insert(campos).select("id");
      if (res.error) throw res.error;
      if (!res.data?.length) throw { code: "42501" };
      const albumId = res.data[0].id;
      album = album || { id: albumId };

      for (let i = 0; i < itens.length; i++) {
        const f = itens[i];
        aviso(el.recado, "ok", `Salvando as fotos… ${i + 1} de ${itens.length}`);

        if (f.blob) {
          const caminho = `${albumId}/${crypto.randomUUID()}.${f.blob.type === "image/webp" ? "webp" : "jpg"}`;
          const envio = await sb.storage.from(BUCKET_GALERIA).upload(caminho, f.blob, {
            contentType: f.blob.type, cacheControl: "31536000", upsert: false,
          });
          if (envio.error) throw envio.error;
          enviadosNovos.push(caminho);
          const url = sb.storage.from(BUCKET_GALERIA).getPublicUrl(caminho).data.publicUrl;
          const ins = await sb.from("fotos").insert({
            album_id: albumId, url, path: caminho, legenda: f.legenda.trim() || null,
            largura: f.largura, altura: f.altura, ordem: i,
          }).select("id");
          if (ins.error) throw ins.error;
          if (!ins.data?.length) throw { code: "42501" };
          Object.assign(f, { id: ins.data[0].id, url, path: caminho });
        } else if (f.legenda.trim() !== f.legendaOriginal.trim() || i !== f.ordemOriginal) {
          const up = await sb.from("fotos")
            .update({ legenda: f.legenda.trim() || null, ordem: i })
            .eq("id", f.id).select("id");
          if (up.error) throw up.error;
          if (!up.data?.length) throw { code: "42501" };
        }
      }

      // o que foi retirado: some do banco primeiro, depois do armazenamento
      if (removidos.length) {
        const del = await sb.from("fotos").delete().in("id", removidos.map((f) => f.id)).select("id");
        if (del.error) throw del.error;
        await sb.storage.from(BUCKET_GALERIA).remove(removidos.map((f) => f.path));
      }

      const capa = await sb.from("albuns").update({ capa: itens[0].url }).eq("id", albumId).select("id");
      if (capa.error) throw capa.error;

      liberarPrevias();
      itens = []; removidos = [];
      await abrir();
    } catch (erro) {
      console.error(erro);
      // álbum novo que não terminou de subir: apaga o que ficou pela metade,
      // para a nova tentativa não duplicar nada
      if (eraNovo && album?.id) {
        await sb.from("albuns").delete().eq("id", album.id);
        if (enviadosNovos.length) await sb.storage.from(BUCKET_GALERIA).remove(enviadosNovos);
        album = null;
        itens.forEach((f) => { if (f.blob) { delete f.id; delete f.url; delete f.path; } });
      }
      aviso(el.recado, "erro", `Não consegui salvar. ${mensagemDeErro(erro)}`);
    } finally {
      ocupado = false; el.salvar.disabled = false;
    }
  });

  /* ══════ EXCLUSÃO ══════ */
  function pedirExclusao(id) {
    paraExcluir = mapaAlbuns.get(id) || null;
    if (!paraExcluir) return;
    const total = paraExcluir.fotos?.[0]?.count ?? 0;
    el.confTexto.textContent =
      `“${paraExcluir.titulo}” e as ${total} ${total === 1 ? "foto" : "fotos"} saem do ar e não tem como desfazer.`;
    el.confirma.hidden = false;
  }
  $("g-cancela").addEventListener("click", () => { el.confirma.hidden = true; paraExcluir = null; });
  el.confSim.addEventListener("click", async () => {
    if (!paraExcluir) return;
    el.confSim.disabled = true;
    try {
      const alvo = paraExcluir;
      const { data: fs, error: e1 } = await sb.from("fotos").select("path").eq("album_id", alvo.id);
      if (e1) throw e1;
      const { data, error } = await sb.from("albuns").delete().eq("id", alvo.id).select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
      // as linhas das fotos caem junto com o álbum; os arquivos saem depois
      if (fs?.length) await sb.storage.from(BUCKET_GALERIA).remove(fs.map((f) => f.path));
      el.confirma.hidden = true;
      await carregarAlbuns();
    } catch (erro) {
      alert(mensagemDeErro(erro));
    } finally {
      el.confSim.disabled = false; paraExcluir = null;
    }
  });

  return { abrir };
}
