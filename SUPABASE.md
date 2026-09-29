# Sistema de artigos

O escritório publica sozinho, sem mexer em código.

## Onde entra

**`painel.html`** — também há o link **Área restrita** no rodapé de todas as páginas.

Login com e-mail e senha. Não existe cadastro pelo site: quem publica é
cadastrado por quem administra o projeto (passo abaixo).

## Como publica

1. Entra no painel → **Novo artigo**
2. Título, texto e, se quiser, uma imagem de capa
3. **Publicar** → o artigo aparece na home e em `artigos.html`

Desmarcar "Publicar no site" salva como rascunho: fica só no painel.

O texto aceita marcações simples, pelos botões da barra: negrito, itálico,
subtítulo, citação, lista e link. A capa pode ser foto de celular — o painel
reduz a imagem antes de enviar.

## Dar acesso a alguém

São duas coisas, e as duas são necessárias:

1. **Criar o usuário** — no Supabase: Authentication → Users → **Add user** →
   **Create new user**, com e-mail e senha, marcando **Auto Confirm User**
2. **Pôr o e-mail na lista de editores** — no SQL Editor:

```sql
insert into public.editores (email) values ('nome@escritorio.com.br');
```

Só o passo 1 não basta: a pessoa entra, mas o painel avisa que ela não tem
permissão para publicar. Para tirar o acesso, basta apagar o e-mail da lista:

```sql
delete from public.editores where email = 'nome@escritorio.com.br';
```

## Segurança

- Visitante só lê artigo publicado. Rascunho não sai do banco para quem não é editor.
- Escrever, alterar, apagar e enviar capa: só quem está em `editores`.
- Desligue o cadastro aberto: Authentication → Sign In / Providers →
  **Allow new users to sign up** desligado. Mesmo ligado ninguém de fora
  publica, mas não há motivo para deixar a porta aberta.
- A chave em `js/supabase.js` é a **publicável**, feita para ficar no
  navegador. A chave `service_role` / secreta **nunca** entra no site.

O banco inteiro — tabelas, regras de acesso e o bucket das capas — está em
[`supabase/esquema.sql`](supabase/esquema.sql).

## Plano gratuito

O projeto está numa organização Free do Supabase: 500 MB de banco e 1 GB de
arquivos, muito além do que um escritório publica.

Projeto gratuito **pausa depois de 7 dias sem uso**. Para isso não acontecer,
o GitHub faz uma consulta por dia ao banco
([`.github/workflows/manter-supabase.yml`](.github/workflows/manter-supabase.yml)).
Se um dia a seção de artigos sumir do site, é o primeiro lugar a olhar: em
Actions, o agendamento precisa estar ativo, e no painel do Supabase o projeto
pode ser reativado com um clique em **Restore**.
