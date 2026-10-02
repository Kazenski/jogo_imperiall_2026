// Helpers de UI reutilizaveis entre as cenas do Impérium.
// Todos devolvem Game Objects do Phaser (a cena decide se embrulha em container).

import { Math as PhaserMath, Scenes as PhaserCenas } from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';

export const FONTE_TITULO = { fontFamily: 'Georgia, serif' };
export const FONTE_UI = { fontFamily: 'system-ui, sans-serif' };

/** Cria um texto com o estilo padrao da UI. */
export function texto(scene, x, y, conteudo, opcoes = {}) {
  return scene.add.text(x, y, conteudo, {
    ...FONTE_UI,
    fontSize: '13px',
    color: PERGAMINHO,
    ...opcoes,
  });
}

/** Titulo dourado. */
export function titulo(scene, x, y, conteudo, tamanho = '18px') {
  return scene.add.text(x, y, conteudo, {
    ...FONTE_TITULO,
    fontSize: tamanho,
    color: OURO,
  });
}

/**
 * Desenha uma caixa de cantos arredondados dentro de um container.
 *
 * O ponto (x, y) do container e a ANCORA da caixa, e `origem` diz qual canto ela
 * representa — assim `botao(..., { origem: [1, 1] })` ancora pelo canto inferior
 * direito, igual ao `setOrigin` de um Rectangle.
 *
 * Usa `Graphics.fillRoundedRect` em vez de Rectangle porque o Phaser so tem
 * cantos arredondados em Graphics. (NineSlice exigiria registrar um plugin do
 * Phaser, que depende de caminho interno da biblioteca.)
 */
export function caixaArredondada(scene, x, y, largura, altura, opcoes = {}) {
  const {
    raio = 8,
    preenchimento = 0x14100c,
    alfa = 1,
    borda = 0x8a6a2f,
    larguraBorda = 2,
    bordaInterna = null,
    alfaBordaInterna = 0.35,
    origem = [0, 0],
  } = opcoes;

  // A caixa e desenhada de (0,0) a (largura, altura) em espaco local, e `origem`
  // diz qual ponto dela coincide com a posicao do container:
  //   origem 0   -> canto superior esquerdo -> dx = 0
  //   origem 0.5 -> centro                  -> dx = -largura / 2
  //   origem 1   -> canto inferior direito  -> dx = -largura
  // Logo `dx = -origem * largura`.
  //
  // Antes era um ternario que so reconhecia 0 e 1, entao a origem padrao
  // [0.5, 0.5] caia no caso 0: todo botao nascia ancorado pelo canto superior
  // esquerdo e aparecia deslocado para a direita e para baixo por metade do
  // proprio tamanho — o que fazia todos os menus parecerem tortos.
  const dx = -origem[0] * largura;
  const dy = -origem[1] * altura;

  const g = scene.add.graphics();
  if (preenchimento !== null) {
    g.fillStyle(preenchimento, alfa);
    g.fillRoundedRect(dx, dy, largura, altura, raio);
  }
  if (larguraBorda > 0 && borda !== null) {
    g.lineStyle(larguraBorda, borda, 1);
    g.strokeRoundedRect(dx, dy, largura, altura, raio);
  }
  if (bordaInterna !== null) {
    g.lineStyle(1, bordaInterna, alfaBordaInterna);
    const m = 5;
    g.strokeRoundedRect(
      dx + m,
      dy + m,
      Math.max(0, largura - m * 2),
      Math.max(0, altura - m * 2),
      Math.max(0, raio - 3),
    );
  }

  const container = scene.add.container(x, y);
  container.add(g);
  container.caixa = g;
  container.largura = largura;
  container.altura = altura;
  container.deslocamento = { dx, dy };
  return container;
}

/**
 * Adiciona um retangulo invisivel usado apenas como area de clique.
 * O container de um painel precisa disso para responder ao mouse.
 */
export function areaDeClique(scene, x, y, largura, altura, origem = [0, 0]) {
  const dx = -origem[0] * largura;
  const dy = -origem[1] * altura;
  return scene.add
    .rectangle(x, y, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })
    .setData('offset', { dx, dy });
}

/** Painel de fundo com moldura, ancorado pelo canto superior esquerdo. */
export function painel(scene, x, y, largura, altura, preenchimento = 0x14100c, alfa = 0.96) {
  return caixaArredondada(scene, x, y, largura, altura, {
    raio: 12,
    preenchimento,
    alfa,
    borda: 0x8a6a2f,
    larguraBorda: 2,
    bordaInterna: OURO,
    alfaBordaInterna: 0.22,
    origem: [0, 0],
  });
}

