import Phaser from 'phaser';

// Gera as texturas do jogo proceduralmente.
// Isso evita depender de arquivos de imagem: o jogo ja abre e da para jogar.
// Substitua por sprites reais quando quiser (mesmos nomes de textura).

export const TEXTURAS = {
  JOGADOR: 'jogador',
  CHAO: 'chao',
  CHAO_ETREO: 'chao_etreo',
  CHAO_CAVERNA: 'chao_caverna',
  ARVORE: 'arvore',
  PORTAL: 'portal',
  PARTICULA: 'particula',
  MONSTRO: 'monstro',
  BLOCO: 'bloco',
  ORBE: 'orbe',
  FERRAMENTA: 'ferramenta',
  MAQUINA: 'maquina',
  EQUIPAVEL: 'equipavel',
  PAINEL: 'painel',
  BARRA_VIDA: 'barra_vida',
  BARRA_PODER: 'barra_poder',
  SLICE: 'slice',
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.criarTexturaJogador();
    this.criarTexturaChao();
    this.criarTexturaChaoEtreo();
    this.criarTexturaChaoCaverna();
    this.criarTexturaArvore();
    this.criarTexturaPortal();
    this.criarTexturaParticula();
    this.criarTexturaBloco();
    this.criarTexturaMonstro();
    this.criarTexturaOrbe();
    this.criarTexturaFerramenta();
    this.criarTexturaMaquina();
    this.criarTexturaEquipavel();
    this.criarTexturaPainel();
    this.criarTexturaBarras();
    this.criarTexturaSlice();

    this.scene.start('Login');
  }

  /** Um "capataz" medieval simples: corpo, cabeca e capa. */
  criarTexturaJogador() {
    const g = this.make.graphics({ add: false });

    g.fillStyle(0x8c2f2f, 1); // capa
    g.fillRect(6, 14, 12, 12);
    g.fillStyle(0x4a5d3a, 1); // torso
    g.fillRect(8, 12, 8, 12);
    g.fillStyle(0xe8c39e, 1); // cabeca
    g.fillRect(9, 4, 6, 7);
    g.fillStyle(0x9aa2ab, 1); // elmo
    g.fillRect(8, 2, 8, 4);
    g.fillStyle(0x1a1410, 1); // olhos
    g.fillRect(10, 6, 2, 2);
    g.fillStyle(0x6b4a1f, 1); // cinto
    g.fillRect(8, 21, 8, 2);

    g.generateTexture(TEXTURAS.JOGADOR, 24, 26);
    g.destroy();
  }

  criarTexturaChao() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x3f5d33, 1);
    g.fillRect(0, 0, 32, 32);
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

  criarTexturaChaoEtreo() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x2c2140, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3a2b56, 1);
    g.fillRect(3, 5, 4, 3);
    g.fillRect(20, 12, 5, 3);
    g.fillStyle(0x4a3570, 1);
    g.fillRect(9, 24, 6, 2);
    g.fillStyle(0x6a4fa0, 1);
    g.fillRect(25, 2, 3, 3);
    g.generateTexture(TEXTURAS.CHAO_ETREO, 32, 32);
    g.destroy();
  }

  criarTexturaChaoCaverna() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x2e2620, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x3d332a, 1);
    g.fillRect(4, 3, 6, 4);
    g.fillRect(19, 16, 7, 5);
    g.fillStyle(0x241d18, 1);
    g.fillRect(11, 26, 8, 3);
    g.generateTexture(TEXTURAS.CHAO_CAVERNA, 32, 32);
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

  /** Bloco 32x32 com "cara" de pedra/madeira: base + borda + textura. */
  criarTexturaBloco() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 32, 32);
    // sombreado interno (o tinte do item entra por cima)
    g.fillStyle(0x000000, 0.18);
    g.fillRect(0, 0, 32, 2);
    g.fillRect(0, 30, 32, 2);
    g.fillRect(0, 0, 2, 32);
    g.fillRect(30, 0, 2, 32);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(2, 2, 28, 2);
    g.fillRect(2, 2, 2, 28);
    // granulado
    g.fillStyle(0x000000, 0.1);
    g.fillRect(8, 8, 3, 3);
    g.fillRect(20, 14, 4, 3);
    g.fillRect(13, 22, 3, 3);
    g.fillRect(24, 6, 2, 2);
    g.generateTexture(TEXTURAS.BLOCO, 32, 32);
    g.destroy();
  }

  /** Silhueta de monstro: corpo, chifres, olhos. O tinte vem do catalogo. */
  criarTexturaMonstro() {
    const g = this.make.graphics({ add: false });
    // sombra
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(16, 28, 20, 6);
    // pernas
    g.fillStyle(0xffffff, 1);
    g.fillRect(8, 20, 5, 8);
    g.fillRect(19, 20, 5, 8);
    // corpo
    g.fillEllipse(16, 18, 20, 16);
    // cabeca
    g.fillCircle(16, 8, 8);
    // chifres
    g.fillTriangle(10, 4, 8, 0, 13, 5);
    g.fillTriangle(22, 4, 24, 0, 19, 5);
    // olhos
    g.fillStyle(0xff3b30, 1);
    g.fillRect(12, 7, 3, 3);
    g.fillRect(18, 7, 3, 3);
    g.generateTexture(TEXTURAS.MONSTRO, 32, 30);
    g.destroy();
  }

  /** Orbe: esfera com brilho. */
  criarTexturaOrbe() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 12, 11);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(9, 9, 4);
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(16, 17, 5);
    g.generateTexture(TEXTURAS.ORBE, 24, 24);
    g.destroy();
  }

  /** Ferramentas: picareta (cabo + cabeca) e machado. */
  criarTexturaFerramenta() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(14, 10, 3, 14); // cabo
    g.fillTriangle(6, 4, 26, 4, 20, 12); // cabeca de picareta
    g.generateTexture(TEXTURAS.FERRAMENTA, 32, 26);
    g.destroy();
  }

  /** Maquina: base, coluna e engrenagem. */
  criarTexturaMaquina() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 20, 28, 6); // base
    g.fillRect(4, 8, 24, 12); // corpo
    g.fillRect(6, 0, 20, 8); // topo
    g.fillStyle(0x000000, 0.28);
    g.fillRect(6, 0, 20, 2);
    g.generateTexture(TEXTURAS.MAQUINA, 32, 26);
    g.destroy();
  }

  /** Equipavel: icone generico em formato de tunicas. */
  criarTexturaEquipavel() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(6, 2, 16, 10, 26, 2);
    g.fillRect(8, 8, 16, 16);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(15, 10, 2, 14);
    g.generateTexture(TEXTURAS.EQUIPAVEL, 32, 26);
    g.destroy();
  }

  /** Painel de fundo com moldura: 9-slice para poder esticar. */
  criarTexturaPainel() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x14100c, 1);
    g.fillRect(0, 0, 48, 48);
    g.lineStyle(2, 0x8a6a2f, 1);
    g.strokeRect(1, 1, 46, 46);
    g.lineStyle(1, 0xd4af6a, 0.4);
    g.strokeRect(4, 4, 40, 40);
    // cantoneiras
    g.fillStyle(0xd4af6a, 1);
    g.fillRect(2, 2, 5, 2);
    g.fillRect(2, 2, 2, 5);
    g.fillRect(41, 2, 5, 2);
    g.fillRect(44, 2, 2, 5);
    g.fillRect(2, 44, 5, 2);
    g.fillRect(2, 41, 2, 5);
    g.fillRect(41, 44, 5, 2);
    g.fillRect(44, 41, 2, 5);
    g.generateTexture(TEXTURAS.PAINEL, 48, 48);
    g.destroy();
  }

  /** Fundo de barra (vida/poder), 32x8, esticavel. */
  criarTexturaBarras() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x1a1410, 1);
    g.fillRect(0, 0, 32, 8);
    g.lineStyle(1, 0x000000, 0.6);
    g.strokeRect(0, 0, 32, 8);
    g.generateTexture(TEXTURAS.BARRA_VIDA, 32, 8);
    g.destroy();
  }

  /** Circulo usado no slice da barra (para dar borda arredondada). */
  criarTexturaSlice() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture(TEXTURAS.SLICE, 16, 16);
    g.destroy();
  }
}
