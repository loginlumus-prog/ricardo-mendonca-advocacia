/* ============================================================
   Comportamento comum a todas as páginas públicas.
   Sem dependências — carrega como módulo normal.
   ============================================================ */

/* ---- topo que ganha fundo ao rolar ------------------------------ */
(function topo() {
  const el = document.getElementById("topo");
  if (!el || el.classList.contains("solido")) return;
  const marcar = () => el.classList.toggle("preso", window.scrollY > 40);
  marcar();
  window.addEventListener("scroll", marcar, { passive: true });
})();

/* ---- revelação ao rolar ----------------------------------------
   Um observador só para a página inteira. Cada elemento sai da lista
   depois de aparecer: seção que já entrou não precisa continuar sendo
   observada, e sem isso o observador fica disparando a cada scroll.

   Fica exposto em window.RM.revelar porque os cards de artigo chegam
   do banco DEPOIS deste script rodar. Sem essa porta, eles nasceriam
   com opacity:0 e nunca seriam observados — invisíveis para sempre.   */
const RM = (window.RM = window.RM || {});

(function revelar() {
  const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const obs = (semMovimento || !("IntersectionObserver" in window)) ? null
    : new IntersectionObserver((entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("visivel");
          obs.unobserve(e.target);
        }
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

  /** Observa os .revela ainda não revelados dentro de `raiz`. */
  RM.revelar = (raiz = document) => {
    raiz.querySelectorAll(".revela:not(.visivel)").forEach((e) => {
      if (obs) obs.observe(e); else e.classList.add("visivel");
    });
  };
  RM.revelar();
})();

/* ---- consentimento de cookies (LGPD) ----------------------------
   O site não usa cookie de rastreamento; o aviso existe por
   transparência, como pede a LGPD. Guardamos só a decisão, em
   localStorage, sem identificar ninguém.  */
(function cookies() {
  const CHAVE = "rm-cookies";
  const caixa = document.getElementById("cookies");
  if (!caixa) return;

  let jaRespondeu = false;
  try { jaRespondeu = !!localStorage.getItem(CHAVE); } catch (e) { jaRespondeu = true; }
  if (jaRespondeu) { caixa.remove(); return; }

  document.body.classList.add("com-cookies");
  caixa.hidden = false;
  requestAnimationFrame(() => caixa.classList.add("visivel"));

  const responder = (valor) => {
    try { localStorage.setItem(CHAVE, valor); } catch (e) { /* navegação privada */ }
    caixa.classList.remove("visivel");
    document.body.classList.remove("com-cookies");
    setTimeout(() => caixa.remove(), 450);
  };

  caixa.querySelector("[data-aceitar]")?.addEventListener("click", () => responder("aceito"));
  caixa.querySelector("[data-recusar]")?.addEventListener("click", () => responder("recusado"));
})();

/* ---- ano corrente no rodapé ------------------------------------- */
document.querySelectorAll("[data-ano]").forEach((e) => {
  e.textContent = String(new Date().getFullYear());
});


/* ---- galeria da sede: foto ampliada -----------------------------
   Sem <dialog> (navegador muito antigo) os links seguem abrindo a
   foto direto, que é o comportamento do HTML puro.                  */
(function galeria() {
  const lente = document.getElementById("lente");
  const links = [...document.querySelectorAll("[data-galeria] a")];
  if (!lente || !links.length || typeof lente.showModal !== "function") return;

  const img = lente.querySelector("img");
  const legenda = lente.querySelector(".lente-leg");
  let atual = 0;

  const mostrar = (i) => {
    atual = (i + links.length) % links.length;
    const a = links[atual];
    img.src = a.href;
    img.alt = a.querySelector("img").alt;
    legenda.textContent = a.closest("figure").querySelector("figcaption")?.textContent || "";
  };

  links.forEach((a, i) => a.addEventListener("click", (e) => {
    e.preventDefault();
    mostrar(i);
    lente.showModal();
  }));
  lente.querySelector("[data-fechar]").addEventListener("click", () => lente.close());
  lente.querySelector("[data-ant]").addEventListener("click", () => mostrar(atual - 1));
  lente.querySelector("[data-prox]").addEventListener("click", () => mostrar(atual + 1));
  // clique fora da foto fecha; Esc o próprio <dialog> já trata
  lente.addEventListener("click", (e) => { if (e.target === lente) lente.close(); });
  lente.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft")  mostrar(atual - 1);
    if (e.key === "ArrowRight") mostrar(atual + 1);
  });
})();
