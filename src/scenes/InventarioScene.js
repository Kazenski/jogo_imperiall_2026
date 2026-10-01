import Phaser from 'phaser';
import { TEXTURAS } from './BootScene.js';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem } from '../core/catalogo.js';
import { nivelDeUpgrades, removerItem } from '../core/personagem.js';
import { usarOrbe, usarConsumivel } from '../core/regras.js';
import {
  texto as uiTexto,
  titulo as uiTitulo,
  painel,
  botao,
  chip,
  caixaArredondada,
  fluxoBotoes,
  medirFluxo,
} from '../ui/comuns.js';

// Grade da mochila. O numero de colunas e calculado em tempo de execucao a
// partir da largura disponivel, e nao fixo no fonte.
const TAMANHO_CELULA = 52;
const VAO_CELULA = 6;
const PASSO_CELULA = TAMANHO_CELULA + VAO_CELULA;

const COR_RARIDADE = {
  comum: 0x8a8a8a,
  incomum: 0x7ad47a,
  raro: 0x7ab4d8,
  epico: 0xc9a6ff,
  lendario: 0xffd76a,
};

/** Rotulos legiveis para os usos de um item. */
const ROTULO_USO = {
  extracao: 'extracao',
  transformacao: 'transformacao',
  utilizacao: 'utilizacao',
  estrutura: 'estrutura',
  equipavel: 'equipavel',
  maquina: 'maquina',
};

