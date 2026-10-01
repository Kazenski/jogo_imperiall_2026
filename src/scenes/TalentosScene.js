import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarClasse } from '../core/catalogo.js';
import {
  desbloquearTalento,
  talentoDisponivel,
  redefinirArvore,
} from '../core/personagem.js';
import { texto as uiTexto, titulo as uiTitulo, botao } from '../ui/comuns.js';

const LARGURA_NO = 150;
const ALTURA_NO = 62;
const ESPACO_X = LARGURA_NO + 40;
const ESPACO_Y = ALTURA_NO + 46;

export class TalentosScene extends Phaser.Scene {
  constructor() {
    super('Talentos');
  }

  init(dados) {
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0a07, 0.98).setInteractive();
    this.add.existing(uiTitulo(this, 24, 18, 'ÁRVORE DE TALENTOS', '22px'));
    this.add.existing(
      uiTexto(this, 24, 48, `Pontos de talento: ${this.estado.pontosTalento ?? 0}   |   Nível: ${this.estado.nivel ?? 1}`, {
        fontSize: '13px',
        color: OURO,
      }),
    );

    const btnRespec = botao(this, width - 220, 34, 'Redefinir árvore', () => {
      const devolvidos = redefinirArvore(this.estado, this.catalogo);
      this.mostrarToast(`${devolvidos} pontos devolvidos.`);
      this.desenhar();
    }, { largura: 180, cor: 0xc96a5a, corHover: 0xd05a5a, corTexto: '#fff' });
    this.add.existing([btnRespec.caixa, btnRespec.label]);

    this.add.existing(
      botao(this, width - 90, 34, 'Fechar [T]', () => this.fechar(), { largura: 120 }).caixa,
    );

    // Sem vocacao escolhida: picker.
    if (!this.estado.vocacaoId) {
      this.desenharEscolhaDeVocacao();
    } else {
      this.desenharArvore();
    }

    this.input.keyboard.on('keydown-T', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());
  }

  desenharEscolhaDeVocacao() {
    this.limparArvore();
    const { width, height } = this.scale;
    this.add.existing(
      uiTexto(this, width / 2, height / 2 - 140, 'Escolha sua Vocação (define sua árvore de talentos):', {
        fontSize: '15px',
        align: 'center',
      }).setOrigin(0.5),
    );

    const classes = this.catalogo.classes ?? [];
    let y = height / 2 - 90;
    for (const c of classes) {
      const b = botao(this, width / 2, y, `${c.nome}  —  ${c.descricao ?? ''}`.slice(0, 60), () => {
        this.estado.vocacaoId = c.id;
        this.mostrarToast(`Vocação escolhida: ${c.nome}`);
        this.desenhar();
      }, { largura: 520, altura: 44, tamanho: '13px' });
      this.add.existing([b.caixa, b.label]);
      y += 56;
    }
  }

  desenharArvore() {
    this.limparArvore();
    const { width, height } = this.scale;
    const classe = buscarClasse(this.catalogo, this.estado.vocacaoId);

    this.add.existing(
      uiTexto(this, 24, 74, `Vocação: ${classe?.nome ?? this.estado.vocacaoId}`, { fontSize: '15px', color: OURO }),
    );

    const talentos = (this.catalogo.skills ?? []).filter((t) => t.classeId === this.estado.vocacaoId);
    if (!talentos.length) {
      this.add.existing(
        uiTexto(this, width / 2, height / 2, 'Esta vocação ainda não tem talentos cadastrados.', {
          fontSize: '14px',
          align: 'center',
        }).setOrigin(0.5),
      );
      return;
    }

    // Centraliza a arvore.
    const maxX = Math.max(...talentos.map((t) => t.posX ?? 0));
    const maxY = Math.max(...talentos.map((t) => t.posY ?? 0));
    const larguraArvore = maxX * ESPACO_X + LARGURA_NO;
    const alturaArvore = maxY * ESPACO_Y + ALTURA_NO;
    const origemX = Math.max(40, (width - larguraArvore) / 2);
    const origemY = Math.max(120, (height - alturaArvore) / 2 + 30);

    const posicao = (t) => ({
      x: origemX + (t.posX ?? 0) * ESPACO_X,
      y: origemY + (t.posY ?? 0) * ESPACO_Y,
    });

    this.containerArvore = this.add.container(0, 0);

    // Ligacoes (pre-requisitos) primeiro, atras dos nos.
    for (const t of talentos) {
      const destino = posicao(t);
      for (const preId of t.preRequisitos ?? []) {
        const pre = talentos.find((o) => o.id === preId);
        if (!pre) continue;
        const origem = posicao(pre);
        const ativo = (this.estado.arvoreDesbloqueada ?? []).includes(preId);
        this.containerArvore.add(
          this.add
            .line(0, 0, origem.x + LARGURA_NO / 2, origem.y + ALTURA_NO / 2, destino.x + LARGURA_NO / 2, destino.y + ALTURA_NO / 2, ativo ? OURO : 0x3a2c20, ativo ? 0.9 : 0.4)
            .setOrigin(0.5),
        );
      }
    }

    // Nos
    for (const t of talentos) {
      const { x, y } = posicao(t);
      const desbloqueado = (this.estado.arvoreDesbloqueada ?? []).includes(t.id);
      const disponivel = talentoDisponivel(this.estado, t);
      const cor = desbloqueado ? 0x3a7f47 : disponivel ? 0xd4af6a : 0x2e241a;

      const caixa = this.add
        .rectangle(x, y, LARGURA_NO, ALTURA_NO, cor, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(desbloqueado ? 2 : 1, desbloqueado ? 0x8fd18f : 0x8a6a2f)
        .setInteractive({ useHandCursor: true });

      const nome = this.add
        .text(x + 8, y + 6, t.nome, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: desbloqueado ? '#eaffea' : PERGAMINHO,
        })
        .setOrigin(0, 0);

      const info = this.add
        .text(x + 8, y + 22, `${t.tipo} · ${t.custoPontos ?? 1}pt · nv${t.nivelMin ?? 1}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#e0b64a',
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(x + 8, y + 38, (t.descricao ?? '').slice(0, 30), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '9px',
          color: '#a89a86',
        })
        .setOrigin(0, 0);

      this.containerArvore.add([caixa, nome, info, desc]);

      caixa.on('pointerdown', () => this.clicarNo(t, desbloqueado));
    }
  }

  clicarNo(talento, desbloqueado) {
    if (desbloqueado) {
      this.mostrarToast(`Já desbloqueado: ${talento.nome}`);
      return;
    }
    const r = desbloquearTalento(this.estado, talento, this.catalogo);
    if (r.ok) {
      this.mostrarToast(`Talento desbloqueado: ${talento.nome}!`);
      this.desenhar();
    } else {
      this.mostrarToast(r.motivo);
    }
  }

  limparArvore() {
    if (this.containerArvore) {
      this.containerArvore.removeAll(true);
      this.containerArvore = null;
    }
  }

  mostrarToast(msg) {
    this.toastObj ??= uiTexto(this, this.scale.width / 2, this.scale.height - 60, '', {
      fontSize: '13px',
      color: OURO,
      backgroundColor: '#14100ccc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(5000);
    this.toastObj.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastObj);
    this.tweens.add({ targets: this.toastObj, alpha: 0, duration: 1800, delay: 400 });
  }

  async fechar() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
    this.scene.stop('Talentos');
  }
}
