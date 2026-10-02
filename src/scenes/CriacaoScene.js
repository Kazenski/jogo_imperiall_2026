import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { calcularDerivados } from '../core/personagem.js';
import { RACAS, RACA_PADRAO, buscarRaca } from '../dados/racas.js';
import { texto as uiTexto, titulo as uiTitulo, painel as uiPainel, botao, campoTexto, chip, caixaArredondada, aoTeclar, FONTE_UI } from '../ui/comuns.js';

export { RACAS, RACA_PADRAO };

/**
 * Tela de criação / seleção de personagem.
 *
 * Fica ENTRE o login e o mundo por dois motivos:
 *
 *  1. Evitar chegar e já ser atacado. O mundo gera monstros ao redor do ponto de
 *     spawn; entrar sem definir personagem significava aparecer no meio deles
 *     antes de qualquer escolha.
 *  2. Fixar identidade antes da primeira escrita no banco: nome, raça e vocação
 *     são gravados juntos, o que evita o estado "personagem meio criado" quando
 *     alguém fecha a aba entre dois salvamentos.
 *
 * Quando o jogador JÁ tem personagem, esta cena vira uma seleção: mostra o
 * personagem salvo, permite trocar de vocação antes do nível 3, ou começar
 * uma nova carreiraDescartando a anterior (mantendo a base).
 */
