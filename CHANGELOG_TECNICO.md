# Changelog técnico

Registro de mudanças do **código**, para quem vai manter o jogo. Cada versão
descreve o que mudou no repositório e — quando houver — **por que**.

O documento voltado ao jogador é [`CHANGELOG.md`](CHANGELOG.md). Este aqui não
fala de "novas mecânicas bonitas"; fala de arquivo, decisão e armadilha.

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
.Versionado em [SemVer](https://semver.org/lang/pt-BR/).

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