export class InventarioScene extends Phaser.Scene {
  constructor() {
    super('Inventario');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
    this.derivados = dados?.derivados ?? {};
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');
    this.selecionado = null;
    this.quantiaLargar = 1;
    this.previewsCarregados = new Set();

    const { width, height } = this.scale;
    const margem = 18;
    const w = Math.min(1060, width - margem * 2);
    const h = Math.min(660, height - margem * 2);
    this.x0 = Math.round(width / 2 - w / 2);
    this.y0 = Math.round(height / 2 - h / 2);
    this.alturaPainel = h;

    // As tres faixas verticais do painel. Tudo e derivado daqui, para o
    // inventario caber em telas baixas sem transbordar por baixo.
    this.topoConteudo = this.y0 + 56;
    this.baseConteudo = this.y0 + h - 52;
    this.larguraUtil = w - margem * 2;

    this.add.existing(painel(this, this.x0, this.y0, w, h));
    this.add.existing(
      uiTitulo(this, this.x0 + margem + 4, this.y0 + 14, 'MOCHILA DO IMPERADOR', '20px'),
    );
    this.add.existing(
      uiTexto(this, this.x0 + w - margem - 4, this.y0 + 22, 'I ou ESC para fechar', {
        fontSize: '11px',
        color: PERGAMINHO,
      })
        .setOrigin(1, 0)
        .setAlpha(0.55),
    );

    // Colunas: mochila a esquerda, leitura do item a direita.
    this.larguraDetalhe = Math.round(Math.min(420, Math.max(290, w * 0.36)));
    this.larguraEsquerda = this.larguraUtil - this.larguraDetalhe - 16;
    this.xEsquerda = this.x0 + margem;
    this.xDetalhe = this.xEsquerda + this.larguraEsquerda + 16;

    this.criarBarraOrbes(this.xEsquerda, this.topoConteudo, this.larguraEsquerda);
    this.criarGrade();
    this.criarDetalhe();

    this.criarRodape();
    this.atualizarDetalhe();

    this.input.keyboard.on('keydown-I', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }

  // ------------------------------------------------------------------ orbes

  /**
   * Cofre de Orbes. Percorre o CATALOGO, e nao uma lista fixa de ids: um Orbe
   * cadastrado pelo administrador tem de aparecer aqui sem mexer no codigo.
   */
  criarBarraOrbes(x, y, largura) {
    this.add.existing(uiTexto(this, x, y, 'Orbes Arcanos', { fontSize: '12px', color: OURO }));
    const yChips = y + 18;

    const orbes = (this.catalogo?.itens ?? []).filter((i) => i.tipo === 'orbe');
    const qtdDe = (id) => this.estado.orbes?.[id] ?? 0;

    if (orbes.length === 0) {
      this.add.existing(
        uiTexto(this, x, yChips + 8, 'Nenhum Orbe cadastrado.', { fontSize: '11px' }).setAlpha(0.5),
      );
      return;
    }

    let cx = x;
    let cy = yChips;
    const alturaChip = 26;
    for (const orbe of orbes) {
      const qtd = qtdDe(orbe.id);
      const texto = `${orbe.nome.replace('Orbe Arcano ', '')} x${qtd}`;
      const larguraChip = 30 + texto.length * 6.2;
      // Quebra de linha: sem isso, 5 Orbes estourariam a coluna esquerda.
      if (cx > x && cx + larguraChip > x + largura) {
        cx = x;
        cy += alturaChip + 6;
      }

      const moldura = caixaArredondada(this, cx, cy, larguraChip, alturaChip, {
        raio: 13,
        preenchimento: 0x241c14,
        borda: COR_RARIDADE[orbe.raridade] ?? 0x8a6a2f,
        larguraBorda: 1,
        origem: [0, 0],
      });
      const icone = this.add
        .image(cx + 17, cy + alturaChip / 2, TEXTURAS.ORBE)
        .setTint(orbe.cor ?? 0xffffff)
        .setDisplaySize(18, 18);
      const rot = uiTexto(this, cx + 30, cy + alturaChip / 2, texto, {
        fontSize: '11px',
        color: qtd > 0 ? PERGAMINHO : '#5a4a3a',
      }).setOrigin(0, 0.5);

      this.add.existing(moldura);
      this.add.existing(icone);
      this.add.existing(rot);
      cx += larguraChip + 6;
    }
    this.alturaOrbes = cy + alturaChip - y;
  }

  // ------------------------------------------------------------------- grade

  criarGrade() {
    const yTopo = this.topoConteudo + (this.alturaOrbes ?? 46) + 16;
    this.gradeY = yTopo;

    const colunas = Math.max(
      3,
      Math.min(8, Math.floor((this.larguraEsquerda + VAO_CELULA) / PASSO_CELULA)),
    );
    const linhas = Math.max(2, Math.floor((this.baseConteudo - yTopo) / PASSO_CELULA));
    const total = colunas * linhas;

    // Centraliza a grade na coluna esquerda quando sobra espaco.
    const larguraUsada = colunas * PASSO_CELULA - VAO_CELULA;
    const x0 = this.xEsquerda + Math.max(0, Math.round((this.larguraEsquerda - larguraUsada) / 2));

    this.add.existing(
      uiTexto(this, this.xEsquerda, yTopo - 16, `${total} espacos`, {
        fontSize: '11px',
        color: PERGAMINHO,
      }).setAlpha(0.5),
    );

    this.celulas = [];
    for (let i = 0; i < total; i += 1) {
      const col = i % colunas;
      const lin = Math.floor(i / colunas);
      const x = x0 + col * PASSO_CELULA;
      const y = yTopo + lin * PASSO_CELULA;

      const fundo = caixaArredondada(this, x, y, TAMANHO_CELULA, TAMANHO_CELULA, {
        raio: 8,
        preenchimento: 0x1a140e,
        borda: 0x3a2c20,
        larguraBorda: 1,
        origem: [0, 0],
      });
      const clique = this.add
        .rectangle(x, y, TAMANHO_CELULA, TAMANHO_CELULA, 0xffffff, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      const img = this.add
        .image(x + TAMANHO_CELULA / 2, y + TAMANHO_CELULA / 2, TEXTURAS.BLOCO)
        .setDisplaySize(30, 30)
        .setVisible(false);
      const qtd = this.add
        .text(x + TAMANHO_CELULA - 4, y + TAMANHO_CELULA - 3, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#fff',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(1, 1);
      const orbeNivel = this.add
        .text(x + 4, y + 3, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: OURO,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0, 0);

      this.add.existing(fundo);
      this.add.existing(clique);
      this.add.existing(img);
      this.add.existing(qtd);
      this.add.existing(orbeNivel);
      this.celulas.push({ fundo, clique, img, qtd, orbeNivel });

      clique.on('pointerdown', () => {
        const pilha = this.estado.inventario.itens[i];
        if (!pilha) return;
        this.selecionado = pilha;
        this.quantiaLargar = 1;
        this.atualizarDetalhe();
        this.destacarCelula(i);
      });
      // Passar o mouse acende o espaco, para a grade nao parecer morta.
      clique.on('pointerover', () => this.pintarCelula(i, 0x2a2018, 0x8a6a2f));
      clique.on('pointerout', () => this.repintarCelula(i));
    }

    this.preencherGrade();
  }

  /** Redesenha o fundo de uma celula. `Graphics` nao guarda estado de estilo. */
  pintarCelula(i, preenchimento, borda) {
    const cel = this.celulas[i];
    if (!cel) return;
    const g = cel.fundo.caixa;
    g.clear();
    g.fillStyle(preenchimento, 1);
    g.fillRoundedRect(0, 0, TAMANHO_CELULA, TAMANHO_CELULA, 8);
    g.lineStyle(1, borda, 1);
    g.strokeRoundedRect(0, 0, TAMANHO_CELULA, TAMANHO_CELULA, 8);
  }

  repintarCelula(i) {
    const pilha = this.estado.inventario.itens[i];
    const selecionado = pilha && this.selecionado && pilha.uid === this.selecionado.uid;
    this.pintarCelula(
      i,
      selecionado ? 0x3a2c18 : 0x1a140e,
      selecionado ? OURO : pilha ? 0x4a3826 : 0x3a2c20,
    );
  }

  destacarCelula(i) {
    this.celulas.forEach((_, idx) => this.repintarCelula(idx));
    if (i !== null && i !== undefined) {
      this.pintarCelula(i, 0x3a2c18, OURO);
    }
  }

  preencherGrade() {
    const inv = this.estado.inventario;
    this.celulas.forEach((celula, i) => {
      const pilha = inv.itens[i];
      if (!pilha) {
        celula.img.setVisible(false);
        celula.qtd.setText('');
        celula.orbeNivel.setText('');
        return;
      }
      const def = buscarItem(this.catalogo, pilha.itemId);
      celula.img.setVisible(true);
      celula.img.setTexture(this.texturaDe(def, celula.img));
      celula.img.setTint(def?.cor ?? 0xffffff);
      celula.qtd.setText(pilha.qtd > 1 ? String(pilha.qtd) : '');
      const nivel = nivelDeUpgrades(pilha);
      celula.orbeNivel.setText(nivel > 0 ? `+${nivel}` : '');
    });
    this.celulas.forEach((_, i) => this.repintarCelula(i));
  }

  /**
   * Textura do item. Se o administrador enviou uma imagem (campo `imagem`), ela
   * substitui o desenho procedural assim que o download termina.
   */
  texturaDe(def, alvo) {
    const base = this.texturaPadrao(def);
    const url = def?.imagem;
    if (!url || !alvo) return base;

    const chave = `upload_${def.id}`;
    if (this.textures.exists(chave)) {
      alvo.setTexture(chave);
      alvo.clearTint();
      return chave;
    }
    // Uma requisicao por URL: o detalhe e redesenhado a cada clique e a fila do
    // loader nao pode acumular o mesmo download.
    if (!this.previewsCarregados.has(url)) {
      this.previewsCarregados.add(url);
      this.load.image(chave, url);
      this.load.once(`filecomplete-image-${chave}`, () => {
        alvo.setTexture(chave);
        alvo.clearTint();
      });
      this.load.start();
    }
    return base;
  }

  texturaPadrao(def) {
    switch (def?.tipo) {
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

  // ----------------------------------------------------------------- detalhe

  criarDetalhe() {
    this.add.existing(
      painel(this, this.xDetalhe, this.topoConteudo, this.larguraDetalhe, this.baseConteudo - this.topoConteudo, 0x191309, 0.98),
    );
    // Container local na moldura; todo o conteudo e desenhado em `atualizarDetalhe`.
    this.detalhe = this.add.container(this.xDetalhe + 14, this.topoConteudo + 14);
    this.larguraDetalheInterna = this.larguraDetalhe - 28;
    // Altura em coordenadas LOCAIS do container, para o bloco de acoes poder
    // se ancorar na base sem conhecer a posicao na tela.
    this.alturaDetalheUtil = this.baseConteudo - this.topoConteudo - 28;
  }

  atualizarDetalhe() {
    this.detalhe.removeAll(true);
    const interna = this.larguraDetalheInterna;
    const pilha = this.selecionado;

    if (!pilha) {
      this.detalhe.add(uiTitulo(this, 0, 0, 'Nenhum item selecionado', '16px'));
      // Envolve no painel: sem `wordWrap` o texto vazava para fora da coluna.
      this.detalhe.add(
        uiTexto(this, 0, 34, 'Clique em um espaco da mochila para ler a descricao, ver a previa, usar Orbes Arcanos ou equipar.', {
          fontSize: '12px',
          wordWrap: { width: this.larguraDetalheInterna, useAdvancedWrap: true },
        }).setAlpha(0.7),
      );
      this.detalhe.add(
        uiTexto(this, 0, 96, 'Dica: o que voce larga e perdido para sempre.', {
          fontSize: '11px',
          color: OURO,
          wordWrap: { width: this.larguraDetalheInterna, useAdvancedWrap: true },
        }).setAlpha(0.6),
      );
      return;
    }

    const def = buscarItem(this.catalogo, pilha.itemId);
    const nivel = nivelDeUpgrades(pilha);

    // ---- previa ----
    const LADO = 84;
    const moldura = caixaArredondada(this, 0, 0, LADO, LADO, {
      raio: 10,
      preenchimento: 0x241c14,
      borda: COR_RARIDADE[def?.raridade] ?? 0x8a6a2f,
      larguraBorda: 2,
      origem: [0, 0],
    });
    const img = this.add.image(LADO / 2, LADO / 2, this.texturaPadrao(def)).setDisplaySize(56, 56);
    this.texturaDe(def, img);
    img.setTint(def?.cor ?? 0xffffff);
    this.detalhe.add([moldura, img]);

    // ---- nome e etiquetas ----
    this.detalhe.add(
      uiTitulo(this, LADO + 14, 2, def?.nome ?? pilha.itemId, '16px').setWordWrapWidth(interna - LADO - 14),
    );
    this.detalhe.add(
      uiTexto(this, LADO + 14, 28, `${def?.tipo ?? 'item'} - nivel minimo ${def?.nivelMin ?? 1}`, {
        fontSize: '11px',
        color: PERGAMINHO,
      }).setAlpha(0.75),
    );

    let y = LADO + 14;

    // ---- etiquetas de uso e raridade ----
    let cx = 0;
    for (const uso of def?.uso ?? []) {
      const c = chip(this, cx, y, ROTULO_USO[uso] ?? uso, 0x241c14);
      this.detalhe.add(c.caixa ?? c);
      cx += (c.width ?? 60) + 6;
    }
    if (def?.raridade) {
      const c = chip(this, cx, y, def.raridade, COR_RARIDADE[def.raridade] ?? 0xd4af6a, '#14100c');
      this.detalhe.add(c.caixa ?? c);
      cx += (c.width ?? 70) + 6;
    }
    if (cx > interna) {
      // Nao coube numa linha so: as etiquetas que sobraram vao para baixo.
      cx = 0;
      y += 26;
      for (const uso of def?.uso ?? []) {
        const c = chip(this, cx, y, ROTULO_USO[uso] ?? uso, 0x241c14);
        this.detalhe.add(c.caixa ?? c);
        cx += (c.width ?? 60) + 6;
      }
    }
    y += 30;

    // ---- quantidade e Orbes ----
    this.detalhe.add(
      uiTexto(
        this,
        0,
        y,
        `Na mochila: ${pilha.qtd}   |   Orbes aplicadas: +${nivel} `
          + `(slots ${pilha.upgrades?.length ?? 0}/${def?.slotsUpgrade ?? 0})`,
        { fontSize: '12px', color: nivel > 0 ? OURO : PERGAMINHO },
      ),
    );
    y += 24;

    // ---- descricao ----
    const descricao = def?.descricao ?? 'Sem descricao cadastrada para este item.';
    const textoDescricao = uiTexto(this, 0, y, descricao, {
      fontSize: '12px',
      color: PERGAMINHO,
      wordWrap: { width: interna, useAdvancedWrap: true },
    }).setAlpha(0.88);
    this.detalhe.add(textoDescricao);
    y += textoDescricao.height + 14;

    // ---- faixa de Orbe ----
    if (def?.faixa) {
      this.detalhe.add(
        uiTexto(this, 0, y, `Faixa: nivel ${def.faixa.min} ate ${def.faixa.max === 999 ? 'infinito' : def.faixa.max}`, {
          fontSize: '11px',
          color: OURO,
        }).setAlpha(0.85),
      );
      y += 20;
    }

    // ---- bloco de acoes, ancorado na BASE ----
    //
    // Acoes e "largar" sao fixos na parte de baixo e a leitura (numeros) e o
    // que cede espaco. Empilhar tudo a partir do topo estourava o painel em
    // quase todo item: sao ate 4 botoes de Orbe, que viram 3 linhas.
    const acoes = this.acoesDe(def, pilha);
    const linhasAcao = medirFluxo(interna, acoes.map((a) => a.largura ?? 160), 8);

    // O "Largar tudo" pode descer para uma segunda linha se a coluna for
    // estreita; nesse caso o bloco de acoes precisa reservar a altura extra.
    const ALT_LINHA_LARGAR = 36;
    const larguraLargarTudo =
      34 + 6 + 66 + 6 + 34 + 6 + 130 + 6 + 96;
    const largarEmDuasLinhas = pilha.qtd > 1 && larguraLargarTudo > interna;
    const alturaLargar = 18 + ALT_LINHA_LARGAR + (largarEmDuasLinhas ? ALT_LINHA_LARGAR : 0) + 14;
    const blocoAcoesAltura = 18 + linhasAcao * 36 + alturaLargar;
    const baseAcoes = this.alturaDetalheUtil - blocoAcoesAltura;

    // ---- numeros: so o que sobra ----
    const numeros = this.numerosDe(def);
    if (numeros.length) {
      const espaco = Math.max(0, baseAcoes - y - 8);
      const quantosCabem = Math.max(0, Math.floor(espaco / 30) * 2);
      const cabem = numeros.slice(0, quantosCabem);
      if (cabem.length) this.adicionarNumeros(cabem, y, interna);
      if (cabem.length < numeros.length) {
        this.detalhe.add(
          uiTexto(this, 0, y + Math.ceil(cabem.length / 2) * 30, `+${numeros.length - cabem.length} outros atributos`, {
            fontSize: '10px',
            color: PERGAMINHO,
          }).setAlpha(0.5),
        );
      }
    }

    // ---- acoes ----
    this.detalhe.add(
      uiTexto(this, 0, baseAcoes, 'O que voce pode fazer', { fontSize: '11px', color: OURO }).setAlpha(0.8),
    );
    fluxoBotoes(this.detalhe, 0, baseAcoes + 18, interna, acoes, {
      altura: 30,
      passoLinha: 36,
      vao: 8,
    });

    // ---- largar ----
    // Fica no proprio jogo: `window.prompt` abre um dialogo do navegador por
    // cima do canvas, com aparencia completamente diferente do resto.
    this.quantiaLargar = Math.min(this.quantiaLargar, pilha.qtd);
    const yLargar = baseAcoes + 18 + linhasAcao * 36 + 12;
    this.detalhe.add(
      uiTexto(this, 0, yLargar, 'Largar da mochila', { fontSize: '11px', color: '#c96a5a' }).setAlpha(0.85),
    );
    this.adicionarLargar(pilha, yLargar + 18, largarEmDuasLinhas);
  }

  /** Botoes de acao do item selecionado, na ordem: Orbes, equipar, consumir, maquina. */
  acoesDe(def, pilha) {
    const acoes = [];

    // So entram os Orbes que o jogador realmente tem no cofre.
    const orbesDisponiveis = (this.catalogo?.itens ?? [])
      .filter((i) => i.tipo === 'orbe' && (this.estado.orbes?.[i.id] ?? 0) > 0);
    for (const orbe of orbesDisponiveis) {
      const curto = orbe.nome.replace('Orbe Arcano ', '');
      acoes.push({
        rotulo: `Usar Orbe ${curto} (${this.estado.orbes[orbe.id]})`,
        largura: 176,
        cor: 0x7a4fd4,
        corHover: 0x9a6fe0,
        corTexto: '#fff',
        tamanho: '11px',
        onClick: () => {
          const r = usarOrbe({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid, orbeId: orbe.id });
          if (!r.ok) {
            this.toast(r.motivo);
            return;
          }
          this.toast(`${def.nome} subiu para +${r.nivel}.`);
          this.preencherGrade();
          this.atualizarDetalhe();
        },
      });
    }

    if (def?.tipo === 'equipavel' || def?.tipo === 'ferramenta') {
      const slot = this.slotDo(def);
      const jaEquipado = this.estado.inventario.equipado[slot] === pilha.uid;
      acoes.push({
        rotulo: jaEquipado ? `Equipado (${slot})` : `Equipar (${slot})`,
        largura: 150,
        cor: jaEquipado ? 0x4a6b5a : 0x8fd18f,
        onClick: () => {
          this.estado.inventario.equipado[slot] = pilha.uid;
          this.toast(`${def.nome} equipado em ${slot}.`);
          this.atualizarDetalhe();
        },
      });
      if (def?.tipo === 'ferramenta') {
        acoes.push({
          rotulo: 'Construir com este',
          largura: 168,
          cor: 0xd4af6a,
          onClick: () => {
            this.blocoSelecionado = pilha.itemId;
            this.toast(`${def.nome} selecionado para construcao.`);
            this.fechar();
          },
        });
      }
    }

    if (def?.tipo === 'consumivel') {
      acoes.push({
        rotulo: 'Consumir 1',
        largura: 130,
        cor: 0x8fd18f,
        onClick: () => {
          const r = usarConsumivel({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid });
          if (!r.ok) {
            this.toast(r.motivo);
            return;
          }
          this.toast(`${r.nome} usado.`);
          this.preencherGrade();
          this.atualizarDetalhe();
        },
      });
    }

    if (def?.tipo === 'maquina') {
      acoes.push({
        rotulo: 'Receitas da estacao',
        largura: 168,
        cor: 0x7ab4d8,
        corTexto: '#14100c',
        onClick: () => this.toast(`Abra Fabricacao [C] para ver as receitas de ${def.nome}.`),
      });
    }

    return acoes;
  }

  /**
   * Seletor de quantidade e botao de largar.
   *
   * Posicoes explicitas em vez de fluxo: o contador e um texto no meio da linha,
   * e um fluxo de botoes nao sabe reservar espaco para isso. Sem este controle
   * a unica forma de escolher a quantidade era `window.prompt`, que abre um
   * dialogo do navegador por cima do canvas, com outra aparencia e outra fonte.
   */
  adicionarLargar(pilha, y, emDuasLinhas = false) {
    const ALTO = 30;
    const VAO = 6;
    const LADO = 34;
    const LARG_LARGAR = 130;
    // Coordenadas LOCAIS ao container do detalhe: `Container.add()` soma a posicao
    // do pai em vez de converter, entao o pai nao entra aqui.
    const centro = (x, largura) => x + largura / 2;
    const yCentro = y + ALTO / 2;

    const ajustar = (delta) => {
      const nova = Math.min(pilha.qtd, Math.max(1, this.quantiaLargar + delta));
      if (nova === this.quantiaLargar) return;
      this.quantiaLargar = nova;
      this.atualizarDetalhe();
    };

    const largar = (n) => {
      const qtd = Math.min(n, pilha.qtd);
      if (qtd <= 0) return;
      removerItem(this.estado.inventario, pilha.uid, qtd);
      this.toast(`${qtd} descartado(s).`);
      const restante = this.estado.inventario.itens.find((p) => p.uid === pilha.uid)?.qtd ?? 0;
      if (restante <= 0) {
        this.selecionado = null;
        this.destacarCelula(null);
      } else {
        this.quantiaLargar = Math.min(this.quantiaLargar, restante);
      }
      this.preencherGrade();
      this.atualizarDetalhe();
    };

    // [-] 3 de 12 [+]  [ Largar 3 ]
    const xMenos = 0;
    const xContador = xMenos + LADO + VAO;
    const larguraContador = 66;
    const xMais = xContador + larguraContador + VAO;
    const xLargar = xMais + LADO + VAO;
    const xTudo = xLargar + LARG_LARGAR + VAO;

    // A linha inteira pode nao caber na coluna estreita. O "Largar tudo" desce
    // para a linha de baixo em vez de sair do painel.
    const larguraTudo = 96;
    const tudoCabeNaMesmaLinha = !emDuasLinhas;
    const yTudo = tudoCabeNaMesmaLinha ? 0 : ALTO + 6;

    const corSeta = { cor: 0x3a2c20, corHover: 0x4a3826, corTexto: PERGAMINHO };
    this.detalhe.add(
      botao(this.detalhe.scene, centro(xMenos, LADO), yCentro, '-', () => ajustar(-1), {
        largura: LADO,
        altura: ALTO,
        ...corSeta,
      }).caixa,
    );
    this.detalhe.add(
      uiTexto(this, centro(xContador, larguraContador), yCentro, `${this.quantiaLargar} de ${pilha.qtd}`, {
        fontSize: '12px',
        color: PERGAMINHO,
      })
        .setOrigin(0.5)
        .setAlpha(0.85),
    );
    this.detalhe.add(
      botao(this.detalhe.scene, centro(xMais, LADO), yCentro, '+', () => ajustar(1), {
        largura: LADO,
        altura: ALTO,
        ...corSeta,
      }).caixa,
    );
    this.detalhe.add(
      botao(
        this.detalhe.scene,
        centro(xLargar, LARG_LARGAR),
        yCentro,
        `Largar ${this.quantiaLargar}`,
        () => largar(this.quantiaLargar),
        {
          largura: LARG_LARGAR,
          altura: ALTO,
          cor: 0xc96a5a,
          corHover: 0xd05a5a,
          corTexto: '#fff',
        },
      ).caixa,
    );

    // "tudo" so faz sentido quando sobrou mais de uma unidade.
    if (pilha.qtd > 1) {
      const x = tudoCabeNaMesmaLinha ? xTudo : 0;
      this.detalhe.add(
        botao(this.detalhe.scene, centro(x, larguraTudo), y + yTudo + ALTO / 2, 'Largar tudo', () => largar(pilha.qtd), {
          largura: larguraTudo,
          altura: ALTO,
          tamanho: '11px',
          cor: 0x5a3a30,
          corHover: 0x6a4438,
          corTexto: '#e8c0b8',
        }).caixa,
      );
    }
  }

  /** Numeros que fazem sentido mostrar para o tipo do item. */
  numerosDe(def) {
    if (!def) return [];
    const linhas = [];
    const push = (rotulo, valor) => {
      if (valor === undefined || valor === null) return;
      linhas.push([rotulo, typeof valor === 'number' ? (Number.isInteger(valor) ? valor : valor.toFixed(1)) : valor]);
    };

    push('Defesa', def.defesa);
    push('Vida maxima', def.vidaMax);
    push('Poder maximo', def.poderMax);
    push('Poder de mineracao', def.poderMineracao);
    push('FIS', def.fis);
    push('MEN', def.men);
    push('SOC', def.soc);
    push('Cura por uso', def.curaVida);
    if (def.vidaBloco) push('Vida do bloco', def.vidaBloco);
    if (def.ferramentas?.length) push('Ferramentas', def.ferramentas.join(', '));
    if (def.estacao) push('Estacao', def.estacao);
    if (def.valor) push('Valor em ouro', def.valor);
    if (def.resistMineracao) push('Resistencia a mineracao', def.resistMineracao);
    push('Tamanho da pilha', def.stackMax);
    return linhas;
  }

  /** Dois numeros por linha, com rotulo em cima do valor. */
  adicionarNumeros(numeros, yInicial, largura) {
    const COLUNAS = 2;
    const larguraCol = Math.floor(largura / COLUNAS);
    let y = yInicial;

    numeros.forEach(([rotulo, valor], i) => {
      const col = i % COLUNAS;
      if (i > 0 && col === 0) y += 30;
      const x = col * larguraCol;
      this.detalhe.add(
        uiTexto(this, x, y, rotulo, { fontSize: '10px', color: PERGAMINHO }).setAlpha(0.6),
      );
      this.detalhe.add(
        uiTexto(this, x, y + 12, String(valor), { fontSize: '13px', color: OURO }),
      );
    });

    return numeros.length ? Math.ceil(numeros.length / COLUNAS) * 30 : 0;
  }

  adicionarAcoes(def, pilha, y, largura) {
    const orbesDisponiveis = (this.catalogo?.itens ?? [])
      .filter((i) => i.tipo === 'orbe' && (this.estado.orbes?.[i.id] ?? 0) > 0);

    const acoes = [];

    // Orbes Arcanos: so aparecem os que o jogador tem no cofre.
    for (const orbe of orbesDisponiveis) {
      const curto = orbe.nome.replace('Orbe Arcano ', '');
      acoes.push({
        rotulo: `Usar Orbe ${curto} (${this.estado.orbes[orbe.id]})`,
        largura: 176,
        cor: 0x7a4fd4,
        corHover: 0x9a6fe0,
        corTexto: '#fff',
        tamanho: '11px',
        onClick: () => {
          const r = usarOrbe({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid, orbeId: orbe.id });
          if (!r.ok) {
            this.toast(r.motivo);
            return;
          }
          this.toast(`${def.nome} subiu para +${r.nivel}.`);
          this.preencherGrade();
          this.atualizarDetalhe();
        },
      });
    }

    if (def?.tipo === 'equipavel' || def?.tipo === 'ferramenta') {
      const slot = this.slotDo(def);
      const jaEquipado = this.estado.inventario.equipado[slot] === pilha.uid;
      acoes.push({
        rotulo: jaEquipado ? `Equipado (${slot})` : `Equipar (${slot})`,
        largura: 150,
        cor: jaEquipado ? 0x4a6b5a : 0x8fd18f,
        onClick: () => {
          this.estado.inventario.equipado[slot] = pilha.uid;
          this.toast(`${def.nome} equipado em ${slot}.`);
          this.atualizarDetalhe();
        },
      });
      if (def?.tipo === 'ferramenta') {
        acoes.push({
          rotulo: 'Construir com este',
          largura: 168,
          cor: 0xd4af6a,
          onClick: () => {
            this.blocoSelecionado = pilha.itemId;
            this.toast(`${def.nome} selecionado para construcao.`);
            this.fechar();
          },
        });
      }
    }

    if (def?.tipo === 'consumivel') {
      acoes.push({
        rotulo: 'Consumir 1',
        largura: 130,
        cor: 0x8fd18f,
        onClick: () => {
          const r = usarConsumivel({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid });
          if (!r.ok) {
            this.toast(r.motivo);
            return;
          }
          this.toast(`${r.nome} usado.`);
          this.preencherGrade();
          this.atualizarDetalhe();
        },
      });
    }

    if (def?.tipo === 'maquina') {
      acoes.push({
        rotulo: 'Ver receitas da estacao',
        largura: 190,
        cor: 0x7ab4d8,
        corTexto: '#14100c',
        onClick: () => this.toast(`Abra Fabricacao [C] para ver as receitas de ${def.nome}.`),
      });
    }

    fluxoBotoes(this.detalhe, 0, y, largura, acoes, { altura: 30, passoLinha: 36, vao: 8 });
  }

  // ------------------------------------------------------------------ rodape

  criarRodape() {
    const y = this.y0 + this.alturaPainel - 26;
    const centro = this.x0 + this.larguraUtil / 2;

    this.add.existing(
      botao(this, centro + 90, y, 'Salvar', async () => {
        await this.salvar();
        this.fechar();
      }, { largura: 140, cor: 0x8fd18f, corHover: 0xa8e5a8 }).caixa,
    );
    this.add.existing(
      botao(this, centro - 90, y, 'Fechar', () => this.fechar(), { largura: 160 }).caixa,
    );
  }

  slotDo(def) {
    if (def.slot) return def.slot;
    if (def.tipo === 'ferramenta') return 'ferramenta';
    return 'corpo';
  }

  toast(msg) {
    this.toastObj ??= uiTexto(this, this.scale.width / 2, 60, '', {
      fontSize: '13px',
      color: OURO,
      backgroundColor: '#14100ccc',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(5000);
    this.toastObj.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastObj);
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 1800, delay: 500 });
  }

  async salvar() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
  }

  fechar() {
    this.scene.stop('Inventario');
  }
}