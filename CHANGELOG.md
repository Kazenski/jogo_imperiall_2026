# Novidades do Império

Notas de atualização do **Jogo Imperiall 2026**, escritas para quem joga.
Para o registro de código, veja [`CHANGELOG_TECNICO.md`](CHANGELOG_TECNICO.md).

Este jogo está em desenvolvimento aberto. Se encontrar algo quebrado, o
caminho mais rápido é relatar com o que você estava fazendo na tela.

---

## Terreno com altura — agora dá para cavar

*v0.1.3 · Outubro de 2026*

### O que mudou

O mundo tem chão de verdade. Cada coluna tem uma superfície e, abaixo dela,
camadas de terra. Você anda por cima, mira num bloco e **cava**: o bloco some,
vai para a mochila e você ganha XP.

- **`E`** escava o bloco da mira
- **`Q`** coloca o bloco que você escolheu na Mochila

O quadradinho dourado que aparece à sua frente é a mira. Ele fica **azul** quando
não há nada ali, para você não ficar cavando o vazio.

E como o terreno tem subsolo, a escavação é vertical: quanta mais baixa a
superfície naquele ponto, mais terra existe para cavar. É isso que a altura que
você cadastra no chunk controla.

### O terreno nasce do chunk

A grade vem do chunk que você cadastrou — superfície, subsolo, altura, variação
e profundidade. **Nada disso é salvo no seu perfil**, exceto o que você mudou:
o que cavou e o que colocou. Todo mundo vê o mesmo mundo, e só o que é seu muda.

Se você redesenhar um chunk no painel, o terreno muda — e os buracos antigos
desaparecem junto. É o comportamento esperado de quem redesenha o mundo.

### Baús e itens no chão

A aba de Chunks ganhou campos novos:

- **Blocos nativos** — o que pertence a este chunk de propósito
- **Tipos de baú** — só entram itens marcados como baú no cadastro de Itens
- **Chance e máximo de baús** — com teto, para não virar 20 baús num chunk só
- **Conteúdo dos baús** — `bauId:itemId:chance:quantidade`, uma linha por baú
- **Itens no chão** e a densidade deles — tralha que o jogador pega andando

O conteúdo do baú é sorteado **uma vez só**, na geração. O mesmo baú tem o
mesmo conteúdo para todo mundo, para sempre.

### Três coisas que estavam quebradas

Aproveitei e consertei o que estava no caminho:

- **Construir nunca funcionou.** O `Q` avisava "selecione um bloco" para sempre:
  a Mochila escrevia a escolha em si mesma e era destruída ao fechar. E o botão
  "Construir com este" só aparecia em **ferramentas** — numa picareta, nunca
  numa pedra.
- **Derrubar bloco da base** estourava um erro interno, por uma chamada com os
  parâmetros na ordem errada.
- **Cavar não consumia o bloco se a célula estivesse ocupada** — você perdia o
  material sem ganhar nada. Agora ele confere antes.

### Para ver o terreno

O jogo normal precisa de conta. Para olhar o terreno sem login, com o dev server
no ar, abra **`/teste-terreno.html`** — sobe a cena do mundo com um chunk de
exemplo e botões de escavar, colocar e abrir baú.

---

## Chunks — o mundo passa a ser desenhado, não sorteado

*v0.1.3 · Outubro de 2026*

### A ideia

Até agora o mundo era um sorteio uniforme. Cada reino jogava a mesma
densidade de minério, de árvore e de monstro em **toda** a sua área — não
existia como ter uma clareira, um pântano e uma mina de ferro no mesmo reino. Ou
o reino inteiro era rico, ou era pobre.

Agora o mundo é um **tabuleiro de chunks**. Cada chunk é um pedaço do mapa com
regras próprias: o que há na superfície, o que há no subsolo, que monstros
nascem, quais NPCs aparecem, e que altura o terreno tem. Você desenha o reino
numa grade, bloco por bloco, e o computador preenche o resto.

### Como funciona no painel

A aba nova é **🧩 Chunks**. O mapa é o mesmo do NPC — um clique posiciona — mas
com uma diferença que importa: **a célula é um chunk, não um bloco**. Um mundo
de 128 blocos com chunks de 32 vira uma grade 4×4; com chunks de 8, vira 16×16.
Mudar o tamanho do chunk redesenha o mapa na hora, porque muda a unidade da
grade.

