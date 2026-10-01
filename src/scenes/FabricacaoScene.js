import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem } from '../core/catalogo.js';
import { ESTAÇÕES } from '../core/enums.js';
import { receitasDaEstacao } from '../core/catalogo.js';
import { fabricar, podeFabricar } from '../core/regras.js';
import { texto as uiTexto, titulo as uiTitulo, linhaLista, botao } from '../ui/comuns.js';

const ROTULOS_ESTACAO = {
  banco_trabalho: 'Banco de Trabalho',
  forja: 'Forja',
  alquimia: 'Mesa Alquimica',
  torno: 'Torno Runico',
  prensa_arcana: 'Prensa Arcana',
  oficina: 'Oficina',
};

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
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, Math.min(900, width - 40), Math.min(600, height - 40), 0x14100c, 0.98).setStrokeStyle(2, 0x8a6a2f);
    this.add.existing(uiTitulo(this, 24, 18, 'OFICINA DO IMPÉRIO', '22px'));
    this.add.existing(
      uiTexto(this, 24, 50, `Nível ${this.nivel}   Poder: ${Math.floor(this.estado.poder ?? 0)}/${this.estado.poderMax ?? 0}`, {
        fontSize: '13px',
        color: OURO,
      }),
    );

    // Abas de estacao
    const idsEstacao = Object.keys(ESTAÇÕES);
    let x = 24;
    for (const est of idsEstacao) {
      const ativa = est === this.estacao;
      const rotulo = ROTULOS_ESTACAO[est] ?? est;
      const b = botao(this, x, 92, rotulo, () => {
        this.estacao = est;
        this.scene.restart({ ...this.dadosOriginais, estacao: est });
      }, {
        largura: Math.max(90, rotulo.length * 8 + 24),
        altura: 30,
        tamanho: '12px',
        cor: ativa ? 0xd4af6a : 0x241c14,
        corHover: ativa ? 0xe6c47c : 0x3a2c20,
        corTexto: ativa ? '#14100c' : PERGAMINHO,
        origem: [0, 0.5],
      });
      this.add.existing([b.caixa, b.label]);
      x += b.caixa.width + 8;
    }

    // Lista de receitas da estacao
    this.add.existing(uiTitulo(this, 24, 130, `Receitas — ${ROTULOS_ESTACAO[this.estacao] ?? this.estacao}`, '16px'));
    let y = 160;
    const receitas = receitasDaEstacao(this.catalogo, this.estacao, this.nivel);

    if (!receitas.length) {
      this.add.existing(
        uiTexto(this, 24, y, 'Nenhuma receita liberada nesta estação para seu nível.', { fontSize: '13px' }).setAlpha(0.7),
      );
    }

    const listaLargura = Math.min(400, width * 0.4);
    for (const r of receitas) {
      const checagem = podeFabricar({ catalogo: this.catalogo, estado: this.estado, receitaId: r.id, nivelEstacao: this.nivel });
      const descricao = this.descreverReceita(r);
      linhaLista(this, 24, y, listaLargura, r.nome, descricao, () => {
        if (!checagem.ok) {
          this.mostrarToast(checagem.motivo);
          return;
        }
        this.fabricar(r);
      });
      if (!checagem.ok) {
        this.children.list
          .filter((o) => o.type === 'Text' && o.text === r.nome)
          .forEach((t) => t.setAlpha(0.5));
      }
      y += 42;
    }

    this.add.existing(
      botao(this, width / 2, height - 60, 'Fechar [C / ESC]', () => this.fechar(), { largura: 200 }).caixa,
    );

    this.input.keyboard.on('keydown-C', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
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
    return `${partes.join(' + ')} -> ${saida.join(' + ')}`;
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
    // Recarrega a cena para atualizar a lista/poder.
    this.time.delayedCall(1200, () => this.scene.restart());
  }

  mostrarToast(msg) {
    this.toastObj ??= uiTexto(this, this.scale.width / 2, height0(this), '', {
      fontSize: '13px',
      color: OURO,
      backgroundColor: '#14100ccc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(5000);
    this.toastObj.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastObj);
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 2000, delay: 500 });
  }

  async persistir() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
  }

  async fechar() {
    await this.persistir();
    this.scene.stop('Fabricacao');
  }
}

function height0(scene) {
  return scene.scale.height - 100;
}
