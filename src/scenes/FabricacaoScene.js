import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem, receitasDaEstacao } from '../core/catalogo.js';
import { ESTAÇÕES } from '../core/enums.js';
import { fabricar, podeFabricar } from '../core/regras.js';
import { contarItem } from '../core/personagem.js';
import {
  texto as uiTexto,
  titulo as uiTitulo,
  linhaLista,
  botao,
  chip,
  painel as uiPainel,
  medirFluxo,
  aoTeclar,
  FONTE_UI,
} from '../ui/comuns.js';

const ROTULOS_ESTACAO = {
  banco_trabalho: 'Banco de Trabalho',
  forja: 'Forja',
  alquimia: 'Mesa Alquimica',
  torno: 'Torno Runico',
  prensa_arcana: 'Prensa Arcana',
  oficina: 'Oficina',
};

const ALTURA_LINHA = 44;

export class FabricacaoScene extends Phaser.Scene {
  constructor() {
    super('Fabricacao');
  }

  init(dados) {
    this.dadosOriginais = dados ?? {};
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
    this.nivel = dados?.nivel ?? 1;
    this.estacao = dados?.estacao ?? 'forja';
    this.selecionada = null;
    this.desloc = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');

    this.raiz = this.add.container(0, 0);

    this.montar();

    const aoRedimensionar = () => this.montar();
    this.scale.on(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    });

