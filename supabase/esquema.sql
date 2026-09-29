-- ============================================================
-- ARTIGOS DO SITE — Ricardo Mendonça & Advogados Associados
--
-- Este é o banco inteiro. Está guardado aqui como registro do que
-- foi aplicado no projeto Supabase do escritório.
--
-- QUEM PODE PUBLICAR: só quem estiver na tabela `editores`.
-- Login certo não basta. Se alguém criar conta no Supabase do
-- escritório por fora do site, entra — mas não escreve nada.
-- ============================================================


-- ---- editores ---------------------------------------------------

create table public.editores (
  email text primary key check (email = lower(email))
);
alter table public.editores enable row level security;

-- cada editor enxerga só a própria linha: é assim que o painel
-- descobre se quem entrou tem permissão, sem expor a lista
create policy "editor ve a propria linha" on public.editores
  for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

revoke all on public.editores from anon;
grant select on public.editores to authenticated;


-- A checagem mora num schema fora da API, para não virar um
-- endpoint público. `security definer` deixa a função ler
-- `editores` sem depender da política acima.
create schema if not exists privado;
grant usage on schema privado to anon, authenticated;

create or replace function privado.eh_editor()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.editores
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function privado.eh_editor() from public;
grant execute on function privado.eh_editor() to anon, authenticated;


-- ---- artigos ----------------------------------------------------

create table public.artigos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (char_length(titulo) between 1 and 160),
  corpo         text not null check (char_length(corpo) between 1 and 100000),
  resumo        text check (char_length(resumo) <= 400),
  autor         text check (char_length(autor) <= 120),
  capa          text check (capa ~ '^https://'),
  capa_path     text,
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- a vitrine só pede os publicados, do mais novo para o mais antigo
create index artigos_vitrine on public.artigos (criado_em desc) where publicado;

-- Editar um artigo não pode mudar a data de publicação — senão uma
-- correção de vírgula joga o texto de 2024 para o topo da lista.
create or replace function privado.carimbar_artigo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.criado_em := old.criado_em;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger artigos_carimbo
  before update on public.artigos
  for each row execute function privado.carimbar_artigo();

alter table public.artigos enable row level security;

create policy "visitante le publicado, editor le tudo" on public.artigos
  for select to anon, authenticated
  using (publicado or (select privado.eh_editor()));

create policy "editor cria" on public.artigos
  for insert to authenticated
  with check ((select privado.eh_editor()));

create policy "editor altera" on public.artigos
  for update to authenticated
  using ((select privado.eh_editor()))
  with check ((select privado.eh_editor()));

create policy "editor exclui" on public.artigos
  for delete to authenticated
  using ((select privado.eh_editor()));

revoke all on public.artigos from anon;
grant select on public.artigos to anon;
grant select, insert, update, delete on public.artigos to authenticated;


-- ---- capas (Storage) -------------------------------------------

-- Bucket público: a capa aparece no site aberto, então qualquer um
-- lê pelo link. Escrever e apagar, só editor. O painel já reduz a
-- imagem antes de enviar; o limite aqui é a garantia.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas', 'capas', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "editor envia capa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capas' and (select privado.eh_editor()));

-- apagar exige também poder ler o objeto
create policy "editor ve capa" on storage.objects
  for select to authenticated
  using (bucket_id = 'capas' and (select privado.eh_editor()));

create policy "editor apaga capa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'capas' and (select privado.eh_editor()));
