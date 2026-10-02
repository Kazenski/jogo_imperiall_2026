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
  TAMANHO_CHUNK_PADRAO,
  gerarTerrenoMundo,
  aplicarAlteracoesTerreno,
  escavarCelula,
  colocarCelula,
  chaveCelula,
  espalharBausEItens,
  chunkParaBloco,
  tamanhoDoChunk,
  chunksDoMundo,
} from '../core/mundo.js';
import { VELOCIDADE, OURO, PERGAMINHO } from '../constants.js';
import {
  texto as uiTexto,
  titulo as uiTitulo,
  painel,
  botao,
  barra,
  caixaArredondada,
} from '../ui/comuns.js';

/**
 * Cenas de painel que abrem por cima do mundo.
 *
 * `fecharPaineis()` para todas elas. Precisa ser uma lista fechada (e nao uma
 * varredura generica em `scene.scenes`) porque `Admin` eo proprio `World`
 * Matcheriam junto e parar o mundo no meio de um painel.
 */
const PAINEIS_SOBREPOSTOS = ['Status', 'Inventario', 'Talentos', 'Fabricacao', 'Reinos', 'Ajuda', 'Admin'];

// Mapa maior: mais espaco para explorar, bases maiores, mais recursos.
// 60x44 = 2640x1936 (antes 34x26 = 1088x832).
const COLUNAS = 60;
const LINHAS = 44;
const TAMANHO = TAMANHO_BLOCO;
const LARGURA_TILEMAP = COLUNAS * TAMANHO;
const ALTURA_TILEMAP = LINHAS * TAMANHO;