Cada chunk guarda:

- **Terreno**: bloco de superfície, bloco de subsolo, profundidade mínima e
  máxima (é isto que o jogador cava)
- **Altura**: altura base, variação e suavização — o terreno com relevo
- **O que aparece**: nós de recurso, mobs nativas, NPCs e estações, com a
  densidade de cada um
- **Para o jogador**: pode construir base, pode escavar, tem abrigo, e o nível
  de perigo
- **Semente**: a mesma semente gera sempre o mesmo chunk, para o mundo ser
  reproduzível entre jogadores

### Peso e desenho

Duas coisas que se combinam:

- **Posicionado** — o que você coloca na grade manda. O preenchimento
  automático não mexe ali.
- **Peso** — decide a frequência do chunk no preenchimento das células vazias.
  Peso 0 significa "só existe onde eu coloquei".

Assim dá para desenhar um caminho seguro cortando um reino perigoso, sem o
sorteio desfazer o desenho.

### O que ainda NÃO mudou no jogo

Isto é importante, para ninguém ficar esperando algo que não chegou: os chunks
**entram no terreno** (veja a seção acima), mas o mundo ainda é o mesmo tamanho
fixo de 60×44 blocos. A exploração que anda sem parar, com o mundo gerado sob
demanda conforme você caminha, é a etapa seguinte.

Também não mudou: o relevo ainda não é caminhável. O jogo segue top-down, sem
gravidade — a altura do terreno é **profundidade de terra para cavar**, e não
um morro que se sobe. Fazer isso exigiria inventar pulo e colisão, que é trocar o
jogo, não o mapa.

---

## Correção — seus personagens não somem mais

*v0.1.3 · Outubro de 2026*

### O que estava acontecendo

O Salão dos Heróis mostrava "0/10 heróis" mesmo com a conta cheia de heróis. E
o pior: em certaslentidão na internet, os personagens eram **apagados de
verdade**.

### Por quê

São dois defeitos da mesma família. O jogo guarda duas coisas em duas coleções
diferentes:

- `users` — quem você é (nome, email)
- `jogadores` — o que você tem (a lista de heróis)

O Salão recebia o documento errado e lia a lista de heróis de um documento que
não tem lista de heróis. Por isso o nome aparecia certo e a lista não.

O segundo é mais sério. Quando a leitura do servidor demorava ou era negada, o
jogo inventava um perfil **vazio** em vez de dizer "não consegui ler" — e como
o salvamento grava o documento inteiro, um perfil vazio significava
`personagens: []`. Ou seja: uma internet lenta podia **apagar seus heróis**.
Foi exatamente isso que aconteceu com você, várias vezes.

### O que mudou

- O Salão lê o documento certo.
- Se a leitura falhar, o jogo **avisa** em vez de fingir que sua conta está
  vazia. Você vê "não foi possível carregar seus heróis" e um botão de
  recarregar — nunca um "crie o seu primeiro herói" que faria você criar um
  duplicado.
- O salvamento não esconde mais falha: se não gravou, o jogo diz.
- Nada é gravado por cima de um perfil que não foi lido.

### E o upload de imagem no painel

O erro **403 (Forbidden)** ao enviar a imagem de uma classe tinha uma causa
específica: as regras do Storage tinham a leitura pública e a escrita de upload
em blocos separados, e o de dentro apagava a de fora. Isso fazia **nenhuma
imagem do jogo carregar**. Corrigido, e agora há um teste que roda com as regras
reais.

### E o painel administrativo

A aba inteira do painel abriu sem nenhum campo em uma versão anterior, por causa
de um erro numa única parte do formulário — que todas as abas usavam. Corrigido,
e agora há teste para essa classe de erro: um campo usado no formulário sem ser
declarado quebra a suíte.

---

## Correção — os botões voltaram a funcionar

*v0.1.1 · Outubro de 2026*

Esta é uma correção de emergência. Se você não entrou no jogo na última
implantação, **esta versão resolve**.

### O que estava quebrado

- **Nenhum botão do jogo respondia.** Não era só o login: era qualquer coisa
  que precisasse de clique — Mochila, Talentos, Admin, tudo.
