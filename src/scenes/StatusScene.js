import Phaser from 'phaser';
import { TEXTURAS } from './BootScene.js';
import { SLOTS, bonusEquipados } from '../core/personagem.js';
import { buscarItem, buscarClasse } from '../core/catalogo.js';
import { OURO, PERGAMINHO } from '../constants.js';
import {
  texto as uiTexto,
  titulo as uiTitulo,
  painel,
  botao,
  caixaArredondada,
  campoTexto,
} from '../ui/comuns.js';

const ROTULOS_SLOT = {
  ferramenta: 'Ferramenta',
  mao: 'Mao',
  corpo: 'Corpo',
  anel: 'Anel',
};

const TAMANHO_SLOT = 58;

/**
 * Painel do personagem: equipamento, atributos e apelido.
 *
 * A area do personagem e um slot vazio esperando o sprite em pixel art — basta
 * substituir o retangulo tracejado por `this.add.image(...)` com a textura
 * quando o desenho ficar pronto (o quadrado guia some junto).
 */
export class StatusScene extends Phaser.Scene {
  constructor() {
    super('Status');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
    this.derivados = dados?.derivados;
    this.podeSalvar = dados?.podeSalvar ?? false;
    this.aoSalvar = dados?.aoSalvar ?? null;
    this.aoFechar = dados?.aoFechar ?? null;
    this.painelAberto = true;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#14100c');

    const w = Math.min(760, width - 48);
    const h = Math.min(520, height - 48);
    const x0 = (width - w) / 2;
    const y0 = (height - h) / 2;

    // Capa escura por tras do painel.
    const capa = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setInteractive();

    painel(this, x0, y0, w, h);

    uiTitulo(this, x0 + 28, y0 + 22, 'O IMPERADOR', '20px');

    // ---------- coluna esquerda: personagem + slots ----------
    const cxPersonagem = x0 + 128;
    const cyPersonagem = y0 + 210;

    this.criarEspacoDoPersonagem(cxPersonagem, cyPersonagem);

    // Slots em volta do personagem.
    const posicoes = {
      ferramenta: { x: cxPersonagem - 108, y: cyPersonagem - 118 },
      mao: { x: cxPersonagem + 108, y: cyPersonagem - 118 },
      corpo: { x: cxPersonagem - 108, y: cyPersonagem + 118 },
      anel: { x: cxPersonagem + 108, y: cyPersonagem + 118 },
    };
    for (const slot of SLOTS) {
      const p = posicoes[slot] ?? posicoes.ferramenta;
      this.criarSlot(slot, p.x, p.y);
    }

    // ---------- coluna direita: atributos ----------
    const colunaX = x0 + 300;
    let y = y0 + 62;

    y = this.criarLinhaApelido(colunaX, y, w - 340);
    y += 14;

    // Atributos principais.
    const classe = buscarClasse(this.catalogo, this.estado?.vocacaoId);
    const linhas = [
      ['Vocation', classe?.nome ?? '—'],
      ['Nivel', String(this.estado?.nivel ?? 1)],
      ['FIS (forca)', String(this.derivados?.fis ?? 0)],
      ['MEN (mente)', String(this.derivados?.men ?? 0)],
      ['SOC (corpo)', String(this.derivados?.soc ?? 0)],
    ];
    for (const [rotulo, valor] of linhas) {
      y = this.criarLinhaStat(colunaX, y, rotulo, valor);
    }

    y += 10;
    y = this.criarSecao(colunaX, y, 'Combate');
    const combate = [
      ['Vida maxima', Math.round(this.derivados?.vidaMax ?? 0)],
      ['Poder maximo', Math.round(this.derivados?.poderMax ?? 0)],
      ['Defesa', Math.round(this.derivados?.defesa ?? 0)],
      ['Poder de mineracao', Math.round(this.derivados?.poderMineracao ?? 0)],
      ['Regeneracao', `${this.derivados?.regen ?? 0}/s`],
    ];
    for (const [rotulo, valor] of combate) {
      y = this.criarLinhaStat(colunaX, y, rotulo, valor);
    }

    y += 10;
    y = this.criarSecao(colunaX, y, 'Trabalho');
    const trabalho = [
      ['Carga', Math.round(this.derivados?.carga ?? 0)],
      ['Alcance de construcao', `${this.derivados?.alcanceConstrucao ?? 0} blocos`],
      ['Bonus de XP', `${Math.round((this.derivados?.pct?.xpPct ?? 0) * 100)}%`],
      ['Bonus de ouro', `${Math.round((this.derivados?.pct?.ouroBonus ?? 0) * 100)}%`],
    ];
    for (const [rotulo, valor] of trabalho) {
      y = this.criarLinhaStat(colunaX, y, rotulo, valor);
    }

    // ---------- rodape ----------
    const totalBonos = this.resumoBonos();
    if (totalBonos) {
      uiTexto(this, colunaX, y0 + h - 92, totalBonos, {
        fontSize: '11px',
        color: OURO,
      }).setAlpha(0.9);
    }

    botao(this, x0 + w - 110, y0 + h - 32, 'Fechar [V / ESC]', () => this.fechar(), {
      largura: 160,
      altura: 36,
    });

    capa.on('pointerdown', () => this.fechar());
    this.input.keyboard.on('keydown-V', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());

    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this),
    );
  }

  relayout() {
    this.scene.restart();
  }

  /** Moldura que marca onde entra o sprite em pixel art do personagem. */
  criarEspacoDoPersonagem(cx, cy) {
    const largura = 150;
    const altura = 190;
    const box = caixaArredondada(this, cx, cy, largura, altura, {
      raio: 10,
      preenchimento: 0x1a1410,
      alfa: 0.9,
      borda: 0x4a3826,
      larguraBorda: 1,
      origem: [0.5, 0.5],
    });

    // Silhueta provisoria, removida quando o sprite entrar.
    box.add(
      this.add
        .image(0, 0, TEXTURAS.JOGADOR)
        .setDisplaySize(48, 52)
        .setOrigin(0.5)
        .setAlpha(0.85),
    );
    box.add(
      this.add
        .text(0, altura / 2 - 14, 'seu sprite aqui', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: PERGAMINHO,
        })
        .setOrigin(0.5)
        .setAlpha(0.45),
    );
    this.silhueta = box;
  }

  /** Um slot de equipamento com o item atualmente equipado. */
  criarSlot(slot, cx, cy) {
    const uidItem = this.estado?.inventario?.equipado?.[slot];
    const pilha = uidItem
      ? (this.estado?.inventario?.itens ?? []).find((i) => i.uid === uidItem)
      : null;
    const def = pilha ? buscarItem(this.catalogo, pilha.itemId) : null;

    const box = caixaArredondada(this, cx, cy, TAMANHO_SLOT, TAMANHO_SLOT, {
      raio: 10,
      preenchimento: def ? 0x2a2018 : 0x14100c,
      alfa: 0.95,
      borda: def ? OURO : 0x3a2c20,
      larguraBorda: def ? 2 : 1,
      origem: [0.5, 0.5],
    });

    box.add(
      this.add
        .image(
          0,
          -6,
          def ? (def.tipo === 'ferramenta' ? TEXTURAS.FERRAMENTA : TEXTURAS.EQUIPAVEL) : TEXTURAS.BLOCO,
        )
        .setDisplaySize(28, 28)
        .setOrigin(0.5)
        .setAlpha(def ? 1 : 0.22),
    );

    box.add(
      this.add
        .text(0, TAMANHO_SLOT / 2 - 9, ROTULOS_SLOT[slot] ?? slot, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: def ? OURO : PERGAMINHO,
        })
        .setOrigin(0.5)
        .setAlpha(def ? 0.95 : 0.4),
    );

    // Nome do item equipado logo abaixo do slot.
    box.add(
      this.add
        .text(0, TAMANHO_SLOT / 2 + 6, def ? def.nome : 'vazio', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: PERGAMINHO,
        })
        .setOrigin(0.5)
        .setAlpha(0.7),
    );
  }

  /** Linha de edicao do apelido. */
  criarLinhaApelido(x, y, largura) {
    uiTexto(this, x, y, 'Apelido', { fontSize: '11px', color: OURO }).setAlpha(0.8);
    const nomeAtual = this.estado?.nome ?? 'Viajante';

    if (!this.podeSalvar) {
      uiTexto(this, x + 74, y, nomeAtual, { fontSize: '13px' });
      return y + 24;
    }

    const campo = campoTexto(this, x + 74, y - 4, Math.min(220, largura - 90), 28, nomeAtual, {
      placeholder: 'seu apelido',
      maxLength: 24,
      aoConfirmar: async (novo) => {
        const limpo = (novo || '').trim().slice(0, 24);
        if (!limpo || limpo === nomeAtual) return;
        this.estado.nome = limpo;
        await this.aoSalvar?.(limpo);
        this.mostrarAviso(`Apelido alterado para "${limpo}".`);
      },
    });
    this.campoApelido = campo;

    botao(this, x + 74 + Math.min(220, largura - 90) + 10, y + 10, 'Salvar', () => {
      campo.input.blur();
    }, { largura: 80, altura: 28, tamanho: '11px' });

    return y + 30;
  }

  criarSecao(x, y, tituloSecao) {
    uiTexto(this, x, y, tituloSecao.toUpperCase(), {
      fontSize: '10px',
      color: OURO,
    }).setAlpha(0.65);
    return y + 18;
  }

  criarLinhaStat(x, y, rotulo, valor) {
    uiTexto(this, x, y, rotulo, { fontSize: '12px' }).setAlpha(0.75);
    uiTexto(this, x + 200, y, String(valor), { fontSize: '12px', color: PERGAMINHO });
    return y + 19;
  }

  /** Resume os bonus somados de tudo que esta equipado. */
  resumoBonos() {
    const bonus = bonusEquipados(this.estado);
    const partes = [];
    for (const [chave, valor] of Object.entries(bonus ?? {})) {
      if (!valor) continue;
      partes.push(`${chave} ${valor > 0 ? '+' : ''}${Math.round(valor * 100) / 100}`);
    }
    return partes.length ? `Equipado: ${partes.join('  ')}` : '';
  }

  mostrarAviso(texto) {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height - 60, texto, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: OURO,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 600 });
    this.time.delayedCall(2500, () => t.destroy());
  }

  fechar() {
    this.campoApelido?.destruir?.();
    this.aoFechar?.();
    this.scene.stop();
  }
}