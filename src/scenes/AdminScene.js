import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { ROLES } from '../core/roles.js';
import {
  TIPOS_ITEM,
  USOS_ITEM,
  RARIDADES,
  ESTAÇÕES,
  TIPOS_ORBE,
  TIPOS_HABILIDADE,
  COMPORTAMENTOS_MONSTRO,
  TIPOS_ACHIEVEMENT,
} from '../core/enums.js';
import {
  repoItens,
  repoClasses,
  repoSkills,
  repoRecipes,
  repoMonstros,
  repoWorldTemplates,
  repoAchievements,
} from '../core/repos.js';
import { ehAdmin } from '../core/usuarios.js';

const ABAS = [
  { id: 'itens', label: 'Itens & Blocos' },
  { id: 'classes', label: 'Classes & Talentos' },
  { id: 'monstros', label: 'Monstros' },
  { id: 'receitas', label: 'Recetas & Máquinas' },
  { id: 'reinos', label: 'Reinos Etéreos' },
  { id: 'conquistas', label: 'Conquistas & Orbes' },
  { id: 'sistema', label: 'Sistema' },
];


export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
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