export class CriacaoScene extends Phaser.Scene {
  constructor() {
    super('Criacao');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado ?? null;
    this.catalogo = dados?.catalogo ?? null;
    this.perfil = dados?.perfil ?? null;
    this.nome = dados?.nome ?? null;
    this.email = dados?.email ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
    this.aoConcluir = dados?.aoConcluir ?? (() => {});
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');

    // Estado local da tela (ainda não salvo).
    const jaTemPersonagem = Boolean(this.estado?.nome && this.estado.nome !== 'Viajante' && this.estado?.criadoEm);
    this.editando = jaTemPersonagem;

    this.formulario = {
      nome: this.editando ? this.estado.nome : String(this.nome ?? '').split(' ')[0] ?? '',
      racaId: this.editando ? (this.estado.racaId ?? RACA_PADRAO) : RACA_PADRAO,
      vocacaoId: this.editando ? this.estado.vocacaoId : null,
    };

    this.raiz = this.add.container(0, 0);
    this.campos = [];

    this.montar();

    const aoRedimensionar = () => this.montar();
    this.scale.on(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, aoRedimensionar);
      for (const c of this.campos) {
        try {
          c.destruir();
        } catch {
          /* <input> já removido */
        }
      }
      this.campos = [];
    });

    aoTeclar(this, 'ESC', () => {
      if (this.editando) this.aoConcluir(null);
      else this.scene.start('Login');
    });
  }

  montar() {
    const { width, height } = this.scale;
    this.raiz.removeAll(true);
    for (const c of this.campos) {
      try {
        c.destruir();
      } catch {
        /* <input> já removido */
      }
    }
    this.campos = [];

    const margem = 20;
    const w = Math.max(600, Math.min(1000, width - margem * 2));
    const h = Math.max(460, Math.min(700, height - margem * 2));
    const x0 = Math.round((width - w) / 2);
    const y0 = Math.round((height - h) / 2);

    this.geo = { x0, y0, w, h };

    this.raiz.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.94).setInteractive(),
    );
    this.raiz.add(uiPainel(this, x0, y0, w, h));

    const titulo = this.editando ? 'SEU PERSONAGEM' : 'FORJE SEU PERSONAGEM';
    this.raiz.add(uiTitulo(this, x0 + 28, y0 + 22, titulo, '20px'));
    this.raiz.add(
      uiTexto(
        this,
        x0 + 28,
        y0 + 50,
        this.editando
          ? 'Você pode ajustar a vocação enquanto tiver nível 1 ou 2. O nome e a raça são definitivos depois disso.'
          : 'Escolha antes de entrar no mundo — ninguém começa a erguer uma base do lado de um monstro.',
        { fontSize: '11px', wordWrap: { width: w - 260 } },
      )
        .setOrigin(0, 0)
        .setAlpha(0.75),
    );

    // Botão sair
    if (this.uid) {
      const btnSair = this.add
        .text(x0 + w - 28, y0 + 30, 'Sair da conta', {
          ...FONTE_UI,
          fontSize: '12px',
          color: '#c96a5a',
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });
      btnSair.on('pointerover', () => btnSair.setColor('#ff9a8a'));
      btnSair.on('pointerout', () => btnSair.setColor('#c96a5a'));
      btnSair.on('pointerdown', () => this.sairDaConta());
      this.raiz.add(btnSair);
    }

    const colunaEsq = x0 + 28;
    const larguraEsq = Math.min(300, w * 0.34);
    const colunaDir = colunaEsq + larguraEsq + 28;
    const larguraDir = x0 + w - 28 - colunaDir;

    this.montarEsquerda(colunaEsq, y0 + 74, larguraEsq, h - 200);
    this.montarDireita(colunaDir, y0 + 74, larguraDir, h - 200);

    // Rodapé
    const yRodape = y0 + h - 44;
    const btnEntrar = botao(
      this,
      x0 + w - 110,
      yRodape,
      this.editando ? 'Salvar e entrar' : 'Entrar no Império',
      () => this.concluir(),
      { largura: 220, altura: 36, tamanho: '14px' },
    );
    this.raiz.add(btnEntrar.container);

    const btnVoltar = botao(
      this,
      x0 + 28 + 90,
      yRodape,
      this.editando ? 'Manter como está' : 'Voltar',
      () => (this.editando ? this.aoConcluir(null) : this.scene.start('Login')),
      {
        largura: 180,
        altura: 36,
        tamanho: '13px',
        cor: 0x3a2c20,
        corHover: 0x4a3828,
        corBorda: 0x8a6a2f,
        corTexto: PERGAMINHO,
      },
    );
    this.raiz.add(btnVoltar.container);
  }

  // ---------- coluna esquerda: identidade ----------

  montarEsquerda(x, y, largura, altura) {
    this.raiz.add(uiTitulo(this, x, y, 'IDENTIDADE', '14px').setOrigin(0, 0));
    let cy = y + 26;

    // Nome
    this.raiz.add(uiTexto(this, x, cy, 'Nome no Império', { fontSize: '12px' }).setOrigin(0, 0));
    cy += 16;
    const campoNome = campoTexto(this, x, cy, largura, 30, this.formulario.nome, {
      placeholder: 'Como os outros vão te chamar',
      maxLength: 24,
      aoConfirmar: (v) => {
        this.formulario.nome = v;
      },
      // Acompanha a digitação: sem isto, o nome só chega ao estado no `blur`,
      // e a tela lê "Viajante" enquanto a pessoa ainda está escrevendo.
      aoMudar: (v) => {
        this.formulario.nome = v;
      },
    });
    this.campos.push(campoNome);
    this.raiz.add(campoNome.box);
    cy += 42;

    const travado = this.editando && (this.estado?.nivel ?? 1) >= 3;
    if (travado) {
      this.raiz.add(
        uiTexto(this, x, cy - 14, 'Nome e raça travados a partir do nível 3.', {
          fontSize: '10px',
        })
          .setOrigin(0, 0)
          .setAlpha(0.6),
      );
      campoNome.input.readOnly = true;
    }

    // Raça
    this.raiz.add(uiTexto(this, x, cy, 'Raça', { fontSize: '12px' }).setOrigin(0, 0));
    cy += 18;

    for (const raca of RACAS) {
      const ativa = this.formulario.racaId === raca.id;
      const box = caixaArredondada(this, x, cy, largura, 34, {
        raio: 8,
        preenchimento: ativa ? 0x2f2418 : 0x1a140e,
        borda: ativa ? raca.cor : 0x2e241a,
        larguraBorda: ativa ? 2 : 1,
        origem: [0, 0],
      });
      const zona = this.add
        .rectangle(x, cy, largura, 34, 0xffffff, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      const marcador = this.add
        .rectangle(x + 10, cy + 17, 12, 12, raca.cor, 1)
        .setOrigin(0.5)
        .setStrokeStyle(ativa ? 2 : 1, ativa ? OURO : 0x4a3a28);
      if (ativa) marcador.setStrokeStyle(2, OURO);

      const nomeRaca = this.add
        .text(x + 30, cy + 10, raca.nome, {
          ...FONTE_UI,
          fontSize: '12px',
          color: ativa ? OURO : PERGAMINHO,
        })
        .setOrigin(0, 0);

      zona.on('pointerover', () => {
        box.caixa.clear();
        box.caixa.fillStyle(0x2a2018, 1);
        box.caixa.fillRoundedRect(0, 0, largura, 34, 8);
        box.caixa.lineStyle(1, OURO, 1);
        box.caixa.strokeRoundedRect(0, 0, largura, 34, 8);
      });
      zona.on('pointerout', () => {
        box.caixa.clear();
        box.caixa.fillStyle(ativa ? 0x2f2418 : 0x1a140e, 1);
        box.caixa.fillRoundedRect(0, 0, largura, 34, 8);
        box.caixa.lineStyle(ativa ? 2 : 1, ativa ? raca.cor : 0x2e241a, 1);
        box.caixa.strokeRoundedRect(0, 0, largura, 34, 8);
      });

      const escolher = () => {
        if (travado) return;
        this.formulario.racaId = raca.id;
        this.montar();
      };
      zona.on('pointerdown', escolher);

      this.raiz.add([box, zona, marcador, nomeRaca]);
      cy += 38;
    }

    cy += 4;
    const racaAtual = buscarRaca(this.formulario.racaId);
    this.raiz.add(
      uiTexto(this, x, cy, racaAtual.descricao, {
        fontSize: '11px',
        wordWrap: { width: largura },
        lineSpacing: 3,
      })
        .setOrigin(0, 0)
        .setAlpha(0.8),
    );
  }

  // ---------- coluna direita: vocação ----------

  montarDireita(x, y, largura, altura) {
    const podeTrocar = !this.editando || (this.estado?.nivel ?? 1) < 3;

    this.raiz.add(uiTitulo(this, x, y, 'VOCAÇÃO', '14px').setOrigin(0, 0));
    this.raiz.add(
      uiTexto(
        this,
        x,
        y + 22,
        'A vocação define sua árvore de talentos. Você pode trocar enquanto tiver nível 1 ou 2.',
        { fontSize: '10px', wordWrap: { width: largura } },
      )
        .setOrigin(0, 0)
        .setAlpha(0.65),
    );

    const classes = this.catalogo?.classes ?? [];
    if (!classes.length) {
      this.raiz.add(
        uiTexto(this, x, y + 52, 'Nenhuma vocação cadastrada pelo administrador.', { fontSize: '12px' })
          .setOrigin(0, 0),
      );
      return;
    }

    let cy = y + 56;

    // Todos os cartões são desenhados, e a ALTURA de cada um é o que sobra
    // dividido pelo número de cartões.
    //
    // A versão anterior fixava a altura mínima em 64px e só então calculava
    // quantos cabiam — o resultado era "Mostrando 3 de 4" numa tela que tinha
    // espaço de sobra para quatro, e a dica apontava para a tecla H, que não
    // existe antes do mundo. Esconder uma opção de vocação atrás de uma tecla
    // que ainda não funciona é o pior dos dois erros.
    const vao = 8;
    const disponivel = altura - 130;
    const alturaCartao = Math.min(
      96,
      Math.max(44, (disponivel - (classes.length - 1) * vao) / Math.max(1, classes.length)),
    );

    for (let i = 0; i < classes.length; i += 1) {
      cy += this.desenharCartaoVocacao(classes[i], x, cy, largura, alturaCartao, podeTrocar);
    }

    // Só avisa quando nem o mínimo coube — aí a rolagem é a saída honesta.
    if (alturaCartao <= 44 && classes.length * 52 > disponivel) {
      this.raiz.add(
        uiTexto(
          this,
          x,
          cy + 4,
          `${classes.length} vocações cadastradas. Esta janela é baixa demais — amplie a tela para ver todas.`,
          { fontSize: '10px', wordWrap: { width: largura } },
        )
          .setOrigin(0, 0)
          .setAlpha(0.6),
      );
    }

    // Prévia dos atributos com a vocação escolhida
    const classe = classes.find((c) => c.id === this.formulario.vocacaoId);
    if (classe) {
      const derivados = calcularDerivados(
        { nivel: this.estado?.nivel ?? 1, atributos: { fis: 0, men: 0, soc: 0 } },
        classe,
        [],
      );
      const texto = `Com esta vocação: vida ${derivados.vidaMax} · poder ${derivados.poderMax} · defesa ${derivados.defesa}`;
      this.raiz.add(
        uiTexto(this, x, y + altura - 24, texto, { fontSize: '11px', color: OURO, wordWrap: { width: largura } })
          .setOrigin(0, 0)
          .setAlpha(0.9),
      );
    } else {
      this.raiz.add(
        uiTexto(this, x, y + altura - 24, 'Escolha uma vocação para ver sua prévia.', {
          fontSize: '11px',
        })
          .setOrigin(0, 0)
          .setAlpha(0.6),
      );
    }
  }

  desenharCartaoVocacao(classe, x, y, largura, altura, podeTrocar) {
    const ativa = this.formulario.vocacaoId === classe.id;

    const box = caixaArredondada(this, x, y, largura, altura, {
      raio: 9,
      preenchimento: ativa ? 0x2f2418 : 0x16110c,
      borda: ativa ? OURO : 0x2e241a,
      larguraBorda: ativa ? 2 : 1,
      origem: [0, 0],
    });

    const zona = this.add
      .rectangle(x, y, largura, altura, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const nome = this.add
      .text(x + 12, y + 10, String(classe.nome ?? classe.id), {
        ...FONTE_UI,
        fontSize: '14px',
        color: ativa ? OURO : PERGAMINHO,
        fontStyle: ativa ? 'bold' : 'normal',
      })
      .setOrigin(0, 0);

    const desc = this.add
      .text(x + 12, y + 30, String(classe.descricao ?? 'Sem descrição.'), {
        ...FONTE_UI,
        fontSize: '11px',
        color: PERGAMINHO,
        wordWrap: { width: largura - 24 },
      })
      .setOrigin(0, 0)
      .setAlpha(0.78);

    // chips de atributos base
    const chips = [
      `vida ${classe.vidaBase ?? 100}`,
      `poder ${classe.poderBase ?? 40}`,
      `fis ${classe.fis ?? 0}`,
      `men ${classe.men ?? 0}`,
      `soc ${classe.soc ?? 0}`,
    ];
    let cx = x + 12;
    const cyChip = y + altura - 26;
    for (const t of chips) {
      const c = chip(this, cx, cyChip, t, ativa ? 0x3a2c20 : 0x1d1710, ativa ? OURO : PERGAMINHO);
      this.raiz.add(c);
      cx += c.largura + 5;
      if (cx > x + largura - 60) break;
    }

    zona.on('pointerover', () => {
      box.caixa.clear();
      box.caixa.fillStyle(0x2a2018, 1);
      box.caixa.fillRoundedRect(0, 0, largura, altura, 9);
      box.caixa.lineStyle(1, OURO, 1);
      box.caixa.strokeRoundedRect(0, 0, largura, altura, 9);
    });
    zona.on('pointerout', () => {
      box.caixa.clear();
      box.caixa.fillStyle(ativa ? 0x2f2418 : 0x16110c, 1);
      box.caixa.fillRoundedRect(0, 0, largura, altura, 9);
      box.caixa.lineStyle(ativa ? 2 : 1, ativa ? OURO : 0x2e241a, 1);
      box.caixa.strokeRoundedRect(0, 0, largura, altura, 9);
    });

    if (podeTrocar) {
      zona.on('pointerdown', () => {
        this.formulario.vocacaoId = classe.id;
        this.montar();
      });
    }

    this.raiz.add([box, zona, nome, desc]);
    return altura + 8;
  }

  // ---------- ações ----------

  concluir() {
    const nome = (this.formulario.nome ?? '').trim();
    if (!nome) {
      this.avisar('Escolha um nome para o seu personagem.');
      return;
    }
    if (!this.formulario.vocacaoId) {
      this.avisar('Escolha uma vocação para abrir sua árvore de talentos.');
      return;
    }

    this.aoConcluir({
      nome,
      racaId: this.formulario.racaId,
      vocacaoId: this.formulario.vocacaoId,
      primeiraVez: !this.editando,
    });
  }

  avisar(msg) {
    this.toast ??= this.add
      .text(this.scale.width / 2, this.scale.height - 40, '', {
        ...FONTE_UI,
        fontSize: '12px',
        color: '#ffd9a0',
        backgroundColor: '#2a1a10dd',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(9000);
    this.raiz.add(this.toast);
    this.toast.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 400, delay: 2200 });
  }

  async sairDaConta() {
    const { sairDaConta } = await import('../core/firebase.js');
    try {
      await sairDaConta();
    } catch (erro) {
      console.warn('[Criacao] falha ao sair:', erro);
    }
    this.scene.stop('Criacao');
    this.scene.start('Login');
  }
}