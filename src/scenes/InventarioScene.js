import Phaser from 'phaser';
import { TEXTURAS } from './BootScene.js';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem } from '../core/catalogo.js';
import {
  nivelDeUpgrades,
  SLOTS,
  removerItem,
} from '../core/personagem.js';
import { usarOrbe, usarConsumivel } from '../core/regras.js';
import { texto as uiTexto, titulo as uiTitulo, painel, botao, chip, addTodos } from '../ui/comuns.js';

const TAMANHO_CELULA = 52;
const COLUNAS = 8;
const LINHAS = 7;

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
    this.blocoSelecionado = null;

    const { width, height } = this.scale;
    const w = Math.min(920, width - 40);
    const h = Math.min(620, height - 40);
    this.x0 = width / 2 - w / 2;
    this.y0 = height / 2 - h / 2;
    this.larguraPainel = w;
    this.alturaPainel = h;

    this.add.rectangle(width / 2, height / 2, w, h, 0x14100c, 0.98).setStrokeStyle(2, 0x8a6a2f);
    this.add.existing(uiTitulo(this, this.x0 + 24, this.y0 + 18, 'MOCHILA DO IMPERADOR', '20px'));

    // ----- cofre de Orbes -----
    this.add.existing(uiTexto(this, this.x0 + 24, this.y0 + 54, 'Orbes Arcanos:', { fontSize: '13px', color: OURO }));
    // criarBarraOrbes ja adiciona os objetos na cena e nao devolve nada.
    this.criarBarraOrbes(this.x0 + 24, this.y0 + 76, w - 48);

    // ----- grade -----
    this.gradeY = this.y0 + 118;
    this.criarGrade();

    // ----- detalhe -----
    this.criarDetalhe(this.x0 + 24, this.y0 + 118 + LINHAS * (TAMANHO_CELULA + 8) + 16, w - 48, 120);

    this.add.existing(
      botao(this, width / 2, this.y0 + h - 26, 'Fechar [I / ESC]', () => this.fechar(), { largura: 200 }).caixa,
    );

    // "Salvar" e "Escolher para construir"
    this.add.existing(
      botao(this, this.x0 + w - 130, this.y0 + h - 26, 'Salvar', async () => {
        await this.salvar();
        this.fechar();
      }, { largura: 120, cor: 0x8fd18f, corHover: 0xa8e5a8 }).caixa,
    );

    this.input.keyboard.on('keydown-I', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }

  criarBarraOrbes(x, y, largura) {
    const orbes = Object.entries(this.estado.orbes ?? {});
    const tipos = Object.keys(catalogoGlobalTipos);
    let cx = x;
    for (const tipo of tipos) {
      const qtd = this.estado.orbes?.[tipo] ?? 0;
      const def = buscarItem(this.catalogo, tipo);
      if (!def) continue;
      const icone = this.add
        .image(cx + 12, y + 12, TEXTURAS.ORBE)
        .setTint(def.cor ?? 0xffffff)
        .setDisplaySize(20, 20);
      const rot = uiTexto(this, cx + 26, y + 3, `${def.nome.split(' ')[0]} x${qtd}`, {
        fontSize: '11px',
        color: qtd > 0 ? PERGAMINHO : '#5a4a3a',
      });
      this.add.existing(icone);
      this.add.existing(rot);
      cx += Math.max(120, rot.width + 40);
      if (cx > x + largura) break;
    }
  }

  criarGrade() {
    const inv = this.estado.inventario;
    const total = COLUNAS * LINHAS;
    this.celulas = [];

    for (let i = 0; i < total; i += 1) {
      const col = i % COLUNAS;
      const lin = Math.floor(i / COLUNAS);
      const x = this.x0 + 24 + col * (TAMANHO_CELULA + 8);
      const y = this.gradeY + lin * (TAMANHO_CELULA + 8);

      const caixa = this.add
        .rectangle(x, y, TAMANHO_CELULA, TAMANHO_CELULA, 0x1a140e)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x3a2c20)
        .setInteractive({ useHandCursor: true });

      const img = this.add.image(x + TAMANHO_CELULA / 2, y + TAMANHO_CELULA / 2, TEXTURAS.BLOCO)
        .setDisplaySize(28, 28)
        .setVisible(false);
      const qtd = this.add
        .text(x + TAMANHO_CELULA - 4, y + TAMANHO_CELULA - 4, '', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#fff' })
        .setOrigin(1, 1);
      const orbeNivel = this.add
        .text(x + 4, y + 4, '', { fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: OURO })
        .setOrigin(0, 0);

      addTodos(this, caixa, img, qtd, orbeNivel);
      this.celulas.push({ caixa, img, qtd, orbeNivel });

      caixa.on('pointerdown', () => {
        const pilha = inv.itens[i];
        if (!pilha) return;
        this.selecionado = pilha;
        this.atualizarDetalhe();
        this.destacarCelula(i);
      });
    }
    this.preencherGrade();
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
      celula.img.setTexture(this.textura(def));
      celula.img.setTint(def?.cor ?? 0xffffff);
      celula.qtd.setText(pilha.qtd > 1 ? String(pilha.qtd) : '');
      const nivel = nivelDeUpgrades(pilha);
      celula.orbeNivel.setText(nivel > 0 ? `+${nivel}` : '');
      celula.caixa.setStrokeStyle(1, 0x3a2c20);
    });
  }

  textura(def) {
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

  destacarCelula(i) {
    this.celulas.forEach((c, idx) => {
      c.caixa.setStrokeStyle(1, idx === i ? OURO : 0x3a2c20);
    });
  }

  criarDetalhe(x, y, largura, altura) {
    this.detalheX = x;
    this.detalheY = y;
    this.detalheAltura = altura;
    this.detalhe = this.add.container(x, y);
    // Placeholder; o conteudo e desenhado em atualizarDetalhe.
  }

  atualizarDetalhe() {
    this.detalhe.removeAll(true);
    const pilha = this.selecionado;
    if (!pilha) {
      this.detalhe.add([
        uiTexto(this, 0, 0, 'Selecione um item para ver detalhes, usar Orbes ou equipar.', {
          fontSize: '13px',
        }).setAlpha(0.7),
      ]);
      return;
    }

    const def = buscarItem(this.catalogo, pilha.itemId);
    this.detalhe.add(uiTitulo(this, 0, 0, def?.nome ?? pilha.itemId, '16px'));

    let y = 28;
    const usos = def?.uso ?? [];
    let cx = 0;
    for (const uso of usos) {
      cx += chip(this, cx, y, uso, 0x241c14).width + 6;
    }
    if (def?.raridade) {
      chip(this, cx, y, def.raridade, 0xd4af6a, '#14100c');
    }
    y += 26;

    // Upgrade
    const nivel = nivelDeUpgrades(pilha);
    this.detalhe.add(
      uiTexto(this, 0, y, `Nível de Orbe: +${nivel}  (slots: ${(pilha.upgrades?.length ?? 0)}/${def?.slotsUpgrade ?? 0})`, {
        fontSize: '12px',
        color: nivel > 0 ? OURO : PERGAMINHO,
      }),
    );
    y += 22;

    // Ações: Orbes
    const orbesDisponiveis = Object.entries(this.estado.orbes ?? {}).filter(([, q]) => q > 0);
    let botaoX = 0;
    for (const [tipo] of orbesDisponiveis) {
      const defOrbe = buscarItem(this.catalogo, tipo);
      const b = botao(
        this,
        botaoX + 70,
        y + 14,
        `Usar ${defOrbe?.nome.split(' ').slice(1).join(' ') ?? 'Orbe'}`,
        () => {
          const r = usarOrbe({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid, orbeId: tipo });
          if (r.ok) {
            this.toast(`+${r.nivel} no item!`);
            this.preencherGrade();
            this.atualizarDetalhe();
          } else {
            this.toast(r.motivo);
          }
        },
        { largura: 140, altura: 28, tamanho: '11px', cor: 0x7a4fd4, corHover: 0x9a6fe0, corTexto: '#fff' },
      );
      this.detalhe.add([b.caixa, b.label]);
      botaoX += 150;
    }
    y += 40;

    // Equipar / usar / construir
    if (def?.tipo === 'equipavel' || def?.tipo === 'ferramenta') {
      const slot = this.slotDo(def);
      const b = botao(this, 70, y + 14, `Equipar (${slot})`, () => {
        this.estado.inventario.equipado[slot] = pilha.uid;
        this.toast(`${def.nome} equipado.`);
      }, { largura: 130, altura: 28, tamanho: '12px', cor: 0x8fd18f });
      this.detalhe.add([b.caixa, b.label]);
      if (def?.tipo === 'ferramenta') {
        const b2 = botao(this, 210, y + 14, 'Construir com este', () => {
          this.blocoSelecionado = pilha.itemId;
          this.toast(`Bloco selecionado para construção: ${def.nome}`);
          this.fechar();
        }, { largura: 170, altura: 28, tamanho: '12px', cor: 0xd4af6a });
        this.detalhe.add([b2.caixa, b2.label]);
      }
      y += 40;
    }

    if (def?.tipo === 'consumivel') {
      const b = botao(this, 70, y + 14, 'Consumir', () => {
        const r = usarConsumivel({ catalogo: this.catalogo, estado: this.estado, pilhaUid: pilha.uid });
        if (r.ok) {
          this.toast(`${r.nome} usado.`);
          this.preencherGrade();
          this.atualizarDetalhe();
        } else {
          this.toast(r.motivo);
        }
      }, { largura: 120, altura: 28, tamanho: '12px', cor: 0x8fd18f });
      this.detalhe.add([b.caixa, b.label]);
      y += 40;
    }

    // Largar 1
    const bDrop = botao(this, 70, y + 14, 'Largar 1', () => {
      const qtd = window.prompt('Quantidade para largar?', '1');
      const n = Number(qtd);
      if (Number.isFinite(n) && n > 0) {
        removerItem(this.estado.inventario, pilha.uid, n);
        this.preencherGrade();
        this.selecionado = null;
        this.atualizarDetalhe();
      }
    }, { largura: 110, altura: 28, tamanho: '12px', cor: 0xc96a5a, corHover: 0xd05a5a, corTexto: '#fff' });
    this.detalhe.add([bDrop.caixa, bDrop.label]);

    // Equipados atuais
    const equipados = SLOTS.filter((s) => this.estado.inventario.equipado[s]);
    if (equipados.length) {
      this.detalhe.add(
        uiTexto(this, 220, y + 6, `Equipado: ${equipados.join(', ')}`, { fontSize: '11px' }).setAlpha(0.8),
      );
    }
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
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 1800, delay: 400 });
  }

  async salvar() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
  }

  fechar() {
    this.scene.stop('Inventario');
  }
}

// Lista local dos tipos de Orbe (evita importar enums só para os chips).
const catalogoGlobalTipos = {
  orbe_arcano_menor: 1,
  orbe_arcano_medio: 1,
  orbe_arcano_superior: 1,
  orbe_arcano_epico: 1,
  orbe_arcano_lendario: 1,
};
