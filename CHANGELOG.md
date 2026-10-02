# Novidades do Império

Notas de atualização do **Jogo Imperiall 2026**, escritas para quem joga.
Para o registro de código, veja [`CHANGELOG_TECNICO.md`](CHANGELOG_TECNICO.md).

Este jogo está em desenvolvimento aberto. Se encontrar algo quebrado, o
caminho mais rápido é relatar com o que você estava fazendo na tela.

--- 

## Atualização — Mundo maior, portal seu, itens que fazem sentido

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