- **As caixas dos botões apareciam grudadas no canto da tela**, separadas do
  texto, enquanto o nome do botão ficava no lugar certo.
- **O botão "Manter como está"** (na tela de criação do personagem) não
  respondia.
- **Não aparecia nenhuma mensagem** ao tentar logar — nem erro, nem aviso.

### O que fazer

Nada. É só recarregar a página. Se o navegador ainda mostrar a versão velha,
force a atualização (Ctrl+Shift+R no Windows, Cmd+Shift+R no Mac) — o jogo
guarda a versão antiga em cache.

O registro técnico do problema está em
[`CHANGELOG_TECNICO.md`](CHANGELOG_TECNICO.md).

---

## Atualização — Mundo maior, portal seu, itens que faz sentido

*Outubro de 2026*

Esta atualização muda **onde você nasce**, **onde seu portal fica** e **como
seus itens se organizam**. São mudanças que você sente na hora de jogar.

### Chegou: você nasce onde parou

Antes, toda vez que entrava no mundo você aparecia no centro do mapa — muitas
vezes no meio de monstros. Agora **o jogo lembra sua posicao**. Saiu perto da
sua base? Volta la. Estava explorando longe? Continua de la. A posicao e
salva automaticamente a cada 10 segundos (se voce andou) e quando voce fecha
o jogo.

### Chegou: mapa **muito maior** (60x44 tiles)

O mundo cresceu de 34x26 para **60x44 tiles**. Sao 2640x1936 pixels de
area jogavel — quase **6x mais espaco**.
- Mais biomas para explorar
- Bases maiores sem ficar apertado
- Mais nos de recurso, mais monstros, mais segredos
- Camara segue voce suavemente, sem travar nas bordas

### Chegou: seu Portal, seu lugar (Shift+P)

O Portal Arcano da sua base agora tem **efeitos visuais novos**: aro runico
girando, brilho pulsante, particulas de essencia arcana subindo, runas
orbitando, placa flutuante. Fica bonito de verdade.

E o melhor: **voce escolhe onde ele fica**. Aperte **Shift+P** para alternar:
direita -> esquerda -> cima -> baixo. A escolha e salva e persiste entre
sessoes. Ninguem mais vai colocar o portal em cima da sua forja.

### Melhorou: itens empilham ate 1.000 + alimentos pereciveis

- Pilha padrao subiu para **1.000** (era 999).
- **Alimentos pereciveis** (novo cadastro no admin: `perecivel: true` +
  `tempoEstragarSegundos`): ao pegar ou fabricar, o jogo carimba a
  `dataValidade`. Pilhas com validade **diferente nao se unem** — sua maca
  fresca nao vira mingau misturado com a de ontem.
- Itens com upgrade continuam nao empilhando (cada um tem seu historico).

### Melhorou: Painel administrativo (F2) — digitar nao trava mais

- **Foco que sobrevive**: filtrar a lista, trocar de aba, redesenhar a tela —
  o cursor **continua no campo** onde voce estava digitando. Antes a terceira
  letra ia para o espaco.
- **Upload de imagem com preview instantaneo**: escolha o arquivo e veja na
  hora (antes de subir pro Storage). Funciona ate offline (data URL).
- **Busca ao vivo**: digita 2 letras e a lista ja filtra (debounce 160ms).
- **Mesma coisa na Wiki (H)**: busca em todas as secoes mantendo o foco.

### Correcao: scroll dos Termos e "Ao aceitar..."

- A roda do mouse **agora rola** o texto dos termos/privacidade (geometria
  mask + wheel listener).
- O texto "Ao aceitar voce concorda..." subiu — nao fica mais colado na
  borda amarela do painel.

### Correcao: busca da Wiki (H) mantem foco

Digitar na busca da wiki nao derruba mais o campo no meio da palavra.

---

## Atualização — Lobby de heróis, editor de pixels, itens perecíveis

*Outubro de 2026*

Esta atualização traz o **Salão dos Heróis** (lobby), um **editor de pixel art**
no painel admin e melhorias em como os itens se organizam na mochila.

### Chegou: Salão dos Heróis — até 10 personagens

Agora você entra no jogo e cai num **lobby** antes de ir pro mundo. Lá você vê
todos os seus heróis (até **10** por conta) com retrato, nível, raça e vocação.

