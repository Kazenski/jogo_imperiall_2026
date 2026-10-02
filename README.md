# Jogo Imperiall 2026

Jogo 2D de navegador: você ergue uma base no Império, extrai recursos, fabrica
equipamentos, sobe de nível por uma árvore de talentos e abre um **Portal
Arcano** para que os amigos atravessem e visitem.

**Phaser 3 + Vite + Firebase**, publicado no GitHub Pages em
`https://kazenski.github.io/jogo_imperiall_2026/`.

---

## Sumário

- [Começando](#começando)
- [Fluxo do jogador](#fluxo-do-jogador)
- [Arquitetura](#arquitetura)
  - [A regra que sustenta tudo](#a-regra-que-sustenta-tudo)
  - [Mapa de arquivos](#mapa-de-arquivos)
  - [Camadas](#camadas)
  - [Fluxo de dados](#fluxo-de-dados)
  - [Firestore](#firestore)
- [Painel administrativo](#painel-administrativo)
- [Regras de sistema](#regras-de-sistema)
- [Conformidade legal](#conformidade-legal)
- [Testes](#testes)
- [Deploy](#deploy)
- [Arquitetura de Servidores](#arquitetura-de-servidores)
- [Armadilhas conhecidas do Phaser](#armadilhas-conhecidas-do-phaser)
- [Decisões de projeto](#decisões-de-projeto)

---

## Começando

```bash
npm install
cp .env.example .env.local     # preencha com o Firebase Console
npm run dev                    # http://localhost:5173/jogo_imperiall_2026/
```

Sem `.env.local` o jogo **funciona em modo local**: salva o progresso no
`localStorage` e usa a semente de dados embutida. É o jeito mais rápido de
mexer no layout sem depender de rede.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Bundle de produção em `dist/` |
| `npm run preview` | Serve o `dist/` localmente |
| `npm test` | Verifica a lógica pura em Node (sem navegador) |

### Variáveis de ambiente

Todas prefixadas com `VITE_FIREBASE_`. A configuração do Firebase Web **não é
secreto** — ela vai parar no bundle de qualquer jeito. O que protege os dados
são as Firestore Rules (`firestore.rules`), não estas variáveis.

O `.env.local` está no `.gitignore` e **nunca** deve ser commitado. No GitHub
Pages as mesmas variáveis entram como *repository variables* no workflow de
deploy.

---

## Fluxo do jogador

A ordem das telas é uma **regra**, não preferência de layout:

```
Boot (texturas procedurais)
  └─> Login ──> Termos ──> Criação do personagem ──> Mundo
                 (LGPD)       (não ser atacado)
                                       │
                                       └─> painéis: Mochila · Talentos ·
                                           Fabricação · Reinos · Wiki (H) ·
                                           Personagem · Admin (F2)
```

Por que cada etapa existe:

- **Termos antes do mundo** — é o único momento em que o aceite precisa ser
  explícito. Depois de gravar a versão, o jogo não pergunta de novo até a
  próxima alteração do documento legal (`VERSAO_TERMOS` em `src/dados/legal.js`).
- **Criação antes do mundo** — o mundo gera monstros em volta do ponto de
  entrada. Sem personagem definido, o jogador aparecia no meio deles.
- **Wiki como tecla H** — toda a escrita do administrador (`descricao`,
  `imagem`) é lida de lá. Se o admin não escreveu, a wiki mostra os campos
  numéricos em vez de um cartão vazio.

### Novidades no fluxo (Out/2026)

- **Posição persistente** — o jogador **nasce onde parou**. `estado.posicao`
  salva a cada 10s (se moveu >20px) e no shutdown de `WorldScene`.
- **Mapa 60x44** — área 6x maior (2640x1936). Mais biomas, bases maiores.
- **Portal posicionável** — Shift+P alterna 4 posições (dir/esq/cima/baixo),
  salvo em `estado.portalOffsetIdx`. Efeitos visuais: aro rúnico, partículas,
  runas orbitando, placa flutuante.
- **Itens até 1k + perecíveis** — `stackMax` padrão 1000. Campo `perecivel` +
  `tempoEstragarSegundos` no cadastro; `dataValidade` carimbada na criação;
  pilhas só unem se validade **exatamente igual**.

---

## Arquitetura

### A regra que sustenta tudo

**Toda lógica de jogo mora em `src/core/` e `src/dados/`, sem Phaser e sem
Firebase.** Isso permite testar em Node puro (`npm test`) e significa que
trocar de renderer não quebraria as regras.

O que essa regra já evitou:

| Se a regra fosse quebrada | O que acontece |
| --- | --- |
| Cálculo de XP dentro da cena | Só dá para testar rodando o navegador |
| Orbe aceito calculado na UI | Orbe aceito errado em um celular só |
| Atributo derivado na tela | Personagem mostra "+18 vida" e não sente |

### Mapa de arquivos

```
index.html                 página, tela de carregamento, estilos globais
vite.config.js             base '/jogo_imperiall_2026/'
firestore.rules            segurança do banco (deployado no projeto)

src/
  main.js                  configuração do Phaser e ordem das cenas
  config.js                lê o .env e expõe "Firebase habilitado?"
  constants.js             OURO, PERGAMINHO e a paleta

  core/                    ---- LÓGICA PURA (sem Phaser) ----
    enums.js               dicionários de valores permitidos
    regras.js              fabricação, extração, uso de itens
    personagem.js          atributos derivados, inventário, orbes, talentos
    catalogo.js            semente + Firestore, com índice de busca
    progresso.js           XP, nível, persistência (Firestore/localStorage)
    mundo.js               geração de mundo, quem entra em cada reino
    firebase.js            autenticação e handle do Firestore
    repos.js               CRUD genérico das coleções
    usuarios.js            perfil e verificação de admin
    armazenamento.js       upload de imagem para o Firebase Storage
    apagamento.js          eliminação de dados (direito do titular, LGPD)

  dados/                   ---- CONTEÚDO ----
    semente.js             itens, classes, talentos, receitas, monstros,
                           reinos e conquistas embutidos no código
    schemaAdmin.js         esquema de TODOS os cadastros do painel
    legal.js               Termos de Uso e Política de Privacidade
    racas.js               as 4 raças e seus textos

  ui/
    comuns.js              caixa arredondada, botão, chip, painel, barra,
                           campo de texto, fluxo de botões, atalhos
    formularios.js         campos de formulário (texto, número, área,
                           select, chips, upload de imagem com preview)

  scenes/
    BootScene.js           gera as texturas proceduralmente
    LoginScene.js          Google / modo local e o roteamento pós-login
    TermosScene.js         aceite dos termos
    CriacaoScene.js        criação e seleção de personagem
    WorldScene.js          o laço principal do jogo
    StatusScene.js         personagem, atributos, equipamento, apagar dados
    InventarioScene.js     mochila, equipamento e aplicação de orbes
    TalentosScene.js       árvore de talentos com ramos e pré-requisitos
    FabricacaoScene.js     receitas por estação
    ReinosScene.js         portais para os Reinos Etéreos
    AjudaScene.js          wiki do Império (tecla H)
    AdminScene.js          painel administrativo

testes/logica.mjs          verificação em Node puro
```

### Camadas

```
        ┌──────────────────────────────────────────────┐
        │  scenes/        o que aparece na tela        │
        │                 conhece core/ e ui/           │
        └───────────────┬──────────────────────────────┘
                        │
        ┌───────────────▼──────────────────────────────┐
        │  ui/            desenho, cliques, medição     │
        │                 NÃO conhece regras de jogo    │
        └───────────────┬──────────────────────────────┘
                        │
        ┌───────────────▼──────────────────────────────┐
        │  core/ + dados/   as regras e o conteúdo      │
        │                    NÃO conhecem Phaser         │
        └──────────────────────────────────────────────┘
```

Exemplo do caminho de um dado: o jogador clica em **Fabricar** →
`FabricacaoScene.fabricar()` → `core/regras.js fabricar()` →
`core/personagem.js adicionarItem()` → `core/progresso.js salvarProgresso()` →
a cena redesenha. Nenhuma regra foi decidida dentro da cena.

### Fluxo de dados

**Catálogo** — o que existe no mundo:

```
dados/semente.js  ─┐
                   ├─> core/catalogo.js ──> { itens, classes, skills, ... }
Firestore          ─┘                        + .indice por id
```

A regra é *sobrescrever, nunca substituir*: o Firestore só troca o registro
com o **mesmo `id`**. Se o painel estiver vazio, bloqueado ou sem rede, a
semente garante que o jogo abre e dá para jogar. Se o admin cadastrar um item
novo, ele entra sem desfazer o resto do mundo.

**Progresso** — o estado de um jogador:

```
cena  ──> core/progresso.js salvarProgresso(uid, estado)
                │
                ├─> Firestore  jogadores/{uid}     (sincroniza entre dispositivos)
                └─> localStorage                    (funciona sem login e sem rede)
```

As duas escritas usam a **mesma interface**; `progresso.js` escolhe o destino.
É por isso que dá para desenvolver sem Firebase configurado.

### Firestore

| Caminho | Quem escreve | Quem lê | Para quê |
| --- | --- | --- | --- |
| `users/{uid}` | o próprio uid | o próprio uid, admin | perfil, role, estatísticas |
| `jogadores/{uid}` | o próprio uid | o próprio uid | **todo** o progresso do jogador |
| `portais/{uid}` | o próprio uid | qualquer autenticado | nome, base e nível (para os amigos acharem) |
| `system/admins` | admin | todos | lista de uids com acesso ao painel (F2) |
| `items`, `classes`, `skills`, `recipes`, `monsters`, `worldTemplates`, `achievements` | admin | todos | o catálogo |

Regras em `firestore.rules`. O ponto sensível é `system/admins`: existe uma
regra de **auto-bootstrap** para que o primeiro jogador consiga se promover
pelo painel. **Se o jogo for aberto ao público, remova essa regra.**

---

## Painel administrativo

Tecla **F2**, só para quem está em `system/admins`.

Nove abas: Itens, Classes, Talentos, Monstros, Receitas, Reinos, Conquistas,
Portais, Jogadores.

**O esquema de cada cadastro vive em `src/dados/schemaAdmin.js`**, e não dentro
da cena. Antes eles estavam espalhados em `switch` dentro do `AdminScene`, o que
significava que a aba de Talentos não tinha campo de cor e a de Classes não
tinha upload de imagem — e isso era invisível na revisão de código. Acrescentar
um cadastro novo é acrescentar um bloco nesse arquivo.

Tipos de campo disponíveis: `texto`, `numero`, `area`, `select`, `multiselec`,
`imagem`. Cada um tem um widget em `src/ui/formularios.js` com cantos
arredondados, moldura que acende no foco e validação visual.

**Imagem** faz upload para o Firebase Storage, reduz para 256 px antes de
enviar (imagem de 6 MB trava o download de todo mundo) e mostra o preview na
hora. Sem Storage configurado, o campo avisa e aceita uma URL colada — o jogo
não finge que salvou.

Campos que valem atenção:

- **Talentos** — `ramo` agrupa a linha e `corRamo` pinta o conector; nomes de
  ramo novos ganham cor automática derivada do nome. `preRequisitos` (outros
  talentos da mesma classe) e `preRequisitoNiveis` (`fis:5` — exige ponto no
  **atributo**, não nível de jogador).
- **Itens** — `uso` é múltipla escolha. `rende` descreve o que o bloco deixa
  ao ser extraído, e é isso que a wiki mostra. `tiposOrbeAceitos` vazio
  significa "aceita todos".
- **Portais** — publica e oculta a base de um jogador **sem** apagar o
  progresso dele.
- **Jogadores** — promove e rebaixa admins. A lista vem de `users/{uid}`, então
  só aparece depois que a pessoa entrou no jogo uma vez.

Ao apagar, o painel avisa **o que vai quebrar**: um item usado em 12 receitas
ou um talento do qual outros 3 dependem.

---

## Regras de sistema

**Atributos.** Três: Físico, Mental e Social. Distribuídos à mão pelo jogador
no painel do Personagem. Não sobem sozinhos com o nível — é isso que permite
que um talento exija `fis:5` como requisito real.

**Pontos de talento.** `pontosPorNivel(nivel)` por nível, mais um por evento de
progressão. Respec gratuito pelo botão "Redefinir árvore".

**Orbes Arcanos.** Reforçam um item até o limite de `slotsUpgrade`. O tipo de
orbe tem de ser compatível com o **nível do jogador**: um orbe médio não entra
em alguém do nível 5, mesmo que sobre na ficha. Cada aplicação consome um
slot e sobe um nível de reforço.

**Árvore de talentos.** Talentos com o mesmo `ramo` formam um caminho;
`preRequisitos` desenha as conexões em curva de três segmentos (uma reta
diagonal ligando centro a centro cruza os nós vizinhos e faz o requisito
parecer outro talento). Um nó só é clicável para leitura com um clique;
liberar exige dois, ou o botão "Liberar" do painel de detalhe.

**Vocações.** Quatro na semente. Cada uma tem sua própria árvore, dividida em
ramos do tipo passiva / ativa / mental / social. Trocável até o nível 3.

---

## Conformidade legal

Implementado em `src/dados/legal.js` + `src/scenes/TermosScene.js` +
`src/core/apagamento.js`:

- **LGPD (Lei 13.709/2018)** — tela de aceite versionada, política de
  privacidade com base legal por categoria de dado, canal de contato com prazo
  de resposta de 15 dias e **botão "Apagar meu progresso"** no painel do
  Personagem, que remove `portais/{uid}`, `jogadores/{uid}` e `users/{uid}`.
- **ECA Digital (Lei 15.263/2025)** — estruturado, mas **depende de
  parecer jurídico**. Ver a lista do que falta no topo de `src/dados/legal.js`.
- **CDC (Lei 8.078/1990)** — canal de atendimento e gratuidade declarados.

O documento legal é **um modelo de trabalho**, não advice jurídico. Antes de
abrir ao público, ele precisa passar por profissional habilitado — os pontos
que faltam estão listados no próprio arquivo.

---

## Testes

```bash
npm test
```

`testes/logica.mjs` roda em Node puro e cobre:

- integridade do catálogo (ids únicos, referências de receita e loot válidas,
  nenhum talento órfão);
- **toda célula da árvore tem no máximo um talento** (senão a linha de um
  cobre o nome do outro);
- o pre-requisito de atributo de ponta a ponta: bloqueia, explica o motivo,
  libera quando o ponto é investido, desconta o custo;
- o esquema do painel: cada cadastro tem campos, todo tipo de campo tem widget,
  todo resumo de lista aguenta um registro quase vazio, nenhum resumo duplica
  chave;
- o documento legal: versão, data, canal de contato e cada direito do titular
  nomeado;
- as raças: ids únicos, textos preenchidos, padrão existente.
- **chamadas para funções inexistentes** — varre `src/scenes`, `src/ui`,
  `src/core`, `src/dados` e acusa qualquer função chamada que não existe
  (nem declarada, nem importada, nem global). Já pegou `this.montar()` vs
  `redimensionar()` e `corDeNome()` inexistente.

Ao mexer em `schemaAdmin.js`, `legal.js` ou `racas.js`, rode `npm test` antes
de olhar no navegador.

---

## Deploy

`.github/workflows/deploy.yml` faz build e publica `dist/` no GitHub Pages a
cada push na branch principal.

As seis variáveis `VITE_FIREBASE_*` precisam existir como **repository
variables** (`Settings → Secrets and variables → Actions → Variables`), não
como secrets. Um push vazio força um novo deploy quando só a configuração muda.

```bash
git commit -am "..." && git push
```

Para checar se o deploy rodou, use a API do GitHub — o `gh` CLI não está
instalado neste ambiente.

---

## Armadilhas conhecidas do Phaser

Verificadas nesta versão (3.90). Todas custaram tempo e estão registradas aqui
porque voltam.

1. **`Container.add()` NÃO converte a posição do filho para local.** Ela
   **soma** a posição do pai. Um texto criado em `(150, 260)` e adicionado a um
   container em `(100, 200)` é desenhado em `(250, 460)`. Helpers dentro de
   container precisam criar os filhos nas coordenadas **locais diretas**.

2. **`Graphics` e `Line` exigem `setOrigin(0, 0)`.** O `displayOrigin` é
   derivado do tamanho, então a forma sai deslocada por metade de si mesma com
   a origem padrão `[0.5, 0.5]`.

3. **`caixaArredondada` precisa de `dx = -origem[0] * largura`.** A versão
   anterior usava `origem[0] === 1 ? -largura : 0`, o que fazia toda caixa com
   origem padrão `[0.5, 0.5]` ser ancorada pelo canto superior esquerdo em vez
   do centro. Esse foi o defeito por trás de "todos os botões tortos".

4. **`Phaser.Events.SHUTDOWN` é `undefined`.** Use
   `Phaser.Scenes.Events.SHUTDOWN`. `Phaser.Scale.Events.RESIZE` está correto.

5. **Meça filhos com `getBounds()`, nunca com `.x`.** `.x` é local do container,
   e `Container.getBounds()` pode subnotar (containers só com `Graphics`
   medem como o texto que contêm).

6. **`fluxoBotoes` e `medirFluxo` precisam usar a mesma conta.** Calcular a
   quebra em dois lugares com fórmulas diferentes é o jeito clássico de um
   layout transbordar.

7. **`g.scene.launch` não existe.** Para abrir um painel, chame o método do
   próprio `WorldScene` (`w.abrirInventario()`).

8. **`window.prompt` é péssimo em jogo.** some o foco, alguns navegadores
   bloqueiam e o jogador não vê o que digitou. Todo campo de texto é um
   `<input>`/`<textarea>` do DOM sobreposto ao canvas — `ui/formularios.js`.

9. **`setMask` não aceita `Rectangle`.** Crie um `Graphics`, preencha e use
   `createGeometryMask()`. E destrua a máscara: `montar()` roda a cada resize.

10. **Injetar eventos de teclado num `<input>` do DOM** sem
    `ev.stopPropagation()` faz "i" abrir a Mochila enquanto se digita.

---

## Arquitetura de Servidores

Documento completo em [`ARQUITETURA_SERVIDORES.md`](ARQUITETURA_SERVIDORES.md).

**Resumo**: O jogo usa **Firebase (Auth + Firestore + Storage)** como backend
principal. Para funcionalidades que exigem autoridade de servidor (matchmaking
de portais, auto-combate, anti-cheat, guildas, chat), adicionamos um **Game
Server leve (Node.js + Colyseus + Redis)** que roda em VPS próprio.

| Responsabilidade | Onde roda |
|---|---|
| Auth, perfil, progresso, itens, base, portais, catálogo | **Firestore** |
| Upload de imagem | **Firebase Storage** |
| Matchmaking de portais, auto-combate, anti-cheat, guildas | **Game Server (Node.js + Colyseus)** |

O Game Server roda em VPS próprio (Docker + Redis), custa ~$50–100/mês,
escala linear. Documento completo com implementação, protocolos, anti-cheat,
auto-combate, guildas, multi-tenancy (escolas/empresas/cidades) e roadmap
em `ARQUITETURA_SERVIDORES.md`.

---

## Decisões de projeto

- **Semente + Firestore em vez de só Firestore.** O painel vazio nunca pode
  tornar o jogo injogável. A semente é o piso; o Firestore é o que o admin
  ajustou por cima.
- **Nada de lógica dentro das cenas.** Testável em Node, e é o que permite
  `npm test` rodar em 200 ms em vez de abrir um navegador.
- **Um clique lê, dois cliques libera.** Desbloquear talento é irreversível e
  consumia pontos; confirmar por gesto evita o clique acidental.
- **Todo texto que o jogador lê vem do admin.** Descrição e imagem são campos
  de cadastro, não constantes no código. É por isso que a wiki se mantém
  sozinha.
- **Termos versionados no documento, não no servidor.** Mudar `VERSAO_TERMOS`
  em `legal.js` força o aceite de novo sem depender de deploy backend.
- **Preferência por texto de teste a cor fixa.** `preRequisitoNiveis: {fis: 5}`
  é legível, previsível e o admin não precisa saber JSON.

---

## Contato

kazenski.developer@gmail.com