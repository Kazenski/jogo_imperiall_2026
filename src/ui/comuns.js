// Helpers de UI reutilizaveis entre as cenas do Impérium.
// Todos devolvem Game Objects do Phaser (a cena decide se embrulha em container).

import { Math as PhaserMath, Events as PhaserEvents } from 'phaser';
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

/** Painel de fundo com moldura, ancorado pelo canto superior esquerdo. */
export function painel(scene, x, y, largura, altura, preenchimento = 0x14100c, alfa = 0.96) {
  return scene.add
    .nineSlice(x, y, 'painel', null, largura, altura, 10, 10, 10, 10)
    .setOrigin(0, 0)
    .setFillStyle(preenchimento, alfa);
}

/** Botao com texto. Retorna { caixa, label, destroy }. */
export function botao(scene, x, y, rotulo, onClick, opcoes = {}) {
  const {
    largura = 160,
    altura = 34,
    cor = 0xd4af6a,
    corHover = 0xe6c47c,
    corTexto = '#14100c',
    tamanho = '13px',
    origem = [0.5, 0.5],
  } = opcoes;

  const caixa = scene.add
    .rectangle(x, y, largura, altura, cor, opcoes.alfa ?? 1)
    .setOrigin(origem[0], origem[1])
    .setStrokeStyle(1, 0x8a6a2f)
    .setInteractive({ useHandCursor: true });

  const label = scene.add
    .text(x, y, rotulo, {
      ...FONTE_UI,
      fontSize: tamanho,
      color: corTexto,
      align: 'center',
    })
    .setOrigin(0.5);

  caixa.on('pointerover', () => caixa.setFillStyle(corHover));
  caixa.on('pointerout', () => caixa.setFillStyle(cor));
  caixa.on('pointerdown', onClick);

  return {
    caixa,
    label,
    setTexto: (t) => label.setText(t),
    definirPosicao: (nx, ny) => {
      caixa.setPosition(nx, ny);
      label.setPosition(nx, ny);
    },
    destruir: () => {
      caixa.destroy();
      label.destroy();
    },
  };
}

/** Linha clicavel de lista (nome + detalhe). */
export function linhaLista(scene, x, y, largura, nome, detalhe, onClick) {
  const caixa = scene.add
    .rectangle(x, y, largura, 38, 0x1d1710, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x2e241a)
    .setInteractive({ useHandCursor: true });

  const t1 = scene.add
    .text(x + 10, y + 5, nome, { ...FONTE_UI, fontSize: '13px', color: OURO })
    .setOrigin(0, 0);

  const t2 = scene.add
    .text(x + 10, y + 21, detalhe, { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
    .setOrigin(0, 0)
    .setAlpha(0.75);

  if (onClick) {
    caixa.on('pointerover', () => caixa.setStrokeStyle(1, 0xd4af6a));
    caixa.on('pointerout', () => caixa.setStrokeStyle(1, 0x2e241a));
    caixa.on('pointerdown', onClick);
  }

  return { caixa, t1, t2 };
}

/** Chip pequeno (usado para tags de uso/raridade). */
export function chip(scene, x, y, rotulo, cor = 0x241c14, corTexto = PERGAMINHO) {
  const t = scene.add
    .text(x, y, rotulo, {
      ...FONTE_UI,
      fontSize: '10px',
      color: corTexto,
      backgroundColor: cor,
      padding: { x: 5, y: 2 },
    })
    .setOrigin(0, 0);
  return t;
}

/** Barra de status (usada por jogador e monstros). */
export function barra(scene, x, y, largura, altura, cor, pct = 1) {
  const fundo = scene.add
    .rectangle(x, y, largura, altura, 0x1a1410, 0.85)
    .setOrigin(0, 0);
  const frente = scene.add
    .rectangle(x + 1, y + 1, Math.max(0, (largura - 2) * PhaserMath.Clamp(pct, 0, 1)), altura - 2, cor)
    .setOrigin(0, 0);
  return {
    fundo,
    frente,
    atualizar(p) {
      frente.width = Math.max(0, (largura - 2) * PhaserMath.Clamp(p, 0, 1));
    },
    destruir() {
      fundo.destroy();
      frente.destroy();
    },
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
  scene.events.once(PhaserEvents.SHUTDOWN, () =>
    scene.input.keyboard.off(`keydown-${tecla}`, handler),
  );
  return handler;
}
