# Ricardo Mendonça & Advogados Associados — site

Site institucional do escritório. 30 anos de atuação em Direito Bancário e
Recuperação de Crédito, com sede em Salvador/BA.

## Estrutura

    index.html          página principal
    artigos.html        vitrine de artigos
    artigo.html         leitura de um artigo (?id=...)
    painel.html         área do escritório: login, lista e editor
    privacidade.html    aviso de privacidade (LGPD)
    css/site.css        sistema visual, compartilhado por todas as páginas
    css/painel.css      só o painel
    js/supabase.js      conexão com o banco e utilidades compartilhadas
    js/site.js          topo, revelação ao rolar e aviso de cookies
    js/artigos.js       vitrine
    js/artigo.js        leitura, com Open Graph e Schema.org Article
    js/painel.js        painel
    supabase/esquema.sql  o banco: tabelas, regras de acesso e bucket das capas
    img/                imagens tratadas e otimizadas
    midia/original/     o que o cliente enviou, sem tratamento

## Sistema de artigos

O escritório publica sozinho pelo `painel.html` (link **Área restrita** no
rodapé). Os artigos ficam no Supabase. Como publicar, como dar acesso a alguém
e como o banco é protegido: **[SUPABASE.md](SUPABASE.md)**. Se o banco estiver
fora do ar, o site funciona normalmente e a seção de artigos não aparece.

## Sobre as imagens

Os retratos que o cliente enviou tinham cada um um cenário diferente, e o do
Ricardo trazia livros em inglês ("Constitution", "Civil Procedure") enquanto a
foto de grupo estava em português. Lado a lado num site, isso denuncia.

Os quatro retratos foram **regerados com Seedream 5 Pro** usando a foto original
de cada um como referência de rosto: mesma pessoa, mesma roupa, mas com
iluminação de estúdio (chave suave à esquerda, contraluz prata) e o mesmo fundo
grafite-marinho para todos. O resultado lê como um ensaio único, feito pelo
mesmo fotógrafo no mesmo dia.

A foto de grupo também foi regerada, com os quatro rostos como referência, num
escritório ao anoitecer com a cidade ao fundo — profundidade real em vez de
quatro pessoas enfileiradas.

O selo de 30 anos veio em azul-marinho sobre transparente, invisível num site
escuro. Foi convertido para prata preservando o traço.

As três imagens de ambiente (capa, autos, textura) foram geradas sob direção de
arte para a paleta da marca: marinho e prata, frio e institucional.

Os arquivos originais do cliente estão preservados em `midia/original/`.


## Conformidade com a OAB

O rodapé traz o número de inscrição da sociedade, o CNPJ e o aviso de caráter
informativo, conforme o Provimento nº 205/2021 do CFOAB. O site não promete
resultados, não exibe logotipos de clientes e não usa linguagem de captação.
