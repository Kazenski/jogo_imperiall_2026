import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem, reinosParaNivel } from '../core/catalogo.js';
import { podeEntrarNoReino } from '../core/mundo.js';
import { texto as uiTexto, titulo as uiTitulo, painel, linhaLista, botao } from '../ui/comuns.js';

export class ReinosScene extends Phaser.Scene {
  constructor() {
    super('Reinos');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
    this.reinoAtual = dados?.reinoAtual ?? null;
    this.aoViajar = dados?.aoViajar ?? (() => {});
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');
    const { width, height } = this.scale;

    const w = Math.min(860, width - 40);
    const h = Math.min(560, height - 40);
    const x0 = width / 2 - w / 2;
    const y0 = height / 2 - h / 2;

    this.add.existing(painel(this, x0, y0, w, h));
    this.add.existing(uiTitulo(this, x0 + 28, y0 + 20, 'PORTAL PARA REINOS ETÉREOS', '22px'));
    this.add.existing(
      uiTexto(this, x0 + 28, y0 + 54, 'Mundos paralelos. Mais perigos, mais recursos, mais Orbes.', {
        fontSize: '13px',
      }).setAlpha(0.8),
    );

    const reinos = reinosParaNivel(this.catalogo, this.estado.nivel ?? 1);
    const listaLargura = Math.min(380, w * 0.42);

    let y = y0 + 92;
    for (const reino of reinos) {
      const acessivel = podeEntrarNoReino(reino, this.estado.nivel ?? 1);
      const atual = this.reinoAtual?.id === reino.id;
      const resumo = `nível ${reino.faixaMin ?? 1}+ • dificuldade ${reino.dificuldade ?? 1}/5`
        + (acessivel ? '' : ' • BLOQUEADO');

      const item = linhaLista(this, x0 + 28, y, listaLargura, reino.nome, resumo, () => {
        if (!acessivel) {
          this.mostrarToast(`Requer nível ${reino.faixaMin}.`);
          return;
        }
        if (atual) {
          this.mostrarToast('Você já está neste reino.');
          return;
        }
        this.aoViajar(reino);
        this.mostrarToast(`Você atravessou para ${reino.nome}.`);
        this.fechar();
      });
      if (atual) item.t1.setColor('#8fd18f');
      if (!acessivel) {
        item.caixa.setFillStyle(0x181310);
        item.t1.setAlpha(0.5);
        item.t2.setAlpha(0.4);
      }
      y += 46;
    }

    // Detalhe do reino selecionado (descricao + loot + monstros).
    this.criarDetalhe(x0 + 28 + listaLargura + 30, y0 + 92, w - listaLargura - 90, h - 180);

    this.add.existing(
      botao(this, width / 2, y0 + h - 30, 'Fechar [R / ESC]', () => this.fechar(), { largura: 200 }).caixa,
    );

    this.input.keyboard.on('keydown-R', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());
  }

  criarDetalhe(x, y, largura, altura) {
    const reinos = reinosParaNivel(this.catalogo, this.estado.nivel ?? 1);
    const reino = reinos[0];
    if (!reino) return;

    this.add.existing(uiTitulo(this, x, y, reino.nome, '16px'));
    let ly = y + 28;
    this.add.existing(
      uiTexto(this, x, ly, reino.descricao ?? '', {
        fontSize: '12px',
        wordWrap: { width: largura },
      }).setAlpha(0.85),
    );
    ly += 48;

    this.add.existing(uiTexto(this, x, ly, `Bioma: ${reino.bioma ?? '—'}`, { fontSize: '12px', color: OURO }));
    ly += 22;

    // Recursos abundantes
    const recs = (reino.recursosAbundantes ?? [])
      .map((id) => buscarItem(this.catalogo, id)?.nome ?? id)
      .join(', ');
    this.add.existing(uiTexto(this, x, ly, `Recursos: ${recs}`, { fontSize: '12px', wordWrap: { width: largura } }));
    ly += 26;

    // Monstros
    const mons = (reino.monstrosPossiveis ?? [])
      .map((id) => this.catalogo.indice.monsters?.[id]?.nome ?? id)
      .join(', ');
    this.add.existing(uiTexto(this, x, ly, `Monstros: ${mons}`, { fontSize: '12px', wordWrap: { width: largura } }));
    ly += 30;

    // Loot global
    this.add.existing(uiTitulo(this, x, ly, 'Loot do mundo', '13px'));
    ly += 20;
    for (const l of reino.lootGlobal ?? []) {
      const def = buscarItem(this.catalogo, l.itemId);
      this.add.existing(
        uiTexto(this, x, ly, `• ${def?.nome ?? l.itemId} — ${l.chance ?? 0}% (${l.qtdMin ?? 1}-${l.qtdMax ?? 1})`, {
          fontSize: '11px',
        }).setAlpha(0.8),
      );
      ly += 18;
    }
  }

  mostrarToast(msg) {
    this.toastObj ??= uiTexto(this, this.scale.width / 2, this.scale.height - 50, '', {
      fontSize: '13px',
      color: OURO,
      backgroundColor: '#14100ccc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(5000);
    this.toastObj.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastObj);
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 1800, delay: 400 });
  }

  fechar() {
    this.scene.stop('Reinos');
  }
}