- **ENTRAR** — vai direto pro mundo com esse herói.
- **EDITAR** — muda nome, raça, vocação (enquanto nível ≤ 2).
- **APAGAR** — apaga o herói para sempre (com confirmação).
- **+ NOVO HERÓI** — cria outro (enquanto tiver vaga, máx. 10).

O lobby tem **background animado** (parallax, neblina, runas flutuantes) e um
painel lateral com as **novidades recentes** (changelog resumido). Se você só
tem um personagem, o lobby abre rapidinho; se não tem nenhum, vai direto pra
criação.

### Chegou: Editor de Pixel Art no painel admin (F2)

Agora o admin pode **desenhar as imagens dos itens/blocos/monstros direto no
painel**, sem precisar subir arquivo externo.

- Canvas 32×32 (ou 16×16 / 64×64) com **zoom 1× a 16×** (roda do mouse).
- **Paleta de 16 cores** + color picker customizado.
- Ferramentas com atalho:
  - `B` — **Pincel** (desenha pixel a pixel)
  - `G` — **Balde** (preenche área contígua — flood fill)
  - `E` — **Borracha** (apaga para transparente)
  - `Alt+clique` — **Conta-gotas** (copia cor do pixel)
  - `Ctrl+L` — **Limpar tudo**
- **Preview 1:1** em tempo real ao lado do editor.
- **Fundo transparente** opcional (checkbox).
- Exporta **PNG base64** → sobe pro Firebase Storage / cola URL.
- Funciona **offline** (preview via data URL antes do upload).

### Melhorou: itens empilham até 1.000 + alimentos perecíveis

- Pilha padrão subiu para **1.000** (era 999).
- **Alimentos perecíveis** (admin cadastra `perecivel: true` +
  `tempoEstragarSegundos`): ao pegar/fabricar, o jogo carimba `dataValidade`.
  Pilhas com validade **diferente não se unem** — sua maçã fresca não vira
  mingau misturado com a de ontem.
- Itens com upgrade continuam não empilhando (cada um tem seu histórico).

### Melhorou: botão "Agrupar" na Mochila (I)

Na mochila, novo botão **Agrupar** junta pilhas do mesmo item até o limite
(1.000). Perecíveis só agrupam se a validade for **exatamente igual**.

### Melhorou: pontos de atributo extras (além dos de nível)

Agora existem **pontos extras** (missões, conquistas, itens, admin) além dos
nativos que você ganha por nível.
- No Personagem (V) aparece: `livres | nativos: X + extras: Y`.
- Botões `+` para **FIS / MEN / SOC** — gasta os extras primeiro, depois os
  nativos.
- Admin pode conceder pontos extras via painel.

### Melhorou: Admin (F2) — digitar não trava, busca ao vivo, editor de pixels

- **Foco que sobrevive**: filtrar a lista, trocar de aba, redesenhar — o cursor
  **continua no campo** onde você estava digitando.
- **Busca ao vivo**: digita 2 letras e a lista já filtra (160ms debounce).
- **Upload de imagem com preview instantâneo**: vê na hora, sobe pro Storage
  (redimensiona 256px client-side). Funciona offline (data URL).
- **Novo campo "Pixel Art"**: desenha a imagem do item/bloco/monstro direto no
  admin (ver acima).

### Correção: Admin — inputs no lugar certo, imagem com preview

- Inputs DOM agora usam coordenadas **absolutas** do container Phaser — ficam
  exatamente onde devem, com `zIndex` alto.
- Campo de imagem mostra **preview instantâneo** (FileReader) antes do upload.

### Correção: busca da Wiki (H) mantém foco

Digitar na busca da wiki não derruba mais o campo no meio da palavra.

### Correção: scroll dos Termos + "Ao aceitar..." com margem

- Roda do mouse **rola** o texto (geometria mask + wheel listener).
- Texto "Ao aceitar..." subiu — não cola mais na borda amarela.

---

### Recap das novidades anteriores

- **Você nasce onde parou** — posição salva a cada 10s e no shutdown.
- **Mapa 60×44** — 6× maior, mais biomas, bases maiores.
- **Portal posicionável (Shift+P)** — 4 posições, efeitos visuais (aro rúnico,
  particulas, runas, placa).
