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

    // === fluxo vertical dos botoes ===
    //
    // Tudo abaixo e posicionado a partir de UM `y` que avanca, em vez de
    // `height * 0.38`, `height * 0.55`, `height * 0.66` e `height * 0.82`.
    // Com quatro multiplos independentes nao ha garantia de nada: numa janela
    // baixa a mensagem de status — que e a unica coisa que explica um login que
    // falhou — batia no botao de baixo ou saia da tela, e o "ou" ficava colado
    // no botao de cima.
    const temFirebase = firebaseDisponivel();
    const larguraBotao = Math.min(320, Math.max(200, width - 56));
    const ALTO_GOOGLE = 54;
    const ALTO_LOCAL = 46;
    const VAO = 14;

    let y = Math.max(height * 0.44, 200);

    // --- aviso de Firebase ausente ---
    if (!temFirebase) {
      this.add
        .text(
          centroX,
          y,
          'Firebase nao configurado (.env.local ausente).\nRodando em modo local — sem login e sem sincronizar.',
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            color: '#e0b64a',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: larguraBotao },
          },
        )
        .setOrigin(0.5, 0);
      y += 48;
    }

    // --- sessao ja ativa ---
    //
    // `onAuthStateChanged` dispara na hora se o navegador ainda tem sessao, e o
    // jogo entra sozinho. Enquanto isso acontece, "Entrar com Google" e um
    // botao morto: clicar nele nao faz nada porque a cena ja esta indo embora.
    this.usuarioAtual = null;
    this.painelConectado = this.add
      .text(centroX, y, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: OURO,
        align: 'center',
        wordWrap: { width: larguraBotao },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    y += 26;

    // --- botao primario ---
    if (temFirebase) {
      this.botaoEntrar = botao(this, centroX, y, 'Entrar com Google', () => this.tentarGoogle(), {
        largura: larguraBotao,
        altura: ALTO_GOOGLE,
        raio: 12,
        tamanho: '16px',
        alinhamento: 'center',
      });
      y += ALTO_GOOGLE / 2 + VAO;

      this.add
        .text(centroX, y + 4, 'ou', {
          fontFamily: 'Georgia, serif',
          fontSize: '12px',
          color: PERGAMINHO,
        })
        .setOrigin(0.5)
        .setAlpha(0.5);
      y += VAO + 18;
    }

    // --- botao secundario ---
    this.botaoLocal = botao(
      this,
      centroX,
      y,
      'Jogar sem conta',
      () => {
        if (this.ocupado) return;
        this.marcarOcupado(true);
        this.avisarStatus('Carregando seu reino...');
        this.entrarUmaVez({ uid: null, displayName: 'Viajante', email: null }).catch(() => {
          this.marcarOcupado(false);
        });
      },
      {
        largura: larguraBotao,
        altura: ALTO_LOCAL,
        raio: 12,
        cor: 0x2a2018,
        corHover: 0x3a2c20,
        corBorda: 0x8a6a2f,
        corTexto: PERGAMINHO,
        tamanho: '16px',
        alinhamento: 'center',
      },
    );
    y += ALTO_LOCAL / 2 + 8;

    // --- rodape de sessao: COLADO nos botoes, nao a 82% da altura ---
    this.status = this.add
      .text(centroX, y + 14, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: PERGAMINHO,
        align: 'center',
        wordWrap: { width: larguraBotao },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.85);

    /**
     * Feedback de "ocupado" no proprio botao.
     *
     * O popup do Google demora alguns segundos para abrir. Sem mexer no botao,
     * o clique parecia perdido e o jogador clicava de novo, abrindo popups
     * empilhados. Aqui o rotulo muda e os dois botoes esmaecem.
     */
    this.marcarOcupado = (ocupado, rotulo = 'Entrar com Google') => {
      this.ocupado = ocupado;

      if (this.botaoEntrar) {
        this.botaoEntrar.setTexto(ocupado ? 'Abrindo o login...' : rotulo);
        this.botaoEntrar.definirVisual(ocupado ? 0x8a6a2f : 0xd4af6a);
        this.botaoEntrar.container.setAlpha(ocupado ? 0.65 : 1);
      }
      this.botaoLocal?.container.setAlpha(ocupado ? 0.65 : 1);
    };

    // ja estiver logado ao abrir o jogo
    //
    // `onAuthStateChanged` NAO aguarda callback async e NAO captura rejeicao.
    // O callback antigo era `async` e chamava `entrar()` direto: qualquer
    // falha ali virava "Uncaught (in promise)" — o jogador ficava parado
    // olhando a tela de login, sem mensagem nenhuma. Por isso o `catch`.
    this.cancelarObservacao = observarLogin((user) => {
      if (!user) return;

      this.usuarioAtual = user;
      this.painelConectado
        .setText(`Conectado como ${user.displayName ?? user.email}`)
        .setVisible(true);

      this.marcarOcupado(true);
      this.avisarStatus('Conectado. Carregando seu reino...');
      this.entrarUmaVez(user).catch(() => {
        this.marcarOcupado(false);
      });
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
      this.status?.setText(msg ?? '');
    } catch {
      /* a cena caiu entre o teste e a escrita: não há mais tela para avisar */
    }
  }

  relayout() {
    // Recalcula posicoes e reconstroi os botoes na nova largura.
    this.scene.restart();
  }

  /**
   * Entra no jogo **no maximo uma vez por usuario**.
   *
   * O login do Google chega aqui por DOIS caminhos ao mesmo tempo: o
   * `signInWithPopup` resolve e `tentarGoogle` chama `entrar`, mas o mesmo
   * sign-in tambem dispara `onAuthStateChanged`, cujo callback chama `entrar`
   * de novo. Sem esta trava, `entrar()` rodava duas vezes em paralelo: dois
   * `scene.start()` disputando a mesma cena, o dobro de escritas no Firestore,
   * e o status aparecendo e sumindo no meio do caminho.
   *
   * A promessa so e liberada se ela FALHAR — assim o jogador pode tentar de
   * novo. Se der certo, a cena esta saindo e nao importa mais.
   */
  entrarUmaVez(user) {
    const chave = user?.uid ?? '__local__';

    if (this.promessaEntrada && this.ultimoUid === chave) {
      return this.promessaEntrada;
    }

    this.ultimoUid = chave;
    this.promessaEntrada = this.entrar(user).catch((erro) => {
      this.promessaEntrada = null;
      this.ultimoUid = null;
      throw erro;
    });

    return this.promessaEntrada;
  }

  async tentarGoogle() {
    if (this.ocupado) return;

    // Sessao ja ativa: o `observarLogin` ja esta entrando. Abrir o popup aqui
    // seria um botao que "nao faz nada" — e era exatamente o que acontecia.
    if (this.usuarioAtual) {
      const nome = this.usuarioAtual.displayName ?? this.usuarioAtual.email;
      this.avisarStatus(`Voce ja esta conectado como ${nome}. Entrando...`);
      return;
    }

    this.marcarOcupado(true);
    this.avisarStatus('Abrindo o login do Google...');

    try {
      // Nao chama `entrar()` aqui de proposito: quem conduz a transicao e o
      // `observarLogin`, via `entrarUmaVez`. Se o popup falhar, ele nunca
      // dispara e o `catch` abaixo devolve a tela ao estado clicavel.
      const user = await entrarComGoogle();

      // Rede de seguranca: normalmente o `onAuthStateChanged` ja começou a
      // entrar enquanto o popup voltava. Se nao começou (evento consumido,
      // corrida entre os dois caminhos), a transicao assume aqui — senao a
      // tela ficaria presa em "Abrindo o login..." para sempre.
      if (!this.promessaEntrada) {
        this.usuarioAtual = user;
        this.painelConectado
          .setText(`Conectado como ${user.displayName ?? user.email}`)
          .setVisible(true);
        this.entrarUmaVez(user).catch(() => this.marcarOcupado(false));
      }
    } catch (erro) {
      console.error('[Login] falha no login do Google:', erro);
      this.marcarOcupado(false);
      this.avisarStatus(traduzirErro(erro));
    }
  }

  /**
   * Carrega/cria o progresso e decide por onde o jogador entra.
   *
   * A ordem das telas e uma REGRA, não preferência de layout:
   *
   *   Login -> Termos -> Lobby -> (Criacao se novo) -> Mundo
   *
   *  - Termos primeiro porque é o único momento em que o aceite precisa ser
   *    explícito. Depois de gravar a versão, o jogo não pergunta de novo até a
   *    próxima alteração do documento legal.
   *  - Lobby mostra até 10 personagens. Se não tem nenhum, vai para Criacao.
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
              this.irParaLobby({ ...contexto, estado: atualizado });
            },
          });
          return;
        }
      }

      // --- Lobby (ou Criacao se não tem personagens) ---
      this.irParaLobby({ ...contexto, estado: progresso });
    } catch (erro) {
      console.error('[Login] falha ao entrar:', erro);
      this.avisarStatus(
        `Nao foi possivel carregar seu reino: ${erro?.message ?? erro}\nTente de novo.`,
      );
      // Volta os botoes ao estado clicavel — sem isso a tela fica travada em
      // "Abrindo o login..." mesmo com o erro escrito logo abaixo.
      this.marcarOcupado(false);
    }
  }

  /** Direciona para Lobby ou Criacao conforme personagens existentes. */
  irParaLobby(contexto) {
    const { uid, perfil, progresso } = contexto;
    const temChars = perfil?.personagens?.length > 0;

    if (temChars) {
      this.scene.start('Lobby', {
        ...contexto,
        estado: progresso, // progresso do personagem ativo (compatibilidade)
      });
    } else {
      // Sem personagens -> direto para criação
      this.scene.start('Criacao', {
        ...contexto,
        estado: progresso,
        aoConcluir: (escolha) => this.paraCriacao(contexto, escolha),
      });
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

      // Após criar, volta pro Lobby para o jogador ver o novo herói na lista
      this.scene.start('Lobby', {
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