// Offsets do portal: o jogador escolhe onde o portal fica (cicla com a tecla P).
// 0 = direita, 1 = esquerda, 2 = cima, 3 = baixo.
const PORTAL_OFFSETS = [
  { dx: TAMANHO * 3.2, dy: 0 },    // direita
  { dx: -TAMANHO * 3.2, dy: 0 },   // esquerda
  { dx: 0, dy: -TAMANHO * 3.2 },   // cima
  { dx: 0, dy: TAMANHO * 3.2 },    // baixo
];

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

    // `create` e async (precisa carregar o catalogo) e o Phaser comeca a chamar
    // `update` no proximo frame, ou seja, ANTES deste metodo terminar. Sem esta
    // trava, o primeiro update roda com metade do cenario construido e estoura
    // em `this.chao.setSize`.
    this.pronto = false;
    this.carregando = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Forjando o reino...', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: OURO,
      })
      .setOrigin(0.5);

    this.catalogo = await carregarCatalogo();
    this.reinoAtual = reinoInicial(this.catalogo, this.estado.nivel ?? 1) ?? this.catalogo.worldTemplates?.[0];

    this.criarDerivados();
    this.criarEntrada();
    this.criarCamera();
    this.criarJogador();
    this.criarMundo();
    this.criarTerreno();
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

    // Aviso do terreno, AQUI e não dentro de `criarTerreno`.
    //
    // `mostrarToast` escreve em `this.toast`, que só existe depois de
    // `criarHud`. Chamar antes derruba o `create` inteiro e o jogador fica
    // olhando uma tela preta — e foi exatamente o que aconteceu na primeira
    // versão, num mundo sem chunks.
    if (this.terreno?.size === 0) {
      this.mostrarToast(this.diagnosticoChunks(), 5200);
    } else if (this.catalogo?.avisos?.length) {
      // Alguma coleção veio da semente. O jogo funciona, mas o conteúdo que o
      // admin cadastrou — chunks, NPCs, biomas — NÃO está aqui. Sem isto o
      // jogador acha que cadastrou errado.
      this.mostrarToast(
        `Carregou ${this.catalogo.avisos.length} coleção(ões) da semente: ` +
          `${this.catalogo.avisos.join(', ')}.`,
        6000,
      );
    }

    this.carregando.destroy();
    this.pronto = true;
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
    // Setas do teclado. Complementam o WASD no movimento.
    this.teclado = this.input.keyboard.createCursorKeys();

    // WASD com nomes semanticos. O `update` le exatamente estes nomes, entao
    // as duas listas precisam concordar — antes elas divergiam (w/a/s/d aqui,
    // esquerda/direita/cima/baixo no update) e o jogo estourava no primeiro
    // frame de movimento.
    this.teclas = this.input.keyboard.addKeys({
      esquerda: Phaser.Input.Keyboard.KeyCodes.A,
      direita: Phaser.Input.Keyboard.KeyCodes.D,
      cima: Phaser.Input.Keyboard.KeyCodes.W,
      baixo: Phaser.Input.Keyboard.KeyCodes.S,
    });
  }

  /**
   * Camera arrastavel com o mouse.
   *
   * Arrastar o terreno solta o "seguir o jogador", o que deixa olhar areas
   * ainda nao exploradas; soltar devolve o controle automatico. Arraste que
   * termina em cima de um botao conta como clique normal.
   */
  criarCamera() {
    const cam = this.cameras.main;
    this.arrastando = false;
    this.arrastou = 0;
    this.arrastarInicio = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

    this.input.on('pointerdown', (ponteiro) => {
      if (ponteiro.button !== 0) return;
      // Nao sequestrar cliques que caem em botoos da interface.
      if (this.input.hitTestPointer(ponteiro).length > 0) return;

      this.arrastando = true;
      this.arrastou = 0;
      this.arrastarInicio.x = ponteiro.x;
      this.arrastarInicio.y = ponteiro.y;
      this.arrastarInicio.scrollX = cam.scrollX;
      this.arrastarInicio.scrollY = cam.scrollY;
      cam.stopFollow();
    });

    this.input.on('pointermove', (ponteiro) => {
      if (!this.arrastando || !ponteiro.isDown) return;
      const dx = ponteiro.x - this.arrastarInicio.x;
      const dy = ponteiro.y - this.arrastarInicio.y;
      this.arrastou = Math.max(this.arrastou, Math.abs(dx) + Math.abs(dy));
      cam.scrollX = this.arrastarInicio.scrollX - dx;
      cam.scrollY = this.arrastarInicio.scrollY - dy;
    });

    const soltar = () => {
      if (!this.arrastando) return;
      this.arrastando = false;
      // Volta a seguir o jogador, mas so se o arrasto nao foi lento demais
      // para ser construed como clique.
      // `create()` é async (carrega o catálogo) e o Phaser já entrega eventos
      // de ponteiro. Um `pointerup` que chegue antes de `criarJogador` roda
      // isto com `this.jogador` nulo, e `startFollow(null)` estoura DENTRO do
      // Phaser com "Cannot read properties of null (reading 'x')" — erro de
      // biblioteca que não diz nada sobre a causa.
      if (!this.jogador) return;
      cam.startFollow(this.jogador, true, 0.12, 0.12);
      cam.setDeadzone(220, 140);
    };

    this.input.on('pointerup', soltar);
    this.input.on('pointerupoutside', soltar);
    this.input.on('gameout', soltar);
  }

  criarJogador() {
    // Usa posição salva ou centro do mapa como fallback.
    // A posição é salva em `this.estado.posicao = { x, y }` pelo loop de jogo
    // e na saida da cena.
    const spawnX = this.estado?.posicao?.x ?? LARGURA_TILEMAP / 2;
    const spawnY = this.estado?.posicao?.y ?? ALTURA_TILEMAP / 2 + 120;

    this.jogador = this.physics.add
      .sprite(spawnX, spawnY, TEXTURAS.JOGADOR)
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

  // =====================================================================
  // TERRENO — a grade que o jogador cava
  // =====================================================================
  //
  // O terreno é PROCEDURAL: `gerarTerrenoMundo` devolve a grade a partir da
  // semente do chunk, e o perfil do jogador entra só como sobreposição das
  // células que ele mudou. Nada de guardar a grade no Firestore.
  //
  // Cada célula é um `Image` com `setDepth(y)`, e não um retângulo de um
  // `Graphics` só. Isso custa 400 objetos, e é o que dá a sobreposição certa:
  // um `Graphics` tem UMA profundidade, então um bloco de subsolo ficaria
  // sempre atrás ou sempre na frente do jogador, conforme o jogador estivesse
  // acima ou abaixo da linha do chão. Com um objeto por célula, o jogador
  // "entra" no terreno ao descer, que é o efeito que dá a sensação de buraco.
  //
  // A ATUALIZAÇÃO É INCREMENTAL. Escarar destrói uma imagem e coloca uma
  // imagem; não redesenha o chunk. Redesenhar 400 imagens a cada escavação
  // daria um engasgo visível a cada toque.

  criarTerreno() {
    this.imagensTerreno = new Map();

    const chunks = this.catalogo?.chunks ?? [];
    this.terreno = gerarTerrenoMundo(this.reinoAtual, chunks, {
      largura: COLUNAS,
      altura: LINHAS,
      seed: this.uid ?? 'local',
    });

    // A escavação do jogador vem por cima do procedural. Precisa ser um objeto
    // próprio: se o perfil veio de uma versão antiga do save, `terrenoCavado`
    // é undefined e escrever nele quebraria.
    this.estado.terrenoCavado ??= {};
    aplicarAlteracoesTerreno(this.terreno, this.estado.terrenoCavado);

    for (const celula of this.terreno.values()) {
      this.criarImagemTerreno(celula);
    }

    // Sem chunks cadastrados o terreno sai vazio, e o jogador cairia num
    // mundo sem chão. O aviso é dado no fim do `create`, quando o HUD já
    // existe — ver a nota lá.
    this.desenharBausEItens();
  }

  /** Cria a imagem de uma célula do terreno. */
  criarImagemTerreno(celula) {
    const def = buscarItem(this.catalogo, celula.itemId);
    if (!def) return;

    const img = this.add
      .image(celula.x * TAMANHO, (celula.y + 1) * TAMANHO, this.texturaDoItem(def))
      .setOrigin(0.5, 1)
      .setTint(def.cor ?? 0xffffff)
      .setDepth(celula.y * TAMANHO);

    img.setData('celula', celula);
    img.setData('chave', chaveCelula(celula.x, celula.y));
    this.imagensTerreno.set(img.getData('chave'), img);
  }

  /**
   * Baús e itens largados no chão, vindos do chunk.
   *
   * O loot do baú já vem sorteado: um baú precisa ter o MESMO conteúdo para
   * todo mundo e para sempre, senão o jogador abre duas vezes e ganha
   * coisas diferentes — o que é a forma mais rápida de fabricar_item bug.
   */
  desenharBausEItens() {
    this.imagensBau = new Map();
    this.imagensItemChao = new Map();

    // Mesmo filtro do terreno: chunk sem mundo vale para qualquer reino.
    const chunks = chunksDoMundo(this.catalogo?.chunks ?? [], this.reinoAtual?.id);
    for (const chunk of chunks) {
      const espalha = espalharBausEItens(chunk, tamanhoDoChunk(chunk));

      for (const bau of espalha.baus) {
        // Não põe baú dentro da terra: um baú soterrado é inacessível, e o
        // jogador não tem como saber que existe.
        if (this.terreno.has(chaveCelula(bau.x, bau.y))) continue;
        const def = buscarItem(this.catalogo, bau.bauId);
        if (!def) continue;
        const img = this.add
          .image(bau.x * TAMANHO, (bau.y + 1) * TAMANHO, this.texturaDoItem(def))
          .setOrigin(0.5, 1)
          .setTint(def.cor ?? 0xd4af6a)
          .setDepth(bau.y * TAMANHO - 1)
          .setInteractive({ useHandCursor: true });
        img.setData('bau', bau);
        this.imagensBau.set(chaveCelula(bau.x, bau.y), img);
      }

      for (const item of espalha.itensChao) {
        if (this.terreno.has(chaveCelula(item.x, item.y))) continue;
        const def = buscarItem(this.catalogo, item.itemId);
        if (!def) continue;
        const img = this.add
          .image(item.x * TAMANHO, (item.y + 1) * TAMANHO, this.texturaDoItem(def))
          .setOrigin(0.5, 1)
          .setTint(def.cor ?? 0xffffff)
          .setDepth(item.y * TAMANHO - 1)
          .setInteractive({ useHandCursor: true });
        img.setData('itemChao', item);
        this.imagensItemChao.set(chaveCelula(item.x, item.y), img);
      }
    }
  }

  /**
   * Esvara a célula sob a mira. Devolve o bloco retirado.
   *
   * Cava é REMOVER a célula da grade. O que o jogador ganhou fica no
   * inventário, e a "marcatura" da escavação é gravada no perfil como `null`
   * — para que o buraco continue lá quando ele voltar, e desapareça se o
   * chunk for reescrito no painel (que é o que se espera: quem redesenha o
   * mundo, redesenha o buraco junto).
   */
  escavar(x, y) {
    const chave = chaveCelula(x, y);
    const celula = this.terreno.get(chave);
    if (!celula) return null;

    const def = buscarItem(this.catalogo, celula.itemId);
    if (!def) return null;

    const resultado = minerar({
      catalogo: this.catalogo,
      estado: this.estado,
      itemId: celula.itemId,
      forcaMineracao: this.derivados.poderMineracao,
    });
    if (!resultado.ok) {
      this.mostrarToast(resultado.motivo);
      return null;
    }

    escavarCelula(this.terreno, x, y);
    this.estado.terrenoCavado[chave] = null;

    const img = this.imagensTerreno.get(chave);
    if (img) {
      this.flashes(img.x, img.y - 12, 0xffffff, 6);
      img.destroy();
      this.imagensTerreno.delete(chave);
    }

    for (const ganho of resultado.ganhos) {
      const g = buscarItem(this.catalogo, ganho.itemId);
      this.mostrarToast(`+${ganho.qtd} ${g?.nome ?? ganho.itemId}`);
    }
    this.ganharXp(resultado.xp);
    return celula;
  }

  /** Coloca o bloco selecionado na célula da mira. */
  colocarNaMira(x, y, itemId) {
    const chave = chaveCelula(x, y);
    if (this.terreno.has(chave)) {
      this.mostrarToast('Já tem bloco ali.');
      return false;
    }

    const celula = colocarCelula(this.terreno, x, y, itemId);
    if (!celula) return false;

    this.estado.terrenoCavado[chave] = itemId;
    this.criarImagemTerreno(celula);
    this.imagensTerreno.get(chave)?.setDepth(y * TAMANHO);
    return true;
  }

  /** Abre um baú: dá o loot ao jogador e some com o baú. */
  abrirBau(bau, img) {
    for (const item of bau.itens ?? []) {
      const qtd = item.qtd ?? 1;
      adicionarItem(this.estado.inventario, item.itemId, qtd);
      const def = buscarItem(this.catalogo, item.itemId);
      this.mostrarToast(`+${qtd} ${def?.nome ?? item.itemId}`);
    }
    if (!bau.itens?.length) this.mostrarToast('Baú vazio.');
    img?.destroy();
    this.imagensBau.delete(chaveCelula(bau.x, bau.y));
    this.ganharXp(5);
    this.persistir();
  }

  /** Pega um item largado no chão. */
  pegarItemChao(item, img) {
    adicionarItem(this.estado.inventario, item.itemId, item.qtd ?? 1);
    const def = buscarItem(this.catalogo, item.itemId);
    this.mostrarToast(`+${item.qtd ?? 1} ${def?.nome ?? item.itemId}`);
    img?.destroy();
    this.imagensItemChao.delete(chaveCelula(item.x, item.y));
    this.ganharXp(1);
    this.persistir();
  }

  /**
 * Explica, em uma frase, por que o mundo saiu liso.
 *
 * "Nenhum chunk cadastrado" é quase sempre mentira: geralmente HÁ chunks no
 * painel, e o que falta é um detalhe — nenhum com peso, ou todos apontando
 * para outro mundo, ou sem bloco de subsolo. Sem dizer qual, o admin cadastro
 * cinco chunks e não entende nada.
 */
  diagnosticoChunks() {
    const todos = this.catalogo?.chunks ?? [];
    const falhou = (this.catalogo?.avisos ?? []).filter((a) => a.startsWith('chunks'));
    if (!todos.length && falhou.length) {
      return `Mundo liso: os chunks NAO carregaram do servidor (${falhou[0]}). O jogo está usando a semente, que não tem chunks. Recarregue a página.`;
    }
    if (!todos.length) {
      return 'Mundo liso: nenhum chunk cadastrado. Crie um na aba Chunks do painel.';
    }

    const doMundo = todos.filter((c) => !c.mundoId || c.mundoId === this.reinoAtual?.id);
    const comPeso = doMundo.filter((c) => (Number(c.peso) || 0) > 0);
    const posicionados = doMundo.filter(
      (c) => Number.isFinite(Number(c.posX)) && Number.isFinite(Number(c.posY)),
    );
    const semSubsolo = doMundo.filter(
      (c) => (c.blocosSubSolo ?? []).length === 0,
    );

    const partes = [];
    if (!doMundo.length) {
      partes.push(`${todos.length} chunk(s) cadastrados, nenhum deste mundo`);
    } else {
      partes.push(`${doMundo.length} chunk(s) deste mundo`);
    }
    if (!comPeso.length) {
      partes.push('nenhum com peso (peso 0 = só onde você posicionou no mapa)');
    }
    if (posicionados.length) {
      partes.push(`${posicionados.length} posicionado(s)`);
    }
    if (doMundo.length && semSubsolo.length === doMundo.length) {
      partes.push('nenhum tem bloco de subsolo — sem subsolo não há o que cavar');
    }

    return `Mundo liso: ${partes.join(' · ')}.`;
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

    // Barra de vida flutuante. Fica em coordenadas de MUNDO (mesmo scroll do
    // corpo), senao o scrollFactor 0 a prenderia na tela.
    monstro.barraVida = barra(this, x - 16, y - 34, 32, 5, 0xd05a5a, 1);
    monstro.barraVida.container.setDepth(y + 1);

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

  /**
   * Portal Arcanos da base.
   *
   * Fica ao lado do jogador na posicao escolhida (cicla com tecla P).
   * E clicavel, e entra na lista de alvos do `E`.
   */
  criarPortal() {
    this.portalOffsetIdx = this.estado?.portalOffsetIdx ?? 0;
    const off = PORTAL_OFFSETS[this.portalOffsetIdx];
    const x = this.jogador.x + off.dx;
    const y = this.jogador.y + off.dy;

    // Aro exterior (runico) — gira devagar.
    const aro = this.add.graphics();
    aro.fillStyle(0x7a4fd4, 0.12);
    aro.fillCircle(0, 0, 84);
    this.portalAro = this.add.container(x, y, [aro]).setDepth(y - 3);
    this.tweens.add({
      targets: aro,
      angle: 360,
      duration: 20000,
      repeat: -1,
      ease: 'Linear',
    });

    // Brilho pulsante central.
    const brilho = this.add.circle(x, y - 22, 72, 0x7a4fd4, 0.14).setDepth(y - 2);
    this.portalBrilho = brilho;

    // Portal principal.
    this.portal = this.add
      .image(x, y, TEXTURAS.PORTAL)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .setInteractive({ useHandCursor: true });

    // Anel de runas orbitando (particulas decorativas).
    this.portalRunas = this.add.particles(x, y - 14, TEXTURAS.PARTICULA, {
      speed: 0,
      lifespan: 3000,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0xc9a6ff,
      frequency: 800,
      quantity: 3,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, 56),
        quantity: 3,
      },
    }).setDepth(y - 1);

    // Particulas subindo (essencia arcana).
    this.particulasPortal = this.add
      .particles(x, y - 14, TEXTURAS.PARTICULA, {
        speedY: { min: -80, max: -30 },
        speedX: { min: -18, max: 18 },
        lifespan: 2000,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: 0xc9a6ff,
        frequency: 100,
        quantity: 1,
      })
      .setDepth(y - 1);

    // Placa de identificacao acima do portal.
    const placa = caixaArredondada(this, x, y - 62, 128, 24, {
      raio: 7,
      preenchimento: 0x1a1030,
      alfa: 0.9,
      borda: 0x9a6fd4,
      larguraBorda: 1,
      origem: [0.5, 0.5],
    });
    placa.add(
      this.add
        .text(0, 0, 'PORTAL [E]  mover [P]', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#c9a6ff',
        })
        .setOrigin(0.5),
    );
    placa.setDepth(y + 1);
    this.portalPlaca = placa;

    // Animacoes: pulso do portal + brilho + rotacao do aro.
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
    this.tweens.add({
      targets: this.portalAro,
      angle: 360,
      duration: 30000,
      repeat: -1,
      ease: 'Linear',
    });

    // Clique abre o painel de portais; hover destaca o aro.
    this.portal.on('pointerover', () => {
      brilho.setFillStyle(0x9a6fd4, 0.3);
      placa.setScale(1.05);
    });
    this.portal.on('pointerout', () => {
      brilho.setFillStyle(0x7a4fd4, 0.14);
      placa.setScale(1);
    });
    this.portal.on('pointerdown', () => {
      if (this.painelAberto) return;
      this.abrirPainelDePortais();
    });

    this.portalAlvo = { x, y };
  }

  /**
   * Reposiciona o portal ao LADO do jogador conforme offset escolhido.
   *
   * Fica num metodo a parte de proposito: `update()` repositiona todo frame, e
   * a versao anteriorHardcodava `jogador.y + 90` la dentro, jogando o portal de
   * volta para baixo do jogador e desfazendo o que `criarPortal` tinha feito.
   * Qualquer ajuste de offset precisa existir em UM lugar so.
   */
  posicionarPortal() {
    if (!this.portal) return;
    const off = PORTAL_OFFSETS[this.portalOffsetIdx ?? 0];
    const x = this.jogador.x + off.dx;
    const y = this.jogador.y + off.dy;

    this.portal.setPosition(x, y).setDepth(y);
    this.portalAlvo = { x, y };
    this.particulasPortal?.setPosition(x, y - 14).setDepth(y - 1);
    this.portalRunas?.setPosition(x, y - 14).setDepth(y - 1);
    this.portalBrilho?.setPosition(x, y - 22).setDepth(y - 2);
    this.portalPlaca?.setPosition(x, y - 62).setDepth(y + 1);
    this.portalAro?.setPosition(x, y).setDepth(y - 3);
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
    // Nome do personagem tambem e atalho para o painel de status.
    this.txtNome.setInteractive({ useHandCursor: true });
    this.txtNome.on('pointerover', () => this.txtNome.setAlpha(0.75));
    this.txtNome.on('pointerout', () => this.txtNome.setAlpha(1));
    this.txtNome.on('pointerdown', () => this.abrirStatus());

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

    // As dicas deixaram de ser um texto corrido no topo: viraram um botao que
    // abre um modal. Um paragrafo de atalhos no canto da tela competia com o
    // nome, o nivel e os recursos, e nao cabia em telas estreitas.
    //
    // Agora esse botao abre a WIKI (tecla H), e o resumo de teclas fica em
    // `abrirDicas()`, que continua acessivel pelo clique no proprio botao com
    // o painel ja aberto — evita duas rotas para a mesma informacao.
    this.botaoAjuda = botao(this, this.scale.width - 18, 10, 'Wiki  [H]', () => this.abrirAjuda(), {
      origem: [1, 0],
      largura: 84,
      altura: 26,
      raio: 13,
      cor: 0x241c14,
      corHover: 0x3a2c20,
      corBorda: 0x8a6a2f,
      corTexto: PERGAMINHO,
      tamanho: '11px',
    });
    this.hud.add(this.botaoAjuda.container);

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
      // Salva posicao final ao sair do mundo.
      if (this.uid && this.jogador?.active) {
        this.estado.posicao = { x: Math.round(this.jogador.x), y: Math.round(this.jogador.y) };
        salvarProgresso(this.uid, this.estado).catch(() => {});
      }
    });
  }

  aoRedimensionar() {
    this.botaoDicas?.definirPosicao(this.scale.width - 18, 10);
    this.toast.setPosition(this.scale.width / 2, 110);
  }

  /**
   * Modal de dicas e controles.
   *
   * Substitui a linha de texto que ficava solta no topo da tela. E um painel
   * sobreposto (nao uma cena nova) porque precisa aparecer instantaneamente,
   * sem passar pela pilha de cenas, e some no primeiro ESC/clique fora.
   */
  abrirDicas() {
    if (this.modal?.active) {
      this.fecharModal();
      return;
    }

    const { width, height } = this.scale;
    const w = Math.min(460, width - 48);
    const h = Math.min(420, height - 64);
    const x0 = Math.round((width - w) / 2);
    const y0 = Math.round((height - h) / 2);

    const atalhos = [
      ['Andar', 'W, A, S, D'],
      ['Olhar o mapa', 'arrastar'],
      ['Usar / atacar / minerar', 'E'],
      ['Construir bloco', 'Q'],
      ['Publicar / ocultar portal', 'B'],
      ['Personagem', 'V'],
      ['Mochila', 'I'],
      ['Talentos', 'T'],
      ['Fabricacao', 'C'],
      ['Reinos Etereos', 'R'],
      ['Portais', 'P'],
      ['Wiki do Imperio', 'H'],
      ['Fechar painel', 'ESC'],
    ];

    // A capa precisa ficar ABAIXO do `box` (o retangulo e added primeiro): se o
    // container fosse criado antes e a capa addada nele, o retangulo
    // interativo cobriria os botoes.
    const capa = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setInteractive()
      .setScrollFactor(0);
    const box = this.add.container(0, 0).setDepth(3000).setScrollFactor(0);
    this.modal = box;

    box.add(capa);
    box.add(painel(this, x0, y0, w, h));
    box.add(uiTitulo(this, x0 + 24, y0 + 20, 'ATALHOS', '18px'));

    let y = y0 + 54;
    for (const [rotulo, tecla] of atalhos) {
      box.add(uiTexto(this, x0 + 24, y, rotulo, { fontSize: '12px' }));
      box.add(
        uiTexto(this, x0 + w - 24, y, tecla, { fontSize: '12px', color: OURO, align: 'right' })
          .setOrigin(1, 0)
          .setAlpha(0.9),
      );
      y += 20;
    }

    if (this.isAdmin) {
      box.add(uiTexto(this, x0 + 24, y, 'Painel do administrador', { fontSize: '12px' }));
      box.add(
        uiTexto(this, x0 + w - 24, y, 'F2', { fontSize: '12px', color: OURO, align: 'right' })
          .setOrigin(1, 0)
          .setAlpha(0.9),
      );
      y += 20;
    }

    // A lista completa vive na wiki (H). Este modal ficou so com o resumo, que
    // cabe numa tela e nao empurra mais nada para fora.
    box.add(
      botao(this, x0 + w / 2 - 100, y + 16, 'Abrir a Wiki do Imperio', () => {
        this.fecharModal();
        this.abrirAjuda();
      }, { largura: 240, altura: 32, tamanho: '12px', cor: 0x2a2018, corHover: 0x3a2c20, corBorda: 0x8a6a2f, corTexto: PERGAMINHO }).container,
    );

    box.add(
      botao(this, x0 + w - 90, y0 + h - 30, 'Fechar', () => this.fecharModal(), {
        largura: 140,
        altura: 30,
        tamanho: '12px',
      }).container,
    );

    capa.on('pointerdown', () => this.fecharModal());
    this.input.keyboard.once('keydown-ESC', () => this.fecharModal());
    this.input.keyboard.once('keydown-H', () => this.fecharModal());
  }

  /** Abre a wiki (tecla H). */
  abrirAjuda() {
    this.abrirSobreposto('Ajuda', {
      uid: this.uid,
      estado: this.estado,
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
    });
  }

  fecharModal() {
    this.modal?.destroy(true);
    this.modal = null;
  }

  /** Botoes flutuantes no canto inferior direito (atalhos de toque/atalho). */
  /**
   * Menu principal: barra vertical de icones na direita.
   *
   * Cada botao e so o icone (a dica de contexto traz o nome e a tecla). O icone
   * e posicionado pelo proprio `botao()` pelo parametro `icone` — posicionar a
   * imagem a mao punha o sprite na BORDA da caixa em vez do centro, e era o que
   * fazia os botoes parecerem espremidos para a direita.
   */
  criarBarraDeAcoes() {
    this.barraAcoes = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);
    this.tooltip = null;

    const acoes = [
      { rotulo: 'Personagem', tecla: 'V', textura: TEXTURAS.ICO_PERSONAGEM, fn: () => this.abrirStatus() },
      { rotulo: 'Mochila', tecla: 'I', textura: TEXTURAS.ICO_MOCHILA, fn: () => this.abrirInventario() },
      { rotulo: 'Talentos', tecla: 'T', textura: TEXTURAS.ICO_TALENTOS, fn: () => this.abrirTalentos() },
      { rotulo: 'Fabricação', tecla: 'C', textura: TEXTURAS.ICO_FABRICAR, fn: () => this.abrirFabricacao() },
      { rotulo: 'Reinos', tecla: 'R', textura: TEXTURAS.ICO_REINOS, fn: () => this.abrirReinos() },
      { rotulo: 'Portais', tecla: 'P', textura: TEXTURAS.ICO_PORTAIS, fn: () => this.abrirPainelDePortais() },
    ];

    this.botoesMenu = [];
    let i = 0;
    for (const acao of acoes) {
      i += 1;
      const b = botao(this, 0, -i * 46, '', acao.fn, {
        origem: [1, 1],
        largura: 42,
        altura: 42,
        raio: 10,
        cor: 0x241c14,
        corHover: 0x4a3826,
        corBorda: 0x8a6a2f,
        icone: { texture: acao.textura, tamanho: 24, alfa: 0.92 },
      });

      b.clique.on('pointerover', () => this.mostrarTooltip(acao.rotulo, acao.tecla, i - 1));
      b.clique.on('pointerout', () => this.esconderTooltip());

      this.barraAcoes.add(b.container);
      this.botoesMenu.push(b);
    }

    this.reposicionarAcoes();
  }

  /**
   * Dica de contexto ao passar o mouse no menu.
   *
   * A posicao vem do botao real (`getBounds`), nao de recalcular o passo da
   * barra aqui: duplicar essa conta fez a dica nascer 46px fora, porque a
   * ancora do botao e `-(indice + 1) * 46` e nao `-indice * 46`.
   */
  mostrarTooltip(rotulo, tecla, indice = 0) {
    this.esconderTooltip();
    const largura = 132;
    const altura = 28;
    const box = caixaArredondada(this, 0, 0, largura, altura, {
      raio: 8,
      preenchimento: 0x0d0a07,
      alfa: 0.95,
      borda: 0x8a6a2f,
      larguraBorda: 1,
      origem: [1, 0.5],
    });
    box.add(
      this.add
        .text(-largura / 2, 0, `${rotulo}  [${tecla}]`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: PERGAMINHO,
        })
        .setOrigin(0.5),
    );

    const alvo = this.botoesMenu[indice]?.clique;
    const limites = alvo?.getBounds();
    const y = limites ? limites.y + limites.height / 2 : this.barraAcoes.y - 21;
    const x = limites ? limites.x : this.barraAcoes.x;

    box.setPosition(x - 12, y);
    box.setDepth(1100);
    this.tooltip = box;
  }

  esconderTooltip() {
    this.tooltip?.destroy(true);
    this.tooltip = null;
  }

  reposicionarAcoes() {
    this.esconderTooltip();
    this.barraAcoes.setPosition(this.scale.width - 18, this.scale.height - 18);
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

    // Baús e itens no chão
    for (const [chave, img] of this.imagensBau ?? []) {
      if (!img.active) continue;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y - 14, img.x, img.y - 12);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'bau', img, chave };
      }
    }

    for (const [chave, img] of this.imagensItemChao ?? []) {
      if (!img.active) continue;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y - 14, img.x, img.y - 12);
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'itemChao', img, chave };
      }
    }

    // Portal (perto e com LAST_RO de folga: e um alvo alto, nao um no do chao)
    if (this.portal?.active) {
      const d = Phaser.Math.Distance.Between(
        this.jogador.x,
        this.jogador.y - 14,
        this.portal.x,
        this.portal.y - 26,
      );
      if (d < melhorDist) {
        melhorDist = d;
        melhor = { tipo: 'portal' };
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
    // A Mochila emite isto ao escolher um bloco para construir.
    //
    // Antes, `InventarioScene` escrevia `blocoSelecionado` em si mesma e
    // fechava — a seleção morria com a cena, e `acaoConstruir` caía sempre no
    // aviso de "selecione um bloco". Construir nunca funcionou.
    this.events.on('bloco-selecionado', (itemId) => {
      this.blocoSelecionado = itemId;
      const def = buscarItem(this.catalogo, itemId);
      this.mostrarToast(`${def?.nome ?? itemId} na mao — use Q perto de uma celula.`, 2600);
    });
    this.input.keyboard.on('keydown-B', () => this.alternarPortal());
    this.input.keyboard.on('keydown-I', () => this.abrirInventario());
    this.input.keyboard.on('keydown-T', () => this.abrirTalentos());
    this.input.keyboard.on('keydown-C', () => this.abrirFabricacao());
    this.input.keyboard.on('keydown-R', () => this.abrirReinos());
    this.input.keyboard.on('keydown-P', () => this.abrirPainelDePortais());
    // Shift+P alterna a posicao do portal (direita -> esquerda -> cima -> baixo).
    this.input.keyboard.on('keydown-P', (ev) => {
      if (ev.shiftKey) this.ciclarPortalOffset();
    });
    this.input.keyboard.on('keydown-V', () => this.abrirStatus());
    this.input.keyboard.on('keydown-H', () => this.abrirAjuda());

    // ESC so fecha painel. Antes ele DESLOGAVA a conta quando nao havia painel
    // aberto — apertar ESC para fechar algo e perder a sessao era facil, e
    // parecia "o jogo me jogou para fora". Sair agora e um ato deliberado,
    // pelo menu principal.
    this.input.keyboard.on('keydown-ESC', () => {
      this.fecharPaineis();
    });

    this.input.keyboard.on('keydown-F2', () => {
      if (!this.isAdmin) return;
      if (this.scene.isActive('Admin')) {
        this.fecharPaineis();
        this.scene.stop('Admin');
        return;
      }
      this.fecharPaineis();
      this.abrirSobreposto('Admin', { uid: this.uid });
    });
  }

  /**
   * Fecha todos os paineis sobrepostos.
   *
   * Antes so destruia o painel interno (`this.painel`, usado pelos Portais) e
   * deixava as cenas sobrepostas ligadas. Com a cena `Status` aberta, isso
   * significava que o `<input>` do apelido continuava no DOM e o painel
   * reaparecia no proximo ESC.
   */
  fecharPaineis() {
    if (this.painel?.active) {
      this.painel.destroy(true);
      this.painel = null;
    }
    for (const nome of PAINEIS_SOBREPOSTOS) {
      if (this.scene.isActive(nome)) this.scene.stop(nome);
    }
    this.fecharModal();
    this.esconderTooltip();
    this.painelAberto = false;
  }

  /**
   * Abre um painel sobreposto, garantindo que haja apenas uma instance.
   *
   * O `scene.launch` do Phaser e idempotente para cena ja ativa: ele roda o
   * `init` de novo mas nao recria a tela. Sem parar antes, apertar `V` duas
   * vezes seguidos deixaria o painel velho no lugar.
   */
  abrirSobreposto(nome, dados) {
    if (this.scene.isActive(nome)) this.scene.stop(nome);
    this.scene.launch(nome, dados);
  }

  /** E: ataca monstro, mineraria recurso ou derruba bloco, conforme o alvo. */
  acaoPrincipal() {
    // Ordem: o que está NA MIRA tem prioridade sobre o que está por perto.
    //
    // A mira é o que o jogador está olhando. Sem esta precedência, cavar a
    // célula da mira podia derrubar um bloco da base que estava a 40px, porque
    // `alvoPerto` varre tudo e fica com o mais próximo — e o bloco da base
    // estava mais perto que a célula que ele mirava.
    const celula = this.alvoCelula;
    if (celula && this.terreno?.has(chaveCelula(celula.x, celula.y))) {
      const cavado = this.escavar(celula.x, celula.y);
      if (cavado) {
        this.persistir();
        return;
      }
    }

    const alvo = this.alvoPerto();
    if (!alvo) {
      this.mostrarToast('Nada por perto.');
      return;
    }
    if (alvo.tipo === 'monstro') this.atacarMonstro(alvo.monstro);
    else if (alvo.tipo === 'recurso') this.minerarNo(alvo);
    else if (alvo.tipo === 'portal') this.abrirPainelDePortais();
    else if (alvo.tipo === 'bau') this.abrirBau(alvo.img.getData('bau'), alvo.img);
    else if (alvo.tipo === 'itemChao') this.pegarItemChao(alvo.img.getData('itemChao'), alvo.img);
    else this.derrubarBloco(alvo);
  }

  /** Q: constroi o bloco selecionado na celula da mira. */
  acaoConstruir() {
    const selecionado = this.blocoSelecionado;
    if (!selecionado) {
      this.mostrarToast('Selecione um bloco na Mochila [I] antes de construir.');
      return;
    }
    const celula = this.alvoCelula;
    if (!celula) {
      this.mostrarToast('Mire numa celula primeiro.');
      return;
    }

    // Consome do inventario ANTES de verificar se dá para colocar.
    //
    // Ao contrario: verificar depois consumir significa que o jogador perde o
    // bloco e nao ganha nada, toda vez que mira numa celula ja ocupada — o que
    // seria a primeira coisa que ele faz, num mundo inteiro cheio de terra.
    const inventario = this.estado.inventario;
    const total = (inventario.itens ?? []).reduce((s, i) => (i.itemId === selecionado ? s + (i.qtd ?? 0) : s), 0);
    if (total <= 0) {
      this.mostrarToast('Voce nao tem mais esse bloco.');
      this.blocoSelecionado = null;
      return;
    }
    if (this.terreno?.has(chaveCelula(celula.x, celula.y))) {
      this.mostrarToast('Ja tem bloco ali.');
      return;
    }

    const gastou = this.consumirDoInventario(selecionado, 1);
    if (!gastou) return;
    if (this.colocarNaMira(celula.x, celula.y, selecionado)) {
      this.mostrarToast('Bloco colocado.');
      this.ganharXp(2);
      this.persistir();
    }
  }

  /** Tira `qtd` unidades de `itemId` do inventário. Devolve se conseguiu. */
  consumirDoInventario(itemId, qtd) {
    const itens = this.estado.inventario?.itens;
    if (!Array.isArray(itens)) return false;
    for (const pilha of itens) {
      if (pilha?.itemId !== itemId) continue;
      if ((pilha.qtd ?? 0) < qtd) continue;
      pilha.qtd -= qtd;
      if (pilha.qtd <= 0) {
        const i = itens.indexOf(pilha);
        if (i >= 0) itens.splice(i, 1);
      }
      return true;
    }
    return false;
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
    // Objeto único. A chamada antiga passava quatro argumentos posicionais e a
    // função lê `{ estado, catalogo, col, linha }` — então `estado` chegava
    // `undefined` e `estado.base` estourava TypeError. Derrubar bloco da base
    // estava quebrado desde que a função mudou de assinatura.
    const resultado = derrubarBlocoDaBase({
      estado: this.estado,
      catalogo: this.catalogo,
      col,
      linha,
    });
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
      quantity: quantidade,
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

  /** Alterna a posicao do portal: direita -> esquerda -> cima -> baixo. */
  ciclarPortalOffset() {
    this.portalOffsetIdx = ((this.portalOffsetIdx ?? 0) + 1) % PORTAL_OFFSETS.length;
    this.estado.portalOffsetIdx = this.portalOffsetIdx;
    const nomes = ['direita', 'esquerda', 'cima', 'baixo'];
    this.mostrarToast(`Portal movido para a ${nomes[this.portalOffsetIdx]}.`);
    this.posicionarPortal();
    // Persiste a preferencia.
    if (this.uid) this.persistir().catch(() => {});
  }

  // ---------- paineis (implementados nas cenas seguintes) ----------

  /** V: painel do personagem (equipamento, atributos e apelido). */
  abrirStatus() {
    this.abrirSobreposto('Status', {
      uid: this.uid,
      estado: this.estado,
      catalogo: this.catalogo,
      derivados: this.derivados,
      // Sem conta nao ha onde persistir o apelido, entao o campo fica somente
      // como leitura.
      podeSalvar: Boolean(this.uid),
      aoSalvar: async (apelido) => {
        await this.persistir();
        this.txtNome.setText(apelido);
      },
    });
  }

  abrirInventario() {
    this.abrirSobreposto('Inventario', {
      uid: this.uid,
      estado: this.estado,
      catalogo: this.catalogo,
      derivados: this.derivados,
    });
  }

  abrirTalentos() {
    this.abrirSobreposto('Talentos', {
      estado: this.estado,
      catalogo: this.catalogo,
    });
  }

  abrirFabricacao() {
    this.abrirSobreposto('Fabricacao', {
      estado: this.estado,
      catalogo: this.catalogo,
      nivel: this.estado.nivel ?? 1,
    });
  }

  abrirReinos() {
    this.abrirSobreposto('Reinos', {
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
      botao(this, width / 2, height / 2 + h / 2 - 26, 'Fechar', () => this.fecharPaineis()).container,
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
    // `create` ainda nao terminou (carregando o catalogo).
    if (!this.pronto) return;

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
    //
    // A mira é AGORA a célula-alvo de verdade da escavação, e por isso ela é
    // encaixada na grade. Antes era um quadrado livre em `x + vx * 51.2`, o que
    // deixava ambíguo qual bloco "aquele" era: a 51.2px do jogador, quase dois
    // blocos, a posição caía num bloco ou no outro conforme o frame.
    //
    // A imagem da célula (x,y) é desenhada em `x*TAMANHO` com origem no canto
    // inferior, e tem `TAMANHO` de lado — ou seja, cobre exatamente o
    // retângulo [x*TAMANHO, (x+1)*TAMANHO]. Por isso `floor(coord / TAMANHO)`
    // dá a célula, sem correção nenhuma.
    const andando = Math.abs(vx) + Math.abs(vy) > 0;
    const miraX = Math.floor((this.jogador.x + vx * TAMANHO * 1.6) / TAMANHO) * TAMANHO + TAMANHO / 2;
    const miraY = Math.floor((this.jogador.y + vy * TAMANHO * 1.6) / TAMANHO) * TAMANHO + TAMANHO / 2;

    this.mira.setPosition(miraX, miraY);
    this.mira.setDepth(this.jogador.y + 1);
    this.mira.setVisible(andando);

    this.alvoCelula = { x: Math.floor(miraX / TAMANHO), y: Math.floor(miraY / TAMANHO) };

    // A mira muda de cor conforme há o que cavar. Sem isto o jogador não sabe
    // se está olhando para terra ou para o vazio.
    const temTerra = this.terreno?.has(chaveCelula(this.alvoCelula.x, this.alvoCelula.y));
    this.mira.setFillStyle(temTerra ? 0xd4af6a : 0x4a90d9, temTerra ? 0.3 : 0.14);
    this.mira.setStrokeStyle(1, temTerra ? 0xd4af6a : 0x4a90d9, 0.7);

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
    this.posicionarPortal();

    // IA dos monstros.
    this.atualizarMonstros(dt);

    // ---- Salva posicao periodicamente (a cada 10s) e na saida ----
    // So salva se ha uid (jogador logado) e a posicao mudou significativamente.
    if (this.uid && this.jogador?.active) {
      const agora = time;
      if (!this.ultimoSavePos || agora - this.ultimoSavePos > 10000) {
        const pos = { x: Math.round(this.jogador.x), y: Math.round(this.jogador.y) };
        const ant = this.estado.posicao ?? { x: 0, y: 0 };
        const dx = pos.x - ant.x;
        const dy = pos.y - ant.y;
        if (dx * dx + dy * dy > 400) { // ~20 pixels de diferenca
          this.estado.posicao = pos;
          this.ultimoSavePos = agora;
          // Dispara salvamento assincrono sem bloquear o frame.
          salvarProgresso(this.uid, this.estado).catch(() => {});
        }
      }
    }
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

      // Barra de vida acima do monstro. A barra e um container unico, entao
      // so ele precisa ser movido e ter o depth atualizado.
      m.barraVida.container.setPosition(m.corpo.x - 16, m.corpo.y - 34);
      m.barraVida.container.setDepth(m.corpo.y + 1);
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