    aoTeclar(this, 'C', () => this.fechar());
    aoTeclar(this, 'ESC', () => this.fechar());
  }

  /**
   * Redesenha a oficina inteira.
   *
   * Rebuild completo em vez de reposicionar: as abas de estação quebram em
   * linhas conforme a largura, e a altura que elas ocupam é o que define onde
   * a lista começa. Recalcular isso a cada clique seria a mesma aritmética em
   * dois lugares — e foi exatamente assim que as abas passaram da borda da
   * tela quando a janela ficou estreita.
   */
  montar() {
    const { width, height } = this.scale;
    this.raiz.removeAll(true);
    this.toastObj?.destroy();
    this.toastObj = null;

    const margem = 16;
    const w = Math.max(560, Math.min(1120, width - margem * 2));
    const h = Math.max(420, Math.min(720, height - margem * 2));
    const x0 = Math.round((width - w) / 2);
    const y0 = Math.round((height - h) / 2);

    this.raiz.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.86).setInteractive());
    this.raiz.add(uiPainel(this, x0, y0, w, h));

    this.raiz.add(uiTitulo(this, x0 + 24, y0 + 20, 'OFICINA DO IMPÉRIO', '22px'));
    this.raiz.add(
      uiTexto(
        this,
        x0 + 24,
        y0 + 50,
        `Nível ${this.nivel}   ·   Poder ${Math.floor(this.estado.poder ?? 0)}/${this.estado.poderMax ?? 0}`,
        { fontSize: '13px', color: OURO },
      ),
    );

    // --- Abas de estação, com quebra de linha ---
    // `Object.keys(ESTAÇÕES)` devolveria as CHAVES do enum (`BANCO_TRABALHO`),
    // não os valores (`banco_trabalho`). Duas consequências, ambas ruins e ambas
    // silenciosas: o rótulo da aba mostrava a chave crua, e escolher uma aba
    // passava a chave para `receitasDaEstacao`, que não encontrava receita
    // nenhuma — a estação parecia vazia e o jogador era avisado de que
    // nenhuma receita estava liberada para o nível dele.
    const estacoes = Object.values(ESTAÇÕES);
    const larguras = estacoes.map((e) => Math.max(90, (ROTULOS_ESTACAO[e] ?? e).length * 7 + 24));
    const larguraUtil = w - 48;
    const linhas = medirFluxo(larguraUtil, larguras, 8);
    const yAbas = y0 + 84;
    const alturaAbas = linhas * 38;

    let cx = x0 + 24;
    let cy = yAbas;
    let usados = 0;
    estacoes.forEach((est, i) => {
      const lw = larguras[i];
      if (usados > 0 && cx + lw > x0 + 24 + larguraUtil) {
        cx = x0 + 24;
        cy += 38;
        usados = 0;
      }
      this.raiz.add(
        this.botaoEstacao(est, cx, cy, lw),
      );
      cx += lw + 8;
      usados += 1;
    });

    const yLista = cy + 52;
    const alturaLista = y0 + h - yLista - 56;

    this.raiz.add(
      uiTitulo(this, x0 + 24, yLista - 30, `Receitas — ${ROTULOS_ESTACAO[this.estacao] ?? this.estacao}`, '16px'),
    );

    const receitas = receitasDaEstacao(this.catalogo, this.estacao, this.nivel);
    // Sem receita liberada a coluna inteira fica vazia; mostrar a coluna direita
    // com um texto explica melhor do que uma tela em branco.
    const larguraColunaDireita = Math.max(260, Math.min(360, w * 0.38));
    const larguraLista = Math.max(240, w - 48 - larguraColunaDireita - 20);

    this.raiz.add(uiPainel(this, x0 + 18, yLista - 4, larguraLista + 12, alturaLista + 10, 0x100c08, 0.9));
    this.desenharLista(receitas, x0 + 24, yLista + 2, larguraLista, alturaLista);
    this.desenharDetalhe(x0 + 24 + larguraLista + 24, yLista - 4, larguraColunaDireita, alturaLista + 10, receitas);

    // Rodapé
    this.raiz.add(
      botao(this, x0 + w - 110, y0 + h - 30, 'Fechar  [C / ESC]', () => this.fechar(), { largura: 200, altura: 32 }).caixa,
    );
  }

  botaoEstacao(est, x, y, largura) {
    const ativa = est === this.estacao;
    const rotulo = ROTULOS_ESTACAO[est] ?? est;
    const b = botao(this, x + largura / 2, y + 15, rotulo, () => {
      this.estacao = est;
      this.selecionada = null;
      this.desloc = 0;
      this.montar();
    }, {
      largura,
      altura: 30,
      tamanho: '12px',
      cor: ativa ? 0xd4af6a : 0x241c14,
      corHover: ativa ? 0xe6c47c : 0x3a2c20,
      corBorda: ativa ? 0x8a6a2f : 0x3a2c20,
      corTexto: ativa ? '#14100c' : PERGAMINHO,
    });
    return b.caixa;
  }

  // ---------- lista ----------

  desenharLista(receitas, x, y, largura, altura) {
    if (!receitas.length) {
      this.raiz.add(
        uiTexto(this, x + 12, y + 16, 'Nenhuma receita liberada nesta estação para o seu nível.', {
          fontSize: '13px',
          wordWrap: { width: largura - 24 },
        }).setOrigin(0, 0).setAlpha(0.75),
      );
      return;
    }

    const cabem = Math.max(1, Math.floor((altura - 12) / ALTURA_LINHA));
    const inicio = Math.max(0, Math.min(receitas.length - 1, this.desloc));
    this.desloc = inicio;

    for (let i = inicio; i < Math.min(receitas.length, inicio + cabem); i += 1) {
      const r = receitas[i];
      const chk = podeFabricar({
        catalogo: this.catalogo,
        estado: this.estado,
        receitaId: r.id,
        nivelEstacao: this.nivel,
      });
      const detalhe = this.descreverReceita(r);
      linhaLista(
        this,
        x,
        y + (i - inicio) * ALTURA_LINHA,
        largura,
        r.nome,
        detalhe,
        () => {
          this.selecionada = r.id;
          this.montar();
        },
        { alfa: chk.ok ? 1 : 0.5, selecionado: r.id === this.selecionada, altura: ALTURA_LINHA - 4 },
      );
    }

    // Rolagem: setas no rodapé da coluna, como nos demais painéis.
    const maxDesloc = Math.max(0, receitas.length - cabem);
    if (maxDesloc <= 0) return;

    const bx = x + largura - 16;
    const topo = y + 2;
    const baixo = y + altura - 22;

    const cima = this.add
      .text(bx, topo, '▲', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
      .setOrigin(0.5)
      .setAlpha(inicio > 0 ? 1 : 0.25)
      .setInteractive({ useHandCursor: true });
    if (inicio > 0) {
      cima.on('pointerdown', () => {
        this.desloc = Math.max(0, this.desloc - cabem);
        this.montar();
      });
    }

    const baixo2 = this.add
      .text(bx, baixo, '▼', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
      .setOrigin(0.5)
      .setAlpha(inicio < maxDesloc ? 1 : 0.25)
      .setInteractive({ useHandCursor: true });
    if (inicio < maxDesloc) {
      baixo2.on('pointerdown', () => {
        this.desloc = Math.min(maxDesloc, this.desloc + cabem);
        this.montar();
      });
    }

    this.raiz.add([
      cima,
      baixo2,
      uiTexto(this, bx - 14, topo + altura / 2 - 14, `${inicio + 1}/${receitas.length}`, {
        fontSize: '9px',
        color: PERGAMINHO,
      })
        .setOrigin(0.5, 0)
        .setAlpha(0.7),
    ]);
  }

  // ---------- detalhe da receita ----------

  desenharDetalhe(x, y, largura, altura, receitas) {
    this.raiz.add(uiPainel(this, x - 6, y, largura + 12, altura, 0x100c08, 0.9));

    const receita = receitas.find((r) => r.id === this.selecionada);

    if (!receita) {
      this.raiz.add(
        uiTexto(
          this,
          x + 10,
          y + 18,
          'Escolha uma receita na lista.\n\nO painel mostra os insumos que faltam, o custo em poder e o que sai da bancada.',
          { fontSize: '12px', wordWrap: { width: largura - 20 }, lineSpacing: 3 },
        )
          .setOrigin(0, 0)
          .setAlpha(0.7),
      );
      return;
    }

    const chk = podeFabricar({
      catalogo: this.catalogo,
      estado: this.estado,
      receitaId: receita.id,
      nivelEstacao: this.nivel,
    });

    let cy = y + 16;
    this.raiz.add(uiTitulo(this, x + 10, cy, String(receita.nome ?? receita.id), '16px').setOrigin(0, 0));
    cy += 26;

    if (receita.descricao) {
      const d = uiTexto(this, x + 10, cy, receita.descricao, {
        fontSize: '11px',
        wordWrap: { width: largura - 20 },
        lineSpacing: 2,
      }).setOrigin(0, 0);
      this.raiz.add(d);
      cy += d.height + 12;
    }

    // Insumos: "3x Machado" com o que você tem ao lado.
    this.raiz.add(uiTexto(this, x + 10, cy, 'INSUMOS', { fontSize: '11px', color: OURO }).setOrigin(0, 0));
    cy += 18;

    for (const insumo of receita.insumos ?? []) {
      const def = buscarItem(this.catalogo, insumo.itemId);
      const tem = contarItem(this.estado.inventario, insumo.itemId);
      const falta = tem < insumo.qtd;
      cy += this.linhaDetalhe(x + 10, cy, largura - 20, `${insumo.qtd}x`, def?.nome ?? insumo.itemId, `${tem}`, falta);
    }

    cy += 8;
    this.raiz.add(uiTexto(this, x + 10, cy, 'SAÍDA', { fontSize: '11px', color: OURO }).setOrigin(0, 0));
    cy += 18;

    for (const s of receita.saida ?? []) {
      const def = buscarItem(this.catalogo, s.itemId);
      const img = this.add
        .image(x + 18, cy + 7, 'painel')
        .setDisplaySize(14, 14)
        .setOrigin(0.5);
      this.raiz.add(img);
      cy += this.linhaDetalhe(x + 30, cy, largura - 40, `${s.qtd}x`, def?.nome ?? s.itemId, null, false);
    }

    // Custos e meta
    cy += 10;
    const chips = [];
    if (receita.nivelMin) chips.push(`estação nível ${receita.nivelMin}`);
    if (receita.custoPoder) chips.push(`${receita.custoPoder} poder`);
    if (receita.tempoMs) chips.push(`${(receita.tempoMs / 1000).toFixed(1)}s`);
    if (receita.experiencia) chips.push(`+${receita.experiencia} XP`);

    let chipX = x + 10;
    for (const t of chips) {
      const c = chip(this, chipX, cy, t, 0x241c14, PERGAMINHO);
      this.raiz.add(c);
      chipX += c.largura + 5;
      if (chipX > x + largura - 60) break;
    }
    cy += 28;

    // Botão de fabricar, ancorado ao rodapé: o número de linhas de insumo
    // varia com a receita e um botão posicionado logo abaixo dele saía da caixa.
    const yBotao = y + altura - 34;

    if (!chk.ok) {
      this.raiz.add(
        uiTexto(this, x + 10, Math.min(cy, yBotao - 26), chk.motivo, {
          fontSize: '11px',
          color: '#e0906a',
          wordWrap: { width: largura - 20 },
        }).setOrigin(0, 0),
      );
    }

    this.raiz.add(
      botao(this, x + largura / 2, yBotao, chk.ok ? 'Fabricar' : 'Insumos faltando', () => this.fabricar(receita), {
        largura: largura - 20,
        altura: 34,
        tamanho: '13px',
        cor: chk.ok ? 0xd4af6a : 0x4a3a28,
        corHover: chk.ok ? 0xe6c47c : 0x4a3a28,
        corTexto: chk.ok ? '#14100c' : PERGAMINHO,
      }).caixa,
    );
  }

  /** "qtdx Nome ........ você tem 2" */
  linhaDetalhe(x, y, largura, qtd, nome, tem, falta) {
    const tq = this.add
      .text(x, y + 3, qtd, { ...FONTE_UI, fontSize: '11px', color: OURO })
      .setOrigin(0, 0);
    const tn = this.add
      .text(x + 34, y + 3, String(nome).slice(0, 22), {
        ...FONTE_UI,
        fontSize: '11px',
        color: falta ? '#e0906a' : PERGAMINHO,
      })
      .setOrigin(0, 0);
    const tm = this.add
      .text(x + largura, y + 3, tem === null ? '' : `você tem ${tem}`, {
        ...FONTE_UI,
        fontSize: '10px',
        color: falta ? '#e0906a' : '#8fd18f',
      })
      .setOrigin(1, 0);
    this.raiz.add([tq, tn, tm]);
    return 18;
  }

  descreverReceita(r) {
    const partes = [];
    for (const i of r.insumos ?? []) {
      const def = buscarItem(this.catalogo, i.itemId);
      partes.push(`${i.qtd}x ${def?.nome ?? i.itemId}`);
    }
    const saida = (r.saida ?? []).map((s) => {
      const def = buscarItem(this.catalogo, s.itemId);
      return `${s.qtd}x ${def?.nome ?? s.itemId}`;
    });
    return `${partes.join(' + ') || 'sem insumos'} → ${saida.join(' + ') || '—'}`;
  }

  fabricar(receita) {
    const resultado = fabricar({ catalogo: this.catalogo, estado: this.estado, receitaId: receita.id });
    if (!resultado.ok) {
      this.mostrarToast(resultado.motivo);
      return;
    }
    const saidas = resultado.producao
      .map((p) => `${p.qtd}x ${buscarItem(this.catalogo, p.itemId)?.nome ?? p.itemId}`)
      .join(', ');
    this.mostrarToast(`Fabricado: ${saidas} (+${resultado.xp} XP)`);
    this.persistir();
    this.time.delayedCall(1200, () => this.montar());
  }

  mostrarToast(msg) {
    this.toastObj ??= this.add
      .text(this.scale.width / 2, this.scale.height - 100, '', {
        fontSize: '13px',
        color: OURO,
        backgroundColor: '#14100ccc',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(5000);
    this.raiz.add(this.toastObj);
    this.toastObj.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastObj);
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 2000, delay: 500 });
  }

  async persistir() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
    const mundo = this.scene.get('World');
    if (mundo?.estado) mundo.estado = this.estado;
  }

  async fechar() {
    await this.persistir();
    this.scene.stop('Fabricacao');
  }
}