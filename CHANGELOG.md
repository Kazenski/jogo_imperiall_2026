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

### Recap das novidades anteriores (caso tenha perdido)

- **Wiki do Imperio (H)**: 9 secoes, busca cruzada, "Ao extrair:" mostra o que
  o bloco vira.
- **Criacao de personagem**: nome, 4 racas, vocacao, preview de stats.
- **Talentos refeitos**: ramos coloridos, ficha ao clicar, pre-requisitos de
  atributo, duplo-clique para liberar, respec gratis.
- **Fabricacao**: layout 2 colunas, abas com quebra de linha, insumos faltando
  em destaque.
- **Admin (F2)**: 9 abas, formularios 2 colunas, upload imagem com preview,
  avisos de dependencia ao apagar, abas Portais e Jogadores.
- **Termos/LGPD**: 12+6 secoes, versao no documento, botao "Apagar meu
  progresso" no Personagem (V).
- **Racas**: 4 opcoes (Humano, Anao, Elfo, Orc) — **sem bonus de atributo**,
  identidade pura.

---

## Ainda em construcao

- Combate automatico e missoes
- Teste ponta-a-ponta do admin
- Revisao visual: Reinos, Portais, Personagem
- Textos legais finais (precisam de advogado)

---

## Como ajudar

1. **Jogue e relate** — tela + o que fazia vale mais que relatorio formal.
2. **Use a mesma conta Google** — progresso salva e sincroniza.
3. **Cadastre no admin** — a wiki so fica boa se item/talento/monstro tem
   descricao e imagem.

Obrigado por construir o Imperio com a gente.