import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarClasse } from '../core/catalogo.js';
import {
  desbloquearTalento,
  talentoDisponivel,
  redefinirArvore,
  talentosAtivos,
} from '../core/personagem.js';
import { painel as uiPainel, texto as uiTexto, titulo as uiTitulo, botao, chip, caixaArredondada, aoTeclar, FONTE_UI } from '../ui/comuns.js';

// Geometria da arvore. Os nos sao desenhados a partir de `posX`/`posY` que o
// ADMINISTRADOR cadastrou (colunas e linhas), e nao de uma grade fixa: assim
// uma ramificacao com 6 talentos e outra com 2 ocupam o mesmo espaco vertical.
const LARGURA_NO = 156;
const ALTURA_NO = 74;
const ESPACO_X = LARGURA_NO + 44;
const ESPACO_Y = ALTURA_NO + 40;

// Cores padrao de ramo, aplicadas quando o admin nao define `corRamo`.
const CORES_RAMO = {
  corpo: 0x4f8a4f,
  mente: 0x4f5f8a,
  espirito: 0x8a7a2f,
  social: 0x8a4f7a,
  arcano: 0x7a4f8a,
  guerra: 0x8a4f4f,
};

const ROTULO_TIPO = {
  passiva: 'Passiva',
  ativa: 'Ativa',
  mental: 'Mental',
  social: 'Social',
};

// Paleta de onde `corDeNome` sorteia para ramos que o admin criou com nome
// novo. Todos os tons são escuros e dessaturados de propósito: a cor do ramo
// fica no conector e na barra da legenda, e um tom vivo competiria com o ouro
// do texto, que é onde a informação está.
const PALETA_RAMO = [
  0x6f8a3f, // verde-oliva
  0x3f7f8a, // verde-azulado
  0x8a6f3f, // âmbar queimado
  0x8a3f6f, // ameixa
  0x6f3f8a, // violeta
  0x8a3f3f, // tijolo
  0x3f8a7a, // esmeralda
  0x7a7f3f, // oliva
  0x8a5f3f, // cobre
  0x4f6f8a, // azul-aço
];

/**
 * Cor estável derivada do NOME do ramo.
 *
 * O admin pode cadastrar ramos que o jogo nunca viu ("Runa", "Sobrevivência",
 * "Alquimia"). Sem esta função, todo ramo sem nome conhecido cairia na mesma cor
 * dourada de fallback e a árvore perderia a leitura visual que a barra lateral
 * faz — que era exatamente o motivo das faixas coloridas existirem.
 *
 * A mesma string devolve sempre a mesma cor: o hash é sobre os caracteres, não
 * sobre a ordem de chamada. Se devolvesse diferente a cada redesenho, as linhas
 * mudariam de cor toda vez que a janela mudasse de tamanho.
 */
function corDeNome(nome) {
  const texto = String(nome ?? '').toLowerCase();
  if (!texto) return 0x8a6a2f;
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return PALETA_RAMO[hash % PALETA_RAMO.length];
}

