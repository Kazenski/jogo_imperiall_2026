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

  // Desenha sempre de (0,0) a (largura, altura) e desloca conforme a origem.
  const dx = origem[0] === 1 ? -largura : 0;
  const dy = origem[1] === 1 ? -altura : 0;

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
  const dx = origem[0] === 1 ? -largura : 0;
  const dy = origem[1] === 1 ? -altura : 0;
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
  const clique = scene.add
    .rectangle(0, 0, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setPosition(dx, dy)
    .setInteractive({ useHandCursor: true });
  box.add(clique);

  // Icone opcional, alinhado a esquerda com o texto ao lado.
  let imgIcone = null;
  let textoX = largura / 2;
  if (icone) {
    imgIcone = scene.add
      .image(dx + padding + 11, dy + altura / 2, icone.texture)
      .setDisplaySize(icone.tamanho ?? 22, icone.tamanho ?? 22)
      .setOrigin(0.5);
    imgIcone.setAlpha(icone.alfa ?? 0.95);
    box.add(imgIcone);
    textoX = padding + 22 + 8 + (largura - padding * 2 - 30) / 2;
  } else if (alinhamento === 'left') {
    textoX = padding + (largura - padding * 2) / 2;
  } else {
    textoX = largura / 2;
  }

  const label = scene.add
    .text(dx + textoX, dy + altura / 2, rotulo, {
      ...FONTE_UI,
      fontSize: tamanho,
      color: corTexto,
      align: 'center',
    })
    .setOrigin(0.5);
  box.add(label);

  const aplicarCor = (c) => {
    box.caixa.clear();
    box.caixa.fillStyle(c, alfa);
    box.caixa.fillRoundedRect(dx, dy, largura, altura, raio);
    box.caixa.lineStyle(1, corBorda, 1);
    box.caixa.strokeRoundedRect(dx, dy, largura, altura, raio);
  };
  aplicarCor(cor);

  clique.on('pointerover', () => aplicarCor(corHover));
  clique.on('pointerout', () => aplicarCor(cor));
  clique.on('pointerdown', onClick);

  return {
    caixa: box,
    container: box,
    clique,
    label,
    icone: imgIcone,
    // Aliases para quem esperava um Rectangle (.width/.height do GameObject).
    width: largura,
    height: altura,
    definirVisual: aplicarCor,
    setTexto: (t) => label.setText(t),
    definirPosicao: (nx, ny) => box.setPosition(nx, ny),
    destruir: () => box.destroy(true),
  };
}

/** Linha clicavel de lista (nome + detalhe). */
export function linhaLista(scene, x, y, largura, nome, detalhe, onClick) {
  const altura = 40;
  const box = caixaArredondada(scene, x, y, largura, altura, {
    raio: 8,
    preenchimento: 0x1d1710,
    borda: 0x2e241a,
    larguraBorda: 1,
    origem: [0, 0],
  });

  const clique = scene.add
    .rectangle(0, 0, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  box.add(clique);

  const t1 = scene.add
    .text(x + 12, y + 7, nome, { ...FONTE_UI, fontSize: '13px', color: OURO })
    .setOrigin(0, 0);
  const t2 = scene.add
    .text(x + 12, y + 23, detalhe, { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
    .setOrigin(0, 0)
    .setAlpha(0.75);

  if (onClick) {
    clique.on('pointerover', () => {
      box.caixa.clear();
      box.caixa.fillStyle(0x2a2018, 1);
      box.caixa.fillRoundedRect(0, 0, largura, altura, 8);
      box.caixa.lineStyle(1, OURO, 1);
      box.caixa.strokeRoundedRect(0, 0, largura, altura, 8);
    });
    clique.on('pointerout', () => {
      box.caixa.clear();
      box.caixa.fillStyle(0x1d1710, 1);
      box.caixa.fillRoundedRect(0, 0, largura, altura, 8);
      box.caixa.lineStyle(1, 0x2e241a, 1);
      box.caixa.strokeRoundedRect(0, 0, largura, altura, 8);
    });
    clique.on('pointerdown', onClick);
  }

  return { caixa: box, clique, t1, t2 };
}

/** Chip pequeno (usado para tags de uso/raridade). */
export function chip(scene, x, y, rotulo, cor = 0x241c14, corTexto = PERGAMINHO) {
  const t = scene.add
    .text(x, y, rotulo, {
      ...FONTE_UI,
      fontSize: '10px',
      color: corTexto,
    })
    .setOrigin(0, 0);

  const w = t.width + 10;
  const h = t.height + 5;
  const fundo = scene.add.graphics();
  fundo.fillStyle(cor, 1);
  fundo.fillRoundedRect(0, 0, w, h, (h / 2));
  fundo.fillStyle(cor, 1);
  t.setPosition(x + 5, y + 2);

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
  // Impede que o clique no proprio campo caia no canvas por tras.
  input.addEventListener('mousedown', (ev) => ev.stopPropagation());

  return {
    box,
    input,
    valor: () => input.value.trim(),
    focar: () => input.focus(),
    destruir: limpar,
  };
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