/**
 * Adiciona varios Game Objects de uma vez.
 *
 * `scene.add.existing` aceita UM objeto por chamada; passar um array ali quebra a
 * cena em runtime (o objeto entra sem canvas/textura). Use este helper.
 */
export function addTodos(scene, ...objetos) {
  const lista = objetos.flat().filter(Boolean);
  for (const obj of lista) scene.add.existing(obj);
  return lista;
}

/**
 * Botao arredondado. Retorna { caixa, label, container, definirPosicao, ... }.
 *
 * `caixa` e o container — quem precisar mexer no visual (fill, hover) usa
 * `container.caixa` (Graphics) e `definirVisual()`.
 */
export function botao(scene, x, y, rotulo, onClick, opcoes = {}) {
  const {
    largura = 160,
    altura = 34,
    raio = 8,
    cor = 0xd4af6a,
    corHover = 0xe6c47c,
    corTexto = '#14100c',
    tamanho = '13px',
    origem = [0.5, 0.5],
    alfa = 1,
    icone = null,
    corBorda = 0x8a6a2f,
    alinhamento = 'left',
    padding = 10,
  } = opcoes;

  const box = caixaArredondada(scene, x, y, largura, altura, {
    raio,
    preenchimento: cor,
    alfa,
    borda: corBorda,
    larguraBorda: 1,
    origem,
  });

  const dx = box.deslocamento.dx;
  const dy = box.deslocamento.dy;
  box.caixa.setAlpha(alfa);

  // Zona de clique: um retangulo invisivel dentro do container.
  //
  // NAO da para tornar o proprio `Graphics` interativo. `Graphics` nao tem
  // componente de tamanho no Phaser (na lista de Mixins do construtor nao ha
  // `Size`), entao `width`/`height` ficam `undefined` e `frame` tambem nao
  // existe. `setInteractive({...})` sem hit area explicito entra em
  // `InputPlugin.setHitArea()`, que chama `setHitAreaFromTexture()` e depois
  // continua o laco com as variaveis `hitArea`/`hitAreaCallback` AINDA `null`:
  //
  //     if (!hitArea || !hitAreaCallback) { setHitAreaFromTexture(...); }
  //     ...
  //     var io = CreateInteractiveObject(gameObject, hitArea, hitAreaCallback);
  //     this.queueForInsertion(gameObject);
  //
  // Ou seja: o objeto entra na lista de input com `hitArea = null` e
  // `hitAreaCallback = null`. Aí todo `InputManager.pointWithinHitArea()` estoura
  // com
  //
  //     TypeError: input.hitAreaCallback is not a function
  //
  // e o `hitTest` inteiro aborta — nao e so este botao que morre, e o input da
  // CENA INTEIRA que deixa de responder (por isso nenhum clique funcionava em
  // lugar nenhum). Medido em runtime: `hitArea: null, hitAreaCallback: null`.
  //
  // `setDepth(1000)` nao ajuda em nada: o problema nao e prioridade, e o objeto
  // estar registered com um callback nulo. Um `Rectangle` tem largura/altura de
  // verdade, entao `setHitAreaFromTexture()` monta o `Rectangle` e o
  // `Rectangle.Contains` corretamente.
  const clique = scene.add
    .rectangle(0, 0, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setPosition(dx, dy)
    .setInteractive({ useHandCursor: true });
  box.add(clique);

  // Posicionamento do conteudo dentro da caixa.
  const tamanhoIcone = icone?.tamanho ?? 22;
  let imgIcone = null;
  let textoX = largura / 2;

  if (icone) {
    const temTexto = Boolean(rotulo);
    const xIcone = temTexto ? padding + tamanhoIcone / 2 : largura / 2;
    imgIcone = scene.add
      .image(dx + xIcone, dy + altura / 2, icone.texture)
      .setDisplaySize(tamanhoIcone, tamanhoIcone)
      .setOrigin(0.5);
    imgIcone.setAlpha(icone.alfa ?? 0.95);
    box.add(imgIcone);

    if (temTexto) {
      const inicio = padding + tamanhoIcone + 8;
      textoX = inicio + (largura - inicio - padding) / 2;
    }
  } else if (alinhamento === 'left') {
    textoX = padding + (largura - padding * 2) / 2;
  }

  const label = scene.add
    .text(dx + textoX, dy + altura / 2, rotulo, {
      ...FONTE_UI,
      fontSize: tamanho,
      color: corTexto,
      align: 'center',
    })
    .setOrigin(0.5);
  label.setVisible(Boolean(rotulo));
  box.add(label);

  const aplicarCor = (c) => {
    box.caixa.clear();
    box.caixa.fillStyle(c, alfa);
    box.caixa.fillRoundedRect(dx, dy, largura, altura, raio);
    box.caixa.lineStyle(1, corBorda, 1);
    box.caixa.strokeRoundedRect(dx, dy, largura, altura, raio);
  };
  aplicarCor(cor);

  // Eventos na zona de clique (a unica parte realmente interativa).
  //
  // No `Graphics` dava para ligar, mas nunca disparava. No `clique` funciona —
  // e `WorldScene` ja usava `b.clique` para as dicas do menu lateral.
  clique.on('pointerover', () => aplicarCor(corHover));
  clique.on('pointerout', () => aplicarCor(cor));
  clique.on('pointerdown', onClick);

  return {
    // `caixa` e o Graphics de fundo. Use para DESENHAR (`definirVisual()`,
    // `caixa.clear()`, hover) — nunca para adicionar a um container pai.
    caixa: box.caixa,
    // `container` e o botao INTEIRO (fundo + zona de clique + rotulo). E este
    // que deve ser passado para `pai.add(...)` / `raiz.add(...)`.
    //
    // Passar `caixa` aqui e o que jogava o botao para o canto superior
    // esquerdo: `Container.add()` chama `addHandler`, que tira o objeto do
    // container anterior e o re-filha mantendo a posicao local `(0, 0)`. O
    // Graphics saia do container do botao e passava a ser desenhado a partir
    // do `(0, 0)` do pai, enquanto o rotulo continuava no lugar certo — dai o
    // texto no meio da tela e a caixa grudada no topo esquerdo.
    container: box,
    clique,
    label,
    // Aliases para quem esperava um Rectangle (.width/.height do GameObject).
    width: largura,
    height: altura,
    definirVisual: aplicarCor,
    setTexto: (t) => label.setText(t),
    definirPosicao: (nx, ny) => box.setPosition(nx, ny),
    destruir: () => box.destroy(true),
  };
}

/**
 * Quantas linhas uma lista de botoes ocupa, sem desenhar nada.
 *
 * `fluxoBotoes` desenha direto; antes de desenhar e preciso saber o espaco
 * vertical que o bloco vai ocupar para ancorar o resto do painel. Calcular a
 * quebra duas vezes em lugares diferentes e o jeito classico de um layout
 * transbordar, entao a conta mora aqui e e usada pelas duas.
 */
export function medirFluxo(larguraUtil, larguras, vao = 8) {
  let cx = 0;
  let linhas = 0;
  let naLinha = 0;
  for (const largura of larguras) {
    if (naLinha > 0 && cx + largura > larguraUtil) {
      linhas += 1;
      cx = 0;
      naLinha = 0;
    }
    cx += largura + vao;
    naLinha += 1;
  }
  return naLinha === 0 ? 0 : linhas + 1;
}

/**
 * Distribui botoes em linhas, quebrando quando o proximo nao cabe.
 *
 * Existe porque os menus posicionavam botao por botao em coordenadas fixas
 * (x = 70, 210, 220...), o que desalinha tudo assim que o rotulo muda de
 * tamanho ou entra um botao novo. Aqui o chamador entrega a lista e a largura
 * util; o espaco entre linhas e a altura total ocupada sao calculados aqui.
 *
 * `x` e `y` sao LOCAIS a `pai` e sao passados ao `botao()` como such.
 *
 * Importante: `Container.add()` NAO converte a posicao do filho para local.
 * Verificado nesta versao do Phaser — um texto criado em (150, 260) e adicionado
 * a um container em (100, 200) continua com x = 150 e e desenhado em 250, 460,
 * ou seja, a posicao do pai e SOMADA. Por isso os botoes sao criados nas
 * coordenadas locais diretas; somar `pai.x` aqui deslocaria tudo duas vezes.
 */
export function fluxoBotoes(pai, x, y, larguraUtil, botoes, opcoes = {}) {
  const { vao = 8, altura = 30, passoLinha = 38 } = opcoes;

  let cx = x;
  let cy = y;
  let usado = 0;

  for (const item of botoes) {
    if (!item) continue;
    const largura = item.largura ?? item.opcoes?.largura ?? 160;
    // O primeiro botao sempre entra, mesmo que alone nao caiba na faixa.
    if (usado > 0 && cx + largura > x + larguraUtil) {
      cx = x;
      cy += passoLinha;
      usado = 0;
    }
    const b = botao(pai.scene, cx + largura / 2, cy + altura / 2, item.rotulo, item.onClick, {
      largura,
      altura,
      tamanho: item.tamanho ?? '12px',
      cor: item.cor ?? 0xd4af6a,
      corHover: item.corHover,
      corTexto: item.corTexto,
      corBorda: item.corBorda,
    });
    // O botao INTEIRO: passar `b.caixa` (o Graphics) arrancaria o fundo do
    // container do botao e o draw no (0,0) do pai — canto superior esquerdo.
    pai.add(b.container);
    cx += largura + vao;
    usado += 1;
  }

  return { alturaTotal: cy + altura - y, linhas: usado === 0 ? 0 : Math.round((cy - y) / passoLinha) + 1 };
}

/**
 * Linha clicavel de lista (nome + detalhe).
 *
 * `opcoes` adiciona os tres estados que as listas grandes precisaram:
 *  - `alfa`        esmaece a linha inteira (ex.: receita sem insumos)
 *  - `selecionado` pinta o fundo e engrossa a borda
 *  - `altura`      altura diferente da padrão, para linhas de duas linhas
 *  - `alturaNome`  deslocamento da segunda linha quando `altura` muda
 *
 * Sem `opcoes` a função se comporta exatamente como antes, para não quebrar os
 * pontos de chamada que já existiam.
 */
export function linhaLista(scene, x, y, largura, nome, detalhe, onClick, opcoes = {}) {
  const {
    alfa = 1,
    selecionado = false,
    altura: alturaCustom = 40,
    corFundo = 0x1d1710,
    corFundoSelecionado = 0x2f2418,
    corBorda = 0x2e241a,
    corBordaSelecionado = OURO,
  } = opcoes;
  const altura = alturaCustom;
  const yNome = y + (altura >= 44 ? 9 : 7);
  const box = caixaArredondada(scene, x, y, largura, altura, {
    raio: 8,
    preenchimento: selecionado ? corFundoSelecionado : corFundo,
    borda: selecionado ? corBordaSelecionado : corBorda,
    larguraBorda: selecionado ? 2 : 1,
    origem: [0, 0],
  });

  const clique = scene.add
    .rectangle(0, 0, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  box.add(clique);

  const t1 = scene.add
    .text(x + 12, yNome, nome, { ...FONTE_UI, fontSize: '13px', color: OURO })
    .setOrigin(0, 0);
  const t2 = scene.add
    .text(x + 12, yNome + 16, detalhe, { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
    .setOrigin(0, 0)
    .setAlpha(0.75);

  if (alfa !== 1) {
    box.caixa.setAlpha(alfa);
    t1.setAlpha(alfa);
    t2.setAlpha(0.75 * alfa);
  }

  const pintar = (fundo, borda, espessura) => {
    box.caixa.clear();
    box.caixa.fillStyle(fundo, 1);
    box.caixa.fillRoundedRect(0, 0, largura, altura, 8);
    box.caixa.lineStyle(espessura, borda, 1);
    box.caixa.strokeRoundedRect(0, 0, largura, altura, 8);
  };

  if (onClick) {
    clique.on('pointerover', () => pintar(0x2a2018, OURO, 1));
    clique.on('pointerout', () =>
      pintar(
        selecionado ? corFundoSelecionado : corFundo,
        selecionado ? corBordaSelecionado : corBorda,
        selecionado ? 2 : 1,
      ),
    );
    clique.on('pointerdown', onClick);
  }

  return { caixa: box, clique, t1, t2, altura };
}

/**
 * Chip pequeno (usado para tags de uso/raridade).
 *
 * Os filhos sao posicionados em coordenadas LOCAIS (0, 0) e o container recebe
 * `x`/`y`. O texto antes nascia em `x + 5, y + 2` — absoluto — e, quando o chip
 * era colocado dentro de outro container, aparecia deslocado pelo valor do
 * pai mais o proprio `x` outra vez.
 */
export function chip(scene, x, y, rotulo, cor = 0x241c14, corTexto = PERGAMINHO) {
  const t = scene.add
    .text(0, 0, rotulo, {
      ...FONTE_UI,
      fontSize: '10px',
      color: corTexto,
    })
    .setOrigin(0, 0);

  const w = t.width + 10;
  const h = t.height + 5;
  const fundo = scene.add.graphics();
  fundo.fillStyle(cor, 1);
  fundo.fillRoundedRect(0, 0, w, h, h / 2);
  t.setPosition(5, 2);

  const container = scene.add.container(x, y);
  container.add(fundo);
  container.add(t);
  container.largura = w;
  container.altura = h;
  container.width = w;
  container.height = h;
  return container;
}

/**
 * Barra de status (usada por jogador e monstros), com cantos arredondados.
 *
 * O `Graphics` so e redesenhado quando o valor MUDA — 22 monstros redesenhando
 * a cada frame custa caro e nao traz nada.
 */
export function barra(scene, x, y, largura, altura, cor, pct = 1) {
  const raio = Math.max(1, Math.min(altura / 2, largura / 2));
  const frente = scene.add.graphics();
  const interno = Math.max(0, (altura - 4) / 2);
  let ultimoPct = -1;

  const desenhar = (p) => {
    frente.clear();
    frente.fillStyle(0x1a1410, 0.85);
    frente.fillRoundedRect(0, 0, largura, altura, raio);
    frente.lineStyle(1, 0x000000, 0.35);
    frente.strokeRoundedRect(0, 0, largura, altura, raio);
    const w = Math.max(0, (largura - 4) * PhaserMath.Clamp(p, 0, 1));
    if (w > 0.5) {
      frente.fillStyle(cor, 1);
      frente.fillRoundedRect(2, 2, w, altura - 4, interno);
    }
  };
  desenhar(pct);

  const container = scene.add.container(x, y);
  container.add(frente);

  return {
    container,
    frente,
    fundo: frente,
    atualizar(p) {
      const v = PhaserMath.Clamp(p, 0, 1);
      if (Math.abs(v - ultimoPct) < 0.002) return;
      ultimoPct = v;
      desenhar(v);
    },
    destruir() {
      container.destroy(true);
    },
  };
}

/**
 * Campo de texto com cantos arredondados.
 *
 * O Phaser nao tem input de texto proprio, entao usamos um <input> do DOM
 * sobreposto ao canvas.
 *
 * Posicionamento: com `Scale.RESIZE` e `width/height: '100%'`, UMA unidade da
 * cena equivale a UM pixel CSS. Multiplicar por `devicePixelRatio` (como se
 * fosse o modo FIT) jogava o campo para fora da tela. Ainda assim medimos o
 * `getBoundingClientRect` do canvas, porque ele pode estar deslocado dentro
 * do elemento pai.
 */
export function campoTexto(scene, x, y, largura, altura, valor = '', opcoes = {}) {
  const {
    placeholder = '',
    maxLength = 24,
    aoConfirmar = null,
    aoMudar = null,
    chave = null,
  } = opcoes;

  const box = caixaArredondada(scene, x, y, largura, altura, {
    raio: 8,
    preenchimento: 0x1a1410,
    borda: 0x8a6a2f,
    larguraBorda: 1,
    origem: [0, 0],
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.value = valor;
  input.maxLength = maxLength;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;

  const canvas = scene.game.canvas;
  const pai = canvas.parentElement;

  const posicionar = () => {
    if (!pai) return;
    const c = canvas.getBoundingClientRect();
    const p = pai.getBoundingClientRect();
    const alturaInput = Math.max(12, Math.min(26, altura - 4));
    input.style.left = `${c.left - p.left + x + 8}px`;
    input.style.top = `${c.top - p.top + y + (altura - alturaInput) / 2}px`;
    input.style.width = `${Math.max(0, largura - 16)}px`;
    input.style.height = `${alturaInput}px`;
  };

  Object.assign(input.style, {
    position: 'absolute',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: PERGAMINHO,
    font: '13px system-ui, sans-serif',
    textAlign: 'center',
    padding: '0',
    margin: '0',
    zIndex: '20',
  });
  posicionar();

  if (pai) pai.appendChild(input);

  // `Enter` seguido de `blur` dispararia `aoConfirmar` duas vezes sem este flag.
  let confirmado = false;

  // `Phaser.Scenes.Events.SHUTDOWN` e nao `Phaser.Events.SHUTDOWN`: o segundo
  // nao existe nesta build e vale `undefined`, o que registra o listener sob a
  // chave "undefined" e nunca dispara — o <input> ficaria no DOM para sempre.
  const limpar = () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, posicionar);
    input.remove();
  };
  scene.events.once(PhaserCenas.Events.SHUTDOWN, limpar);
  scene.scale.on(Phaser.Scale.Events.RESIZE, posicionar);

  input.addEventListener('keydown', (ev) => {
    // Sem isso, digitar "i" abriria a Mochila e "v" o painel do personagem.
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      confirmado = true;
      aoConfirmar?.(input.value.trim());
      input.blur();
    } else if (ev.key === 'Escape') {
      input.value = valor; // cancela e devolve o valor original
      confirmado = true;
      input.blur();
    }
  });
  input.addEventListener('blur', () => {
    if (confirmado) return;
    confirmado = true;
    aoConfirmar?.(input.value.trim());
  });

  // Estado vivo durante a digitação.
  //
  // Sem este listener, o texto só chega na cena quando o campo perde o foco
  // (`blur`) ou quando o jogador aperta Enter. Funciona "por acidente" quando o
  // botão de.submit está no canvas — o clique causa o blur primeiro — mas a
  // cena lê estado velho até lá, e qualquer submissão que aconteça antes do blur
  // salva o valor anterior. Foi o que fazia o personagem nascer com o nome
  // "Viajante" mesmo depois de a pessoa digitar o nome dela.
  input.addEventListener('input', () => {
    marcarFoco();
    aoMudar?.(input.value);
  });
  // Impede que o clique no proprio campo caia no canvas por tras.
  input.addEventListener('mousedown', (ev) => ev.stopPropagation());

  // ---------- foco que sobrevive ao redesenho ----------
  //
  // Os painéis do jogo redesenham a tela inteira a cada mudança (filtrar uma
  // lista, trocar um chip, salvar). Como o `<input>` é do DOM e o resto é
  // canvas, um redesenho **destrói o elemento onde a pessoa está digitando**:
  // o foco cai no `<body>` e a palavra some no meio da digitação.
  //
  // A cena guarda qual campo tem o foco e onde está o cursor; `restaurarFoco`
  // devolve os dois depois que o painel foi reconstruído. É o mínimo para o
  // filtro do painel administrativo poder responder a cada tecla.
  const marcarFoco = () => {
    scene._foco = { chave, inicio: input.selectionStart ?? 0, fim: input.selectionEnd ?? 0 };
  };

  input.addEventListener('focus', marcarFoco);
  input.addEventListener('keyup', () => {
    if (scene._foco?.chave === chave) marcarFoco();
  });
  input.addEventListener('click', () => {
    if (scene._foco?.chave === chave) marcarFoco();
  });
  input.addEventListener('blur', () => {
    if (scene._foco?.chave === chave) scene._foco = null;
  });

  return {
    box,
    input,
    chave,
    valor: () => input.value.trim(),
    focar: () => input.focus(),
    /** Devolve o foco e o cursor a este campo. */
    restaurarFoco(inicio = 0, fim = inicio) {
      if (input.readOnly || input.disabled) return false;
      if (!input.isConnected) return false;
      input.focus();
      const i = Math.min(inicio ?? 0, input.value.length);
      const f = Math.min(fim ?? i, input.value.length);
      try {
        input.setSelectionRange(i, f);
      } catch {
        /* tipos sem selecao (ex.: email) aceitam foco, mas nao cursor */
      }
      return true;
    },
    destruir: limpar,
  };
}

/**
 * Devolve o foco ao campo com a mesma `chave` do objeto `foco`.
 *
 * Usado depois de um redesenho: `campoTexto` grava `scene._foco` sozinho, a
 * cena redesenha, e depois chama isto com o valor que guardou antes.
 */
export function restaurarFoco(scene, foco, campos = []) {
  if (!foco?.chave) return false;
  const alvo = campos.find((c) => c?.chave === foco.chave);
  return alvo?.restaurarFoco ? alvo.restaurarFoco(foco.inicio, foco.fim) : false;
}

/** Apaga todos os filhos de um container com seguranca. */
export function limpar(container) {
  if (!container) return;
  container.removeAll(true);
}

/** Registra um atalho de teclado limpo no SHUTDOWN da cena. */
export function aoTeclar(scene, tecla, callback) {
  const handler = scene.input.keyboard.on(`keydown-${tecla}`, callback);
  // Ver `campoTexto`: tem de ser `Phaser.Scenes.Events.SHUTDOWN`.
  scene.events.once(PhaserCenas.Events.SHUTDOWN, () =>
    scene.input.keyboard.off(`keydown-${tecla}`, handler),
  );
  return handler;
}