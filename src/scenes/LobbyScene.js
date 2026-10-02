import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import {
  painel as uiPainel,
  botao,
  texto as uiTexto,
  titulo as uiTitulo,
  caixaArredondada,
  aoTeclar,
} from '../ui/comuns.js';
import { TEXTURAS } from './BootScene.js';
import {
  MAX_PERSONAGENS,
  DIAS_CARENCIA_EXCLUSAO,
  calcularNivel,
  carregarPerfilJogador,
  carregarPersonagem,
  criarPersonagem,
  salvarPersonagem,
  definirPersonagemAtivo,
  agendarExclusao,
  cancelarExclusao,
  purgarExclusoesExpiradas,
  diasRestantesExclusao,
  personagemJogavel,
} from '../core/progresso.js';
import { VERSAO_EXIBIDA } from '../dados/versao.js';

// =====================================================================
// LobbyScene — o salão de seleção. É o ÚNICO destino depois do login.
//
// Antes esta cena existia mas não estava ligada a nada: os quatro caminhos que
// o jogador podia tomar nela (entrar, criar, editar, apagar) ou chamavam um
// callback que ninguém passava, ou reiniciavam a cena sem gravar. O lobby era
// uma vitrine, não um hub.
//
// Regras desta cena:
//
//  1. Clicar no herói abre confirmação antes de entrar no mundo. Entrar no
//     mundo assume que a pessoa vai jogar, então o clique precisa ser confirmado
//     — e a confirmação mostra de qual herói ela é.
//  2. A exclusão tem carência de 30 dias. Ela é AGENDADA, não executada, e
//     durante a janela o herói fica congelado e pode ser resgatado.
//  3. Criar e editar gravam de verdade. `CriacaoScene` só entrega o formulário
//     preenchido — quem grava é quem chamou.
//
// Um clique do Phaser chega em TODOS os objetos sob o ponteiro — e a ordem é a
// de INSERÇÃO na lista de input da cena, não a de profundidade nem a de
// desenho. `InputManager.hitTest` (phaser.esm.js:103825) só empurra os
// candidatos na ordem em que os encontra; `InputPlugin.sortGameObjects` existe,
// mas roda em `processOverEvents`, não em `processDownEvents`.
//
// Medido em runtime nesta tela: o clique num botão de modal encontra
// [slot(113), capa(153), botão(160)] na renderList — o slot PRIMEIRO. E o
// primeiro que chama `stopPropagation()` cancela o resto
// (`_eventData.cancelled` → `break`). Ou seja: quem grita primeiro vence, e
// `stopPropagation` aqui só serve para o objeto que mora mais fundo no input
// list matar os que estão na frente.
//
// Por isso o conteúdo do lobby é DESABILITADO enquanto há modal
// (`input.enabled = false`), em vez de tentar arbitrar a ordem. Desligar o
// input do que está atrás é a única correção que não depende de sorte.
// =====================================================================

const VAO = 14;
/** Proporções internas do cartão. Tudo é fração da altura, para o cartão
 *  poder ser redimensionado pela grade sem virar uma lista de constantes
 *  quebradas em telas diferentes. */
// Os `Y` são frações da ALTURA e os botões são ancorados pelo TOPO
// (`origem: [0.5, 0]`). As frações estão fechadas para que a pilha termine
// dentro do cartão:
//
//   corpo      0.700 -> 168      zona de clique, para acima dos botões
//   ENTRAR     0.720 -> 172.8    +0.1167 (28/240) = 201
//   EDITAR     0.845 -> 202.8    +0.1167 = 231     sobra 9px
const P = {
  retratoY: 0.19,
  retratoFraçãoLargura: 0.44,
  retratoFraçãoAltura: 0.3,
  nomeY: 0.375,
  subY: 0.462,
  nivelY: 0.528,
  rodapeY: 0.61,
  /** Topo do botão de entrar. */
  entrarY: 0.72,
  /** Topo da linha de botões secundários. */
  secundarioY: 0.845,
  /** A zona de clique do cartão para acima daqui, para não invadir os botões. */
  corpo: 0.7,
  /** Altura do botão como fração da altura do cartão. */
  botao: 0.1167,
};

const NOME_RACA = {
  humano: 'Humano do Norte',
  anao: 'Anão da Forja',
  elfo: 'Elfo do Véu',
  orc: 'Orc do Sul',
};
const GLIFO_RACA = { humano: '👤', anao: '⛏️', elfo: '🏹', orc: '⚔️' };

const BORDA_SLOT = 0x7a4fd4;
const BORDA_SLOT_HOVER = 0xa87ef0;
const BORDA_CONGELADO = 0x8a3a33;
const BORDA_CONGELADO_HOVER = 0xb05a50;

/**
 * Repinta um cartão.
 *
 * Precisa redesenhar e não pode usar `setStrokeStyle` direto: o retorno de
 * `caixaArredondada` é um **Container** (ele só carrega `.caixa` com o
 * `Graphics`), então `bg.setStrokeStyle(...)` — como fazia o código antigo —
 * estoura `TypeError: bg.setStrokeStyle is not a function` no primeiro hover,
 * derrubando o handler de input do slot. E mesmo no `Graphics`, `setStrokeStyle`
 * só muda o estilo para os *próximos* comandos: ele não redesenha nada.
 */
function pintarCartao(g, largura, altura, { preenchimento, borda, larguraBorda = 2, raio = 8 }) {
  g.clear();
  g.fillStyle(preenchimento, 1);
  g.fillRoundedRect(0, 0, largura, altura, raio);
  g.lineStyle(larguraBorda, borda, 1);
  g.strokeRoundedRect(0, 0, largura, altura, raio);
}

