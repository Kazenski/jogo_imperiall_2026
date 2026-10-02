# Permissões e CORS — o que fazer para as imagens e o painel funcionarem

Este arquivo existe porque dois erros bem diferentes produzem mensagens quase
iguais, e trocar a coisa errada não resolve nada.

---

## Resumo: rode isto

```powershell
node configure-cors.js --apply
```

Ou, passo a passo:

```powershell
# 1. Publica as regras do Firestore E do Storage
npx firebase-tools@latest deploy --only firestore:rules,storage

# 2. Ajusta o CORS do bucket (precisa do Google Cloud CLI)
gcloud storage buckets update gs://jogo-imperiall-2026.firebasestorage.app --cors-file=cors.json
```

Depois **recompile e publique o site**:

```powershell
npm run build
npx firebase-tools@latest deploy --only hosting
```

---

## Os dois erros, lado a lado

### Erro 1 — "Missing or insufficient permissions"

```
index-P81F-e-Y.js:121 FirebaseError: Missing or insufficient permissions.
```

Aparece ao abrir abas que leem coleções do Firestore: **Bal. Tabela**,
**Estatísticas**, **Jogadores**.

**Causa:** as regras do Firestore não estão publicadas no projeto, ou sua conta
não está em `system/admins`.

As regras dizem: leitura de `items`, `classes`, `users`, etc. só para quem está
em `system/admins`. É proposital — o painel mostra dados de jogo de todo mundo.

**Como verificar em 1 minuto:**

1. Abra o Firestore no console do Firebase.
2. Existe a coleção `system` com o documento `admins`?
   - **Não existe:** nenhuma regra permite criá-lo agora. Rode o código abaixo
     para criar (veja a seção seguinte).
   - **Existe:** seu UID está no array `uids`?

**Se precisar criar o `admins` do zero:**

```js
// Cole no console do Firebase > Authentication > criar um teste rápido,
// ou use o SDK no navegador com seu usuário logado.
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { auth } from './firebase.js';

await setDoc(doc(getFirestore(), 'system', 'admins'), {
  uids: [auth.currentUser.uid],
});
```

A regra de bootstrap permite criar esse documento **só** se o próprio autor
estiver na lista — ninguém mais pode se promover junto.

---

### Erro 2 — "blocked by CORS policy ... preflight"

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...'
from origin 'https://kazenski.github.io' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
It does not have HTTP ok status.
```

Aparece nas imagens das listas e na prévia.

**Causa:** as regras do **Storage** não estão publicadas. Sem elas, toda
requisição ao bucket recebe 403. O preflight (OPTIONS) exige resposta 2xx e
recebe 403 — então o navegador acusa CORS, mas o problema é regra ausente.

**Correção:** `npx firebase-tools@latest deploy --only storage`

> Depois de publicar as regras, pode levar 1–2 minutos para propagar. Recarregue
> com cache limpo (Ctrl+Shift+R).

---

### Erro 3 — imagem continua quebrada depois das regras

Se as regras estão publicadas e ainda assim a imagem não carrega, aí sim é o
CORS do bucket. O bucket precisa liberar a origem do GitHub Pages:

```powershell
gcloud storage buckets update gs://jogo-imperiall-2026.firebasestorage.app --cors-file=cors.json
```

O `cors.json` já vem pronto no projeto, com `https://kazenski.github.io` e o
localhost para desenvolvimento.

> Atenção: `--cors-file` **substitui** a configuração inteira. Se você já tinha
> outras origens liberadas, acrescente-as ao `cors.json` antes de rodar.

---

## Estrutura das regras

### Firestore (`firestore.rules`)

| Coleção | Leitura | Escrita |
|---|---|---|
| `system/admins` | autenticado | só admin (bootstrap no 1º create) |
| `users/{uid}` | dono ou admin | dono (sem mudar `role`) ou admin |
| `items`, `classes`, `skills`, `recipes`, `monsters`, `worldTemplates`, `achievements`, `estacoes`, `biomas`, `npcs`, `servidores` | autenticado | só admin |
| `backups` | só admin | só admin |
| `portais/{uid}` | autenticado | só o dono |
| `jogadores/{uid}`, `bases/{uid}` | só o dono | só o dono |
| qualquer outra | **negado** | **negado** |

### Storage (`storage.rules`)

| Operação | Quem pode |
|---|---|
| Ler | qualquer um (anônimo inclusive — necessário para o preflight CORS) |
| Escrever | só admin, só nas pastas de upload, até 5 MB, apenas imagens |

O Storage consulta a **mesma** lista de admins do Firestore via
`firestore.get(...)`. Não existe cópia do seu uid em dois arquivos: promover
alguém no painel já libera o upload dele, e rebaixar já bloqueia.

---

## Problemas que já foram corrigidos no código

Estes não precisam de nada no console — estão resolvidos:

**Listagens que vinham vazias.** `orderBy('nome')` falhava inteiro se um
registro qualquer da coleção não tivesse o campo `nome`. Agora a ordenação é
tentativa e, se falhar, o painel lista sem ordem e ordena na tela
(`src/core/repos.js`).

**Prévia que não atualizava.** O valor da imagem ficava preso no objeto
antigo. Agora o campo mantém o valor atual e a prévia reflete assim que o
upload termina (`AdminScene.js`).

**Imagem quebrada virava moldura cinza.** Thumbnails com URL inválida agora
somem; a prévia mostra "imagem não carregou" em vez do ícone de erro.

**Erro de permissão genérico.** O painel traduz `permission-denied` em texto
que diz o que fazer, em vez de repassar "Missing or insufficient permissions".

**Campos com lista que nunca era preenchida.** `classesPermitidas` numa
estação, `biomas` num mundo, `npcsPermitidos` num servidor apareciam vazios
porque as opções vinham de outras coleções. Agora são resolvidas por `fonte`.

**Nomes com HTML.** Todo texto do Firestore passa por escape antes de virar
HTML no painel.

---

## Checklist de verificação

Depois de publicar, abra o painel (F2) e confirme:

- [ ] Aba **Bal. Tabela** abre com a tabela preenchida, sem erro de permissão
- [ ] Aba **Estações** mostra a lista de processos com nome e descrição
- [ ] Aba **Mundos** deixa escolher tamanho e biomas
- [ ] Aba **Biomas** lista blocos e mobs nativos
- [ ] Aba **NPCs do Mundo** mostra o mapa quadriculado ao lado do formulário
- [ ] Seletor de **Cor** mostra 36 quadradinhos
- [ ] Enviar uma imagem dá "Imagem enviada" e ela aparece na prévia
- [ ] Aba **Backup** cria um backup e lista o anterior
