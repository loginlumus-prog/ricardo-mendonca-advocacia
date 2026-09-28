# Ligando o sistema de artigos

O site funciona sem o Firebase — a seção de artigos simplesmente não aparece.
Para ligar, são cerca de 15 minutos, uma vez só. Depois disso o escritório
publica sozinho pelo `painel.html`.

> **A ordem importa.** Os passos 3 e 4 existem para ninguém além do escritório
> conseguir escrever no site. Não pule nenhum.

---

## 1. Criar o projeto

1. Entre em [console.firebase.google.com](https://console.firebase.google.com) com a conta Google do escritório
2. **Adicionar projeto** → nome: `ricardo-mendonca-advocacia`
3. Google Analytics: **desative** (o site não usa, e o aviso de privacidade diz isso)

## 2. Ligar os três serviços

No menu da esquerda, em **Criação**:

| Serviço | O que fazer |
|---|---|
| **Firestore Database** | Criar banco → **modo de produção** → região `southamerica-east1` (São Paulo) |
| **Storage** | Começar → **modo de produção** → mesma região |
| **Authentication** | Começar → método **E-mail/senha** → ativar |

## 3. Criar quem pode publicar

Em **Authentication → Users → Adicionar usuário**, cadastre o e-mail e a senha
de cada pessoa que vai publicar.

Depois, **desligue o cadastro público** — este é o passo que mais se esquece:

**Authentication → Settings → User actions → desmarque "Enable create (sign-up)"**

Sem isso, qualquer pessoa consegue criar conta chamando o Firebase direto pelo
navegador, mesmo sem existir tela de cadastro no site.

## 4. Publicar as regras de segurança

Abra `firestore.rules` e `storage.rules` e troque `<EMAIL_DO_ADMIN>` pelos
e-mails do passo 3. **As duas listas precisam ser iguais.**

Várias pessoas:

```
&& request.auth.token.email in [
     'ricardo@escritorio.com.br',
     'patricia@escritorio.com.br'
   ];
```

Depois publique, por um dos dois caminhos:

**Pelo console** — copie o conteúdo de cada arquivo e cole em
Firestore → **Regras** e Storage → **Regras**, clicando em Publicar.

**Pela linha de comando:**

```bash
npm install -g firebase-tools
```
```bash
firebase login
```
```bash
firebase use --add
```
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 5. Criar o índice da vitrine

A lista de artigos filtra os publicados e ordena por data. O Firestore exige um
índice para essa combinação.

Se usou a linha de comando no passo 4, **já está feito**. Pelo console:
Firestore → **Índices** → **Criar índice**:

| Coleção | Campo | Ordem |
|---|---|---|
| `artigos` | `publicado` | Crescente |
| | `criadoEm` | Decrescente |

O índice leva alguns minutos para ficar pronto. Até lá, a vitrine fica vazia.

## 6. Ligar o site ao projeto

1. Configurações do projeto (engrenagem) → **Seus apps** → ícone `</>` (Web)
2. Nome: `site` → **não** marque Firebase Hosting → Registrar
3. Copie o objeto `firebaseConfig` que aparece
4. Cole em `js/firebase.js`, no lugar dos valores entre `<>`

As chaves do `firebaseConfig` **não são segredo** — o Firebase as expõe no
navegador por projeto. Quem protege os dados são as regras do passo 4.

## 7. Autorizar o domínio

Authentication → Settings → **Domínios autorizados** → adicione o endereço onde
o site está publicado (hoje: `loginlumus-prog.github.io`; depois, o domínio do
escritório). Sem isso o login falha com erro de domínio.

---

## Conferindo

| Teste | Esperado |
|---|---|
| Abrir `painel.html` e entrar | lista vazia, botão "Novo artigo" |
| Publicar um artigo com capa | aparece em `artigos.html` e na home |
| Desmarcar "Publicar no site" | some do site, continua no painel como rascunho |
| Abrir o site numa janela anônima | vê o artigo, **não** vê o rascunho |

## Custo

No plano gratuito (Spark) cabem folgadamente um escritório e seus artigos:
50 mil leituras/dia no Firestore e 5 GB no Storage. Uma capa otimizada tem
cerca de 200 KB — são 25 mil capas antes de encostar no limite.