- **Itens até 1.000 + perecíveis** — pilha 1k, validade carimbada, não mistura.
- **Botão "Agrupar" na Mochila** — junta pilhas compatíveis.
- **Pontos de atributo extras** — missões/conquistas dão pontos além do nível.
- **Admin (F2)**: foco persistente, busca ao vivo, upload com preview, editor
  de pixel art.
- **Wiki (H)**: busca ao vivo com foco preservado.
- **Termos**: scroll funciona, texto com margem.
- **Lobby**: até 10 heróis, background animado, changelog lateral.

---

## Ainda em construção

- Combate automático e missões
- Teste ponta-a-ponta do admin (upload real, abas Portais/Jogadores)
- Revisão visual: Reinos, Portais, Personagem
- Textos legais finais (precisam de advogado)
- Guildas / servidores dedicados (para escolas/empresas/cidades)
- Anti-cheat para auto-farm futuro

---

## Como ajudar

1. **Jogue e relate** — tela + o que fazia vale mais que relatorio formal.
2. **Use a mesma conta Google** — progresso salva e sincroniza.
3. **Cadastre no admin** — a wiki so fica boa se item/talento/monstro tem
   descricao e imagem.

Obrigado por construir o Imperio com a gente.
---

## Correção — o login do Google e os botões da tela de entrada

*v0.1.2 · Outubro de 2026*

### O que estava quebrado

- **"Entrar com Google" não fazia nada.** A tela ficava parada, sem aviso.
- **O painel de administração abria com erro** (`ALTURA_CHIP is not defined`)
  e a tela ficava em branco.
- **As mensagens de login apareciam no lugar errado**, batendo nos botões ou
  fora da tela em janelas baixas.

### O que mudou

- **Os botões da tela de entrada foram reorganizados.** Agora ficam em coluna,
  com o botão do Google em cima, um "ou" no meio e "Jogar sem conta" embaixo.
  A mensagem de erro aparece **colada abaixo dos botões**, sempre visível.
- **"Entrar com Google" dá retorno visual na hora**: o rótulo vira
  "Abrindo o login..." e os botões escurecem enquanto o navegador abre a
  janela do Google. Antes o clique parecia perdido.
- **O erro agora aparece sempre.** Se o login falhar, a mensagem fica na tela
  em vez de sumir.
- **Sem popups empilhados:** clicar várias vezes não abre várias janelas.
- **Sessão já ativa é tratada.** Se você já está logado, o jogo entra
  direto e avisa com quem — o botão do Google deixa de ser um botão morto.
- **Corrigido o erro do painel de administração.**

---

## O salão dos heróis (lobby)

*v0.1.3 · Outubro de 2026*

### O que mudou

- **Depois de entrar com o Google, você cai no salão** — não na tela de criação
  direto. O salão lista **até 10 heróis** e é a partir dele que o jogo continua.
- **Escolher herói pede confirmação.** Clicar num cartão abre uma janela com o
  nome e o nível de quem vai entrar, e só depois disso o mundo abre. Dá para
  voltar sem risco.
- **O salão virou um CRUD de verdade.** Criar (`+ NOVO HERÓI`), editar
  (`EDITAR`) e excluir (`EXCLUIR`) funcionam e gravam de fato — antes os botões
  existiam mas nada era salvo.
- **Excluir passou a ter 30 dias de prazo.** O herói agendado fica **congelado**
  (não dá para entrar nele) e mostra quantos dias faltam. Durante esse tempo
  dá para **cancelar** e resgatá-lo. Só depois de 30 dias ele é removido de
  verdade, e isso é conferido toda vez que o salão abre.
- **Editar só trava o que precisa.** O nome, a raça e a vocação podem ser
  ajustados enquanto o herói está no nível 1 ou 2.

### Correções que vieram junto

- **Voltar do formulário agora volta ao salão**, e não para a tela de login.
- **O herói criado aparece na lista** na hora, com a confirmação escrita.
- Herói agendado para exclusão não pode mais ser aberto por engano.

### Nota

Se você já tinha mais de um herói, nada foi perdido: a carência de 30 dias só
vale para exclusões marcadas a partir de agora. A tela de Reinos tem um erro
conhecido em revisão, fora do escopo desta versão.
