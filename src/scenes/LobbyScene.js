import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import {
  painel as uiPainel,
  botao,
  texto as uiTexto,
  titulo as uiTitulo,
  caixaArredondada,
  aoTeclar,
} from '../ui/comuns.js';
import { TEXTURAS } from './BootScene.js';

// =====================================================================
// LobbyScene — seleção de personagem (até 10), changelog lateral, bg animado
// =====================================================================

const MAX_CHARS = 10;
const SLOT_W = 180;
const SLOT_H = 220;
const GAP = 16;

export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.perfil = dados?.perfil ?? null;
    this.catalogo = dados?.catalogo ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
    this.aoEntrar = dados?.aoEntrar ?? (() => {});
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0805');

    // --- Background animado (parallax layers) ---
    this.criarBackground();

    // --- Container raiz ---
    this.raiz = this.add.container(0, 0);

    // Overlay semi-transparente
    this.raiz.add(
      this.add.rectangle(0, 0, 2000, 2000, 0x000000, 0.65).setOrigin(0).setInteractive(),
    );

    // Painel central
    const { width, height } = this.scale;
    const panelW = Math.min(1100, width - 40);
    const panelH = Math.min(720, height - 40);
    const x0 = (width - panelW) / 2;
    const y0 = (height - panelH) / 2;

    this.raiz.add(uiPainel(this, x0, y0, panelW, panelH, 0x120d08, 0.95));

    // Título
    this.raiz.add(uiTitulo(this, x0 + 24, y0 + 18, 'SALÃO DOS HERÓIS', '22px'));

    // Subtítulo com conta
    const contaTxt = this.uid
      ? `Conectado: ${this.perfil?.nome ?? this.perfil?.email ?? 'Jogador'}`
      : 'Modo local — progresso salvo neste navegador';
    this.raiz.add(
      uiTexto(this, x0 + 24, y0 + 52, contaTxt, { fontSize: '11px', color: PERGAMINHO })
        .setAlpha(0.7)
        .setOrigin(0, 0),
    );

    // Botão fechar (só no modo local, para voltar ao login)
    if (!this.uid) {
      this.raiz.add(
        botao(this, x0 + panelW - 24, y0 + 24, 'Voltar ao Login [ESC]', () => this.voltarLogin(), {
          largura: 180,
          altura: 32,
          tamanho: '11px',
          cor: 0x3a2c20,
          corHover: 0x4a3828,
          corTexto: PERGAMINHO,
        }).caixa.setOrigin(1, 0),
      );
    }

    // --- Área dos slots (esquerda) ---
    const slotsX = x0 + 24;
    const slotsY = y0 + 84;
    const slotsW = panelW - 320; // deixa espaço pro changelog à direita
    this.criarSlots(slotsX, slotsY, slotsW, panelH - 110);

    // --- Changelog lateral (direita) ---
    const logX = x0 + panelW - 280;
    const logY = y0 + 84;
    this.criarChangelog(logX, logY, 256, panelH - 110);

    // Botão "Novo Herói" (se tem vaga)
    const temVaga = (this.perfil?.personagens?.length ?? 0) < MAX_CHARS;
    if (temVaga) {
      const btnY = y0 + panelH - 56;
      this.raiz.add(
        botao(this, x0 + panelW / 2, btnY, '+ NOVO HERÓI', () => this.novoPersonagem(), {
          largura: 220,
          altura: 40,
          tamanho: '14px',
          cor: 0x8a6a2f,
          corHover: 0x9a7a3f,
          corTexto: PERGAMINHO,
        }).caixa.setOrigin(0.5),
      );
    }

    // Teclas
    aoTeclar(this, 'ESC', () => this.uid ? this.fechar() : this.voltarLogin());
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.redesenhar());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, () => this.redesenhar());
      this.pararBackground();
    });
  }

  // =====================================================================
  // Background animado (parallax com imagens procedurais)
  // =====================================================================

  criarBackground() {
    const { width, height } = this.scale;
    this.bgLayers = [];

    // Camada 1: chão escuro com textura
    const chao = this.add.tileSprite(0, 0, width, height, TEXTURAS.CHAO)
      .setOrigin(0, 0)
      .setDepth(-100)
      .setTint(0x1a1410)
      .setAlpha(0.8);
    this.bgLayers.push({ obj: chao, speedX: 0.02, speedY: 0.01 });

    // Camada 2: neblina/partículas lentas
    const neblina = this.add.graphics().setDepth(-90);
    this.desenharNeblina(neblina, width, height);
    this.bgLayers.push({ obj: neblina, speedX: 0.005, speedY: 0.003, redraw: true });

    // Camada 3: runas flutuantes
    this.runas = [];
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const r = this.add.text(x, y, '◆', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Phaser.Math.Between(16, 32)}px`,
        color: '#7a4fd4',
      }).setAlpha(0.15).setDepth(-80).setOrigin(0.5);
      this.runas.push({ obj: r, vx: Phaser.Math.FloatBetween(-0.02, 0.02), vy: Phaser.Math.FloatBetween(-0.03, -0.01) });
    }
  }

  desenharNeblina(g, w, h) {
    g.clear();
    g.fillStyle(0x1a1028, 0.08);
    for (let i = 0; i < 6; i++) {
      const x = (this.neblinaOffsetX ?? 0) + i * 300;
      const y = (this.neblinaOffsetY ?? 0) + i * 150;
      g.fillEllipse(x % (w + 200) - 100, y % (h + 200) - 100, 400, 200);
    }
  }

  update(time, delta) {
    if (!this.bgLayers) return;
    const dt = delta / 1000;

    // Parallax layers
    for (const layer of this.bgLayers) {
      if (layer.obj.tilePosition) {
        layer.obj.tilePositionX += layer.speedX * delta;
        layer.obj.tilePositionY += layer.speedY * delta;
      } else if (layer.redraw && layer.obj.clear) {
        this.neblinaOffsetX = (this.neblinaOffsetX ?? 0) + layer.speedX * delta;
        this.neblinaOffsetY = (this.neblinaOffsetY ?? 0) + layer.speedY * delta;
        this.desenharNeblina(layer.obj, this.scale.width, this.scale.height);
      }
    }

    // Runas flutuantes
    for (const r of this.runas) {
      r.obj.x += r.vx * delta;
      r.obj.y += r.vy * delta;
      if (r.obj.y < -50) {
        r.obj.y = this.scale.height + 50;
        r.obj.x = Phaser.Math.Between(0, this.scale.width);
      }
      if (r.obj.x < -50) r.obj.x = this.scale.width + 50;
      if (r.obj.x > this.scale.width + 50) r.obj.x = -50;
    }
  }

  pararBackground() {
    this.bgLayers = null;
    this.runas = null;
  }

  // =====================================================================
  // Slots de personagem
  // =====================================================================

  criarSlots(x, y, w, h) {
    const personagens = this.perfil?.personagens ?? [];
    const cols = Math.floor((w + GAP) / (SLOT_W + GAP));
    const rows = Math.ceil(MAX_CHARS / cols);

    // Painel de fundo dos slots
    this.raiz.add(
      caixaArredondada(this, x - 8, y - 8, w + 16, h + 16, {
        raio: 10,
        preenchimento: 0x0d0a07,
        borda: 0x3a2c20,
        larguraBorda: 1,
        origem: [0, 0],
      }),
    );

    let cx = x;
    let cy = y;
    let idx = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (idx >= MAX_CHARS) break;

        const char = personagens[idx];
        this.criarSlot(char, cx, cy, idx);
        cx += SLOT_W + GAP;
        idx++;
      }
      cx = x;
      cy += SLOT_H + GAP;
    }

    // Se sobraram slots vazios, mostra placeholder "+"
    while (idx < MAX_CHARS) {
      this.criarSlotVazio(cx, cy);
      cx += SLOT_W + GAP;
      idx++;
      if (cx > x + w - SLOT_W) {
        cx = x;
        cy += SLOT_H + GAP;
      }
    }
  }

  criarSlot(char, x, y, idx) {
    const container = this.add.container(x, y);
    this.raiz.add(container);

    // Fundo do slot
    const bg = caixaArredondada(this, 0, 0, SLOT_W, SLOT_H, {
      raio: 8,
      preenchimento: char ? 0x1a1410 : 0x120d08,
      borda: char ? 0x7a4fd4 : 0x3a2c20,
      larguraBorda: char ? 2 : 1,
      alfa: char ? 1 : 0.6,
      origem: [0, 0],
    });
    container.add(bg);

    if (char) {
      // Retrato (usa classe como base visual)
      const classe = this.catalogo?.classes?.find(c => c.id === char.vocacaoId);
      const corClasse = classe?.cor ?? 0x7a4fd4;
      const retrato = this.add.rectangle(SLOT_W / 2, 60, 80, 80, corClasse, 0.9)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x7a4fd4);
      container.add(retrato);

      // Ícone da raça
      const raca = { humano: '👤', anao: '⛏️', elfo: '🏹', orc: '⚔️' }[char.racaId] ?? '❓';
      container.add(this.add.text(SLOT_W / 2, 60, raca, { fontSize: '36px' }).setOrigin(0.5));

      // Nome
      container.add(this.add.text(SLOT_W / 2, 116, char.nome, {
        fontFamily: 'Georgia, serif',
        fontSize: '14px',
        color: OURO,
        wordWrap: { width: SLOT_W - 16 },
      }).setOrigin(0.5, 0));

      // Raça + Vocação
      const racaNome = { humano: 'Humano do Norte', anao: 'Anão da Forja', elfo: 'Elfo do Véu', orc: 'Orc do Sul' }[char.racaId] ?? char.racaId;
      const vocNome = this.catalogo?.classes?.find(c => c.id === char.vocacaoId)?.nome ?? '—';
      container.add(this.add.text(SLOT_W / 2, 138, `${racaNome}  ·  ${vocNome}`, {
        fontSize: '10px',
        color: PERGAMINHO,
        wordWrap: { width: SLOT_W - 16 },
      }).setOrigin(0.5, 0).setAlpha(0.8));

      // Nível + XP
      const { nivel, xpNoNivel, faltam } = this.calcularNivel(char.xp ?? 0);
      container.add(this.add.text(SLOT_W / 2, 158, `Nível ${nivel}  (${xpNoNivel}/${xpNoNivel + faltam} XP)`, {
        fontSize: '10px',
        color: OURO,
      }).setOrigin(0.5, 0).setAlpha(0.9));

      // Botões
      const bEntrar = this.criarBotaoSlot(container, 'ENTRAR', SLOT_W / 2, 186, () => this.entrarCom(char));
      const bEditar = this.criarBotaoSlot(container, 'EDITAR', SLOT_W / 2 - 56, 214, () => this.editarPersonagem(char));
      const bApagar = this.criarBotaoSlot(container, 'APAGAR', SLOT_W / 2 + 56, 214, () => this.confirmarApagar(char), {
        cor: 0x7a2f2a, corHover: 0x9a3a33, corTexto: '#ffe6e0',
      });

      container.add([bEntrar, bEditar, bApagar]);
    } else {
      // Slot vazio — botão "+"
      container.add(this.add.text(SLOT_W / 2, SLOT_H / 2 - 10, '+', {
        fontFamily: 'Georgia, serif',
        fontSize: '48px',
        color: '#4a3a28',
      }).setOrigin(0.5).setAlpha(0.5));

      container.add(this.add.text(SLOT_W / 2, SLOT_H / 2 + 30, 'Novo Herói', {
        fontSize: '12px',
        color: PERGAMINHO,
      }).setOrigin(0.5).setAlpha(0.6));

      // Clique no slot vazio = novo personagem
      const hit = this.add.rectangle(0, 0, SLOT_W, SLOT_H, 0xffffff, 0)
        .setOrigin(0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.novoPersonagem());
      hit.on('pointerover', () => bg.setStrokeStyle(2, 0x7a4fd4));
      hit.on('pointerout', () => bg.setStrokeStyle(1, 0x3a2c20));
      container.add([bg, hit]);
    }

    container.setData('idx', idx);
    container.setDepth(10);
  }

  criarBotaoSlot(container, texto, x, y, callback, estilo = {}) {
    const b = botao(this, x, y, texto, callback, {
      largura: estilo.largura ?? 100,
      altura: 26,
      tamanho: '10px',
      cor: estilo.cor ?? 0x241c14,
      corHover: estilo.corHover ?? 0x3a2c20,
      corTexto: estilo.corTexto ?? PERGAMINHO,
      corBorda: estilo.corBorda ?? 0x7a4fd4,
      raio: 6,
    });
    b.caixa.setOrigin(0.5, 0);
    return b.caixa;
  }

  criarSlotVazio(x, y) {
    // Usa criarSlot com char=null
    this.criarSlot(null, x, y, -1);
  }

  // =====================================================================
  // Changelog lateral
  // =====================================================================

  criarChangelog(x, y, w, h) {
    this.raiz.add(
      caixaArredondada(this, x - 8, y - 8, w + 16, h + 16, {
        raio: 10,
        preenchimento: 0x0d0a07,
        borda: 0x3a2c20,
        larguraBorda: 1,
        origem: [0, 0],
      }),
    );

    this.raiz.add(
      uiTitulo(this, x, y, 'NOVIDADES', '14px').setOrigin(0, 0),
    );

    const changelog = this.obterChangelogResumido();
    let cy = y + 28;
    for (const entry of changelog) {
      if (cy > y + h - 30) break;
      this.raiz.add(
        uiTexto(this, x, cy, entry, {
          fontSize: '10px',
          color: entry.startsWith('•') ? OURO : PERGAMINHO,
          wordWrap: { width: w - 16 },
          lineSpacing: 2,
        }).setOrigin(0, 0).setAlpha(entry.startsWith('•') ? 1 : 0.8),
      );
      cy += 18;
    }
  }

  obterChangelogResumido() {
    // Lê do CHANGELOG.md se disponível, senão usa fallback
    // No build, o arquivo não vem junto — usamos fallback hardcoded
    return [
      '📜 v0.2.0 — Out/2026',
      '• Mundo 60×44 (6× maior)',
      '• Posição persistente',
      '• Portal posicionável (Shift+P)',
      '• Itens até 1k + perecíveis',
      '• Agrupar itens (inventário)',
      '• Atributos extras (missões)',
      '• Admin: foco persistente',
      '• Termos: scroll + margem',
      '• Wiki (H): busca com foco',
      '• Lobby: até 10 heróis',
      '',
      '🔧 Em breve:',
      '• Auto-combate / missões',
      '• Editor de pixels (admin)',
      '• Guildas / servidores',
      '• Anti-cheat',
    ];
  }

  // =====================================================================
  // Ações
  // =====================================================================

  entrarCom(char) {
    this.aoEntrar(char);
    this.scene.stop('Lobby');
  }

  novoPersonagem() {
    // Abre tela de criação em modo "novo"
    this.scene.stop('Lobby');
    this.scene.start('Criacao', {
      uid: this.uid,
      perfil: this.perfil,
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
      modoNovo: true,
      aoConcluir: (novoChar) => this.aoCriado(novoChar),
    });
  }

  aoCriado(novoChar) {
    // Volta pro lobby com o perfil atualizado
    this.scene.start('Lobby', {
      uid: this.uid,
      perfil: this.perfil, // o perfil já foi atualizado pelo CriacaoScene
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
    });
  }

  editarPersonagem(char) {
    this.scene.stop('Lobby');
    this.scene.start('Criacao', {
      uid: this.uid,
      perfil: this.perfil,
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
      editando: true,
      personagem: char,
      aoConcluir: (atualizado) => this.aoEditado(atualizado),
    });
  }

  aoEditado(atualizado) {
    this.scene.start('Lobby', {
      uid: this.uid,
      perfil: this.perfil,
      catalogo: this.catalogo,
      isAdmin: this.isAdmin,
    });
  }

  confirmarApagar(char) {
    // Modal de confirmação simples
    const { width, height } = this.scale;
    const w = 360, h = 180;
    const x0 = (width - w) / 2, y0 = (height - h) / 2;

    const modal = this.add.container(0, 0).setDepth(9000);
    const capa = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.85)
      .setOrigin(0.5).setInteractive();
    const box = caixaArredondada(this, x0 + w/2, y0 + h/2, w, h, {
      raio: 10, preenchimento: 0x1a1410, borda: 0x7a2f2a, larguraBorda: 2, origem: [0.5, 0.5],
    });
    modal.add([capa, box]);

    modal.add(uiTitulo(this, x0 + w/2, y0 + 22, 'Apagar herói?', '16px').setOrigin(0.5, 0));
    modal.add(uiTexto(this, x0 + w/2, y0 + 56,
      `Apagar "${char.nome}" (nível ${this.calcularNivel(char.xp ?? 0).nivel})?\n\n` +
      'Progresso, base, inventário e portal serão perdidos.\nNão dá para desfazer.',
      { fontSize: '11px', align: 'center', wordWrap: { width: w - 40 }, lineSpacing: 3 }
    ).setOrigin(0.5, 0));

    const bSim = botao(this, x0 + w/2 - 70, y0 + h - 40, 'APAGAR', async () => {
      await this.apagarPersonagem(char.id);
      modal.destroy();
      this.redesenhar();
    }, { largura: 110, cor: 0x7a2f2a, corHover: 0x9a3a33, corTexto: '#ffe6e0' }).caixa;

    const bNao = botao(this, x0 + w/2 + 70, y0 + h - 40, 'Cancelar', () => modal.destroy(),
      { largura: 110, cor: 0x3a2c20, corHover: 0x4a3828, corTexto: PERGAMINHO }).caixa;

    modal.add([bSim, bNao]);
    capa.on('pointerdown', () => modal.destroy());
    this.raiz.add(modal);
  }

  async apagarPersonagem(id) {
    const { apagarPersonagem } = await import('../core/progresso.js');
    await apagarPersonagem(this.uid, id);
    // Recarrega perfil
    const { carregarPerfilJogador } = await import('../core/progresso.js');
    this.perfil = await carregarPerfilJogador(this.uid);
  }

  redesenhar() {
    // Para simplificar: restart da cena
    this.scene.restart();
  }

  fechar() {
    this.scene.stop('Lobby');
  }

  voltarLogin() {
    this.scene.stop('Lobby');
    this.scene.start('Login');
  }

  calcularNivel(xpTotal) {
    let nivel = 1;
    let restante = Math.max(0, xpTotal);
    const xpParaProximoNivel = (n) => Math.floor(100 * Math.pow(Math.max(1, n), 1.35));
    while (restante >= xpParaProximoNivel(nivel)) {
      restante -= xpParaProximoNivel(nivel);
      nivel += 1;
    }
    return { nivel, xpNoNivel: restante, faltam: xpParaProximoNivel(nivel) - restante };
  }
}