import Phaser from 'phaser';
import {
  entrarComGoogle,
  observarLogin,
  sairDaConta,
  firebaseDisponivel,
  traduzirErro,
} from '../core/firebase.js';
import { carregarProgresso, salvarProgresso } from '../core/progresso.js';
import { OURO, PERGAMINHO } from '../constants.js';
import { garantirPerfil, ehAdmin } from '../core/usuarios.js';

export class LoginScene extends Phaser.Scene {
  constructor() {
    super('Login');
  }

  create() {
    const { width, height } = this.scale;
    const centroX = width / 2;

    this.cameras.main.setBackgroundColor('#14100c');

    // --- titulo ---
    this.add
      .text(centroX, height * 0.22, 'JOGO IMPERIAL', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: `${Math.min(56, width * 0.09)}px`,
        color: OURO,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    this.add
      .text(centroX, height * 0.22 + 42, 'o reino se constroi entre portais', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: PERGAMINHO,
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // --- aviso de Firebase ausente ---
    if (!firebaseDisponivel()) {
      this.add
        .text(
          centroX,
          height * 0.38,
          'Firebase nao configurado (.env.local ausente).\nRodando em modo local — sem login e sem sincronizar.',
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            color: '#e0b64a',
            align: 'center',
            lineSpacing: 4,
          },
        )
        .setOrigin(0.5);
    }

    // --- botoes ---
    this.botaoEntrar = firebaseDisponivel()
      ? this.criarBotao(centroX, height * 0.55, 'Entrar com Google', this.tentarGoogle.bind(this))
      : null;

    this.botaoLocal = this.criarBotao(
      centroX,
      firebaseDisponivel() ? height * 0.66 : height * 0.58,
      'Jogar sem conta',
      () => this.entrar({ uid: null, nome: 'Viajante', email: null }),
      {
        fill: 0x2a2018,
        hover: 0x3a2c20,
        textColor: PERGAMINHO,
      },
    );

    // --- rodape de sessao ---
    this.status = this.add
      .text(centroX, height * 0.82, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: PERGAMINHO,
        align: 'center',
        wordWrap: { width: width * 0.8 },
      })
      .setOrigin(0.5)
      .setAlpha(0.75);

    // ja estiver logado ao abrir o jogo
    this.cancelarObservacao = observarLogin(async (user) => {
      if (user) {
        this.status.setText(`Conectado como ${user.displayName ?? user.email}`);
        await this.entrar(user);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cancelarObservacao?.();
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this);
    });
  }

  relayout() {
    // Recalcula posicoes e reconstroi os botoes na nova largura.
    this.scene.restart();
  }

  criarBotao(x, y, texto, onClick, estilo = {}) {
    const {
      fill = 0xd4af6a,
      hover = 0xe6c47c,
      textColor = '#14100c',
    } = estilo;

    const largura = 260;
    const altura = 50;

    const caixa = this.add
      .rectangle(x, y, largura, altura, fill)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x8a6a2f)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x, y, texto, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: '600',
        color: textColor,
      })
      .setOrigin(0.5);

    caixa.on('pointerover', () => caixa.setFillStyle(hover));
    caixa.on('pointerout', () => caixa.setFillStyle(fill));
    caixa.on('pointerdown', onClick);

    caixa.setData('rotulo', label);
    return caixa;
  }

  async tentarGoogle() {
    this.botaoEntrar?.setFillStyle(0x8a6a2f);
    this.status.setText('Abrindo o login do Google...');

    try {
      const user = await entrarComGoogle();
      await this.entrar(user);
    } catch (erro) {
      console.error(erro);
      this.botaoEntrar?.setFillStyle(0xd4af6a);
      this.status.setText(traduzirErro(erro));
    }
  }

  /** Carrega/cria a progressao e vai para o mundo. */
  async entrar(user) {
    const uid = user?.uid ?? null;
    const nome = user?.displayName ?? 'Viajante';

    this.status.setText('Carregando seu reino...');

    let progresso = await carregarProgresso(uid);

    // Primeiro login: usa o nome do Google no primeiro salvamento.
    if (uid && (!progresso.nome || progresso.nome === 'Viajante')) {
      progresso = await salvarProgresso(uid, { nome });
    }

    if (user && !progresso.criadoEm) {
      progresso = await salvarProgresso(uid, {});
    }

    // Garante perfil com role + verifica admin
    let perfil = null;
    let isAdminUser = false;
    if (uid) {
      try {
        perfil = await garantirPerfil(user);
        isAdminUser = await ehAdmin(uid);
      } catch (e) {
        console.warn('[Login] nao foi possivel garantir perfil:', e);
      }
    }

    this.scene.start('World', {
      uid,
      nome,
      email: user?.email ?? null,
      podeSair: Boolean(uid),
      progresso,
      perfil,
      isAdmin: isAdminUser,
    });
  }
}