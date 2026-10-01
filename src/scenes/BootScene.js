import Phaser from 'phaser';

// Gera as texturas do jogo proceduralmente.
// Isso evita depender de arquivos de imagem no primeiro commit: o jogo ja
// abre e da para andar por ai. Substitua por sprites reais quando quiser.

export const TEXTURAS = {
  JOGADOR: 'jogador',
  CHAO: 'chao',
  ARVORE: 'arvore',
  PORTAL: 'portal',
  PARTICULA: 'particula',
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.criarTexturaJogador();
    this.criarTexturaChao();
    this.criarTexturaArvore();
    this.criarTexturaPortal();
    this.criarTexturaParticula();

    this.scene.start('Login');
  }

  /** Um "capataz" medieval simples: corpo, cabeca e capa. */
  criarTexturaJogador() {
    const g = this.make.graphics({ add: false });

    // capa
    g.fillStyle(0x8c2f2f, 1);
    g.fillRect(6, 14, 12, 12);
    // corpo / torso
    g.fillStyle(0x4a5d3a, 1);
    g.fillRect(8, 12, 8, 12);
    // cabeca
    g.fillStyle(0xe8c39e, 1);
    g.fillRect(9, 4, 6, 7);
    // elmo
    g.fillStyle(0x9aa2ab, 1);
    g.fillRect(8, 2, 8, 4);
    // olhos
    g.fillStyle(0x1a1410, 1);
    g.fillRect(10, 6, 2, 2);
    // cinto
    g.fillStyle(0x6b4a1f, 1);
    g.fillRect(8, 21, 8, 2);

    g.generateTexture(TEXTURAS.JOGADOR, 24, 26);
    g.destroy();
  }

  criarTexturaChao() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x3f5d33, 1);
    g.fillRect(0, 0, 32, 32);
    // textura de grama para nao ficar chapado
    g.fillStyle(0x48693a, 1);
    g.fillRect(2, 4, 5, 3);
    g.fillRect(17, 9, 6, 4);
    g.fillRect(8, 22, 4, 3);
    g.fillRect(24, 20, 5, 4);
    g.fillStyle(0x365028, 1);
    g.fillRect(13, 1, 4, 2);
    g.fillRect(2, 15, 4, 2);
    g.generateTexture(TEXTURAS.CHAO, 32, 32);
    g.destroy();
  }

  criarTexturaArvore() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x5a3a1e, 1);
    g.fillRect(14, 20, 4, 12);
    g.fillStyle(0x2f6b3a, 1);
    g.fillCircle(16, 14, 11);
    g.fillStyle(0x3a7f47, 1);
    g.fillCircle(11, 10, 6);
    g.fillCircle(21, 17, 6);
    g.generateTexture(TEXTURAS.ARVORE, 32, 36);
    g.destroy();
  }

  /** Portal: anel com brilho. A animacao vem na WorldScene. */
  criarTexturaPortal() {
    const g = this.make.graphics({ add: false });
    g.lineStyle(5, 0x7a4fd4, 1);
    g.strokeEllipse(20, 26, 26, 40);
    g.lineStyle(2, 0xc9a6ff, 1);
    g.strokeEllipse(20, 26, 18, 32);
    g.fillStyle(0x2a1348, 0.85);
    g.fillEllipse(20, 26, 26, 40);
    g.lineStyle(5, 0x7a4fd4, 1);
    g.strokeEllipse(20, 26, 26, 40);
    g.lineStyle(2, 0xc9a6ff, 1);
    g.strokeEllipse(20, 26, 18, 32);
    g.generateTexture(TEXTURAS.PORTAL, 40, 52);
    g.destroy();
  }

  criarTexturaParticula() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3);
    g.generateTexture(TEXTURAS.PARTICULA, 8, 8);
    g.destroy();
  }
}