export class TalentosScene extends Phaser.Scene {
  constructor() {
    super('Talentos');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado;
    this.catalogo = dados?.catalogo;
    this.selecionado = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');

    this.arvore = this.add.container(0, 0);
    this.painel = this.add.container(0, 0).setDepth(2000);

    this.desenhar();

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.desenhar());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.desenhar);
    });

    aoTeclar(this, 'T', () => this.fechar());
    aoTeclar(this, 'ESC', () => (this.selecionado ? this.selecionado = null : this.fechar()));
  }

  // ---------- estrutura ----------

  desenhar() {
    this.arvore.removeAll(true);
    this.painel.removeAll(true);
    this.selecionado = null;

    const { width, height } = this.scale;

    this.arvore.add(this.add.rectangle(width / 2, height / 2, width, height, 0x0d0a07, 0.99).setInteractive());
    this.arvore.add(uiTitulo(this, 24, 18, 'ÁRVORE DE TALENTOS', '22px'));
    this.arvore.add(
      uiTexto(
        this,
        24,
        48,
        `Pontos de talento: ${this.estado.pontosTalento ?? 0}   |   Nível: ${this.estado.nivel ?? 1}`,
        { fontSize: '13px', color: OURO },
      ),
    );

    this.arvore.add(
      botao(this, width - 220, 34, 'Redefinir árvore', () => {
        const devolvidos = redefinirArvore(this.estado, this.catalogo);
        this.mostrarToast(`${devolvidos} pontos devolvidos.`);
        this.desenhar();
      }, { largura: 180, cor: 0xc96a5a, corHover: 0xd05a5a, corTexto: '#fff' }).caixa,
    );
    this.arvore.add(botao(this, width - 90, 34, 'Fechar [T]', () => this.fechar(), { largura: 120 }).caixa);

    if (!this.estado.vocacaoId) return this.desenharEscolhaDeVocacao();
    this.desenharArvore();
  }

  desenharEscolhaDeVocacao() {
    const { width, height } = this.scale;
    const classes = this.catalogo?.classes ?? [];

    this.arvore.add(
      uiTexto(this, width / 2, height / 2 - 150, 'Escolha sua Vocação (ela define sua árvore de talentos):', {
        fontSize: '15px',
        align: 'center',
      }).setOrigin(0.5),
    );

    if (!classes.length) {
      this.arvore.add(
        uiTexto(this, width / 2, height / 2, 'Nenhuma vocação cadastrada.', { fontSize: '14px' }).setOrigin(0.5),
      );
      return;
    }

    let y = height / 2 - 100;
    for (const c of classes) {
      const b = botao(this, width / 2, y, `${c.nome}`, () => {
        this.estado.vocacaoId = c.id;
        this.mostrarToast(`Vocação escolhida: ${c.nome}`);
        this.desenhar();
      }, { largura: 420, altura: 40, tamanho: '14px' });

      this.arvore.add(b.caixa);
      this.arvore.add(
        uiTexto(this, width / 2 + 230, y, `${c.descricao ?? ''}`.slice(0, 44), {
          fontSize: '11px',
          wordWrap: { width: Math.min(300, width - 300) },
        })
          .setOrigin(0, 0.5)
          .setAlpha(0.7),
      );
      y += 52;
    }
  }

  // ---------- arvore ----------

  talentosDaClasse() {
    const todos = this.catalogo?.skills ?? [];
    return todos.filter((t) => t.classeId === this.estado.vocacaoId);
  }

  /**
   * Cor de um ramo.
   *
   * Ordem de precedência:
   *  1. `corRamo` que o admin cadastrou — ele manda sempre;
   *  2. uma cor nomeada, se o nome do ramo contiver uma palavra conhecida
   *     (Corpo, Mente, Social…);
   *  3. uma cor derivada do NOME do ramo.
   *
   * O passo 3 existe porque o admin pode cadastrar ramos com nomes que o jogo
   * nunca viu ("Runa", "Sobrevivência", "Arcano Selvagem"). Sem ele, todos os
   * ramos novos cairiam na mesma cor dourada e a árvore perderia a leitura
   * visual que a barra lateral faz — que era exatamente o motivo das faixas
   * coloridas.
   */
  corDoRamo(t) {
    if (t.corRamo) return Number(String(t.corRamo).replace('#', '0x')) || OURO;
    const chave = String(t.ramo ?? '').toLowerCase();
    for (const [nome, cor] of Object.entries(CORES_RAMO)) {
      if (chave.includes(nome)) return cor;
    }
    return corDeNome(chave);
  }

  desenharArvore() {
    const { width, height } = this.scale;
    const classe = buscarClasse(this.catalogo, this.estado.vocacaoId);
    const talentos = this.talentosDaClasse();

    this.arvore.add(
      uiTexto(this, 24, 74, `Vocação: ${classe?.nome ?? this.estado.vocacaoId}`, {
        fontSize: '15px',
        color: OURO,
      }),
    );

    if (!talentos.length) {
      this.arvore.add(
        uiTexto(this, width / 2, height / 2, 'Esta vocação ainda não tem talentos cadastrados.', {
          fontSize: '14px',
          align: 'center',
        }).setOrigin(0.5),
      );
      return;
    }

    // Legenda de ramos
    this.desenharLegendaDeRamos(talentos, 24, 100);

    // Centraliza a arvore na area livre (abaixo da legenda, acima do rodape).
    const maxX = Math.max(...talentos.map((t) => t.posX ?? 0));
    const maxY = Math.max(...talentos.map((t) => t.posY ?? 0));
    const larguraArvore = maxX * ESPACO_X + LARGURA_NO;
    const alturaArvore = maxY * ESPACO_Y + ALTURA_NO;

    const topoLivre = 138;
    const origemX = Math.max(24, (width - larguraArvore) / 2);
    const origemY = Math.max(topoLivre, (height - alturaArvore) / 2 + topoLivre / 2);

    const posicao = (t) => ({
      x: origemX + (t.posX ?? 0) * ESPACO_X,
      y: origemY + (t.posY ?? 0) * ESPACO_Y,
    });

    const porId = new Map(talentos.map((t) => [t.id, t]));
    const arvoreAtual = this.estado.arvoreDesbloqueada ?? [];

    // --- Conexoes primeiro, para ficarem atras dos nos ---
    for (const t of talentos) {
      const destino = posicao(t);
      const corRamo = this.corDoRamo(t);
      for (const preId of t.preRequisitos ?? []) {
        const pre = porId.get(preId);
        if (!pre) continue;

        const origem = posicao(pre);
        const ativo = arvoreAtual.includes(preId);
        const meioY = (origem.y + ALTURA_NO / 2 + destino.y) / 2;

        // Curva em tres segmentos: sai do topo do pre-requisito, desce, entra
        // pela lateral. Uma reta diagonal ligando centro a centro cruza os nos
        // vizinhos e da a impressao de que o requisito e outro.
        const pontos = [
          origem.x + LARGURA_NO / 2, origem.y + ALTURA_NO,
          origem.x + LARGURA_NO / 2, meioY,
          destino.x + LARGURA_NO / 2, meioY,
          destino.x + LARGURA_NO / 2, destino.y,
        ];

        // Origem [0, 0] e obrigatoria: `Line`/`Graphics.lineBetween` derivam o
        // displayOrigin do comprimento, e com [0.5, 0.5] a linha sai deslocada
        // pela metade do proprio tamanho.
        const g = this.add.graphics();
        g.lineStyle(ativo ? 3 : 2, ativo ? corRamo : 0x4a3a28, ativo ? 0.95 : 0.55);
        g.beginPath();
        g.moveTo(pontos[0], pontos[1]);
        for (let i = 2; i < pontos.length; i += 2) g.lineTo(pontos[i], pontos[i + 1]);
        g.strokePath();
        this.arvore.add(g);
      }
    }

    // --- Nos ---
    for (const t of talentos) {
      const { x, y } = posicao(t);
      const desbloqueado = arvoreAtual.includes(t.id);
      const disponivel = talentoDisponivel(this.estado, t);
      const corRamo = this.corDoRamo(t);

      const preenchimento = desbloqueado ? 0x23361f : disponivel ? 0x2f2418 : 0x14100c;
      const borda = desbloqueado ? corRamo : disponivel ? OURO : 0x3a2c20;

      const caixa = caixaArredondada(this, x, y, LARGURA_NO, ALTURA_NO, {
        raio: 10,
        preenchimento,
        alfa: 0.96,
        borda,
        larguraBorda: desbloqueado ? 2 : 1,
        origem: [0, 0],
      });

      const zona = this.add
        .rectangle(x, y, LARGURA_NO, ALTURA_NO, 0xffffff, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      // Barra lateral com a cor do ramo: e o que faz o jogador enxergar a qual
      // ramificacao o talento pertence sem precisar ler o rotulo.
      const faixa = this.add.graphics();
      faixa.fillStyle(corRamo, desbloqueado ? 1 : 0.55);
      faixa.fillRoundedRect(x + 4, y + 4, 4, ALTURA_NO - 8, 2);
      this.arvore.add(faixa);

      const nome = this.add
        .text(x + 14, y + 8, String(t.nome ?? '').slice(0, 22), {
          ...FONTE_UI,
          fontSize: '11px',
          color: desbloqueado ? '#eaffea' : disponivel ? OURO : PERGAMINHO,
          fontStyle: desbloqueado ? 'bold' : 'normal',
        })
        .setOrigin(0, 0);

      const info = this.add
        .text(x + 14, y + 25, `${ROTULO_TIPO[t.tipo] ?? t.tipo ?? '—'} · ${t.custoPontos ?? 1}pt · nv${t.nivelMin ?? 1}`, {
          ...FONTE_UI,
          fontSize: '9px',
          color: corRamo === OURO ? OURO : '#c9b898',
        })
        .setOrigin(0, 0);

      const resumoEfeito = this.resumoEfeitos(t);
      const desc = this.add
        .text(x + 14, y + 40, resumoEfeito || (t.descricao ?? '').slice(0, 26), {
          ...FONTE_UI,
          fontSize: '9px',
          color: resumoEfeito ? '#8fd18f' : '#8a7a66',
          wordWrap: { width: LARGURA_NO - 24 },
        })
        .setOrigin(0, 0);

      // Cadeado visual nos requisitos nao atendidos
      if (!desbloqueado && !disponivel) {
        this.arvore.add(
          this.add
            .text(x + LARGURA_NO - 14, y + 10, '🔒', { fontFamily: 'sans-serif', fontSize: '11px' })
            .setOrigin(1, 0)
            .setAlpha(0.6),
        );
      }

      this.arvore.add([caixa, nome, info, desc, zona]);

      zona.on('pointerover', () => {
        caixa.caixa.clear();
        caixa.caixa.fillStyle(0x3a2c20, 0.98);
        caixa.caixa.fillRoundedRect(0, 0, LARGURA_NO, ALTURA_NO, 10);
        caixa.caixa.lineStyle(2, OURO, 1);
        caixa.caixa.strokeRoundedRect(0, 0, LARGURA_NO, ALTURA_NO, 10);
      });
      zona.on('pointerout', () => {
        caixa.caixa.clear();
        caixa.caixa.fillStyle(preenchimento, 0.96);
        caixa.caixa.fillRoundedRect(0, 0, LARGURA_NO, ALTURA_NO, 10);
        caixa.caixa.lineStyle(desbloqueado ? 2 : 1, borda, 1);
        caixa.caixa.strokeRoundedRect(0, 0, LARGURA_NO, ALTURA_NO, 10);
      });

      zona.on('pointerdown', () => {
        this.selecionado = t;
        this.desenharPainelDeDetalhe();
      });

      // Clique duplo desbloqueia: evita desbloquear por engano ao só querer ler.
      zona.on('dblclick', () => this.tentarDesbloquear(t));
    }
  }

  resumoEfeitos(t) {
    const e = t.efeitos ?? {};
    const partes = Object.entries(e)
      .slice(0, 3)
      .map(([k, v]) => `${k} ${Number(v) >= 0 ? '+' : ''}${v}`);
    return partes.join(' · ');
  }

  desenharLegendaDeRamos(talentos, x, y) {
    const ramos = [...new Set(talentos.map((t) => t.ramo).filter(Boolean))];
    if (!ramos.length) return;

    this.arvore.add(uiTexto(this, x, y, 'Ramos:', { fontSize: '11px', color: PERGAMINHO }).setOrigin(0, 0).setAlpha(0.8));

    let cx = x + 48;
    for (const ramo of ramos) {
      const cor = this.corDoRamo({ ramo });
      const g = this.add.graphics();
      g.fillStyle(cor, 1);
      g.fillRoundedRect(cx, y + 5, 10, 10, 2);
      this.arvore.add(g);
      this.arvore.add(
        this.add
          .text(cx + 15, y + 3, ramo, { ...FONTE_UI, fontSize: '11px', color: PERGAMINHO })
          .setOrigin(0, 0)
          .setAlpha(0.9),
      );
      cx += 22 + ramo.length * 6;
    }
  }

  // ---------- painel de detalhe ----------

  desenharPainelDeDetalhe() {
    this.painel.removeAll(true);
    const t = this.selecionado;
    if (!t) return;

    const { width, height } = this.scale;
    const w = Math.min(360, width - 48);
    const h = Math.min(430, height - 80);
    const x0 = Math.round((width - w - 32) / 2);
    const y0 = Math.round((height - h) / 2);

    const capa = this.add
      .rectangle(x0 + w / 2, y0 + h / 2, w + 40, h + 40, 0x000000, 0.65)
      .setOrigin(0.5)
      .setInteractive();
    const box = uiPainel(this, x0, y0, w, h, 0x14100c, 1);
    this.painel.add([capa, box]);

    const corRamo = this.corDoRamo(t);
    const arvoreAtual = this.estado.arvoreDesbloqueada ?? [];
    const desbloqueado = arvoreAtual.includes(t.id);
    const disponivel = talentoDisponivel(this.estado, t);
    const porId = new Map(this.talentosDaClasse().map((x) => [x.id, x]));

    let y = y0 + 20;
    this.painel.add(uiTitulo(this, x0 + 20, y, String(t.nome ?? ''), '17px'));
    y += 26;

    // Faixa de estado
    const estadoTexto = desbloqueado
      ? 'DESBLOQUEADO'
      : disponivel
        ? 'DISPONÍVEL — clique duas vezes no nó para liberar'
        : this.motivoBloqueio(t, porId, arvoreAtual);
    this.painel.add(
      uiTexto(this, x0 + 20, y, estadoTexto, {
        fontSize: '11px',
        color: desbloqueado ? '#8fd18f' : disponivel ? OURO : '#e0906a',
        wordWrap: { width: w - 40 },
      }).setOrigin(0, 0),
    );
    y += 34;

    // Imagem do admin, se houver
    if (t.imagem) {
      const chave = `tal_${t.id}`;
      this.load.image(chave, t.imagem);
      this.load.once(`filecomplete-${chave}`, () => {
        const img = this.painel.list.find((o) => o.texture?.key === chave);
        if (img) img.setVisible(true);
      });
      this.load.start();
      const img = this.add.image(x0 + w - 44, y0 + 20 + 22, 'painel').setDisplaySize(48, 48).setVisible(false);
      this.painel.add(img);
    }

    // Descrição
    const desc = this.add.text(x0 + 20, y, t.descricao ?? 'Sem descrição.', {
      ...FONTE_UI,
      fontSize: '12px',
      color: PERGAMINHO,
      wordWrap: { width: w - 40 },
      lineSpacing: 3,
    }).setOrigin(0, 0).setAlpha(0.9);
    this.painel.add(desc);
    y += desc.height + 18;

    // Atributos
    const linhas = [
      ['Tipo', ROTULO_TIPO[t.tipo] ?? t.tipo ?? '—'],
      ['Ramificação', t.ramo || 'raiz'],
      ['Custo', `${t.custoPontos ?? 1} ponto(s)`],
      ['Nível mínimo', t.nivelMin ?? 1],
      ['Posição', `coluna ${t.posX ?? 0}, linha ${t.posY ?? 0}`],
    ];
    if (t.custoPoder) linhas.push(['Custo de Poder', t.custoPoder]);

    for (const [rotulo, valor] of linhas) {
      this.painel.add(
        uiTexto(this, x0 + 20, y, rotulo, { fontSize: '11px' }).setOrigin(0, 0).setAlpha(0.65),
      );
      this.painel.add(
        uiTexto(this, x0 + w - 20, y, String(valor), { fontSize: '11px', color: OURO, align: 'right' })
          .setOrigin(1, 0),
      );
      y += 17;
    }

    y += 10;

    // Efeitos detalhados
    const efeitos = Object.entries(t.efeitos ?? {});
    if (efeitos.length) {
      this.painel.add(uiTitulo(this, x0 + 20, y, 'Efeitos', '13px'));
      y += 20;
      for (const [chave, valor] of efeitos) {
        this.painel.add(
          uiTexto(this, x0 + 28, y, `+ ${chave}`, { fontSize: '11px' }).setOrigin(0, 0).setAlpha(0.8),
        );
        this.painel.add(
          uiTexto(this, x0 + w - 20, y, `${Number(valor) >= 0 ? '+' : ''}${valor}`, {
            fontSize: '11px',
            color: '#8fd18f',
            align: 'right',
          })
            .setOrigin(1, 0),
        );
        y += 17;
      }
    }

    // Requisitos
    const pre = t.preRequisitos ?? [];
    const niveis = Object.entries(t.preRequisitoNiveis ?? {});
    if (pre.length || niveis.length) {
      y += 8;
      this.painel.add(uiTitulo(this, x0 + 20, y, 'Requisitos', '13px'));
      y += 20;
      for (const preId of pre) {
        const p = porId.get(preId);
        const ok = arvoreAtual.includes(preId);
        this.painel.add(
          uiTexto(this, x0 + 28, y, `${ok ? '✔' : '✘'} ${p?.nome ?? preId}`, {
            fontSize: '11px',
            color: ok ? '#8fd18f' : '#e0906a',
          }).setOrigin(0, 0),
        );
        y += 17;
      }
      for (const [attr, nivel] of niveis) {
        const atual = this.estado.atributos?.[attr] ?? 0;
        const ok = atual >= Number(nivel);
        this.painel.add(
          uiTexto(this, x0 + 28, y, `${ok ? '✔' : '✘'} ${attr} ${atual}/${nivel}`, {
            fontSize: '11px',
            color: ok ? '#8fd18f' : '#e0906a',
          }).setOrigin(0, 0),
        );
        y += 17;
      }
    }

    // Progresso geral
    y += 10;
    const ativos = talentosAtivos(this.catalogo, this.estado).length;
    this.painel.add(
      uiTexto(
        this,
        x0 + 20,
        y,
        `${ativos} talento(s) ativo(s) · ${this.estado.pontosTalento ?? 0} ponto(s) disponível(is)`,
        { fontSize: '10px' },
      )
        .setOrigin(0, 0)
        .setAlpha(0.6),
    );

    // Ações
    const yBotao = y0 + h - 30;
    if (!desbloqueado) {
      this.painel.add(
        botao(this, x0 + w - 84, yBotao, 'Liberar', () => this.tentarDesbloquear(t), {
          largura: 148,
          altura: 32,
          tamanho: '13px',
          cor: disponivel ? 0xd4af6a : 0x4a3a28,
          corHover: disponivel ? 0xe6c47c : 0x4a3a28,
          corTexto: disponivel ? '#14100c' : PERGAMINHO,
        }).caixa,
      );
    }

    this.painel.add(
      botao(this, x0 + 60, yBotao, 'Fechar', () => {
        this.selecionado = null;
        this.painel.removeAll(true);
      }, {
        largura: 100,
        altura: 32,
        tamanho: '13px',
        cor: 0x3a2c20,
        corHover: 0x4a3828,
        corBorda: 0x8a6a2f,
        corTexto: PERGAMINHO,
      }).caixa,
    );

    capa.on('pointerdown', () => {
      this.selecionado = null;
      this.painel.removeAll(true);
    });
  }

  motivoBloqueio(t, porId, arvoreAtual) {
    const nivel = this.estado.nivel ?? 1;
    if (nivel < (t.nivelMin ?? 1)) return `Requer nível ${t.nivelMin}.`;

    for (const preId of t.preRequisitos ?? []) {
      if (!arvoreAtual.includes(preId)) {
        return `Requer antes: ${porId.get(preId)?.nome ?? preId}.`;
      }
    }
    for (const [attr, min] of Object.entries(t.preRequisitoNiveis ?? {})) {
      if ((this.estado.atributos?.[attr] ?? 0) < Number(min)) {
        return `Requer ${attr} ${min} (você tem ${this.estado.atributos?.[attr] ?? 0}).`;
      }
    }
    if ((this.estado.pontosTalento ?? 0) < (t.custoPontos ?? 1)) {
      return `Faltam pontos de talento (custo ${t.custoPontos ?? 1}).`;
    }
    return 'Indisponível.';
  }

  tentarDesbloquear(t) {
    if ((this.estado.arvoreDesbloqueada ?? []).includes(t.id)) {
      this.mostrarToast(`Já desbloqueado: ${t.nome}`);
      return;
    }
    const r = desbloquearTalento(this.estado, t, this.catalogo);
    if (r.ok) {
      this.mostrarToast(`Talento liberado: ${t.nome}!`);
      this.selecionado = null;
      this.desenhar();
      this.persistir();
    } else {
      this.mostrarToast(r.motivo);
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

  /**
   * Grava o estado e avisa o mundo.
   *
   * O mundo mantém uma cópia do estado do jogador para calcular dano, vida e
   * atributos derivados. Se a árvore de talentos mudar e o mundo continuar com
   * a cópia antiga, o jogador vê "+18 Vida" na ficha e não sente na barra.
   */
  async persistir() {
    const { salvarProgresso } = await import('../core/progresso.js');
    this.estado = await salvarProgresso(this.uid, this.estado);
    const mundo = this.scene.get('World');
    if (mundo?.estado) mundo.estado = this.estado;
  }

  async fechar() {
    await this.persistir();
    this.scene.stop('Talentos');
  }
}