/**
 * Melhor grade para `total` cartões dentro de `largura` × `altura`.
 *
 * Antes as posições eram calculadas com `MAX_CHARS` fixo e o grid transbordava
 * do painel em telas baixas — 10 cartões de 220px em 4 colunas precisam de 944px
 * e o painel dava 650. Aqui a grade é escolhida pelo que CABE, e sobra de
 * espaço é distribuído como folga.
 */
function calcularGrade(largura, altura, total) {
  let melhor = null;
  for (let cols = 1; cols <= total; cols++) {
    const linhas = Math.ceil(total / cols);
    const larguraCelula = Math.floor((largura - VAO * (cols - 1)) / cols);
    const alturaCelula = Math.floor((altura - VAO * (linhas - 1)) / linhas);
    if (larguraCelula < 118 || alturaCelula < 168) continue;

    // Mantém a proporção do cartão e sobra o resto como folga.
    const larguraCartao = Math.min(larguraCelula, Math.floor(alturaCelula * 0.8));
    const alturaCartao = Math.min(alturaCelula, Math.floor(larguraCartao / 0.8));

    const area = larguraCartao * alturaCartao;
    if (!melhor || area > melhor.area || (area === melhor.area && linhas < melhor.linhas)) {
      melhor = { cols, linhas, largura: larguraCartao, altura: alturaCartao, area };
    }
  }

  // Nenhuma grade cabível: uma coluna estreita é melhor que nada invisível.
  return melhor ?? { cols: 1, linhas: total, largura: Math.min(180, largura), altura, area: 0 };
}

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.perfil = dados?.perfil ?? null;
    this.catalogo = dados?.catalogo ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
    this.email = dados?.email ?? null;
    this.podeSair = dados?.podeSair ?? Boolean(this.uid);
    // Mensagem atravessando um `scene.start()`/`restart()`: o `Text` da cena
    // anterior morre junto com ela, então avisar antes de trocar de cena não
    // chega a lugar nenhum. O texto viaja nos dados.
    this.aviso = dados?.aviso ?? null;
    this.avisoErro = dados?.avisoErro ?? false;

    // Trava de reentrada. `agendarExclusao`/`criarPersonagem` fazem I/O; sem
    // isto, dois cliques rápidos no mesmo botão disparam duas escritas e a
    // segunda termina depois, sobrescrevendo a primeira.
    // Objetos interativos PRÓPRIOS desta cena (cartões e botões de fora dos
    // modais). É este conjunto que se desliga quando um modal abre — o
    // comentário do topo explica por que não dá para resolver por ordem.
    this.interativos = new Set();

    this.ocupado = false;
    this.modal = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0805');

    this.criarBackground();

    this.raiz = this.add.container(0, 0);

    // Overlay escurece o fundo. NÃO é interativo: interativo, ele receberia o
    // `pointerdown` de todo clique da tela e pagaria um `hitTest` inútil.
    this.raiz.add(this.add.rectangle(0, 0, 4000, 4000, 0x000000, 0.65).setOrigin(0));

    const { width, height } = this.scale;
    const panelW = Math.min(1240, width - 40);
    const panelH = Math.min(780, height - 40);
    const x0 = (width - panelW) / 2;
    const y0 = (height - panelH) / 2;

    this.raiz.add(uiPainel(this, x0, y0, panelW, panelH, 0x120d08, 0.95));

    this.raiz.add(uiTitulo(this, x0 + 24, y0 + 18, 'SALÃO DOS HERÓIS', '22px'));

    const usados = this.perfil?.personagens?.length ?? 0;
    const contaTxt = this.uid
      ? `${this.perfil?.nome ?? this.perfil?.email ?? 'Jogador'} · ${usados}/${MAX_PERSONAGENS} heróis`
      : `Modo local — salvo neste navegador · ${usados}/${MAX_PERSONAGENS} heróis`;

    this.raiz.add(
      uiTexto(this, x0 + 24, y0 + 52, contaTxt, { fontSize: '11px', color: PERGAMINHO })
        .setAlpha(0.7)
        .setOrigin(0, 0),
    );

    if (!this.uid) {
      // `origem: [1, 0]` ancora o botao pelo canto superior direito.
      // Nao use `.setOrigin(1, 0)` no container: a origem de um Container
      // desloca a posicao de TODOS os filhos, o que empurraria o botao por
      // cima da propria largura/altura.
      const voltar = botao(this, x0 + panelW - 24, y0 + 24, 'Voltar ao Login [ESC]', () => this.voltarLogin(), {
        largura: 180,
        altura: 32,
        tamanho: '11px',
        cor: 0x3a2c20,
        corHover: 0x4a3828,
        corTexto: PERGAMINHO,
        origem: [1, 0],
      });
      this.raiz.add(voltar.container);
      this.registrarInterativo(voltar.clique);
    }

    this.mensagem = uiTexto(this, x0 + 24, y0 + panelH - 92, this.aviso ?? '', {
      fontSize: '11px',
      color: this.avisoErro ? '#e08a80' : OURO,
      wordWrap: { width: panelW - 60 },
    })
      .setOrigin(0, 0)
      .setAlpha(this.aviso ? 1 : 0);
    this.raiz.add(this.mensagem);
    // Não passa por `avisar()`: dentro de `create()` o `sys.isActive()` ainda
    // é falso (o status vira RUNNING depois), e o guarda de `avisar()` engoliria
    // a mensagem que acabou de chegar nos dados da cena.

    // A coluna do changelog só existe se sobrar largura. Em tela estreita ela
    // comia um terço do painel e deixava a grade dos heróis inutilizável.
    const larguraChangelog = width >= 1000 ? 256 : 0;
    const slotsX = x0 + 24;
    const slotsY = y0 + 84;
    const slotsW = panelW - 48 - (larguraChangelog ? larguraChangelog + 24 : 0);
    this.criarSlots(slotsX, slotsY, slotsW, panelH - 186);

    if (larguraChangelog) {
      this.criarChangelog(x0 + panelW - larguraChangelog - 24, y0 + 84, larguraChangelog, panelH - 186);
    }

    const novo = botao(this, x0 + panelW / 2, y0 + panelH - 42, '+ NOVO HERÓI', () => this.novoPersonagem(), {
      largura: 220,
      altura: 40,
      tamanho: '14px',
      cor: 0x8a6a2f,
      corHover: 0x9a7a3f,
      corTexto: PERGAMINHO,
    });
    this.raiz.add(novo.container);
    this.registrarInterativo(novo.clique);

    aoTeclar(this, 'ESC', () => {
      if (this.modal) return;
      this.voltarLogin();
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.aoRedimensionar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.aoRedimensionar, this);
      // Solta o `Text` morto: `avisar()` ainda pode ser chamado por um `await`
      // que resolve depois da parada, e um `Text` sem canvas é uma armadilha.
      this.mensagem = null;
      this.pararBackground();
    });

    this.aplicarCarencias();
  }

  /**
   * Aplica as exclusões que venceram e redesenha se alguma caiu.
   *
   * Rodar isto é o que dá efeito à carência: sem uma leitura do perfil depois
   * do vencimento, "excluir em 30 dias" seria só um rótulo e o herói congelado
   * ficaria ali para sempre. É deliberately assíncrono e fora do caminho do
   * desenho: a tela aparece na hora e se corrige quando a resposta chega.
   */
  async aplicarCarencias() {
    try {
      const removidos = await purgarExclusoesExpiradas(this.uid);
      if (!removidos.length) return;
      // A cena pode ter sido encerrada enquanto a rede respondia.
      if (!this.sys.isActive()) return;

      const quantos = removidos.length;
      this.scene.restart(
        this.dadosParaLobby({
          aviso: `${quantos} ${quantos === 1 ? 'herói venceu' : 'heróis venceram'} a carência de ${DIAS_CARENCIA_EXCLUSAO} dias e ${quantos === 1 ? 'foi removido' : 'foram removidos'} de vez.`,
        }),
      );
    } catch (erro) {
      console.warn('[Lobby] não foi possível aplicar as carências:', erro);
    }
  }

  aoRedimensionar() {
    // `restart()` sem dados limpa o `init` e a cena volta com `perfil = null`,
    // ou seja, a lista vazia. Tem que repassar os dados.
    this.scene.restart(this.dadosParaLobby());
  }

  // =====================================================================
  // Background animado (parallax com imagens procedurais)
  // =====================================================================

  criarBackground() {
    const { width, height } = this.scale;
    this.bgLayers = [];

    const chao = this.add.tileSprite(0, 0, width, height, TEXTURAS.CHAO)
      .setOrigin(0, 0)
      .setDepth(-100)
      .setTint(0x1a1410)
      .setAlpha(0.8);
    this.bgLayers.push({ obj: chao, speedX: 0.02, speedY: 0.01 });

    const neblina = this.add.graphics().setDepth(-90);
    this.desenharNeblina(neblina, width, height);
    this.bgLayers.push({ obj: neblina, speedX: 0.005, speedY: 0.003, redraw: true });

    this.runas = [];
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = this.add
        .text(x, y, '◆', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${Phaser.Math.Between(16, 32)}px`,
          color: '#7a4fd4',
        })
        .setAlpha(0.15)
        .setDepth(-80)
        .setOrigin(0.5);
      this.runas.push({ obj: r, vx: Phaser.Math.FloatBetween(-0.02, 0.02), vy: Phaser.Math.FloatBetween(-0.03, -0.01) });
    }
  }

  desenharNeblina(g, w, h) {
    g.clear();
    g.fillStyle(0x1a1028, 0.08);
    for (let i = 0; i < 6; i++) {
      const x = (this.neblinaOffsetX ?? 0) + i * 300;
      const y = (this.neblinaOffsetY ?? 0) + i * 150;
      g.fillEllipse((x % (w + 200)) - 100, (y % (h + 200)) - 100, 400, 200);
    }
  }

  update(time, delta) {
    if (!this.bgLayers) return;

    for (const layer of this.bgLayers) {
      if (layer.obj.tilePosition) {
        layer.obj.tilePositionX += layer.speedX * delta;
        layer.obj.tilePositionY += layer.speedY * delta;
      } else if (layer.redraw && layer.obj.clear) {
        this.neblinaOffsetX = (this.neblinaOffsetX ?? 0) + layer.speedX * delta;
        this.neblinaOffsetY = (this.neblinaOffsetY ?? 0) + layer.speedY * delta;
        this.desenharNeblina(layer.obj, this.scale.width, this.scale.height);
      }
    }

    for (const r of this.runas) {
      r.obj.x += r.vx * delta;
      r.obj.y += r.vy * delta;
      if (r.obj.y < -50) {
        r.obj.y = this.scale.height + 50;
        r.obj.x = Phaser.Math.Between(0, this.scale.width);
      }
      if (r.obj.x < -50) r.obj.x = this.scale.width + 50;
      if (r.obj.x > this.scale.width + 50) r.obj.x = -50;
    }
  }

  pararBackground() {
    this.bgLayers = null;
    this.runas = null;
  }

  // =====================================================================
  // Grade de slots
  // =====================================================================

  criarSlots(x, y, w, h) {
    const personagens = this.perfil?.personagens ?? [];
    // Mostra só os heróis que EXISTEM. Antes a grade era sempre MAX_PERSONAGENS:
    // com 0 criados apareciam 10 cartões "+" e o CRUD parecia inutilizável;
    // e com o perfil nulo (garantirPerfil retornava undefined) a lista gravada
    // no Firebase nunca aparecia — só sobravam os "+".
    const total = Math.max(1, personagens.length);
    const grade = calcularGrade(w, h, total);

    // Altura do botão como fração da altura do cartão, com piso e teto: abaixo
    // de 22px o texto de 10px não cabe, e o teto evita botão gigante num cartão
    // alto (grade de 2 linhas).
    this.alturaBotao = Math.round(Math.min(30, Math.max(22, grade.altura * P.botao)));

    this.raiz.add(
      caixaArredondada(this, x - 8, y - 8, w + 16, h + 16, {
        raio: 10,
        preenchimento: 0x0d0a07,
        borda: 0x3a2c20,
        larguraBorda: 1,
        origem: [0, 0],
      }),
    );

    // Centraliza a grade no espaço disponível, em vez de colar na esquerda:
    // com o cartão proporcional sobra largura, e sobra colada na esquerda
    // deixa a lista torta.
    const larguraGrade = grade.cols * grade.largura + VAO * (grade.cols - 1);
    const alturaGrade = grade.linhas * grade.altura + VAO * (grade.linhas - 1);
    const origemX = x + Math.max(0, (w - larguraGrade) / 2);
    const origemY = y + Math.max(0, (h - alturaGrade) / 2);

    if (personagens.length === 0) {
      this.raiz.add(
        uiTexto(this, x + w / 2, y + h / 2 - 14, 'Nenhum herói no salão ainda.\nUse "+ NOVO HERÓI" para forjar o primeiro.', {
          fontSize: '13px',
          color: PERGAMINHO,
          align: 'center',
        })
          .setOrigin(0.5, 0)
          .setAlpha(0.7),
      );
      return;
    }

    for (let i = 0; i < personagens.length; i++) {
      const linha = Math.floor(i / grade.cols);
      const coluna = i % grade.cols;
      const cx = origemX + coluna * (grade.largura + VAO);
      const cy = origemY + linha * (grade.altura + VAO);
      const char = personagens[i];

      this.criarSlotOcupado(char, cx, cy, grade.largura, grade.altura);
    }
  }

  criarSlotOcupado(char, x, y, largura, altura) {
    const congelado = !personagemJogavel(char);
    const borda = congelado ? BORDA_CONGELADO : BORDA_SLOT;
    const bordaHover = congelado ? BORDA_CONGELADO_HOVER : BORDA_SLOT_HOVER;
    const preenchimento = congelado ? 0x1c1210 : 0x1a1410;

    const container = this.add.container(x, y);
    this.raiz.add(container);

    const fundo = caixaArredondada(this, 0, 0, largura, altura, {
      raio: 8,
      preenchimento,
      borda,
      larguraBorda: 2,
      origem: [0, 0],
    });
    pintarCartao(fundo.caixa, largura, altura, { preenchimento, borda });
    container.add(fundo);

    // Zoom proporcional: corpo ~10px no cartão de referência, com piso e teto.
    const z = altura / 240;
    const fonte = (n) => `${Math.max(9, Math.round(n * z))}px`;

    const classe = this.catalogo?.classes?.find((c) => c.id === char.vocacaoId);
    const corClasse = congelado ? 0x5a3a38 : classe?.cor ?? BORDA_SLOT;
    const ladoRetrato = Math.min(largura * P.retratoFraçãoLargura, altura * P.retratoFraçãoAltura);
    const cyRetrato = altura * P.retratoY;

    container.add(
      this.add
        .rectangle(largura / 2, cyRetrato, ladoRetrato, ladoRetrato, corClasse, congelado ? 0.3 : 0.9)
        .setOrigin(0.5)
        .setStrokeStyle(2, borda),
    );
    container.add(
      this.add
        .text(largura / 2, cyRetrato, GLIFO_RACA[char.racaId] ?? '❓', { fontSize: fonte(30) })
        .setOrigin(0.5)
        .setAlpha(congelado ? 0.3 : 1),
    );

    container.add(
      this.add
        .text(largura / 2, altura * P.nomeY, char.nome ?? 'Sem nome', {
          fontFamily: 'Georgia, serif',
          fontSize: fonte(15),
          color: congelado ? '#a87878' : OURO,
          align: 'center',
          wordWrap: { width: largura - 14 },
        })
        .setOrigin(0.5, 0),
    );

    container.add(
      this.add
        .text(
          largura / 2,
          altura * P.subY,
          `${NOME_RACA[char.racaId] ?? char.racaId}  ·  ${classe?.nome ?? '—'}`,
          { fontSize: fonte(10), color: PERGAMINHO, align: 'center', wordWrap: { width: largura - 14 } },
        )
        .setOrigin(0.5, 0)
        .setAlpha(0.8),
    );

    const nivel = calcularNivel(char.xp ?? 0);
    container.add(
      this.add
        .text(largura / 2, altura * P.nivelY, `Nível ${nivel.nivel} · ${nivel.xpNoNivel}/${nivel.xpNoNivel + nivel.faltam} XP`, {
          fontSize: fonte(10),
          color: OURO,
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.9),
    );

    if (congelado) {
      const dias = diasRestantesExclusao(char);
      container.add(
        this.add
          .text(largura / 2, altura * P.rodapeY, `EXCLUÍDO EM ${dias} ${dias === 1 ? 'DIA' : 'DIAS'}`, {
            fontSize: fonte(9),
            color: '#e08a80',
          })
          .setOrigin(0.5, 0),
      );
    } else {
      container.add(
        this.add
          .text(largura / 2, altura * P.rodapeY, 'clique para entrar', { fontSize: fonte(9), color: PERGAMINHO })
          .setOrigin(0.5, 0)
          .setAlpha(0.45),
      );
    }

    // Zona de clique do CARTÃO. Ela para em `P.corpo` da altura, acima do
    // primeiro botão: sem sobreposição geométrica, clicar em "Entrar" nunca
    // chega aqui — e o `stopPropagation` abaixo cobre o resto.
    const corpo = this.add
      .rectangle(0, 0, largura, altura * P.corpo, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    corpo.on('pointerover', () => pintarCartao(fundo.caixa, largura, altura, { preenchimento, borda: bordaHover, larguraBorda: 3 }));
    corpo.on('pointerout', () => pintarCartao(fundo.caixa, largura, altura, { preenchimento, borda }));
    corpo.on('pointerdown', () => {
      if (congelado) this.confirmarResgate(char);
      else this.confirmarEntrada(char);
    });
    container.add(corpo);
    this.registrarInterativo(corpo);

    const larguraCheia = largura - 18;
    const meia = Math.floor((largura - 18 - 8) / 2);

    if (congelado) {
      // Durante a carência a única ação possível é voltar atrás.
      container.add(
        this.criarBotaoSlot(
          'CANCELAR EXCLUSÃO',
          largura / 2,
          altura * P.entrarY,
          larguraCheia,
          () => this.confirmarResgate(char),
          { cor: 0x2f5a3a, corHover: 0x3d7048, corBorda: 0x4f8a5f },
        ),
      );
      return;
    }

    container.add(
      this.criarBotaoSlot('ENTRAR NO MUNDO', largura / 2, altura * P.entrarY, larguraCheia, () =>
        this.confirmarEntrada(char),
      { cor: 0x6a4a9a, corHover: 0x7d5ab2, corBorda: 0x8a6ac2 }),
    );

    container.add(
      this.criarBotaoSlot('EDITAR', largura / 2 - (meia + 4) / 2 - 2, altura * P.secundarioY, meia, () =>
        this.editarPersonagem(char),
      ),
    );

    container.add(
      this.criarBotaoSlot(
        'EXCLUIR',
        largura / 2 + (meia + 4) / 2 + 2,
        altura * P.secundarioY,
        meia,
        () => this.confirmarExclusao(char),
        { cor: 0x7a2f2a, corHover: 0x9a3a33, corBorda: 0xa34840, corTexto: '#ffe6e0' },
      ),
    );
  }

  criarSlotVazio(x, y, largura, altura, indice) {
    const container = this.add.container(x, y);
    this.raiz.add(container);

    const fundo = caixaArredondada(this, 0, 0, largura, altura, {
      raio: 8,
      preenchimento: 0x120d08,
      borda: 0x3a2c20,
      larguraBorda: 1,
      origem: [0, 0],
    });
    container.add(fundo);

    const z = altura / 240;
    container.add(
      this.add
        .text(largura / 2, altura / 2 - 18, '+', {
          fontFamily: 'Georgia, serif',
          fontSize: `${Math.round(48 * z)}px`,
          color: '#4a3a28',
        })
        .setOrigin(0.5)
        .setAlpha(0.5),
    );
    container.add(
      this.add
        .text(largura / 2, altura / 2 + 24, `Vaga ${indice + 1}`, { fontSize: `${Math.max(9, Math.round(12 * z))}px`, color: PERGAMINHO })
        .setOrigin(0.5)
        .setAlpha(0.6),
    );

    const hit = this.add
      .rectangle(0, 0, largura, altura, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () =>
      pintarCartao(fundo.caixa, largura, altura, { preenchimento: 0x120d08, borda: BORDA_SLOT, larguraBorda: 2 }),
    );
    hit.on('pointerout', () =>
      pintarCartao(fundo.caixa, largura, altura, { preenchimento: 0x120d08, borda: 0x3a2c20, larguraBorda: 1 }),
    );
    hit.on('pointerdown', () => this.novoPersonagem());
    container.add(hit);
    this.registrarInterativo(hit);
  }

  /**
   * Botão dentro do cartão.
   *
   * `origem: [0.5, 0]` ancora pelo TOPO. Antes era `b.caixa.setOrigin(0.5, 0)`,
   * que nao reposicionava nada: o `Graphics` ja estava desenhado nas coords
   * (dx, dy) que `caixaArredondada` calculou a partir do `origem`. Quem decide
   * o deslocamento e o `origem`, nao o `setOrigin`.
   */
  criarBotaoSlot(rotulo, x, y, largura, callback, estilo = {}) {
    const criado = botao(this, x, y, rotulo, callback, {
      largura,
      altura: this.alturaBotao ?? 28,
      tamanho: '10px',
      cor: estilo.cor ?? 0x241c14,
      corHover: estilo.corHover ?? 0x3a2c20,
      corTexto: estilo.corTexto ?? PERGAMINHO,
      corBorda: estilo.corBorda ?? BORDA_SLOT,
      raio: 6,
      origem: [0.5, 0],
    });
    this.registrarInterativo(criado.clique);
    return criado.container;
  }

  // =====================================================================
  // Changelog lateral
  // =====================================================================

  criarChangelog(x, y, w, h) {
    this.raiz.add(
      caixaArredondada(this, x - 8, y - 8, w + 16, h + 16, {
        raio: 10,
        preenchimento: 0x0d0a07,
        borda: 0x3a2c20,
        larguraBorda: 1,
        origem: [0, 0],
      }),
    );

    this.raiz.add(uiTitulo(this, x, y, 'NOVIDADES', '14px').setOrigin(0, 0));

    // O CHANGELOG.md não é empacotado pelo Vite, então a lista é fixa aqui.
    let cy = y + 28;
    for (const entry of this.obterChangelogResumido()) {
      if (cy > y + h - 30) break;
      this.raiz.add(
        uiTexto(this, x, cy, entry, {
          fontSize: '10px',
          color: entry.startsWith('•') ? OURO : PERGAMINHO,
          wordWrap: { width: w - 16 },
          lineSpacing: 2,
        })
          .setOrigin(0, 0)
          .setAlpha(entry.startsWith('•') ? 1 : 0.8),
      );
      cy += 18;
    }
  }

  /**
   * Resumo das novidades para o jogador.
   *
   * A versão vem de `VERSAO_EXIBIDA` (que vem do `package.json`), nunca escrito
   * à mão — a linha antiga dizia `v0.3.0` enquanto o changelog dizia `0.1.2` e
   * o package.json `0.1.0`. Os itens estão separados por versão justamente para
   * que uma lista única não finja que tudo é novidade do release atual.
   */
  obterChangelogResumido() {
    return [
      `📜 ${VERSAO_EXIBIDA} — Out/2026`,
      '• Lobby de verdade após o login',
      '• Confirmação antes de entrar',
      '• Exclusão com carência de 30 dias',
      '• Criar e editar gravam de verdade',
      '',
      'v0.1.2 e anteriores',
      '• Mundo 60×44 (6× maior)',
      '• Posição persistente',
      '• Portal posicionável (Shift+P)',
      '• Itens até 1k + perecíveis',
      '• Agrupar itens (inventário)',
      '• Atributos extras (missões)',
      '• Admin: foco persistente',
      '• Termos: scroll + margem',
      '• Wiki (H): busca com foco',
      '',
      '🔧 Em breve:',
      '• Auto-combate / missões',
      '• Editor de pixels (admin)',
      '• Guildas / servidores',
      '• Anti-cheat',
    ];
  }

  /** Registra um objeto interativo do lobby (desligado enquanto houver modal). */
  registrarInterativo(objeto) {
    this.interativos?.add(objeto);
    return objeto;
  }

  // =====================================================================
  // Modais
  //
  // Um por vez. `abrirModal()` derruba o anterior antes de criar o próximo —
  // dois `capa` disputando o mesmo clique fazem o modal fechar sozinho.
  // =====================================================================

  abrirModal() {
    this.fecharModal();

    // Corta o input de TUDO que está atrás. Sem isto, clicar num botão do modal
    // também chega ao cartão que está embaixo (a lista de input não ordena por
    // depth), e o clique mais fundo cancelaria o botão com o `stopPropagation`.
    for (const o of this.interativos) {
      if (o?.input) o.input.enabled = false;
    }

    this.modal = { container: this.add.container(0, 0).setDepth(9000) };
    return this.modal;
  }

  fecharModal() {
    this.modal?.container.destroy(true);
    this.modal = null;

    for (const o of this.interativos) {
      if (o?.input) o.input.enabled = true;
    }
  }

  /** Desenha moldura + título + corpo + linha de botões no modal já aberto. */
  montarModal({ x0, y0, w, h, titulo, corpo, corBorda = BORDA_SLOT, botoes }) {
    const { container } = this.modal;
    const centro = x0 + w / 2;

    container.add(
      caixaArredondada(this, centro, y0 + h / 2, w, h, {
        raio: 10,
        preenchimento: 0x1a1410,
        borda: corBorda,
        larguraBorda: 2,
        origem: [0.5, 0.5],
      }),
    );

    container.add(uiTitulo(this, centro, y0 + 20, titulo, '17px').setOrigin(0.5, 0));

    container.add(
      uiTexto(this, centro, y0 + 54, corpo, {
        fontSize: '11px',
        align: 'center',
        color: PERGAMINHO,
        wordWrap: { width: w - 44 },
        lineSpacing: 4,
      }).setOrigin(0.5, 0),
    );

    const vao = 14;
    const total = botoes.reduce((s, b) => s + b.largura, 0) + vao * (botoes.length - 1);
    let bx = centro - total / 2;

    for (const b of botoes) {
      const criado = botao(this, bx + b.largura / 2, y0 + h - 46, b.rotulo, b.aoClicar, {
        largura: b.largura,
        altura: 32,
        tamanho: '11px',
        cor: b.cor ?? 0x3a2c20,
        corHover: b.corHover ?? 0x4a3828,
        corTexto: b.corTexto ?? PERGAMINHO,
        corBorda: b.corBorda ?? 0x6a5230,
      });
      container.add(criado.container);
      bx += b.largura + vao;
    }

    // A capa vai POR ÚLTIMO de propósito. Ela é o último da lista de input, e
    // o que vier depois é o que roda. Se ela entrasse primeiro — como fazia o
    // `confirmarApagar` antigo —, um clique em qualquer botão do modal
    // destruiria o modal antes de o botão fazer o que foi pedido.
    const capa = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.85)
      .setOrigin(0.5)
      .setInteractive();
    capa.on('pointerdown', () => this.fecharModal());
    container.add(capa);
  }

  /** Geometria padrão de um modal, já limitada à viewport. */
  molduraModal(altura, largura = 420) {
    const { width, height } = this.scale;
    const w = Math.min(largura, width - 48);
    const h = Math.min(altura, height - 48);
    return { x0: (width - w) / 2, y0: (height - h) / 2, w, h };
  }

  // =====================================================================
  // Ações
  // =====================================================================

  /** Passo 1 do CRUD-Read: confirmar entrada no mundo. */
  confirmarEntrada(char) {
    if (this.ocupado || this.modal) return;

    const m = this.molduraModal(252);
    const nivel = calcularNivel(char.xp ?? 0);

    this.abrirModal();
    this.montarModal({
      ...m,
      titulo: 'Entrar no mundo?',
      corpo:
        `Vai entrar como ${char.nome ?? 'Viajante'}, nível ${nivel.nivel}.\n\n` +
        'Os outros heróis continuam na lista — dá para voltar para qualquer um ' +
        'depois, pelo Voltar.',
      botoes: [
        { rotulo: 'Cancelar', largura: 130, aoClicar: () => this.fecharModal() },
        {
          rotulo: 'Entrar no mundo',
          largura: 160,
          cor: 0x6a4a9a,
          corHover: 0x7d5ab2,
          corBorda: 0x8a6ac2,
          aoClicar: () => this.entrarCom(char),
        },
      ],
    });
  }

  /** Passo 2: carrega o estado completo, grava o ativo e só então troca de cena. */
  async entrarCom(char) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.fecharModal();
    this.avisar('Abrindo o mundo...');

    try {
      const estado = await carregarPersonagem(this.uid, char.id);
      if (!estado) throw new Error('Herói não encontrado no perfil.');

      await definirPersonagemAtivo(this.uid, char.id);
      this.perfil = await carregarPerfilJogador(this.uid);

      this.scene.start('World', {
        uid: this.uid,
        nome: char.nome,
        email: this.email,
        podeSair: this.podeSair,
        estado,
        catalogo: this.catalogo,
        perfil: this.perfil,
        isAdmin: this.isAdmin,
      });
    } catch (erro) {
      console.error('[Lobby] falha ao entrar:', erro);
      this.ocupado = false;
      this.avisar(`Nao foi possivel entrar: ${erro?.message ?? erro}`, true);
    }
  }

  /** Passo 1 do CRUD-Create. */
  novoPersonagem() {
    if (this.ocupado || this.modal) return;

    const usados = this.perfil?.personagens?.length ?? 0;
    if (usados >= MAX_PERSONAGENS) {
      this.avisar(`Limite de ${MAX_PERSONAGENS} heróis atingido. Exclua um para liberar espaço.`, true);
      return;
    }

    this.scene.start('Criacao', {
      uid: this.uid,
      nome: this.perfil?.nome ?? '',
      email: this.email,
      podeSair: this.podeSair,
      catalogo: this.catalogo,
      perfil: this.perfil,
      isAdmin: this.isAdmin,
      // `CriacaoScene` deriva o modo a partir de `estado`. Passar só
      // `personagem:` (que ela não lê) deixava o EDITAR sem efeito nenhum.
      estado: null,
      editando: false,
      aoConcluir: (escolha) => this.salvarCriacao(escolha),
      // ESC e "Voltar" nesta tela têm que devolver ao lobby, não ao Login.
      aoCancelar: () => this.voltarAoLobby(),
    });
  }

  /** Grava o herói novo. `CriacaoScene` só devolve o formulário preenchido. */
  async salvarCriacao(escolha) {
    if (!escolha) {
      this.voltarAoLobby();
      return;
    }

    this.avisar('Forjando seu herói...');
    try {
      await criarPersonagem(this.uid, {
        nome: escolha.nome,
        racaId: escolha.racaId,
        vocacaoId: escolha.vocacaoId,
      });
      // Recarrega o perfil para que o novo Lobby mostre o personagem criado.
      this.perfil = await carregarPerfilJogador(this.uid);
      this.voltarAoLobby({ aviso: `${escolha.nome} entrou para o salão.` });
    } catch (erro) {
      console.error('[Lobby] falha ao criar personagem:', erro);
      this.voltarAoLobby({
        aviso: `Nao foi possivel criar o herói: ${erro?.message ?? erro}`,
        avisoErro: true,
      });
    }
  }

  /** Passo 1 do CRUD-Update. */
  editarPersonagem(char) {
    if (this.ocupado || this.modal) return;

    this.scene.start('Criacao', {
      uid: this.uid,
      nome: char.nome ?? '',
      email: this.email,
      podeSair: this.podeSair,
      catalogo: this.catalogo,
      perfil: this.perfil,
      isAdmin: this.isAdmin,
      // Chave que a `CriacaoScene` realmente lê. É ela que liga o modo edição.
      estado: char,
      editando: true,
      personagem: char,
      aoConcluir: (escolha) => this.salvarEdicao(char, escolha),
      aoCancelar: () => this.voltarAoLobby(),
    });
  }

  /** Grava as mudanças do formulário no herói existente. */
  async salvarEdicao(char, escolha) {
    if (!escolha) {
      this.voltarAoLobby();
      return;
    }

    this.avisar('Salvando as mudanças...');
    try {
      await salvarPersonagem(this.uid, char.id, {
        nome: escolha.nome,
        racaId: escolha.racaId,
        vocacaoId: escolha.vocacaoId,
      });
      // Recarrega o perfil para que o novo Lobby mostre as alterações.
      this.perfil = await carregarPerfilJogador(this.uid);
      this.voltarAoLobby({ aviso: `${escolha.nome} foi atualizado.` });
    } catch (erro) {
      console.error('[Lobby] falha ao editar personagem:', erro);
      this.voltarAoLobby({ aviso: `Nao foi possivel salvar: ${erro?.message ?? erro}`, avisoErro: true });
    }
  }

  /**
   * Passo 1 do CRUD-Delete.
   *
   * A exclusão é AGENDADA, não executada: 30 dias de carência, com resgate
   * durante a janela. O texto do modal existe para isso — sem ele o jogador
   * teria de adivinhar que ainda dá para voltar atrás.
   */
  confirmarExclusao(char) {
    if (this.ocupado || this.modal) return;

    const m = this.molduraModal(282, 450);

    this.abrirModal();
    this.montarModal({
      ...m,
      corBorda: 0x8a3a33,
      titulo: `Excluir ${char.nome ?? 'este herói'}?`,
      corpo:
        'A exclusão só acontece 30 dias depois.\n\n' +
        'Até lá o herói fica congelado — não dá para entrar nele — e o botão ' +
        'CANCELAR EXCLUSÃO continua disponível.\n\n' +
        'Passados os 30 dias, o progresso é removido de vez.',
      botoes: [
        { rotulo: 'Manter herói', largura: 130, aoClicar: () => this.fecharModal() },
        {
          rotulo: 'Agendar exclusão',
          largura: 170,
          cor: 0x7a2f2a,
          corHover: 0x9a3a33,
          corBorda: 0xa34840,
          corTexto: '#ffe6e0',
          aoClicar: () => this.executarExclusao(char),
        },
      ],
    });
  }

  async executarExclusao(char) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.fecharModal();
    this.avisar('Agendando exclusão...');

    try {
      await agendarExclusao(this.uid, char.id);
      // Relê para usar o timestamp REAL do agendamento. Calcular a partir de
      // `Date.now()` aqui daria um dia a menos sempre que a gravação demorasse
      // meio segundo além da meia-noite.
      this.perfil = await carregarPerfilJogador(this.uid);
      const agendado = this.perfil.personagens?.find((p) => p.id === char.id);
      const dias = diasRestantesExclusao(agendado);
      this.voltarAoLobby({
        aviso: `${char.nome ?? 'O herói'} foi agendado para exclusão em ${dias} ${dias === 1 ? 'dia' : 'dias'}. Dá para cancelar até lá.`,
      });
    } catch (erro) {
      console.error('[Lobby] falha ao agendar exclusão:', erro);
      this.ocupado = false;
      this.avisar(`Nao foi possivel excluir: ${erro?.message ?? erro}`, true);
    }
  }

  /** Resgatar um herói dentro da carência. */
  confirmarResgate(char) {
    if (this.ocupado || this.modal) return;

    const dias = diasRestantesExclusao(char);
    const m = this.molduraModal(226);

    this.abrirModal();
    this.montarModal({
      ...m,
      corBorda: 0x4f8a5f,
      titulo: 'Cancelar a exclusão?',
      corpo:
        `${char.nome ?? 'Este herói'} volta a ficar jogável imediatamente.\n\n` +
        `A exclusão estava marcada para daqui a ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
      botoes: [
        { rotulo: 'Deixar excluído', largura: 140, aoClicar: () => this.fecharModal() },
        {
          rotulo: 'Resgatar herói',
          largura: 150,
          cor: 0x2f5a3a,
          corHover: 0x3d7048,
          corBorda: 0x4f8a5f,
          aoClicar: () => this.executarResgate(char),
        },
      ],
    });
  }

  async executarResgate(char) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.fecharModal();
    this.avisar('Resgatando herói...');

    try {
      await cancelarExclusao(this.uid, char.id);
      this.perfil = await carregarPerfilJogador(this.uid);
      this.voltarAoLobby({ aviso: `${char.nome ?? 'O herói'} voltou para a lista.` });
    } catch (erro) {
      console.error('[Lobby] falha ao cancelar exclusão:', erro);
      this.ocupado = false;
      this.avisar(`Nao foi possivel resgatar: ${erro?.message ?? erro}`, true);
    }
  }

  /**
   * Volta para o lobby recriando a cena.
   *
   * `this.scene.stop('Criacao')` não é redundante. `this.scene` é o plugin do
   * LOBBY, e quando esta roda o lobby já está parado (foi embora quando o
   * jogador foi para `Criacao`), então `start('Lobby')` não tem cena "corrente"
   * para derrubar: a `Criacao` continuava de pé por baixo. O resultado eram duas
   * cenas ativas com dois conjuntos de input disputando o mesmo ponteiro — e a
   * tela de criação continuava existindo "atrás" do lobby.
   *
   * O `isActive()` não é preciosismo: `SceneManager.stop()` numa cena que já
   * está parada cai no ramo `sleep()` em vez de `shutdown()`, e `sleep()` não
   * roda o `destroy()` do SHUTDOWN. Num caminho que nem passou pela criação
   * (excluir/resgatar, que saem do lobby direto) isso deixaria o `<input>` do
   * formulário vivo no DOM em cima do lobby recem-criado.
   */
  voltarAoLobby(extra = {}) {
    if (this.scene.isActive('Criacao')) this.scene.stop('Criacao');
    this.scene.start('Lobby', this.dadosParaLobby(extra));
  }

  dadosParaLobby(extra = {}) {
    return {
      uid: this.uid,
      perfil: this.perfil,
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
      email: this.email,
      podeSair: this.podeSair,
      ...extra,
    };
  }

  /**
   * Escreve na linha de feedback.
   *
   * Precisa do guarda de `isActive()`: `salvarCriacao`/`salvarEdicao`/
   * `executarExclusao`/`executarResgate` rodam DEPOIS de a cena ter sido
   * parada (o Lobby foi embora quando o jogador foi para `Criacao`). Nesse
   * ponto o `Text` continua no JavaScript mas o canvas dele já foi destruído, e
   * `setColor` estoura com
   *
   *   TypeError: Cannot read properties of null (reading 'glTexture')
   *   at Text2.updateText ... at TextStyle2.setColor ... at Text2.setColor
   *
   * Como a chamada fica ANTES do `try` do chamador, o `throw` comia a gravação
   * inteira: o herói não era salvo, nenhuma cena mudava, e o jogador ficava
   * preso em `Criacao` sem nenhuma mensagem. A mensagem que importa nesses
   * caminhos viaja nos dados do `scene.start` (ver `dadosParaLobby`).
   */
  avisar(msg, erro = false) {
    if (!this.mensagem || !this.sys.isActive()) return;
    this.mensagem.setText(msg);
    this.mensagem.setColor(erro ? '#e08a80' : OURO);
    this.mensagem.setAlpha(1);
  }

  voltarLogin() {
    this.scene.start('Login');
  }
}