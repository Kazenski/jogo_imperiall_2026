# Changelog técnico

Registro de mudanças do **código**, para quem vai manter o jogo. Cada versão
descreve o que mudou no repositório e — quando houver — **por que**.

O documento voltado ao jogador é [`CHANGELOG.md`](CHANGELOG.md). Este aqui não
fala de "novas mecânicas bonitas"; fala de arquivo, decisão e armadilha.

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
.Versionado em [SemVer](https://semver.org/lang/pt-BR/).

---

## [0.1.3] — Terreno cavavel, chunks no painel e integridade de conta

*Outubro de 2026*

### 1. O mapa nao tinha mapa

Antes de mexer em "chunks", a primeira coisa foi conferir o que existia. O
resultado muda o tamanho do trabalho:

- `WorldScene` tem `COLUNAS`/`LINHAS`/`LARGURA_TILEMAP`, mas **nao ha tilemap**.
  `this.chao` e um `tileSprite` com `setScrollFactor(0)`: um padrao de fundo
  repetido, nao uma grade.
- Nao ha terreno, nem relevo, nem parede. Os nos de recurso sao `Image` soltos e
  as 60 arvores sao sorteadas por `hashSimples`.
- O unico colisor do mundo inteiro sao as arvores (`WorldScene.js:289`).
  Nao ha `physics.world.setBounds`.

Ou seja: nao havia mapa para comecar a mexer. **Cavar e construir entraram como
construcao, nao como refatoracao.**

### 2. A linha do terreno e PROFUNDIDADE, nao altura

Decisao central, porque o jogo e top-down com movimento livre nas 8 direcoes e
**sem gravidade**: nao existe chao para o jogador pisar. Dar relevo caminhavel
exigiria inventar pulo, colisao e reescrever o input — trocar o jogo, nao o mapa.

O que da para fazer no que existe e ja valia: a coluna e o eixo X, e a LINHA e
a PROFUNDIDADE. Acima da superficie e ceu; abaixo, `profundidade` camadas de
solo. Cavar e REMOVER uma celula — e a grade e a mesma que a base ja usava
(`base.blocos`, `chaveBloco`).

`core/mundo.js`:
- `gerarTerrenoMundo(reino, chunks, opcoes)` -> `Map<"x,y", celula>`
- `aplicarAlteracoesTerreno`, `escavarCelula`, `colocarCelula`
- `espalharBausEItens`, `sortearLoot`

### 3. Terreno procedural + sobreposicao do jogador

O terreno vem da semente (todo mundo ve o mesmo). O perfil guarda **so** as
celulas que o jogador mudou (`estado.terrenoCavado`): `null` = cavado, `itemId` =
colocado. Guardar a grade inteira seria centenas de milhares de caracteres por
conta e redundante — o procedural ja esta no seed.

Consequencia de projeto, registrada de proposito: **redesenhar um chunk no
painel apaga os buracos antigos**, porque o registro do jogador e uma sobreposicao
e nao uma edicao do procedural. E o comportamento esperado de quem redesenha o
mundo.

### 4. Cada celula e uma Image, nao um retangulo de um Graphics

`Graphics` tem **uma** profundidade. Com um `Graphics` so para o terreno, um
bloco de subsolo ficaria sempre atras ou sempre na frente do jogador, conforme o
jogador estivesse acima ou abaixo da linha do chao — a "entrar no terreno" some.
Com um objeto por celula e `setDepth(y)`, o jogador desce para dentro do buraco.

Custo: ~600 `Image` para um mundo de 60x44. Atualizacao **incremental**: escavar
destroi uma imagem e colocar cria uma. Redesenhar 600 imagens por toque daria um
engasgo visivel.

### 5. `soltar()` estourava dentro do Phaser

`create()` e async (carrega o catalogo) e o Phaser ja entrega eventos de ponteiro.
Um `pointerup` que chegasse antes de `criarJogador` rodava `cam.startFollow(null)`
e o erro era `Cannot read properties of null (reading 'x')`, **dentro da
biblioteca** — sem nenhuma pista da causa. Guarda adicionada.

### 6. Dois bugs de gameplay que estavam la ha tempo

- `derrubarBloco` chamava `derrubarBlocoDaBase(estado, catalogo, col, linha)` com
  quatro argumentos posicionais, mas a funcao le **um objeto**. `estado` chegava
  `undefined` e `estado.base` estourava `TypeError`. Quebrado desde a mudança de
  assinatura.
- Construir **nunca funcionou**: `InventarioScene` escrevia `blocoSelecionado` em
  si mesma e era destruida ao fechar, e o botao "Construir com este" so aparecia
  em `tipo === 'ferramenta'` — ou seja, numa picareta, nunca num bloco. Agora
  emite `bloco-selecionado` para o World, e o botao aparece em `tipo === 'bloco'`
  ou uso `estrutura`.

### 7. `acaoConstruir` comia o bloco e nao colocava nada

A ordem era: verificar o resultado e so entao consumir. Mirando numa celula
ocupada — o que e a primeira coisa que se faz num mundo cheio de terra — o
jogador perdia o bloco sem ganhar nada. Agora verifica antes de consumir.

### 8. Cycle de import: a paleta

`ui/pixelart.js` importava `CORES_PALETA` de `dados/schemaAdmin.js`. O ciclo
`AdminScene -> pixelart -> schemaAdmin` devolvia `undefined` para um `export
const` no navegador (o Vite resolve ciclos diferente do Node), e a aba Classes
abria em branco. A paleta foi para `ui/paleta.js`, sem volta.
`testes/painel.mjs` detecta ciclos estaticamente.

### 9. Regra de Storage: `match` aninhado NAO herda

`allow read: if true` no nivel do bucket, com um `match /{allPaths=**}` dentro
só com `allow write`. Regra de Storage **substitui** a do pai nos caminhos que
casa — nao soma. Resultado: leitura negada para todo arquivo, e nenhuma imagem do
jogo carregava. As duas permissoes agora vivem no mesmo `match`.
`testes/storage-regras.mjs` roda contra os emuladores com as regras reais.

### 10. Integridade conta <-> personagem

`LoginScene` importava `garantirPerfil` de `core/progresso.js` (grava em
`jogadores`) em vez de `garantirPerfilUsuario` de `core/usuarios.js` (grava em
`users`): `users` ficava vazio e a aba Jogadores nao mostrava ninguem.

Depois, o mesmo arquivo passou a mandar ao salao o perfil de `users`, que nao tem
`personagens` — a lista vinha vazia sempre.

E o grave: `carregarPerfilJogador` devolvia um perfil **inventado** quando a
leitura falhava ou passava do timeout, e `salvarPerfil` grava o objeto inteiro com
`merge: true`. Um perfil vazio traz `personagens: []`, entao

    ler (falhou) -> perfil vazio -> salvarPerfil -> personagens: []

**apagava de verdade** os herois que existiam no Firestore. Agora a funcao lanca
`PerfilIlegivelError`, e o salao distingue "nao tem heroi" de "nao consegui ler".

`testes/integridade.mjs` trava esse contrato.

### 11. Arquivos

| Arquivo | Mudanca |
|---|---|
| `core/mundo.js` | geracao de terreno, heightmap, chunks, baus |
| `scenes/WorldScene.js` | terreno, escavar, colocar, baus, mira na grade |
| `scenes/InventarioScene.js` | emite `bloco-selecionado` para o World |
| `scenes/LoginScene.js` | dois perfis separados, `perfilJogador` vs `perfilUsuario` |
| `core/progresso.js` | `PerfilIlegivelError`, escrita sem engole falha |
| `core/catalogo.js` | chunks, npcs e biomas entram no catalogo |
| `core/personagem.js` | `estado.terrenoCavado` |
| `dados/schemaAdmin.js` | `CAMPOS_CHUNK` (36 campos), `parseConteudoBaus` |
| `scenes/AdminScene.js` | aba Chunks, mapa de chunks, fonte `baus` |
| `core/repos.js` | `repoChunks` |
| `firestore.rules` / `storage.rules` | colecoes novas, leitura/escrita no mesmo match |
| `ui/paleta.js` | paleta movida (quebra o ciclo) |

### 12. Testes

| Arquivo | Cobre |
|---|---|
| `testes/terreno.mjs` | grade, profundidade, escavar, colocar, sobreposicao, baus |
| `testes/chunks.mjs` | grade em chunk, sorteio por peso, determinismo |
| `testes/painel.mjs` | ciclos, esquema orfao, tipos de campo, `fileEl` |
| `testes/integridade.mjs` | os dois perfis, leitura falha != vazio |
| `testes/storage-regras.mjs` | regras do Storage no emulador |
| `teste-terreno.html` | sobe a `WorldScene` sem login, para ver o terreno |

`npm run test:tudo` roda as quatro suites de Node.

---

## [0.1.3] — Lobby como hub, CRUD real e exclusao com carencia

*Outubro de 2026*

Objetivo: depois de "Entrar com Google" o jogador sempre cai no salao (ate 10
herois), clica num heroi para confirmar a entrada, e tem CRUD completo — com
exclusao que so vale 30 dias depois.

### 1. O lobby existia, mas nao fazia nada

A tela estava desenhada e registrada no `config.js`. **Os quatro caminhos
mortos** e o porque de "entrar" parecer quebrado:

| Caminho | Estado anterior | O que acontecia |
| --- | --- | --- |
| `aoEntrar` | `LobbyScene.init` lia `dados.aoEntrar`, **ninguem passava** | no-op silencioso |
| `novoPersonagem` | `aoCriado()` so reiniciava a cena | nunca chamava `criarPersonagem` |
| `editarPersonagem` | passava `personagem:`; `CriacaoScene.init` le **`estado:`** | modo edicao nunca ativava, nunca salvava |
| `APAGAR` | chamava `apagarPersonagem` direto | sem carencia, sem volta |

Dois outros desvios: `irParaLobby` ainda tinha um ramo `temChars` que pulava o
lobby e ia direto para `Criacao` (contrariando o requisito), e o lobby nao
iniziava `World` — apenas voltava para ele.

**Correcao.** `irParaLobby` perdeu o ramo. `LobbyScene` passou a fazer a
transicao ele mesmo: `carregarPersonagem` + `definirPersonagemAtivo` +
`scene.start('World', ...)`, passando `podeSair`/`email`/`nomeConta` por `init`
em vez da indirecao `aoEntrar` que ninguem fornecia. `aoConcluir` das rotas de
criar/editar agora grava de verdade (`criarPersonagem` / `salvarPersonagem`) e
`CriacaoScene` recebe `estado: char` + `editando: true`.

### 2. Exclusao com carencia de 30 dias (`src/core/progresso.js`)

`exclusaoAgendadaEm` entra no documento do personagem (`criarPersonagem` ja
inicializa em `null`), e o bloco novo expoe `DIAS_CARENCIA_EXCLUSAO = 30`,
`JANELA_EXCLUSAO_MS`, `exclusaoPendente`, `exclusaoExpiradaEm`,
`diasRestantesExclusao`, `exclusaoVencida`, `personagemJogavel`,
`agendarExclusao`, `cancelarExclusao` e `purgarExclusoesExpiradas`.

`MAX_PERSONAGENS` saiu do lobby e passou a ser exportado de `progresso.js`,
para que o limite tenha uma fonte só.

`apagarPersonagem()` continua existindo (seed e manutencao) mas foi marcado
`@deprecated`: chamar direto burla a carencia e nao da chance de resgate.

### 3. Termos: `salvarTermos` em vez do atalho

Aceitar os termos usava `salvarProgresso`, que **caia em `criarPersonagem`** e
criava um heroi fantasma "Viajante" so para guardar a data. Novo `salvarTermos`
grava direto no perfil. As duas chamadas a `salvarProgresso` no login foram
removidas — o nome de exibicao do Google virou so sugestao na tela de criacao.

### 4. Bugs de runtime encontrados no navegador

`npm test` roda logica pura em Node e **nunca importa Phaser** (README, item
15). Tudo abaixo passou com build verde e suite verde; nenhum era alcancavel sem
rodar o jogo.

**(a) `setStrokeStyle()` em `Container`.** O hover dos cartoes fazia
`bg.setStrokeStyle(...)`, sendo que `caixaArredondada()` devolve um
**Container** — o `Graphics` e `.caixa`. `TypeError` no primeiro hover.
Trocado por `pintarCartao()`, que faz `clear()` e redesenha.

**(b) `avisar()` num `Text` morto.** `salvarCriacao` / `salvarEdicao` /
`executarExclusao` / `executarResgate` rodam **depois** de `await`, ou seja com
o lobby ja parado. O `Text` continua no JS mas o canvas foi destruido:

```
TypeError: Cannot read properties of null (reading 'glTexture')
    at Text2.updateText ... at TextStyle2.setColor ... at LobbyScene.avisar
```

Como a chamada ficava **antes** do `try` do chamador, o `throw` comia a
gravacao inteira: o heroi nao era salvo, nenhuma cena mudava e o jogador
ficava preso em `Criacao` sem mensagem nenhuma. Duas correcoes: guarda
`if (!this.mensagem || !this.sys.isActive()) return;` em `avisar()`, e
`this.mensagem = null` no `SHUTDOWN`.

Atencao: dentro de `create()` o `sys.isActive()` **ainda e falso** (o status
vira RUNNING depois), entao a mensagem que chega nos dados da cena e escrita
direto em `this.mensagem`, sem passar por `avisar()`.

**(c) `ScenePlugin.start()` nao derruba a cena de baixo.** `voltarAoLobby()`
chama `scene.start('Lobby', ...)` a partir do **proprio lobby, que ja estava
parado** — `start()` e enfileirado e nao tem cena "corrente" para derrubar. A
`Criacao` continuava de pe por baixo: duas cenas ativas, dois conjuntos de input
disputando o mesmo ponteiro, e o `<input>` do DOM por cima do lobby novo.
Centralizado em `voltarAoLobby()`, que agora tambem para a `Criacao` — mas
**so quando ela esta ativa**: `SceneManager.stop()` numa cena ja parada cai no
ramo `sleep()` em vez de `shutdown()`, e `sleep()` nao dispara `destroy()`
(README, item 18).

**(d) Tipografia que so morre em producao.** A constante era declarada
`JANELA_EXCLUCAO_MS` (19 chars) e usada como `JANELA_EXCLUCAUCO_MS` (20) —
`ReferenceError` garantido, build verde. Achei pelo scanner de `testes/logica.mjs`.

**(e) Grade fixa estourava o painel.** 10 slots x 220px em 4 colunas precisam
944px; o painel dava 650. `calcularGrade()` calcula colunas e linhas pelo
espaco disponivel.

**(f) Deducao por nome em `CriacaoScene`.** O modo edicao era deduzido do nome
do heroi — um heroi chamado literalmente "Viajante" era lido como "sem
personagem". Agora respeita o flag `editando` explicito.

### 5. Entrada em fila do Phaser (medido, nao deduzido)

`InputManager.hitTest` **nao ordena** nada; `sortGameObjects` so roda no
`processOverEvents`. A ordem de `POINTER_DOWN` e a **ordem de insercao** em
`input._list`. Medido num botao do modal: `[slot, capa, botao]` — o slot do
fundo primeiro. O primeiro a chamar `stopPropagation()` cancela os seguintes
(`processDownEvents` quebra em `_eventData.cancelled`), ou seja o
`stopPropagation` no objeto mais antigo mata o botao que esta na frente.

A solucao adotada **nao** mexe na ordem:

1. `input.enabled = false` em tudo que ja estava na tela enquanto o modal abre;
2. a `capa` do modal e criada **por ultimo**, depois dos botoes.

O mesmo padrao esta documentado no README (item 16) e o defeito equivalente
existe em `StatusScene.js:180` e `TalentosScene.js:100`, que adicionam a `capa`
**antes** dos botoes — la, clicar em qualquer botao do modal destroi o modal
primeiro. **Nao corrigido aqui: fora do escopo desta versao.**

### 6. Testes

15 casos novos em `testes/logica.mjs`, secao `== exclusao com carencia ==`:
pendente/vencido, borda de 30 dias (ms antes e depois), `diasRestantesExclusao`
com 0/1/muitos dias, `personagemJogavel` para heroi livre, congelado e vencido,
o cancelamento limpando `exclusaoAgendadaEm`, a purga removendo so os vencidos,
relogio valendo a carencia mesmo depois de `criarPersonagem`, e o estado limpo
de `criarPersonagem`.

### Verificacao em navegador

Percorrido o CRUD inteiro com o `window.__game` do dev server: criar (grava e
volta ao salao com mensagem), editar (modo edicao ativo, nome/raca/vocacao
grava), excluir (agenda, persiste, mostra `EXCLUIXDO EM 18 DIAS`), cancelar
(resgata), purga (some o que venceu 30 dias, com aviso), limite de 10 (11o
heroi mostra "Limite de 10 herois atingido"), heroi congelado sem
`ENTRAR NO MUNDO`, clique no cartao abrindo a confirmacao e `World` ativa com o
heroi certo.
---

## [0.1.2] — Login do Google, layout da entrada e o scanner de constantes

*Outubro de 2026*

### 1. `ALTURA_CHIP is not defined` (crash real, build verde)

`src/ui/formularios.js::campoMultiselec()` usava `ALTURA_CHIP` como valor
inicial de `totalAlturaChip`. Esse identificador **não existe em lugar nenhum
do repositório** — só a linha de uso. Como `refazer()` sobrescreve o valor
imediatamente depois (inclusive quando `lista` é vazio, onde `linhasUsadas`
fica `1`), o inicial só precisa ser coerente com o cálculo de uma linha:
`ALTO_CHIP`.

Bug pré-existente, nunca alcançado porque o Admin ficava atrás do input morto
que o `0.1.1` corrigiu. O `npm run build` e o `npm test` passavam: `npm test`
roda lógica pura em Node e **nunca importa Phaser**, então nenhum bug de
runtime de cena é detectável por ele.

### 2. "Entrar com Google não faz nada" — três causas somadas

**(a) Rejeição não tratada no `observarLogin`.** O callback era
`observarLogin(async (user) => { ... await this.entrar(user) })`.
`onAuthStateChanged` **não aguarda callbacks async nem captura rejeição**. Uma
falha em `entrar()` virava `Uncaught (in promise)` e o jogador via uma tela
parada, sem mensagem — exatamente o sintoma reportado. O callback agora é
síncrono e encerra em `.catch(() => this.marcarOcupado(false))`.

**(b) `entrar()` rodava duas vezes por login.** `signInWithPopup` resolve e
`tentarGoogle` chamava `entrar()`; o mesmo sign-in **também** dispara
`onAuthStateChanged`, cujo callback chamava `entrar()` de novo. Duas execuções
paralelas disputando `scene.start()`, o dobro de escritas no Firestore, e o
status aparecendo/sumindo. Novo `entrarUmaVez(user)` memoiza a promessa por
`uid`; ela só é liberada **se falhar**, para o jogador poder tentar de novo.
`tentarGoogle` deixou de chamar `entrar()` diretamente — quem conduz a
transição é o observer, com uma rede de segurança caso ele não dispare
(senão a tela ficaria presa em "Abrindo o login..." para sempre).

**(c) Botão morto com sessão já ativa.** `onAuthStateChanged` dispara na hora
se o navegador ainda tem sessão, e o jogo entra sozinho. Nesse estado
clicar "Entrar com Google" não fazia nada de útil. Agora `tentarGoogle`
detecta `usuarioAtual` e responde em texto em vez de abrir o popup.

> Verificado e **não** é causa: as 6 variáveis `VITE_FIREBASE_*` estão no
> bundle publicado, a API key responde 200 e `kazenski.github.io` está em
> `authorizedDomains`. Nem popup bloqueado nem domínio não autorizado.

**(d) Sem trava de reentrada.** Clicar repetidamente abria popups empilhados.
`this.ocupado` bloqueia os dois handlers; o feedback vai para o próprio botão
(`setTexto` + `definirVisual` + `setAlpha`), não só para a linha de status.

### 3. Layout da tela de entrada

Quatro posições independentes (`height * 0.38`, `0.55`, `0.66`, `0.82`) foram
troca­das por **um `y` que avança**, com o status **colado abaixo dos botões**
(`setOrigin(0.5, 0)`) em vez de 82% da altura. Com quatro multiplicos
independentes nada era garantido: em janela baixa a mensagem — a única coisa que
explica um login que falhou — batia no botão de baixo ou saía da tela.

`larguraBotao = Math.min(320, Math.max(200, width - 56))` evita estouro em tela
estreita. Novo `painelConectado` (`OURO`) mostra com quem a sessão está ativa.

### 4. Scanner de constantes não declaradas (`testes/logica.mjs`)

O teste "chamadas para funções inexistentes" é **estruturalmente cego** ao
`ALTURA_CHIP`: ele só vê identificador seguido de `(`, e lá não há `(`. Foi
estendido para checar constantes em caixa alta usadas como valor:

```js
const usoConstante = /(^|[^\p{L}\p{N}_$.?>])([A-Z][A-Z0-9_]{2,})($|[^\p{L}\p{N}_$?:(])/gu;
```

**Deliberadamente estreito.** A primeira versão tentou checar *todo*
identificador solto e produziu **mais de mil falsos positivos** — literais
numéricos, `this`, `const`, chaves de desestruturação e nomes dentro de
`import {…}` viram todos "suspeitos". Um teste que accuse mil fantasmas é pior
do que nenhum: acostuma a ignorar a saída. `ALTURA_CHIP` e `ZOOM_MAX` são
caixa alta usada como valor sem declaração, e é essa a classe que morre em
produção com build verde.

Correção de apoio em `disponiveis`: `variavel` só pegava o primeiro nome de
`const A = 1, B = 2`, então `ZOOM_MAX` (linha 824) parecia não declarado
apesar de estar declarado — um falso positivo do próprio teste. Novo
`declaracaoVar` pega a declaração inteira.

**Validação:** reintroduzi `ALTURA_CHIP` e o teste acusou
`ui/formularios.js: ALTURA_CHIP`; com o fix, passa limpo. Suspeitas: 1
com o bug, 0 sem.

### Armadilha: `new RegExp(template)` com `\p{...}`

O regex nasceu como `new RegExp(\`(^|[^\\p{L}...])\`, 'gu')` e **não casava com
nada em lugar nenhum do repositório — sem erro nenhum**. Dentro de um template
literal os `\p{...}` exigem escape duplo, e o `>` foi parar **depois** do `]`,
fora da classe de caracteres. O `0` de "nenhuma suspeita" parecia signal verde.
Por isso o regex agora é **literal**, sem template e sem escape duplo.

Diagnóstico: comparar `usoSolto.source` com um literal equivalente, ambos de
61 caracteres, e achar os índices 19/20 trocados.

**Regra geral deste repositório: regex com `\p{...}` vai como literal, nunca
como `new RegExp(template)`.**
---

## [0.1.1] — Hotfix: input e posicionamento de botões

*Outubro de 2026*

Regressão de input introduzida em `7fb5351` ("fix(button): depth priority +
caixa graphics fix"), que ficou **8 commits sem ninguém perceber** — porque
vários commits posteriores acusaram "tree-shaking" e "cache do Vite", que não
tinham nada a ver. O bug só era visível no navegador, nunca no build.

### Sintoma reportado

Botões desenhados mas sem clique. "Manter como está" inerte. Login impossível.
Caixa do botão colada no canto superior esquerdo enquanto o texto ficava no
lugar. Nenhuma mensagem de status aparecia.

### Causa raiz 1 — `Graphics` não aceita `setInteractive()` sem hit area

`src/ui/comuns.js::botao()` fazia:

```js
box.caixa.setInteractive({ useHandCursor: true });   // caixa = Graphics
```

`Graphics` **não tem o componente `Size`** na lista de `Mixins` do construtor
do Phaser 3.90. Logo `gameObject.width` e `gameObject.height` são `undefined`,
e `gameObject.frame` também não existe.

O que realmente acontece dentro de `InputPlugin.setHitArea()` (Phaser 3.90):

```js
var hitArea       = GetFastValue(config, 'hitArea', null);
var hitAreaCallback = GetFastValue(config, 'hitAreaCallback', null);

if (!hitArea || !hitAreaCallback)
{
    //  If the object has no hit area, use the texture to make one
    this.setHitAreaFromTexture(gameObjects);
    customHitArea = false;
}
//  <-- setHitAreaFromTexture NÃO escreve de volta nas variáveis locais acima
```

`setHitAreaFromTexture()` preenche o `width`/`height` de um objeto **externo**
passado por referência — mas aqui a chamada foi feita sem argumento
(`gameObjects` do closure), então o resultado é descartado. O laço continua com
`hitArea === null` e `hitAreaCallback === null` e faz:

```js
var io = CreateInteractiveObject(gameObject, hitArea, hitAreaCallback);
gameObject.input = io;
this.queueForInsertion(gameObject);   // <-- ENTRA na lista mesmo assim
```

Medido em runtime, não deduzido:

```
Graphics setInteractive -> input? true | width: undefined | height: undefined | frame: undefined
Graphics -> hitArea: null | hitAreaCallback: null
Graphics quebrado chegou na lista de input? true
```

O objeto **é registrado**, com `hitArea = null` e `hitAreaCallback = null`. Aí
todo `InputManager.pointWithinHitArea()` estoura:

```js
if (input && input.hitAreaCallback(input.hitArea, x, y, gameObject))
//     ^^^^^^^^^^^^^^^^^^^^^^^ TypeError: input.hitAreaCallback is not a function
```

Como `InputManager.hitTest()` itera `this._list` e a exceção **não é capturada
em lugar nenhum**, o `TypeError` aborta o hit test inteiro. O efeito real é
**pior que "o botão não responde"**: *o input da cena inteira deixa de
responder*, e nenhum objeto sob o ponteiro recebe evento nenhum. Era por isso
que nada funcionava em lugar nenhum — e por isso o console do jogo estava
cheio de `TypeError` que ninguém ligou ao problema.

**`setDepth(1000)` não podia consertar isso.** O `depth` nunca foi o problema:
o objeto não precisava de prioridade, precisava de um `hitAreaCallback` que
existe. O hack de side-effect (`box.caixa.depth = 1000;
box.caixa.setDepth(box.caixa.depth)`) existia só para "evitar tree-shaking", que
também não era a causa.

**Ordem de inserção na lista de input:** `_list` é ordenada por
`queueForInsertion` (concatenação em `preUpdate`), **não por depth**. Ou seja,
em conflito de sobreposição (uma `capa` modal adicionada antes do botão), quem
recebe o evento primeiro é quem foi registrado primeiro. `processDownEvents`
emite `POINTER_DOWN` em **todos** os objetos sob o ponteiro e só usa `topOnly`
para interromper — então uma capa sem handler próprio é inofensiva, mas uma
capa **com** handler (ex.: o "Cancelar" do modal de apagar personagem em
`LobbyScene.js:475`) roda junto com o botão.

### Causa raiz 2 — `.caixa` devolvia o `Graphics`, não o botão

`botao()` passou a retornar `caixa: box.caixa` (o `Graphics` de fundo) em vez
do container inteiro. Todos os ~35 pontos de chamada fazem
`pai.add(b.caixa)` / `this.raiz.add(btn.caixa)`.

`Container.add()` chama `addHandler()`, que tira o objeto do container anterior
e o re-filha mantendo a **posição local** `(0, 0)`. Como todas as cenas usam
`this.raiz = this.add.container(0, 0)`, o `Graphics` saía do container do botão
e passava a ser desenhado a partir do `(0, 0)` da tela, enquanto o `label`
continuava ancorado no lugar certo. Daí o sintoma "textos certainos e caixas
grudadas no canto".

### Causa raiz 3 — recursão infinita em `LoginScene.avisarStatus()`

```js
avisarStatus(msg) {
  if (!this.sys?.isActive()) return;
  try {
    this.avisarStatus(msg);        // chama a si mesma
  } catch { /* ... */ }
}
```

A `try` não estourava nada: a recursão batia no `if (!this.sys?.isActive())`
antes de acumular stack. Efeito: nenhuma mensagem de status ou erro era
exibida no login.

### Correções

**`src/ui/comuns.js::botao()`** — voltou a zona de clique explícita:

```js
const clique = scene.add
  .rectangle(0, 0, largura, altura, 0xffffff, 0)
  .setOrigin(0, 0)
  .setPosition(dx, dy)
  .setInteractive({ useHandCursor: true });
box.add(clique);

clique.on('pointerover', () => aplicarCor(corHover));
clique.on('pointerout',  () => aplicarCor(cor));
clique.on('pointerdown', onClick);
```

`Rectangle` tem largura/altura de verdade, então `setHitAreaFromTexture()`
monta o retângulo e `Rectangle.Contains` corretamente. Os eventos foram
remontados para `clique` (no `Graphics`, ligavam mas nunca disparavam). O hack
de `depth = 1000` foi removido.

**Contrato de `botao()`** — o retorno documenta a semântica dos dois campos, e
`clique` foi **reativado** (o `WorldScene.js:771` já dependia dele):

| Campo | Tipo | Usar para |
| --- | --- | --- |
| `container` | `Container` | **`pai.add(...)`** — o botão inteiro |
| `caixa` | `Graphics` | **desenhar** — `definirVisual()`, `.clear()`, `.fillStyle()` |
| `clique` | `Rectangle` | eventos extras (`WorldScene` usa para tooltips) |
| `label` | `Text` | `setTexto()` |

**`fluxoBotoes`** — `pai.add(b.container)`.

**13 arquivos de cena** — `add(b.caixa)` → `add(b.container)` em ~35 pontos
(`AdminScene`, `AjudaScene`, `CriacaoScene`, `FabricacaoScene`,
`InventarioScene`, `LobbyScene`, `ReinosScene`, `StatusScene`, `TalentosScene`,
`TermosScene`, `WorldScene`, `src/ui/formularios.js`). Também
`setDepth`/`destroy` de botão passaram a ser no `container` (o `depth` de filho
dentro de container é ignorado).

**`LoginScene.avisarStatus()`** — `this.avisarStatus(msg)` → `this.status?.setText(msg ?? '')`.

**`LobbyScene`** — removido `.container.setOrigin(1, 0)` / `(0.5, 0)` inválido
(origem de `Container` desloca **todos** os filhos); substituído pela opção
`origem` que `caixaArredondada` já respeita via `dx`/`dy`.

### Bug adjacente encontrado, NÃO corrigido

`src/scenes/ReinosScene.js:62`:

```js
item.caixa.setFillStyle(0x181310);
```

`item` vem de `linhaLista()`, cujo `.caixa` é um **`Container`** — e `Container`
não tem `setFillStyle`. Vai estourar `TypeError` sempre que o jogador alcançar
um reino ainda não liberado. É a mesma confusão de semântica de `.caixa` que
causou esta regressão, mas é um caminho de código diferente e a correção exige
repintar o `Graphics` corretamente, não só trocar o nome do campo.

### Verificação

Não houve verificação visual — o modelo não lê imagens. A prova foi feita
instrumentando o jogo real no navegador e lendo o console:

```
[DIAG] Graphics -> hitArea: null | hitAreaCallback: null
[DIAG] botao -> hitArea: 280x52
[DIAG] apos pai.add(container) -> caixa continua dentro do container? true | posicao: 450 208
[DIAG] hitTest no CENTRO do botao (450,208) -> zona incluida? true
[DIAG] hitTest no (10,10) -> Array(0)
[DIAG] >>> CLIQUE CHEGOU
```

`npm run build` limpo e `npm test` passando (incluindo o bloco de "chamadas
para funções inexistentes", que pegaria `b.clique` ausente se ele fosse
chamado em módulo avaliado em Node).

### Lição para o processo

**`npm test` não pega bug de input.** O pacote de testes roda lógica pura em
Node; Phaser nunca é importado. Um bug que derrubou 100% da interação do jogo
passou por 8 commits e por todos os gates de CI.

Duas lições específicas:

1. **`npm run build` verde não significa nada sobre runtime.** Vários commits
  USParam "forçar rebuild" / "limpar cache do Vite" / "timestamp de build"
   no `vite.config.js` e no workflow, com a mensagem de que a causa era
   tree-shaking. **Não era.** O sintoma era 100% reproduzível localmente com
   `npm run dev`; o diagnóstico exigiria rodar o jogo e olhar o console.
2. **Teste de regressão que teria pegado isto:** um teste estático que rode
   `setInteractive` em cada GameObject criado e falha se o `input.hitAreaCallback`
   ficar `null`. Barato, e pega o erro na hora da escrita.
---

## [Não publicado] — Base editorial, conformidade e melhorias de gameplay

Estado atual do repositório: **não commitado, não publicado**. Tudo abaixo
existe localmente e passa em `npm run build` e `npm test`.

### Adicionado

#### Persistência de posição no mundo — `src/core/personagem.js`, `src/scenes/WorldScene.js`

O jogador agora **nasce onde parou**. A posicao `estado.posicao = { x, y }` e
salva periodicamente (a cada 10s se moveu >20px) e no shutdown da cena
`WorldScene`. No proximo login, `criarJogador()` usa a posicao salva em vez do
centro do mapa. Resolve o problema de "sempre aparecer no mesmo lugar e ser
atacado por monstros".

#### Mapa maior e portal posicionavel — `src/scenes/WorldScene.js`

- Mapa expandido de **34x26** para **60x44** tiles (2640x1936 vs 1088x832).
  Mais espaco para explorar, bases maiores, mais recursos e monstros.
- Portal Arcanos com **efeitos visuais aprimorados**: aro runico rotativo,
  brilho pulsante, particulas de essencia arcana subindo, runas orbitando,
  placa com dica de tecla.
- **Posicao do portal escolha do jogador**: Shift+P alterna entre 4 posicoes
  (direita, esquerda, cima, baixo). A preferencia e salva em
  `estado.portalOffsetIdx` e persiste entre sessoes.

#### Itens empilhaveis ate 1k + pereciveis — `src/core/personagem.js`, `src/core/regras.js`, `src/dados/schemaAdmin.js`

- Novo padrao `stackMax = 1000` (era 999).
- Campo `perecivel` (boolean) + `tempoEstragarSegundos` no cadastro de itens.
- Alimentos pereciveis **nao empilham se tiverem validade diferente** —
  `dataValidade = Date.now() + tempoEstragarSegundos * 1000` ao criar.
  Evita misturar comida fresca com velha e perder tudo de uma vez.

#### Admin: foco persistente, imagem com preview, busca ao vivo — `src/ui/formularios.js`, `src/ui/comuns.js`, `src/scenes/AdminScene.js`, `src/scenes/AjudaScene.js`

- Inputs DOM reais com **foco e cursor que sobrevivem a redesenhos**.
  Redesenhar a tela (filtrar lista, trocar aba) nao mais derruba o que o
  admin esta digitando.
- Campo imagem: preview instantaneo (data URL) antes do upload, upload para
  Storage com redimensionamento client-side 256px, fallback para colar URL.
- Busca ao vivo com debounce 160ms na lista do admin e na wiki (H).

#### Validação estática de chamadas inexistentes — `testes/logica.mjs`

Novo teste que varre `src/scenes`, `src/ui`, `src/core`, `src/dados` e
acusa **qualquer funcao chamada que nao exista** (nem declarada, nem importada,
nem global). Ja pegou dois bugs reais:
- `AjudaScene.create()` chamava `this.montar()` (metodo era `redimensionar()`).
- `TalentosScene.corDoRamo()` chamava `corDeNome()` (nao existia).

#### Eliminação de dados — `src/core/apagamento.js`

`apagarDadosDoJogador(uid)`, `resetarProgresso(uid)`, `temConsentimento(uid)`.

A ordem importa e está documentada no arquivo: **portal → progresso → perfil**,
depois as coleções legadas, e por fim o `localStorage`. Apagar o progresso
antes do perfil deixaria um usuário órfão que o Auth ainda reconhece.

#### Botão "Apagar meu progresso" — `src/scenes/StatusScene.js`

O texto legal promete o caminho; sem o botão ele mente. Fica no rodapé do
painel do Personagem, com modal de confirmação que lista **o que** será
apagado e avisa que não há volta.

#### Criação de personagem — `src/scenes/CriacaoScene.js`, `src/dados/racas.js`

Tela antes do mundo: nome, 4 raças, vocação, com pré-visualização dos atributos
derivados. Também serve de editor do personagem existente.

Marcador `personagemCriadoEm` no estado impede que a tela reabra em modo edição
quando o jogador só queria olhar.

`racas.js` foi separado da cena porque os testes rodam em Node sem Phaser — a
regra de "lógica pura fora das cenas" tinha que valer justamente aqui.

#### Esquema declarativo do painel — `src/dados/schemaAdmin.js`

Fonte única de verdade do formulário dos 7 catálogos: campos, tipos, opções,
parsers, serializers e resumo de lista.

**Motivo da reescrita:** antes os campos estavam espalhados em `switch` dentro
do `AdminScene`. O sintoma era a aba de Talentos sem campo de cor e a de Classes
sem upload — invisível na revisão de código, porque "está no switch" parece
"está cadastrado".

#### Widgets de formulário — `src/ui/formularios.js`

`<input>` e `<textarea>` **de verdade** do DOM, sobrepostos ao canvas.

O motivo é foco: um canvas não recebe teclado. Antes, digitar exigia capturar
`keydown` global e reconstruir a cada tecla, o que comia o caractere following
em acentos e maiúsculas. `select` abre popup com rolagem por roda, `multiselec`
vira chips com altura **medida** (não estimada), e `imagem` faz upload com
preview.

#### Armazenamento — `src/core/armazenamento.js`

Upload para o Firebase Storage com **redução client-side para 256 px** antes de
enviar. Pixel art de 6 MB trava o download de todo mundo que abre a wiki.

`armazenamentoDisponivel()` para o campo avisar e cair para URL colada em vez de
fingir que salvou.

#### Pré-requisito de atributo — `src/core/personagem.js`

`preRequisitoNiveis: { fis: 5 }` — "sobe Físico até 5".

Implementado como `atributosAtendidos(estado, requisito)`, usado tanto por
`talentoDisponivel` (leitura) quanto por `desbloquearTalento` (ação), para que
a tela nunca mostre disponível algo que a gravação vai recusar.

### Corrigido

#### Layout inteiro desalinhado — `src/ui/comuns.js`

Causa raiz: `caixaArredondada` usava

```js
dx = origem[0] === 1 ? -largura : 0
```

Com a origem padrão `[0.5, 0.5]`, isso dava `dx = 0` — toda caixa era ancorada
pelo canto superior esquerdo em vez do centro. **Corrigido para
`dx = -origem[0] * largura`.** A mesma correção foi para `areaDeClique`.

Foi a causa de "todos os botões tortos" e de "os inputs do admin não estão
certos". Não era estilo: era a geometria.

#### Talento novo não aparecia em árvore nenhuma — `src/scenes/AdminScene.js`

`classeId` nunca era escrito: o formulário não tem o campo, e a intenção era que
viesse do filtro de classe da lista. O filtro existia, mas o `normalizar()` não
propagava. Resultado: registro criado, painel dizia "salvo", jogo não mudava.

Corrigido em `normalizar()`: `if (this.aba?.filtroClasse) out.classeId = this.filtroClasse`.

Teste travando o comportamento: o esquema de talento **não** pode ter campo
`classeId`, senão o admin grava na classe errada.

#### Árvore de talentos ilegível — `src/scenes/TalentosScene.js`

- A posição vinha do código; agora vem de `posX`/`posY` do cadastro, com o
  admin controlando o desenho.
- Os conectores eram retas diagonal centro-a-centro, que cruzavam os nós
  vizinhos e faziam o requisito parecer outro talento. Agora são curvas
  ortogonais de três segmentos.
- Cor do ramo: `corRamo` do admin manda sempre; senão uma cor nomeada se o nome
  contiver uma palavra conhecida; senão uma cor **derivada do nome**. O passo 3
  existe porque o admin pode cadastrar "Runa" ou "Sobrevivência" e, sem ele,
  todo ramo novo cairia na mesma cor dourada — que era exatamente para isso que
  as faixas coloridas existiam.
- `uid` não era repassado do mundo à cena: a árvore carregava estado vazio.
- `persistir()` agora avisa o `WorldScene` do estado novo. Sem isso o jogador
  vê "+18 Vida" na ficha e não sente na barra — o mundo continua com a cópia
  antiga.

#### `linhaLista` sem estado selecionado — `src/ui/comuns.js`

Aceita agora `opcoes`: `alfa`, `selecionado`, `altura`, cores. **Sem opções o
comportamento é idêntico ao anterior**, para não quebrar os pontos de chamada
existentes.

#### Fabricação com abas transbordando — `src/scenes/FabricacaoScene.js`

Reescrita no layout de duas colunas do Inventário: abas de estação com quebra
de linha (`medirFluxo`), lista com rolagem, painel de detalhe com insumos
faltando em destaque e botão ancorado ao rodapé.

O botão fica no rodapé porque o número de linhas de insumo varia com a receita
e um botão posicionado logo abaixo dele saía da caixa.

#### Botão de fechar sobrepondo — `src/scenes/WorldScene.js`

A capa precisa ser criada e adicionada **antes** do container da caixa: com a
ordem invertida, a caixa desenhava por cima da capa e a capa não recebia o
clique.

`PAINEIS_SOBREPOSTOS` passou a incluir `'Ajuda'`, então `fecharPaineis()` para
a camada certa.

### Mudado

#### Fluxo de cenas — regra, não preferência

```
Login → Termos → Criacao → World
```

Termos só é exigido quando existe `uid`. **Sem login local não há dado pessoal
para proteger**, e exigir aceite ali seria trancar a porta de um jogo que não
guarda nada do jogador.

Criacao antes de World porque o mundo gera monstros em volta do ponto de
entrada — sem personagem definido o jogador aparecia no meio deles.

#### Esc não desloga mais

`fecharPaineis()` para a primeira camada de `PAINEIS_SOBREPOSTOS` que estiver
aberta. Antes o ESC derrubava o login inteiro.

#### Dicas (H) virou atalho para a Wiki

O modal antigo de "Dicas" foi reduzido a um resumo de teclas com um botão
**"Abrir a Wiki do Império"**. Duas telas fazendo a mesma coisa é uma tela a
mais para manter.

#### Campos vazios no admin são descartados, não gravados como `''`

Um item que tinha `defesa: 12` continua com 12 se o admin limpar a caixa. Só
`numero` faz exceção: vazio é 0.

Gravar `''` ao limpar um campo transformava "não quero mexer nesse número" em
"esse número é zero", e o item perdia o stat sem nenhum aviso na tela.

#### Chave de dependência nos Talentos

`preRequisitoNiveis` como objeto nomeado (`{ fis: 5 }`) em vez de string
serializada. Preferência por texto legível a cor fixa: o admin não precisa
saber JSON para cadastrar "Fisico 5".

#### `package.json`

Descrição deixou de citar Starbound. A identidade do jogo é Império, Reinos
Etéreos, Portais Arcanos, Orbes Arcanos.

### Testes

`testes/logica.mjs` cresceu de ~40 para ~120 asserções. Novas:

| Bloco | O que trava |
| --- | --- |
| Ramos de talento | todo talento tem ramo; `posX`/`posY` inteiros ≥ 0; **nenhuma célula com dois talentos** |
| Pré-requisito de atributo | bloqueia, explica o motivo, libera depois do investimento, desconta custo, atributo não sobe sozinho |
| Esquema do admin | todo cadastro tem campos; todo tipo tem widget; todo resumo aguenta registro quase vazio; `classeId` não é campo |
| Termos e privacidade | versão, data, canal de contato, **cada direito do titular nomeado**, o texto aponta o botão de apagar |
| Raças | ids únicos, textos preenchidos, padrão existente |
| Chamadas inexistentes | varre `src/scenes`, `src/ui`, `src/core`, `src/dados` e acusa qualquer função chamada que não existe — pegou `this.montar()` vs `redimensionar()` e `corDeNome()` inexistente |
| Receitas/estações | toda receita aponta para estação real; toda estação tem rótulo amigável |

A asserção de célula duplicada veio de um bug real: dois talentos na mesma
grade faziam a linha de um cobrir o nome do outro, e nada no código reclamava.

### Adicionado (continuação)

#### Lobby multi-personagem — `src/scenes/LobbyScene.js`, `src/core/progresso.js`

Até **10 personagens por conta** (`MAX_PERSONAGENS = 10`). Fluxo:
`Login → Termos → Lobby → (Criacao se 0 chars) → World`.

- `progresso.js` reescrito: perfil `jogadores/{uid}` com array `personagens[]`,
  `personagemAtivoId`, migração automática de perfil antigo (single-char).
- API nova: `carregarPerfilJogador`, `criarPersonagem`, `carregarPersonagem`,
  `salvarPersonagem`, `apagarPersonagem`, `definirPersonagemAtivo`.
- Compatibilidade mantida: `carregarProgresso`/`salvarProgresso` ainda funcionam
  delegando ao personagem ativo.

#### LobbyScene — `src/scenes/LobbyScene.js`

- Grade de slots (até 10) com retrato, nome, raça, vocação, nível/XP.
- Botões por slot: **ENTRAR**, **EDITAR**, **APAGAR** (com modal confirmação).
- Botão **+ NOVO HERÓI** abre `CriacaoScene` em modo `modoNovo: true`.
- Background animado: parallax `tileSprite` + neblina procedural + runas flutuantes.
- Painel lateral **Changelog** com resumo das últimas versões.

#### Editor de Pixel Art no Admin — `src/ui/formularios.js::campoPixelArt`

Novo tipo de campo `pixelart` para itens/blocos/monstros:
- Canvas 16/32/64px com zoom 1×–16× (roda do mouse / botões).
- Paleta 16 cores + color picker customizado.
- Ferramentas: **Pincel (B)**, **Balde flood-fill (G)**, **Borracha (E)**, **Conta-gotas (Alt+clique)**, **Limpar (Ctrl+L)**.
- Preview 1:1 em tempo real, grid sutil no zoom.
- Fundo transparente opcional (checkbox).
- Exporta **data URL PNG base64** → sobe pro Storage / cola URL.
- Atalhos: `B` pincel, `G` balde, `E` borracha, `Alt+clique` conta-gotas, `Ctrl+L` limpar.
- Valor salvo = data URL PNG base64; preview 1:1 ao lado do editor.

#### Pontos de atributo extras — `src/core/personagem.js`

Além dos pontos nativos por nível (`pontosPorNivel`), agora existe
`pontosAtributoExtras` (missões, conquistas, itens, admin).
- `totalPontosAtributo(estado)` → `{ nativos, extras, total }`
- `concederPontosAtributoExtras(estado, qtd)`
- `gastarPontoAtributo(estado, atributo)` — gasta extras primeiro, depois nativos.
- UI no `StatusScene`: mostra `nativos + extras`, botões `+` para FIS/MEN/SOC.

#### Botão "Agrupar itens" no Inventário — `src/scenes/InventarioScene.js`, `src/core/personagem.js::agruparItens`

Junta pilhas do mesmo `itemId` até `stackMax` (padrão 1000).
- Itens com upgrades **não** agrupam (histórico próprio).
- Perecíveis (`perecivel: true` + `tempoEstragarSegundos`): só agrupam se
  `dataValidade` **exatamente igual** (evita misturar fresco com velho).

#### Termos/Privacidade: scroll corrigido + margem — `src/scenes/TermosScene.js`

- Wheel listener corrigido: `this.input.on('wheel', handler)` (Phaser 3.90).
- Texto "Ao aceitar..." reposicionado com 16px de margem do rodapé.

#### Wiki (H): busca ao vivo com foco preservado — `src/scenes/AjudaScene.js`, `src/ui/comuns.js::restaurarFoco`

- Debounce 160ms, `restaurarFoco` devolve cursor após `redimensionar()`.

#### Validação estática de chamadas inexistentes — `testes/logica.mjs`

Novo bloco de teste que varre `src/scenes`, `src/ui`, `src/core`, `src/dados`
e acusa **qualquer função chamada que não existe** (nem declarada, nem importada,
nem global). Já pegou dois bugs reais:
- `AjudaScene.create()` chamava `this.montar()` (método era `redimensionar()`).
- `TalentosScene.corDoRamo()` chamava `corDeNome()` (não existia).

#### Receitas/estações validadas — `testes/logica.mjs`

- Toda receita aponta para estação real (`Object.values(ESTAÇÕES)`).
- Toda estação tem rótulo amigável (`ROTULOS_ESTACAO`).

### Corrigido (continuação)

#### Admin: inputs com posição correta + zIndex — `src/ui/formularios.js`

`criarElementoDom` agora recebe `container` Phaser e calcula posição absoluta
via `container.x + x` / `container.y + y`. DOM inputs ficam sobre o canvas no
lugar certo, com `zIndex: 30`.

#### Admin: campo imagem com preview instantâneo — `src/ui/formularios.js`

Preview via `FileReader.readAsDataURL` **antes** do upload (funciona offline).
Upload para Storage com redimensionamento 256px client-side.

#### Admin: busca ao vivo com debounce + foco preservado — `src/scenes/AdminScene.js`

Debounce 160ms, `restaurarFoco` devolve cursor após `redesenhar()`.

#### Admin: campo `pixelart` integrado — `src/dados/schemaAdmin.js`

Itens/Classes/Talentos/Monstros/Receitas/Reinos/Conquistas podem ter
`chave: 'imagem', tipo: 'pixelart'` no esquema.

### Arquivos (atualizado)

**Modificados:** `package.json`, `src/core/personagem.js`, `src/core/repos.js`,
`src/core/progresso.js`, `src/main.js`, `src/scenes/AdminScene.js`,
`src/scenes/FabricacaoScene.js`, `src/scenes/LoginScene.js`,
`src/scenes/StatusScene.js`, `src/scenes/TalentosScene.js`,
`src/scenes/WorldScene.js`, `src/scenes/LobbyScene.js`,
`src/scenes/CriacaoScene.js`, `src/scenes/TermosScene.js`,
`src/scenes/AjudaScene.js`, `src/ui/comuns.js`, `src/ui/formularios.js`,
`testes/logica.mjs`

**Novos:** `README.md`, `src/core/apagamento.js`, `src/dados/legal.js`,
`src/dados/racas.js`, `src/dados/schemaAdmin.js`, `src/scenes/AjudaScene.js`,
`src/scenes/CriacaoScene.js`, `src/scenes/TermosScene.js`,
`src/scenes/LobbyScene.js`, `src/ui/formularios.js`

### Pendente

- Painel administrativo testado ponta a ponta: campos, upload imagem,
  confirmação exclusão, abas Portais/Jogadores.
- Bundle em produção **sem** Firebase config (verificar 6 vars no GitHub).
- Sintoma intermitente "pede para logar de novo" — 3 causas corrigidas.
- Editor de pixels: testar upload real + preview no jogo.
- Auto-combate / missões / guildas / servidores dedicados.
- Anti-cheat para auto-farm futuro.
---

## Histórico anterior

### [0.1.0] — Base jogável

Primeiro commit com o jogo abrindo: `Boot` gerando texturas procedurais,
mundo com blocos, extração, fabricação, inventário, orbes arcanos, portais para
as bases dos amigos, Reinos Etéreos, árvore de talentos, conquistas, login
Google e o painel administrativo com `F2`.

Deploy no GitHub Pages funcionando em `/jogo_imperiall_2026/`.
---
