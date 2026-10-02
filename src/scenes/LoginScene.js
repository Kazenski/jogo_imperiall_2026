import Phaser from 'phaser';
import {
  entrarComGoogle,
  observarLogin,
  sairDaConta,
  firebaseDisponivel,
  traduzirErro,
} from '../core/firebase.js';
import { carregarProgresso, salvarProgresso } from '../core/progresso.js';
import { carregarCatalogo } from '../core/catalogo.js';
import { temConsentimento } from '../core/apagamento.js';
import { ACEITE_REQUERIDO } from '../dados/legal.js';
import { OURO, PERGAMINHO } from '../constants.js';
import { garantirPerfil, ehAdmin } from '../core/usuarios.js';
import { botao } from '../ui/comuns.js';

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
      ? botao(this, centroX, height * 0.55, 'Entrar com Google', this.tentarGoogle.bind(this), {
          largura: 280,
          altura: 52,
          raio: 12,
          tamanho: '16px',
        })
      : null;

    this.botaoLocal = botao(
      this,
      centroX,
      firebaseDisponivel() ? height * 0.66 : height * 0.58,
      'Jogar sem conta',
      () => this.entrar({ uid: null, displayName: 'Viajante', email: null }),
      {
        largura: 280,
        altura: 52,
        raio: 12,
        cor: 0x2a2018,
        corHover: 0x3a2c20,
        corBorda: 0x8a6a2f,
        corTexto: PERGAMINHO,
        tamanho: '16px',
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
        this.avisarStatus(`Conectado como ${user.displayName ?? user.email}`);
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

  /**
   * Escreve na linha de status **sem rebentar** se a cena já morreu.
   *
   * `entrar()` termina com `scene.start('Criacao')`, e é a `CriacaoScene` que
   * chama `paraCriacao()` de volta quando o jogador confirma. A essa altura a
   * cena de Login já foi derrubada: os `Text` dela têm o canvas destruído, e
   * qualquer `setText` posterior estoura com
   *
   *   TypeError: Cannot read properties of null (reading 'drawImage')
   *   at Frame.updateUVs ... at Text.setText
   *
   * — o que derrubava a transição inteira e deixava o jogador sem cena
   * nenhuma na tela, sem mensagem. O objeto continua no JavaScript (o GC não
   * passou por ele), então `this.status?.setText` não acusaria nada; só
   * `sys.isActive()` diz a verdade.
   */
  avisarStatus(msg) {
    if (!this.sys?.isActive()) return;
    try {
      this.avisarStatus(msg);
    } catch {
      /* a cena caiu entre o teste e a escrita: não há mais tela para avisar */
    }
  }

  relayout() {
    // Recalcula posicoes e reconstroi os botoes na nova largura.
    this.scene.restart();
  }

  async tentarGoogle() {
    this.botaoEntrar?.definirVisual(0x8a6a2f);
    this.avisarStatus('Abrindo o login do Google...');

    try {
      const user = await entrarComGoogle();
      await this.entrar(user);
    } catch (erro) {
      console.error(erro);
      this.botaoEntrar?.definirVisual(0xd4af6a);
      this.avisarStatus(traduzirErro(erro));
    }
  }

  /**
   * Carrega/cria o progresso e decide por onde o jogador entra.
   *
   * A ordem das telas e uma REGRA, não preferência de layout:
   *
   *   Login -> Termos -> Criação do personagem -> Mundo
   *
   *  - Termos primeiro porque é o único momento em que o aceite precisa ser
   *    explícito. Depois de gravar a versão, o jogo não pergunta de novo até a
   *    próxima alteração do documento legal.
   *  - Criação antes do Mundo porque o mundo gera monstros em volta do ponto de
   *    entrada: sem personagem definido, o jogador aparecia no meio deles.
   *
   * Sem conta (modo local) os termos não são exigidos: não há dado pessoal
   * para consentir, e travar o jogo local seria pior do que a proteção.
   */
  async entrar(user) {
    const uid = user?.uid ?? null;
    const nome = user?.displayName ?? 'Viajante';

    this.avisarStatus('Carregando seu reino...');

    try {
      // O catálogo é carregado AQUI, uma vez, e viaja no `contexto` para todas
      // as cenas seguintes.
      //
      // Antes ele era carregado só no fim de `paraCriacao`, o que significava
      // que a `CriacaoScene` recebia `catalogo: undefined` — e o seletor de
      // vocação aparecia com "Nenhuma vocação cadastrada pelo administrador"
      // mesmo com quatro classes na semente. Carregar tarde demais não é o
      // mesmo que não carregar: os dados existiam, só não tinham chegado.
      const catalogo = await carregarCatalogo();

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

      const contexto = {
        uid,
        nome,
        email: user?.email ?? null,
        podeSair: Boolean(uid),
        progresso,
        perfil,
        isAdmin: isAdminUser,
        catalogo,
      };

      // --- Termos ---
      if (uid) {
        const aceitou = await temConsentimento(uid, ACEITE_REQUERIDO.versao);
        if (!aceitou) {
          this.avisarStatus('');
          this.scene.start('Termos', {
            ...contexto,
            estado: progresso,
            aoAceitar: async (aceite) => {
              const atualizado = await salvarProgresso(uid, {
                termos: { versao: aceite.versao, data: aceite.data, aceitoEm: Date.now() },
              });
              this.scene.start('Criacao', {
                ...contexto,
                estado: atualizado,
                aoConcluir: (escolha) => this.paraCriacao(contexto, escolha),
              });
            },
          });
          return;
        }
      }

      // --- Criação de personagem ---
      this.scene.start('Criacao', {
        ...contexto,
        estado: progresso,
        aoConcluir: (escolha) => this.paraCriacao(contexto, escolha),
      });
    } catch (erro) {
      // Sem isto, uma falha aqui deixa o jogador preso na tela de login sem
      // nenhuma explicacao — parecia "o jogo me deslogou".
      console.error('[Login] falha ao entrar:', erro);
      this.avisarStatus(
        `Nao foi possivel carregar seu reino: ${erro?.message ?? erro}\nTente de novo.`,
      );
      if (this.botaoEntrar) this.botaoEntrar.definirVisual(0xd4af6a);
    }
  }

  /** Grava nome/raça/vocação e só então inicia o mundo. */
  async paraCriacao(contexto, escolha) {
    const { uid, progresso } = contexto;

    // `null` = cancelou a edição de um personagem existente.
    if (!escolha) {
      this.scene.start('World', {
        uid,
        nome: progresso.nome,
        email: contexto.email,
        podeSair: contexto.podeSair,
        estado: progresso,
        catalogo: contexto.catalogo,
        perfil: contexto.perfil,
        isAdmin: contexto.isAdmin,
      });
      return;
    }

    this.avisarStatus('Forjando seu personagem...');
    try {
      let estado = await salvarProgresso(uid, {
        nome: escolha.nome,
        racaId: escolha.racaId,
        vocacaoId: escolha.vocacaoId,
        // Marca que a criação terminou. Sem isto, `CriacaoScene` reabriria em
        // modo edição para quem só entrou para olhar a tela.
        personagemCriadoEm: Date.now(),
      });

      this.scene.start('World', {
        uid,
        nome: escolha.nome,
        email: contexto.email,
        podeSair: contexto.podeSair,
        estado,
        catalogo: contexto.catalogo,
        perfil: contexto.perfil,
        isAdmin: contexto.isAdmin,
      });
    } catch (erro) {
      console.error('[Login] falha ao criar personagem:', erro);
      this.avisarStatus(`Nao foi possivel criar o personagem: ${erro?.message ?? erro}`);
    }
  }
}