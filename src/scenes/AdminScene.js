import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { ROLES } from '../core/roles.js';

export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
  }

  create() {
    const { width, height } = this.scale;
    const centroX = width / 2;
    const centroY = height / 2;

    this.cameras.main.setBackgroundColor('#14100c');

    // Fundo semitransparente
    const fundo = this.add
      .rectangle(centroX, centroY, Math.min(720, width - 40), Math.min(520, height - 60), 0x14100c, 0.98)
      .setStrokeStyle(2, 0x8a6a2f)
      .setInteractive();

    // Titulo
    this.add
      .text(centroX, centroY - Math.min(220, height / 2 - 40), 'PAINEL ADMINISTRATIVO', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: OURO,
      })
      .setOrigin(0.5);

    this.add
      .text(
        centroX,
        centroY - Math.min(180, height / 2 - 80),
        'Impérium — Gestão de Itens, Classes, Habilidades, Monstros e Conquistas',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: PERGAMINHO,
          align: 'center',
          wordWrap: { width: Math.min(620, width - 80) },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.75);

    // Aviso: este é painel visual inicial (CRUD completo virá em sequência)
    this.add
      .text(
        centroX,
        centroY - 40,
        'Módulos planejados:\n• Itens & Blocos (usos: extração/transformação/utilização/estrutura/equipável/máquina)\n• Classes & Vocação + Árvore de Talentos (Passiva/Ativa/Mental/Social)\n• Monstros (Vida, Poder, FIS/MEN/SOC, Loot, Comportamento)\n• Recetas & Máquinas (Estações: Forja/Alquimia/Oficina/Torno/Prensa Arcana)\n• Reinos Etéreos (mundos paralelos por faixa de nível)\n• Conquistas + Orbes Arcanos (upgrades por tiers)',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: PERGAMINHO,
          align: 'left',
          lineSpacing: 6,
          wordWrap: { width: Math.min(640, width - 80) },
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        centroX,
        centroY + 140,
        'F2 ou ESC para voltar ao mundo',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#e0b64a',
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.85);

    // Botao Fechar
    const btnFechar = this.criarBotao(centroX, centroY + 190, 'Fechar', () => this.fechar());

    // Atalhos
    this.input.keyboard.on('keydown-F2', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => this.fechar());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-F2');
      this.input.keyboard.off('keydown-ESC');
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE);
    });
  }

  fechar() {
    this.scene.stop('Admin');
    if (this.scene.isSleeping('World')) this.scene.wake('World');
    else if (!this.scene.isActive('World')) this.scene.start('World');
  }

  criarBotao(x, y, texto, onClick) {
    const largura = 180;
    const altura = 42;
    const caixa = this.add
      .rectangle(x, y, largura, altura, 0xd4af6a)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x8a6a2f)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, texto, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: '600',
        color: '#14100c',
      })
      .setOrigin(0.5);

    caixa.on('pointerover', () => caixa.setFillStyle(0xe6c47c));
    caixa.on('pointerout', () => caixa.setFillStyle(0xd4af6a));
    caixa.on('pointerdown', onClick);
    return caixa;
  }
}
