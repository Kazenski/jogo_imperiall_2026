import Phaser from 'phaser';
import { TEXTURAS } from './BootScene.js';
import {
  carregarProgresso,
  salvarProgresso,
  definirBaseVisivel,
  listarPortais,
  xpParaProximoNivel,
  calcularNivel,
} from '../core/progresso.js';
import { sairDaConta } from '../core/firebase.js';
import {
  LARGURA_MUNDO,
  ALTURA_MUNDO,
  VELOCIDADE,
  ARVORES_NO_MUNDO,
  OURO,
  PERGAMINHO,
} from '../constants.js';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.podeSair = dados?.podeSair ?? false;
    this.progresso = dados?.progresso ?? null;
    this.perfil = dados?.perfil ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
  }

  create() {
    const cam = this.cameras.main;

    // Workaround para o bug de mangling do Vite: ler as dimensoes em
    // variaveis locais antes de usar (ver README).

    this.teclado = this.input.keyboard.createCursorKeys();
    this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });

    cam.setBackgroundColor('#22331f');
    const largura = LARGURA_MUNDO;
    const altura = ALTURA_MUNDO;

    cam.setBounds(0, 0, largura, altura);
    cam.setRoundPixels(true);

    this.criarCeu();
    this.criarArvores();
    this.criarPortal();
    this.criarJogador();
    this.criarHud();
    this.criarDicaPortal();

    cam.startFollow(this.jogador, true, 0.12, 0.12);
    cam.setDeadzone(220, 140);

    this.atalhos();
  }

  // ---------- cenario ----------

  criarCeu() {
    // TileSprite cobre o mundo inteiro sem instanciar milhares de tiles.
    // A cada frame ele e reposicionado pelo scroll da camera.
    this.chao = this.add
      .tileSprite(0, 0, 800, 600, TEXTURAS.CHAO)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-10);
  }

  criarArvores() {
    this.arvores = this.physics.add.staticGroup();

    for (let i = 0; i < ARVORES_NO_MUNDO; i += 1) {
      const x = Phaser.Math.Between(60, LARGURA_MUNDO - 60);
      const y = Phaser.Math.Between(80, ALTURA_MUNDO - 40);

      // mantem a area do portal livre
      const distancia = Phaser.Math.Distance.Between(x, y, LARGURA_MUNDO / 2, ALTURA_MUNDO / 2);
      if (distancia < 200) continue;

      const arvore = this.add.image(x, y, TEXTURAS.ARVORE).setOrigin(0.5, 1).setDepth(y);
      this.physics.add.existing(arvore, true);
      this.arvores.add(arvore);
    }
  }

  criarPortal() {
    const x = LARGURA_MUNDO / 2;
    const y = ALTURA_MUNDO / 2;

    const brilho = this.add
      .circle(x, y - 14, 70, 0x7a4fd4, 0.12)
      .setDepth(y - 2);

    this.portal = this.add
      .image(x, y, TEXTURAS.PORTAL)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .setInteractive({ useHandCursor: true });

    // pulsacao
    this.tweens.add({
      targets: this.portal,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.tweens.add({
      targets: brilho,
      alpha: { from: 0.08, to: 0.26 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // particulas subindo do portal
    this.particulas = this.add.particles(x, y - 10, TEXTURAS.PARTICULA, {
      speedY: { min: -70, max: -25 },
      speedX: { min: -14, max: 14 },
      lifespan: 1800,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xc9a6ff,
      frequency: 110,
      quantity: 1,
    });
    this.particulas.setDepth(y - 1);

    this.portal.on('pointerdown', () => this.abrirPainelDePortais());

    this.portalAlvo = { x, y };
  }

  criarJogador() {
    this.jogador = this.physics.add.sprite(LARGURA_MUNDO / 2, ALTURA_MUNDO / 2 + 160, TEXTURAS.JOGADOR);
    this.jogador.setOrigin(0.5, 1);
    this.jogador.setDepth(this.jogador.y);
    this.jogador.setCollideWorldBounds(true);
    this.jogador.setDamping(true);
    this.jogador.setDrag(900, 900);

    this.physics.add.collider(this.jogador, this.arvores);

    this.teclas = {
      esquerda: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      direita: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      cima: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      baixo: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };
  }

  // ---------- interface ----------

  criarHud() {
    const p = this.progresso ?? { nivel: 1, xp: 0, nome: 'Viajante', base: { visivel: false } };
    const { nivel, xpNoNivel, faltam } = calcularNivel(p.xp ?? 0);

    this.add
      .rectangle(0, 0, 100000, 74, 0x14100c, 0.72)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.textoNome = this.add
      .text(18, 12, `${p.nome}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: OURO,
      })
      .setScrollFactor(0)
      .setDepth(1001);

    this.textoNivel = this.add
      .text(18, 38, `Nivel ${nivel}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: PERGAMINHO,
      })
      .setScrollFactor(0)
      .setDepth(1001);

    const larguraBarra = 220;
    const fundo = this.add.rectangle(150, 46, larguraBarra, 10, 0x000000, 0.5)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.barraXp = this.add.rectangle(152, 46, 0, 6, 0xd4af6a)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(1002);

    this.textoXp = this.add
      .text(150, 32, `${xpNoNivel}/${xpParaProximoNivel(nivel)} xp`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: PERGAMINHO,
      })
      .setScrollFactor(0)
      .setDepth(1002);

    this.textoAjuda = this.add
      .text(
        this.scale.width - 18,
        16,
        'WASD/setas: andar   E: portais   B: base visivel   ESC: sair' + (this.isAdmin ? '   F2: admin' : ''),
        { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: PERGAMINHO, align: 'right' },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0.7);

    this.toast = this.add
      .text(this.scale.width / 2, 96, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: OURO,
        backgroundColor: '#14100ccc',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1003)
      .setAlpha(0);

    this.atualizarBarraXp(xpNoNivel, faltam);
    fundo.setData('largura', larguraBarra);
  }

  criarDicaPortal() {
    this.dicaPortal = this.add
      .text(this.portalAlvo.x, this.portalAlvo.y - 92, '[E] Portais', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#e0b64a',
        backgroundColor: '#14100cb0',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(1000);
  }

  atualizarBarraXp(xpNoNivel, faltam) {
    const largura = 216;
    const pct = Phaser.Math.Clamp(xpNoNivel / Math.max(1, xpNoNivel + faltam), 0, 1);
    this.barraXp.width = largura * pct;
  }

  mostrarToast(mensagem, duracao = 2200) {
    this.toast.setText(mensagem).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: duracao, delay: 400 });
  }

  // ---------- acoes ----------

  atalhos() {
    this.input.keyboard.on('keydown-E', () => {
      const perto = Phaser.Math.Distance.Between(
        this.jogador.x, this.jogador.y, this.portalAlvo.x, this.portalAlvo.y,
      ) < 160;
      if (perto) this.abrirPainelDePortais();
      else this.mostrarToast('Aproxime-se do portal.');
    });

    this.input.keyboard.on('keydown-B', async () => {
      if (!this.uid) {
        this.mostrarToast('Entre com Google para expor sua base.');
        return;
      }
      const novoValor = !this.progresso?.base?.visivel;
      await definirBaseVisivel(this.uid, novoValor);
      this.progresso.base.visivel = novoValor;
      this.mostrarToast(novoValor ? 'Sua base agora e visivel para os amigos.' : 'Sua base foi ocultada.');
    });

    this.input.keyboard.on('keydown-ESC', async () => {
      if (!this.podeSair) return;
      await salvarProgresso(this.uid, { nome: this.progresso.nome });
      await sairDaConta();
      this.scene.start('Login');
    });

    this.input.keyboard.on('keydown-F2', () => {
      if (this.isAdmin) {
        if (this.scene.isActive('Admin')) {
          this.scene.stop('Admin');
          return;
        }
        this.scene.pause('World');
        this.scene.launch('Admin');
      }
    });
  }

  /** Lista os portais dos amigos. */
  async abrirPainelDePortais() {
    if (this.painel?.active) {
      this.painel.destroy(true);
      this.painel = null;
      return;
    }

    const { width, height } = this.scale;
    const portais = await listarPortais(this.uid);

    this.painel = this.add.container(0, 0).setDepth(2000);

    this.painel.add(
      this.add.rectangle(width / 2, height / 2, Math.min(520, width - 40), Math.min(380, height - 60), 0x14100c, 0.96)
        .setStrokeStyle(2, 0x8a6a2f),
    );

    this.painel.add(
      this.add.text(width / 2, height / 2 - Math.min(160, height / 2 - 40), 'PORTALIS', {
        fontFamily: 'Georgia, serif', fontSize: '26px', color: OURO,
      }).setOrigin(0.5),
    );

    if (!this.uid) {
      this.painel.add(this.add.text(width / 2, height / 2, 'Entre com Google para viajar.', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: PERGAMINHO,
      }).setOrigin(0.5));
      return;
    }

    if (!portais.length) {
      this.painel.add(this.add.text(
        width / 2, height / 2,
        'Nenhuma base visivel por enquanto.\nPeca para um amigo pressionar B na base dele.',
        { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: PERGAMINHO, align: 'center' },
      ).setOrigin(0.5));
      return;
    }

    let y = height / 2 - Math.min(110, 110);
    portais.slice(0, 6).forEach((p) => {
      const linha = this.add
        .text(width / 2, y, `${p.nomeBase}  —  ${p.nome} (nivel ${p.nivel})`, {
          fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: PERGAMINHO,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      linha.on('pointerover', () => linha.setColor(OURO));
      linha.on('pointerout', () => linha.setColor(PERGAMINHO));
      linha.on('pointerdown', () => this.viajarPara(p));

      this.painel.add(linha);
      y += 34;
    });
  }

  /** Placeholder da viagem: hoje so registra a visita. */
  async viajarPara(amigo) {
    this.painel?.destroy(true);
    this.painel = null;

    const stats = {
      ...(this.progresso.stats ?? {}),
      portaisUsados: (this.progresso.stats?.portaisUsados ?? 0) + 1,
    };

    this.progresso = await salvarProgresso(this.uid, { stats });
    this.mostrarToast(`Travelled para a base de ${amigo.nome}. (em construcao)`);
  }

  // ---------- loop ----------

  update() {
    const cam = this.cameras.main;

    // Workaround para o bug de mangling do Vite: ler as dimensoes em
    // variaveis locais antes de usar (ver README).

    // reposiciona o cenario conforme a camera
    this.chao.setSize(cam.width, cam.height);
    this.chao.setPosition(-cam.scrollX, -cam.scrollY);

    const t = this.teclas;
    let vx = 0;
    let vy = 0;
    if (t.esquerda.isDown || this.teclado.left.isDown) vx -= 1;
    if (t.direita.isDown || this.teclado.right.isDown) vx += 1;
    if (t.cima.isDown || this.teclado.up.isDown) vy -= 1;
    if (t.baixo.isDown || this.teclado.down.isDown) vy += 1;

    this.jogador.setVelocity(vx * VELOCIDADE, vy * VELOCIDADE);

    // ordena por profundidade (perspectiva simples)
    this.jogador.setDepth(this.jogador.y);

    // dica do portal aparece quando chega perto
    const perto = Phaser.Math.Distance.Between(
      this.jogador.x, this.jogador.y, this.portalAlvo.x, this.portalAlvo.y,
    ) < 160;
    this.dicaPortal.setAlpha(perto ? 1 : 0.25);
  }
}