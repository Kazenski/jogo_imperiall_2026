import Phaser from 'phaser';
import { TEXTURAS } from './BootScene.js';
import {
  carregarProgresso,
  salvarProgresso,
  definirBaseVisivel,
  listarPortais,
  calcularNivel,
  xpParaProximoNivel,
} from '../core/progresso.js';
import { sairDaConta } from '../core/firebase.js';
import { carregarCatalogo, buscarItem } from '../core/catalogo.js';
import {
  calcularDerivados,
  talentosAtivos,
  bonusEquipados,
  adicionarItem,
  aplicarBônus,
} from '../core/personagem.js';
import {
  calcularDano,
  calcularDanoRecebido,
  minerar,
  construir,
  derrubarBlocoDaBase,
  processarConquistas,
  sortearLoot,
  aplicarLoot,
} from '../core/regras.js';
import {
  gerarNosDeRecurso,
  gerarSpawns,
  nivelarMonstro,
  listarBlocos,
  reinoInicial,
  chaveBloco,
  TAMANHO_BLOCO,
} from '../core/mundo.js';
import { VELOCIDADE, OURO, PERGAMINHO } from '../constants.js';
import { texto as uiTexto, titulo as uiTitulo, painel, botao, barra } from '../ui/comuns.js';

const COLUNAS = 34;
const LINHAS = 26;
const TAMANHO = TAMANHO_BLOCO;
const LARGURA_TILEMAP = COLUNAS * TAMANHO;
const ALTURA_TILEMAP = LINHAS * TAMANHO;

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.podeSair = dados?.podeSair ?? false;
    this.perfil = dados?.perfil ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
    this.estado = dados?.estado ?? null;
  }

  async create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#22331f');
    cam.setBounds(0, 0, LARGURA_TILEMAP, ALTURA_TILEMAP);
    cam.setRoundPixels(true);

    this.catalogo = await carregarCatalogo();
    this.reinoAtual = reinoInicial(this.catalogo, this.estado.nivel ?? 1) ?? this.catalogo.worldTemplates?.[0];

    this.criarDerivados();
    this.criarEntrada();
    this.criarJogador();
    this.criarMundo();
    this.criarBase();
    this.criarPortal();
    this.criarHud();
    this.criarBarraDeAcoes();
    this.criarAlvos();

    cam.startFollow(this.jogador, true, 0.12, 0.12);
    cam.setDeadzone(220, 140);

    this.atalhos();
    this.syncBaseVisivel();
    this.atualizarDerivados();
  }

  // ---------- derivados e estado ----------

  criarDerivados() {
    const ativos = talentosAtivos(this.catalogo, this.estado);
    const base = calcularDerivados(this.estado, this.catalogo.indice.classes[this.estado.vocacaoId], ativos);
    const bonus = bonusEquipados(this.estado, this.catalogo);
    this.derivados = {
      ...base,
      defesa: base.defesa + bonus.defesa,
      vidaMax: base.vidaMax + bonus.vidaMax,
      poderMax: base.poderMax + bonus.poderMax,
      poderMineracao: base.poderMineracao + bonus.poderMineracao,
      carga: base.carga + bonus.carga,
      alcanceConstrucao: base.alcanceConstrucao + bonus.alcanceConstrucao,
    };

    // Aplica o maximo derivado, preservando a vida/poder atuais (ratio).
    this.estado.vidaMax = this.derivados.vidaMax;
    this.estado.poderMax = this.derivados.poderMax;
    this.estado.vida = Math.min(this.estado.vida || this.derivados.vidaMax, this.derivados.vidaMax);
    this.estado.poder = Math.min(this.estado.poder ?? this.derivados.poderMax, this.derivados.poderMax);
  }

  get classe() {
    return this.catalogo?.indice?.classes?.[this.estado.vocacaoId] ?? null;
  }

  // ---------- construcao de cenario ----------

  criarEntrada() {
    this.teclado = this.input.keyboard.createCursorKeys();
    this.teclas = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  criarJogador() {
    this.jogador = this.physics.add
      .sprite(LARGURA_TILEMAP / 2, ALTURA_TILEMAP / 2 + 120, TEXTURAS.JOGADOR)
      .setOrigin(0.5, 1)
      .setCollideWorldBounds(true)
      .setDamping(true)
      .setDrag(900, 900);
    this.jogador.setDepth(this.jogador.y);
  }

  /** Chao: um TileSprite que cobre a camera, com textura conforme o bioma. */
  criarMundo() {
    const texturaPorBioma = {
      etereo: TEXTURAS.CHAO_ETREO,
      caverna: TEXTURAS.CHAO_CAVERNA,
      vazio: TEXTURAS.CHAO_ETREO,
      campo: TEXTURAS.CHAO,
    };
    this.chao = this.add
      .tileSprite(0, 0, 800, 600, texturaPorBioma[this.reinoAtual?.bioma] ?? TEXTURAS.CHAO)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100);

    // Nos de recurso do reino.
    this.nosRecurso = gerarNosDeRecurso(this.reinoAtual, COLUNAS, LINHAS, this.uid ?? 'local');
    this.imagensNo = new Map();
    for (const no of this.nosRecurso) {
      const def = buscarItem(this.catalogo, no.itemId);
      if (!def) continue;
      const x = no.col * TAMANHO + TAMANHO / 2;
      const y = no.linha * TAMANHO + TAMANHO;

      const img = this.add
        .image(x, y, this.texturaDoItem(def))
        .setOrigin(0.5, 1)
        .setTint(def.cor ?? 0xffffff)
        .setDepth(y)
        .setInteractive({ useHandCursor: true });
      img.setData('no', no);

      this.imagensNo.set(chaveBloco(no.col, no.linha), img);
    }

    // Arvores decorativas.
    this.arvores = this.physics.add.staticGroup();
    const rng = this.reinoAtual?.seedBase ?? 'arvores';
    for (let i = 0; i < 60; i += 1) {
      const s = Math.abs(hashSimples(`${rng}:arvore:${i}`)) % 1000 / 1000;
      const s2 = Math.abs(hashSimples(`${rng}:arvore2:${i}`)) % 1000 / 1000;
      const x = 40 + s * (LARGURA_TILEMAP - 80);
      const y = 60 + s2 * (ALTURA_TILEMAP - 80);
      const arvore = this.add.image(x, y, TEXTURAS.ARVORE).setOrigin(0.5, 1).setDepth(y);
      this.physics.add.existing(arvore, true);
      this.arvores.add(arvore);
    }
    this.physics.add.collider(this.jogador, this.arvores);

    // Monstros.
    this.monstros = [];
    this.imagensMonstro = new Map();
    this.gerarMonstros();
  }

  texturaDoItem(def) {
    switch (def.tipo) {
      case 'maquina':
        return TEXTURAS.MAQUINA;
      case 'equipavel':
        return TEXTURAS.EQUIPAVEL;
      case 'ferramenta':
        return TEXTURAS.FERRAMENTA;
      case 'orbe':
        return TEXTURAS.ORBE;
      default:
        return TEXTURAS.BLOCO;
    }
  }

  gerarMonstros() {
    const spawns = gerarSpawns(this.reinoAtual, this.catalogo, this.estado.nivel ?? 1, 22, this.uid ?? 'local');

    for (const spawn of spawns) {
      const def = this.catalogo.indice.monsters[spawn.monstroId];
      if (!def) continue;
      this.criarMonstro(def, spawn);
    }
  }

  criarMonstro(def, spawn, escala) {
    const x = (spawn.x ?? 0.5) * LARGURA_TILEMAP;
    const y = (spawn.y ?? 0.5) * ALTURA_TILEMAP;
    const dados = escala ?? nivelarMonstro(def, spawn.distanciaCentro ?? 0.3, this.estado.nivel ?? 1);

    const corpo = this.physics.add.sprite(x, y, TEXTURAS.MONSTRO).setTint(def.cor ?? 0x999999);
    corpo.setOrigin(0.5, 1);
    corpo.setData('def', def);
    corpo.setData('stats', dados);

    const monstro = { corpo, def, stats: dados, alvo: null, cooldown: 0 };

    // Barra de vida flutuante.
    monstro.barraVida = barra(this, x - 16, y - 34, 32, 4, 0xd05a5a, 1);
    monstro.barraVida.fundo.setScrollFactor(0).setDepth(1000);

    corpo.setDepth(y);
    this.monstros.push(monstro);
    this.imagensMonstro.set(corpo.id, monstro);
    return monstro;
  }

  /** Blocos colocados pelo jogador. */
  criarBase() {
    this.imagensBloco = new Map();
    this.reconstruirBase();
  }

  reconstruirBase() {
    for (const img of this.imagensBloco.values()) img.destroy();
    this.imagensBloco.clear();

    for (const bloco of listarBlocos(this.estado.base)) {
      const def = buscarItem(this.catalogo, bloco.itemId);
      if (!def) continue;
      const x = this.colParaX(this.jogador.x, bloco.col);
      const y = this.linhaParaY(this.jogador.y, bloco.linha);

      const img = this.add
        .image(x, y, this.texturaDoItem(def))
        .setOrigin(0.5, 1)
        .setTint(def.cor ?? 0xffffff)
        .setDepth(y)
        .setInteractive({ useHandCursor: true });
      img.setData('bloco', bloco);
      img.setData('chave', chaveBloco(blocko.col, bloco.linha));
      this.imagensBloco.set(img.getData('chave'), img);
    }
  }

  /** Posicao do centro da base (segue o jogador: a base viaja com ele). */
  colParaX(jogadorX, col) {
    return jogadorX + col * TAMANHO;
  }

  linhaParaY(jogadorY, linha) {
    return jogadorY + (linha - 6) * TAMANHO;
  }

  xParaCol(jogadorX, x) {
    return Math.round((x - jogadorX) / TAMANHO);
  }

  yParaLinha(jogadorY, y) {
    return Math.round((y - jogadorY) / TAMANHO + 6);
  }

  criarPortal() {
    const x = this.jogador.x;
    const y = this.jogador.y + 90;

    const brilho = this.add.circle(x, y - 20, 70, 0x7a4fd4, 0.14).setDepth(y - 2);
    this.portal = this.add.image(x, y, TEXTURAS.PORTAL).setOrigin(0.5, 1).setDepth(y);

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
      alpha: { from: 0.08, to: 0.3 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.particulasPortal = this.add
      .particles(x, y - 12, TEXTURAS.PARTICULA, {
        speedY: { min: -70, max: -25 },
        speedX: { min: -14, max: 14 },
        lifespan: 1800,
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: 0xc9a6ff,
        frequency: 120,
        quantity: 1,
      })
      .setDepth(y - 1);

    this.portalAlvo = { x, y };
  }

  // ---------- interface ----------

  criarHud() {
    this.hud = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    this.add.rectangle(0, 0, 100000, 96, 0x14100c, 0.75).setOrigin(0, 0);

    const p = this.estado;
    this.txtNome = uiTexto(this, 18, 10, p.nome ?? 'Viajante', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: OURO,
    });

    const { nivel, xpNoNivel, faltam } = calcularNivel(p.xp ?? 0);
    this.txtNivel = uiTexto(this, 18, 36, `Nivel ${nivel}`, { fontSize: '13px' });
    this.txtXp = uiTexto(this, 18, 56, `${xpNoNivel}/${xpParaProximoNivel(nivel)} XP`, { fontSize: '11px' });

    this.barraXp = this.add.rectangle(18, 74, 0, 7, 0xd4af6a).setOrigin(0, 0);
    this.larguraXp = 210;
    this.hud.add([
      this.txtNome, this.txtNivel, this.txtXp, this.barraXp,
    ]);
    this.atualizarBarraXp(xpNoNivel, xpNoNivel + faltam);

    // Atributos / recursos a direita.
    this.txtAtributos = uiTexto(this, 250, 10, '', { fontSize: '11px' }).setAlpha(0.9);
    this.txtVida = uiTexto(this, 250, 52, '', { fontSize: '12px', color: '#e88a8a' });
    this.txtPoder = uiTexto(this, 250, 70, '', { fontSize: '12px', color: '#8ab4e8' });
    this.txtOuro = uiTexto(this, 250, 34, '', { fontSize: '12px', color: OURO });
    this.hud.add([this.txtAtributos, this.txtOuro, this.txtVida, this.txtPoder]);

    this.txtAjuda = uiTexto(
      this,
      this.scale.width - 18,
      10,
      'WASD/setas: andar | E: atacar/minerar | Q: construir | B: portal | I: inventario | T: talentos | C: fabricar | ESC: sair'
        + (this.isAdmin ? ' | F2: admin' : ''),
      { fontSize: '11px', align: 'right' },
    ).setOrigin(1, 0).setAlpha(0.65);
    this.hud.add(this.txtAjuda);

    this.toast = uiTexto(this, this.scale.width / 2, 110, '', {
      fontSize: '14px',
      color: OURO,
      backgroundColor: '#14100ccc',
      padding: { x: 12, y: 6 },
    })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.hud.add(this.toast);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.aoRedimensionar, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.aoRedimensionar, this);
    });
  }

  aoRedimensionar() {
    this.txtAjuda.setPosition(this.scale.width - 18, 10);
    this.toast.setPosition(this.scale.width / 2, 110);
  }

  /** Botoes flutuantes no canto inferior direito (atalhos de toque/atalho). */
  criarBarraDeAcoes() {
    this.barraAcoes = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    const acoes = [
      { rotulo: 'Mochila [I]', fn: () => this.abrirInventario() },
      { rotulo: 'Talentos [T]', fn: () => this.abrirTalentos() },
      { rotulo: 'Fabricar [C]', fn: () => this.abrirFabricacao() },
      { rotulo: 'Reinos [R]', fn: () => this.abrirReinos() },
      { rotulo: 'Portais [P]', fn: () => this.abrirPainelDePortais() },
    ];
    let i = 0;
    for (const acao of acoes) {
      i += 1;
      this.barraAcoes.add(
        botao(this, 0, -i * 40, acao.rotulo, acao.fn, {
          origem: [1, 1],
          largura: 140,
          altura: 32,
          cor: 0x241c14,
          corHover: 0x3a2c20,
          corTexto: PERGAMINHO,
          tamanho: '12px',
        }).caixa,
      );
    }
    this.reposicionarAcoes();
  }

  reposicionarAcoes() {
    this.barraAcoes.setPosition(this.scale.width - 16, this.scale.height - 16);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.reposicionarAcoes, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.reposicionarAcoes, this),
    );
  }

  atualizarBarraXp(obtido, total) {
    const pct = Phaser.Math.Clamp(obtido / Math.max(1, total), 0, 1);
    this.barraXp.width = this.larguraXp * pct;
  }

  mostrarToast(mensagem, duracao = 2200) {
    this.toast.setText(mensagem).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: duracao, delay: 500 });
  }

  // ---------- alvos (cursor de mira) ----------

  criarAlvos() {
    this.mira = this.add
      .rectangle(this.jogador.x, this.jogador.y, TAMANHO, TAMANHO, 0xd4af6a, 0.18)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0xd4af6a, 0.5)
      .setDepth(this.jogador.y + 1);
  }

  alvoPerto(maximo = TAMANHO * 1.6) {
    let melhor = null;
    let melhorDist = maximo;

    // Nos de recurso
    for (const [chave, img] of this.imagensNo) {
      if (!img.active) continue;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y - 14, img.x, img.y - 12);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'recurso', img, chave };
      }
    }

    // Blocos da base
    for (const [chave, img] of this.imagensBloco) {
      if (!img.active) continue;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y - 14, img.x, img.y - 12);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'bloco', img, chave };
      }
    }

    // Monstros
    for (const m of this.monstros) {
      if (!m.corpo.active) continue;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y - 14, m.corpo.x, m.corpo.y - 14);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'monstro', monstro: m };
      }
    }

    return melhor;
  }

  // ---------- acoes de teclado ----------

  atalhos() {
    this.input.keyboard.on('keydown-E', () => this.acaoPrincipal());
    this.input.keyboard.on('keydown-Q', () => this.acaoConstruir());
    this.input.keyboard.on('keydown-B', () => this.alternarPortal());
    this.input.keyboard.on('keydown-I', () => this.abrirInventario());
    this.input.keyboard.on('keydown-T', () => this.abrirTalentos());
    this.input.keyboard.on('keydown-C', () => this.abrirFabricacao());
    this.input.keyboard.on('keydown-R', () => this.abrirReinos());
    this.input.keyboard.on('keydown-P', () => this.abrirPainelDePortais());

    this.input.keyboard.on('keydown-ESC', async () => {
      if (this.painelAberto) {
        this.fecharPaineis();
        return;
      }
      if (!this.podeSair) return;
      await this.persistir();
      await sairDaConta();
      this.scene.start('Login');
    });

    this.input.keyboard.on('keydown-F2', () => {
      if (!this.isAdmin) return;
      if (this.scene.isActive('Admin')) {
        this.fecharPaineis();
        this.scene.stop('Admin');
        return;
      }
      this.fecharPaineis();
      this.scene.launch('Admin', { uid: this.uid });
    });
  }

  fecharPaineis() {
    if (this.painel?.active) {
      this.painel.destroy(true);
      this.painel = null;
    }
    this.painelAberto = false;
  }

  /** E: ataca monstro, mineraria recurso ou derruba bloco, conforme o alvo. */
  acaoPrincipal() {
    const alvo = this.alvoPerto();
    if (!alvo) {
      this.mostrarToast('Nada por perto.');
      return;
    }
    if (alvo.tipo === 'monstro') this.atacarMonstro(alvo.monstro);
    else if (alvo.tipo === 'recurso') this.minerarNo(alvo);
    else this.derrubarBloco(alvo);
  }

  /** Q: constroi o bloco selecionado perto do jogador. */
  acaoConstruir() {
    const selecionado = this.blocoSelecionado;
    if (!selecionado) {
      this.mostrarToast('Selecione um bloco de construcao na Mochila [I].');
      return;
    }
    const col = this.xParaCol(this.jogador.x, this.jogador.x);
    const linha = this.yParaLinha(this.jogador.y, this.jogador.y - TAMANHO * 2);
    const resultado = construir({
      estado: this.estado,
      catalogo: this.catalogo,
      col,
      linha,
      itemId: selecionado,
      alcance: this.derivados.alcanceConstrucao,
    });

    if (!resultado.ok) {
      this.mostrarToast(resultado.motivo);
      return;
    }
    this.reconstruirBase();
    this.mostrarToast(`Bloco colocado (${resultado.xp} XP).`);
    this.ganharXp(resultado.xp);
  }

  async minerarNo(alvo) {
    const no = alvo.img.getData('no');
    const resultado = minerar({
      catalogo: this.catalogo,
      estado: this.estado,
      itemId: no.itemId,
      forcaMineracao: this.derivados.poderMineracao,
    });

    if (!resultado.ok) {
      this.mostrarToast(resultado.motivo);
      return;
    }

    // Efeito visual: o no "quebra".
    alvo.img.destroy();
    this.imagensNo.delete(alvo.chave);
    this.flashes(alvo.img.x, alvo.img.y - 12, 0xffffff, 6);

    for (const ganho of resultado.ganhos) {
      const def = buscarItem(this.catalogo, ganho.itemId);
      this.mostrarToast(`+${ganho.qtd} ${def?.nome ?? ganho.itemId}`);
    }
    this.ganharXp(resultado.xp);
    await this.persistir();
  }

  derrubarBloco(alvo) {
    const [col, linha] = alvo.chave.split(',').map(Number);
    const resultado = derrubarBlocoDaBase(this.estado, this.catalogo, col, linha);
    if (!resultado.ok) {
      this.mostrarToast(resultado.motivo);
      return;
    }
    alvo.img.destroy();
    this.imagensBloco.delete(alvo.chave);
    for (const g of resultado.ganhos) {
      const def = buscarItem(this.catalogo, g.itemId);
      this.mostrarToast(`+${g.qtd} ${def?.nome ?? g.itemId}`);
    }
    this.ganharXp(resultado.xp);
    this.persistir();
  }

  atacarMonstro(monstro) {
    const ativos = talentosAtivos(this.catalogo, this.estado);
    const multiplicador = ativos.reduce(
      (s, t) => Math.max(s, Number(t.efeitos?.danoMultiplicador) || 1),
      1,
    );
    const criticoPct = ativos.reduce((s, t) => s + (Number(t.efeitos?.criticoPct) || 0), 0);

    const { dano, critico } = calcularDano({
      poder: this.estado.poder,
      fis: this.derivados.fis,
      men: this.derivados.men,
      defesaAlvo: monstro.stats.defesa,
      multiplicador,
      criticoPct,
    });

    monstro.stats.vida -= dano;
    this.flashes(monstro.corpo.x, monstro.corpo.y - 18, critico ? 0xffd76a : 0xffffff, critico ? 10 : 6);

    // Monstro revida.
    const recebido = calcularDanoRecebido({
      dano: monstro.stats.dano,
      reducaoPct: this.derivados.pct.reducaoDanoPct,
      escudoPct: this.derivados.escudoPct,
      defesa: this.derivados.defesa,
    });
    this.estado.vida = Math.max(0, this.estado.vida - recebido);

    if (monstro.stats.vida <= 0) this.derrotarMonstro(monstro);
    this.atualizarDerivados();

    if (this.estado.vida <= 0) this.morrer();
  }

  async derrotarMonstro(monstro) {
    const pecas = sortearLoot({
      catalogo: this.catalogo,
      estado: this.estado,
      monstro: { ...monstro.def, nivel: monstro.stats.nivel },
    });
    const { itens, orbes } = aplicarLoot(this.estado, pecas);
    for (const item of itens) {
      const def = buscarItem(this.catalogo, item.itemId);
      this.adicionarItemAoInventario(item.itemId, item.qtd, def?.stackMax ?? 999);
    }
    this.estado.orbes = somarMapasSeguras(this.estado.orbes, orbes);

    this.estado.stats.inimigosDerrotados = (this.estado.stats.inimigosDerrotados ?? 0) + 1;
    this.ganharXp(monstro.def.xpRecompensa ?? 10);

    monstro.corpo.destroy();
    monstro.barraVida.destruir();
    this.monstros = this.monstros.filter((m) => m !== monstro);

    let msg = `${monstro.def.nome} derrotado!`;
    if (itens.length) {
      msg += ' +' + itens.map((i) => `${i.qtd} ${buscarItem(this.catalogo, i.itemId)?.nome ?? i.itemId}`).join(', ');
    }
    const orbeTexto = Object.entries(orbes).map(([tipo, qtd]) => `${qtd}x ${tipo.replace(/_/g, ' ')}`).join(', ');
    if (orbeTexto) msg += ` | Orbes: ${orbeTexto}`;
    this.mostrarToast(msg, 3200);

    this.flashes(monstro.corpo.x, monstro.corpo.y - 14, 0xd05a5a, 14);

    // Repovoa o mundo com o tempo.
    this.time.delayedCall(30000, () => {
      if (!this.scene.isActive()) return;
      this.criarMonstro(monstro.def, {
        x: Phaser.Math.FloatBetween(0.05, 0.95),
        y: Phaser.Math.FloatBetween(0.05, 0.95),
        distanciaCentro: 0.35,
      });
    });

    await this.persistir();
  }

  morrer() {
    this.mostrarToast('Voce caiu! Perdeu parte do ouro.', 4000);
    this.estado.vida = Math.floor(this.derivados.vidaMax * 0.5);
    this.estado.ouro = Math.floor((this.estado.ouro ?? 0) * 0.9);
    this.jogador.setAlpha(0.35);
    this.time.delayedCall(2500, () => this.jogador.setAlpha(1));
    this.atualizarDerivados();
    this.persistir();
  }

  flashes(x, y, cor, quantidade) {
    this.add.particles(x, y, TEXTURAS.PARTICULA, {
      speed: { min: 40, max: 120 },
      lifespan: 320,
      quantity,
      tint: cor,
      scale: { start: 0.8, end: 0 },
      emitting: false,
    }).explode(quantidade);
  }

  // ---------- XP / save ----------

  async ganharXp(quantidade) {
    if (!quantidade) return;
    const antes = calcularNivel(this.estado.xp ?? 0).nivel;
    const { xpNoNivel, faltam } = calcularNivel(this.estado.xp ?? 0);
    this.estado.xp = (this.estado.xp ?? 0) + quantidade;

    const depois = calcularNivel(this.estado.xp);
    this.estado.nivel = depois.nivel;
    this.atualizarBarraXp(depois.xpNoNivel, depois.xpNoNivel + depois.faltam);

    this.txtNivel.setText(`Nivel ${depois.nivel}`);
    this.txtXp.setText(`${depois.xpNoNivel}/${xpParaProximoNivel(depois.nivel)} XP`);

    if (depois.nivel > antes) {
      // +1 ponto de talento e +3 pontos de atributo por nivel.
      this.estado.pontosTalento = (this.estado.pontosTalento ?? 0) + 1;
      this.estado.pontosAtributo = (this.estado.pontosAtributo ?? 0) + 3;
      this.mostrarToast(`Nivel ${depois.nivel}! +1 ponto de talento, +3 de atributo.`, 3000);
    }
  }

  /** Recalcula e reescreve o painel de status. */
  atualizarDerivados() {
    const d = this.derivados;
    this.txtAtributos.setText(
      `FIS ${d.fis}  MEN ${d.men}  SOC ${d.soc}   DEF ${d.defesa}  MIN ${d.poderMineracao}`,
    );
    this.txtOuro.setText(`Ouro: ${this.estado.ouro ?? 0}   Talentos: ${this.estado.pontosTalento ?? 0}`);
    const vidaPct = this.estado.vidaMax ? this.estado.vida / this.estado.vidaMax : 0;
    const poderPct = this.estado.poderMax ? this.estado.poder / this.estado.poderMax : 0;
    this.txtVida.setText(`Vida ${Math.ceil(this.estado.vida ?? 0)}/${this.estado.vidaMax}`);
    this.txtPoder.setText(`Poder ${Math.ceil(this.estado.poder ?? 0)}/${this.estado.poderMax}`);
    this.txtVida.setAlpha(vidaPct < 0.3 ? 0.6 + Math.abs(Math.sin(Date.now() / 200)) * 0.4 : 1);
    this.txtPoder.setAlpha(poderPct < 0.3 ? 0.6 + Math.abs(Math.sin(Date.now() / 200)) * 0.4 : 1);
  }

  adicionarItemAoInventario(itemId, qtd, stackMax) {
    adicionarItem(this.estado.inventario, itemId, qtd, stackMax ?? 999);
  }

  /** Processa conquistas, salva e atualiza o HUD. */
  async persistir() {
    const novas = processarConquistas({ catalogo: this.catalogo, estado: this.estado });
    if (novas.length) {
      for (const c of novas) {
        this.mostrarToast(`Conquista: ${c.nome}`, 3200);
      }
    }
    await this.syncBaseVisivel();
    this.estado = await salvarProgresso(this.uid, this.estado);
    this.criarDerivados();
    this.atualizarDerivados();
    return novas;
  }

  /** Mantem o portal publico em dia com nome/nivel/base. */
  async syncBaseVisivel() {
    if (!this.uid) return;
    const visivel = Boolean(this.estado.base?.visivel);
    try {
      await definirBaseVisivel(this.uid, visivel);
    } catch (erro) {
      console.warn('[World] falha ao sincronizar portal:', erro);
    }
  }

  async alternarPortal() {
    if (!this.uid) {
      this.mostrarToast('Entre com Google para expor sua base.');
      return;
    }
    this.estado.base.visivel = !this.estado.base.visivel;
    await this.persistir();
    this.mostrarToast(
      this.estado.base.visivel ? 'Sua base agora e visivel para os amigos.' : 'Sua base foi ocultada.',
    );
  }

  // ---------- paineis (implementados nas cenas seguintes) ----------

  abrirInventario() {
    this.scene.launch('Inventario', {
      uid: this.uid,
      estado: this.estado,
      catalogo: this.catalogo,
      derivados: this.derivados,
    });
  }

  abrirTalentos() {
    this.scene.launch('Talentos', {
      estado: this.estado,
      catalogo: this.catalogo,
    });
  }

  abrirFabricacao() {
    this.scene.launch('Fabricacao', {
      estado: this.estado,
      catalogo: this.catalogo,
      nivel: this.estado.nivel ?? 1,
    });
  }

  abrirReinos() {
    this.scene.launch('Reinos', {
      estado: this.estado,
      catalogo: this.catalogo,
      reinoAtual: this.reinoAtual,
      aoViajar: (reino) => {
        this.reinoAtual = reino;
        this.mostrarToast(`Você chegou a ${reino.nome}.`);
      },
    });
  }

  // ---------- portais ----------

  async abrirPainelDePortais() {
    if (this.painel?.active) {
      this.fecharPaineis();
      return;
    }

    const { width, height } = this.scale;
    this.painel = this.add.container(0, 0).setDepth(2000).setScrollFactor(0);
    this.painelAberto = true;

    const w = Math.min(560, width - 40);
    const h = Math.min(420, height - 60);
    this.painel.add(painel(this, width / 2 - w / 2, height / 2 - h / 2, w, h));
    this.painel.add(
      uiTitulo(this, width / 2, height / 2 - h / 2 + 20, 'PORTALIS ARCANOS', '20px').setOrigin(0.5, 0),
    );

    if (!this.uid) {
      this.painel.add(
        uiTexto(this, width / 2, height / 2, 'Entre com Google para viajar.', {
          fontSize: '14px',
          align: 'center',
        }).setOrigin(0.5),
      );
      return;
    }

    this.painel.add(
      uiTexto(this, width / 2, height / 2 - h / 2 + 60, 'Carregando portais...', { fontSize: '13px' })
        .setOrigin(0.5, 0),
    );

    const portais = await listarPortais(this.uid);
    if (!this.painel?.active) return;

    let y = height / 2 - h / 2 + 96;
    if (!portais.length) {
      this.painel.add(
        uiTexto(this, width / 2, y, 'Nenhuma base visivel.\nPeca a um amigo para apertar B na base dele.', {
          fontSize: '14px',
          align: 'center',
        }).setOrigin(0.5, 0),
      );
    } else {
      for (const p of portais.slice(0, 8)) {
        const item = this.add
          .text(width / 2, y, `${p.nomeBase} — ${p.nome} (nível ${p.nivel})`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            color: PERGAMINHO,
          })
          .setOrigin(0.5, 0)
          .setInteractive({ useHandCursor: true });
        item.on('pointerover', () => item.setColor(OURO));
        item.on('pointerout', () => item.setColor(PERGAMINHO));
        item.on('pointerdown', () => this.viajarPara(p));
        this.painel.add(item);
        y += 30;
      }
    }

    this.painel.add(
      botao(this, width / 2, height / 2 + h / 2 - 26, 'Fechar', () => this.fecharPaineis()).caixa,
    );
  }

  /** Viaja para a base de um amigo. */
  async viajarPara(amigo) {
    this.fecharPaineis();
    this.estado.stats.portaisUsados = (this.estado.stats.portaisUsados ?? 0) + 1;

    const bonus = aplicarBônus(this.derivados, { xp: 60, emPortal: true, xpPortalPct: 25 });
    this.ganharXp(bonus.xp);
    this.mostrarToast(`Você viajou para a base de ${amigo.nome}.`, 3000);
    await this.persistir();
  }

  // ---------- loop ----------

  update(time, delta) {
    const dt = delta / 1000;
    const cam = this.cameras.main;

    // Chao cobre a camera.
    this.chao.setSize(cam.width, cam.height);
    this.chao.setPosition(-cam.scrollX, -cam.scrollY);

    // Movimento
    const t = this.teclas;
    let vx = 0;
    let vy = 0;
    if (t.esquerda.isDown || this.teclado.left.isDown) vx -= 1;
    if (t.direita.isDown || this.teclado.right.isDown) vx += 1;
    if (t.cima.isDown || this.teclado.up.isDown) vy -= 1;
    if (t.baixo.isDown || this.teclado.down.isDown) vy += 1;
    this.jogador.setVelocity(vx * VELOCIDADE, vy * VELOCIDADE);
    this.jogador.setDepth(this.jogador.y);

    // Mira: quadrado no chao, sempre a frente do jogador.
    this.mira.setPosition(
      this.jogador.x + vx * TAMANHO * 1.6,
      this.jogador.y + vy * TAMANHO * 1.6,
    );
    this.mira.setDepth(this.jogador.y + 1);
    this.mira.setVisible(Math.abs(vx) + Math.abs(vy) > 0);

    // Regeneracao de vida e poder.
    if ((this.estado.vida ?? 0) < this.derivados.vidaMax) {
      this.estado.vida = Math.min(this.derivados.vidaMax, this.estado.vida + this.derivados.regen * dt);
    }
    if ((this.estado.poder ?? 0) < this.derivados.poderMax) {
      this.estado.poder = Math.min(
        this.derivados.poderMax,
        this.estado.poder + this.derivados.regenPoder * dt,
      );
    }
    if (time - (this.ultimoUpdateHud ?? 0) > 200) {
      this.atualizarDerivados();
      this.ultimoUpdateHud = time;
    }

    // Portal segue o jogador.
    if (this.portal) {
      this.portal.setPosition(this.jogador.x, this.jogador.y + 90);
      this.portalAlvo = { x: this.jogador.x, y: this.jogador.y + 90 };
      this.particulasPortal.setPosition(this.jogador.x, this.jogador.y + 78);
    }

    // IA dos monstros.
    this.atualizarMonstros(dt);
  }

  atualizarMonstros(dt) {
    for (const m of this.monstros) {
      if (!m.corpo.active) continue;
      const dist = Phaser.Math.Distance.Between(
        this.jogador.x, this.jogador.y - 14, m.corpo.x, m.corpo.y - 14,
      );

      const comportamento = m.def.comportamento ?? 'errante';
      const velocidade = (m.def.velocidade ?? 40) * dt;

      if (dist < 220 && comportamento !== 'passivo') {
        // Persegue ou ataca.
        const ang = Phaser.Math.Angle.Between(m.corpo.x, m.corpo.y - 14, this.jogador.x, this.jogador.y - 14);
        if (dist > (m.def.alcance ?? 28) + 10) {
          m.corpo.x += Math.cos(ang) * velocidade;
          m.corpo.y += Math.sin(ang) * velocidade;
          m.corpo.setFlipX(Math.cos(ang) < 0);
        } else if (comportamento === 'agressivo' && (m.cooldown ?? 0) <= 0) {
          this.atacarJogador(m);
          m.cooldown = 1.2;
        }
      } else if (comportamento === 'errante' || comportamento === 'territorial') {
        // Anda por ai.
        m.direcao ??= Math.random() * Math.PI * 2;
        m.direcao += (Math.random() - 0.5) * 0.6;
        m.corpo.x += Math.cos(m.direcao) * velocidade * 0.4;
        m.corpo.y += Math.sin(m.direcao) * velocidade * 0.4;
        m.corpo.setFlipX(Math.cos(m.direcao) < 0);
      }

      m.cooldown = (m.cooldown ?? 0) - dt;
      m.corpo.setDepth(m.corpo.y);
      m.corpo.y = Phaser.Math.Clamp(m.corpo.y, 60, ALTURA_TILEMAP - 20);
      m.corpo.x = Phaser.Math.Clamp(m.corpo.x, 20, LARGURA_TILEMAP - 20);

      // Barra de vida acima do monstro.
      m.barraVida.fundo.setPosition(m.corpo.x - 16, m.corpo.y - 34);
      m.barraVida.frente.setPosition(m.corpo.x - 15, m.corpo.y - 33);
      m.barraVida.atualizar(m.stats.vida / Math.max(1, m.stats.vidaMax));
    }
  }

  atacarJogador(monstro) {
    const recebido = calcularDanoRecebido({
      dano: monstro.stats.dano,
      reducaoPct: this.derivados.pct.reducaoDanoPct,
      escudoPct: this.derivados.escudoPct,
      defesa: this.derivados.defesa,
    });
    this.estado.vida = Math.max(0, (this.estado.vida ?? 0) - recebido);
    this.flashes(this.jogador.x, this.jogador.y - 20, 0xd05a5a, 6);
    this.atualizarDerivados();
    if (this.estado.vida <= 0) this.morrer();
  }
}

// ---------- helpers locais ----------

function hashSimples(texto) {
  let h = 0;
  const s = String(texto);
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function somarMapasSeguras(a, b) {
  const saida = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    saida[k] = (saida[k] ?? 0) + (Number(v) || 0);
  }
  return saida;
}
