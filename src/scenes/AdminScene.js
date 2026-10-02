import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import {
  repoItens,
  repoClasses,
  repoSkills,
  repoRecipes,
  repoMonstros,
  repoWorldTemplates,
  repoAchievements,
  repoUsuarios,
  repoPortais,
  listarAdmins,
  definirAdminUid,
} from '../core/repos.js';
import { ehAdmin } from '../core/usuarios.js';
import { criarCampo } from '../ui/formularios.js';
import {
  painel as uiPainel,
  botao,
  caixaArredondada,
  campoTexto,
  medirFluxo,
  texto as uiTexto,
  titulo as uiTitulo,
  aoTeclar,
  restaurarFoco,
  FONTE_UI,
} from '../ui/comuns.js';
import {
  CAMPOS_ITEM,
  CAMPOS_CLASSE,
  CAMPOS_MONSTRO,
  CAMPOS_RECEITA,
  CAMPOS_REINO,
  CAMPOS_CONQUISTA,
  CAMPOS_TALENTO,
  RESUMO,
  serializadores,
} from '../dados/schemaAdmin.js';

// =====================================================================
// Abas
//
// `campos` = esquema (vem de dados/schemaAdmin.js)
// `opcoes` = comportamento especifico do registro (busca, filtro, extras)
// =====================================================================

const ABAS = [
  {
    id: 'itens',
    label: 'Itens',
    repo: repoItens,
    cache: 'itens',
    campos: CAMPOS_ITEM,
    resumo: RESUMO.itens,
    buscar: true,
    pastaUpload: 'itens',
  },
  {
    id: 'classes',
    label: 'Classes',
    repo: repoClasses,
    cache: 'classes',
    campos: CAMPOS_CLASSE,
    resumo: RESUMO.classes,
    buscar: true,
    pastaUpload: 'classes',
  },
  {
    id: 'talentos',
    label: 'Talentos',
    repo: repoSkills,
    cache: 'talentos',
    campos: CAMPOS_TALENTO,
    resumo: RESUMO.talentos,
    buscar: true,
    filtroClasse: true,
    pastaUpload: 'talentos',
  },
  {
    id: 'monstros',
    label: 'Monstros',
    repo: repoMonstros,
    cache: 'monstros',
    campos: CAMPOS_MONSTRO,
    resumo: RESUMO.monstros,
    buscar: true,
    pastaUpload: 'monstros',
  },
  {
    id: 'receitas',
    label: 'Receitas',
    repo: repoRecipes,
    cache: 'receitas',
    campos: CAMPOS_RECEITA,
    resumo: RESUMO.receitas,
    pastaUpload: 'receitas',
  },
  {
    id: 'reinos',
    label: 'Reinos',
    repo: repoWorldTemplates,
    cache: 'reinos',
    campos: CAMPOS_REINO,
    resumo: RESUMO.reinos,
    pastaUpload: 'reinos',
  },
  {
    id: 'conquistas',
    label: 'Conquistas',
    repo: repoAchievements,
    cache: 'conquistas',
    campos: CAMPOS_CONQUISTA,
    resumo: RESUMO.conquistas,
    pastaUpload: 'conquistas',
  },
  { id: 'portais', label: 'Portais', especial: 'portais' },
  { id: 'jogadores', label: 'Jogadores', especial: 'jogadores' },
];

const LARGURA_LISTA = 320;
const TOPO = 116;
const GAP = 6;

export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.meuNome = dados?.nome ?? null;
  }

  create() {
    this.abaAtual = 'itens';
    this.caches = {};
    this.selecionado = null; // { aba, item }
    this.filtroClasse = null;
    this.busca = '';
    this.camposVivos = [];

    this.cameras.main.setBackgroundColor('#0d0a07');
    this.raiz = this.add.container(0, 0).setDepth(1);
    this.camada = this.add.container(0, 0).setDepth(20);

    this.montarCabecalho();
    this.montarAbas();
    this.redimensionar(true);

    const aoRedimensionar = () => this.redimensionar();
    this.scale.on(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, aoRedimensionar);
      this.limparCamada();
    });

    aoTeclar(this, 'F2', () => this.fechar());
    aoTeclar(this, 'ESC', () => {
      if (this.selecionado) {
        this.selecionado = null;
        this.redesenhar();
      } else {
        this.fechar();
      }
    });
  }

  // ---------- chrome ----------

  montarCabecalho() {
    this.cabecalho = this.add.container(0, 0);
    this.raiz.add(this.cabecalho);
  }

  montarAbas() {
    this.abasContainer = this.add.container(0, 0);
    this.raiz.add(this.abasContainer);
  }

  /**
   * Refaz o layout inteiro para o tamanho atual da janela.
   *
   * Rebuild completo em vez de reposicionar: o conteudo depende da largura
   * (colunas do formulario, largura da lista), e recalcular cada posicao a mao
   * era exatamente o que mantinha o painel torto em resolucoes diferentes.
   */
  redimensionar(primeiraVez = false) {
    const { width, height } = this.scale;
    this.limparCamada();

    this.cabecalho.removeAll(true);
    this.abasContainer.removeAll(true);

    // Fundo e moldura.
    this.cabecalho.add(this.add.rectangle(width / 2, height / 2, width, height, 0x0d0a07, 0.99));
    this.cabecalho.add(
      uiPainel(this, 12, 12, Math.max(320, width - 24), Math.max(200, height - 24), 0x14100c, 0.99),
    );

    this.cabecalho.add(uiTitulo(this, 32, 28, 'ADMINISTRAÇÃO DO IMPÉRIUM', '20px').setOrigin(0, 0));

    const fechar = this.add
      .text(width - 32, 30, 'Fechar  [F2]', { ...FONTE_UI, fontSize: '12px', color: OURO })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    fechar.on('pointerover', () => fechar.setColor('#fff'));
    fechar.on('pointerout', () => fechar.setColor(OURO));
    fechar.on('pointerdown', () => this.fechar());
    this.cabecalho.add(fechar);

    this.barraStatus = this.add
      .text(32, height - 32, '', { ...FONTE_UI, fontSize: '12px', color: OURO })
      .setOrigin(0, 0.5);
    this.cabecalho.add(this.barraStatus);

    // Abas em fluxo (quebra automatica quando nao cabem).
    this.abas = ABAS;
    const larguras = ABAS.map((a) => Math.max(72, a.label.length * 7 + 26));
    const util = Math.max(200, width - 64);
    const linhas = medirFluxo(util, larguras, GAP);
    const alturaFaixa = 4 + linhas * 34;

    let cx = 32;
    let cy = 62;
    ABAS.forEach((aba, i) => {
      const w = larguras[i];
      if (i > 0 && cx + w > 32 + util) {
        cx = 32;
        cy += 34;
      }
      this.abasContainer.add(this.desenharAba(aba, cx, cy, w));
      cx += w + GAP;
    });

    this.linhaLista = LARGURA_LISTA;
    this.alturaLista = Math.max(180, height - TOPO - 56);
    this.redesenhar();

    if (!primeiraVez) this.status('');
  }

  desenharAba(aba, x, y, largura) {
    const ativo = aba.id === this.abaAtual;
    const c = this.add.container(x, y);
    const h = 30;
    const cx = largura / 2;

    const fundo = caixaArredondada(this, cx, h / 2, largura, h, {
      raio: 8,
      preenchimento: ativo ? 0xd4af6a : 0x241c14,
      borda: ativo ? 0x8a6a2f : 0x3a2c20,
      larguraBorda: 1,
      origem: [0.5, 0.5],
    });

    const zone = this.add
      .rectangle(0, h / 2, largura, h, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    c.add(zone);

    c.add(
      this.add
        .text(cx, h / 2, aba.label, {
          ...FONTE_UI,
          fontSize: '12px',
          color: ativo ? '#14100c' : PERGAMINHO,
        })
        .setOrigin(0.5),
    );

    zone.on('pointerover', () => {
      if (ativo) return;
      this.repintar(c, cx, h, largura, 0x3a2c20, 0x8a6a2f);
    });
    zone.on('pointerout', () => {
      if (ativo) return;
      this.repintar(c, cx, h, largura, 0x241c14, 0x3a2c20);
    });
    zone.on('pointerdown', () => {
      this.abaAtual = aba.id;
      this.selecionado = null;
      this.busca = '';
      this.redimensionar();
    });

    return c;
  }

  repintar(container, cx, cy, w, h, corPreench, corBorda) {
    const g = container.list.find((o) => o.largura !== undefined);
    if (!g) return;
    g.caixa.clear();
    g.caixa.fillStyle(corPreench, 1);
    g.caixa.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.caixa.lineStyle(1, corBorda, 1);
    g.caixa.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  }

  // ---------- ciclo de desenho ----------

  limparCamada() {
    for (const campo of this.camposVivos ?? []) {
      try {
        campo.destruir();
      } catch {
        /* o DOM ja pode ter sumido */
      }
    }
    this.camposVivos = [];
    this.camada?.removeAll(true);
  }

  async redesenhar() {
    const geracao = (this.geracao = (this.geracao ?? 0) + 1);

    // Guarda o foco e o cursor ANTES de destruir os campos, para devolver
    // depois. Sem isto, filtrar a lista com duas letras jogava o teclado fora.
    const foco = this._foco;
    this.limparCamada();

    const aba = this.abas.find((a) => a.id === this.abaAtual) ?? ABAS[0];
    this.aba = aba;

    if (aba.especial === 'portais') await this.desenharPortais(geracao);
    else if (aba.especial === 'jogadores') await this.desenharJogadores(geracao);
    else await this.desenharCatalogo(geracao);

    if (this.geracao === geracao && foco?.chave) {
      restaurarFoco(this, foco, this.camposVivos);
    }
  }

  /** Sair cedo se o jogador redimensionou/clicou enquanto carregava. */
  valido(geracao) {
    return geracao === this.geracao;
  }

  status(msg, cor = OURO) {
    this.barraStatus?.setText(msg ?? '').setColor(cor);
  }

  // ---------- carga com cache ----------

  async carregar(chave, fn) {
    if (this.caches[chave]) return this.caches[chave];
    this.status('Carregando…');
    try {
      const dados = await fn();
      this.caches[chave] = dados;
      this.status('');
      return dados;
    } catch (erro) {
      console.error(erro);
      this.status('Erro ao carregar: ' + (erro?.message ?? erro), '#e0806a');
      return [];
    }
  }

  invalidarCache() {
    for (const k of Object.keys(this.caches)) delete this.caches[k];
  }

  // ---------- aba genérica de catálogo ----------

  async desenharCatalogo(geracao) {
    const aba = this.aba;
    const itens = await this.carregar(aba.cache, () => aba.repo.listar());
    if (!this.valido(geracao)) return;

    // Field options that depend on OTHER catalogs.
    const [itensCat, monstrosCat, classesCat, talentosCat] = await Promise.all([
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('talentosCat', () => repoSkills.listar()),
    ]);
    if (!this.valido(geracao)) return;

    // Talent filter
    if (aba.filtroClasse) {
      const opcoes = classesCat.map((c) => ({ valor: c.id, rotulo: c.nome ?? c.id }));
      if (!this.filtroClasse || !opcoes.some((o) => o.valor === this.filtroClasse)) {
        this.filtroClasse = opcoes[0]?.valor ?? null;
      }
    }

    const campos = this.camposComOpcoes(aba.campos, { itensCat, monstrosCat, classesCat, talentosCat });

    // ----- left column -----
    let y = TOPO;
    this.camada.add(uiTitulo(this, 32, y, `${aba.label.toUpperCase()}`, '15px').setOrigin(0, 0));
    y += 26;

    if (aba.buscar) {
      this.camada.add(
        uiTexto(this, 32, y, 'Buscar', { fontSize: '11px' }).setOrigin(0, 0).setAlpha(0.8),
      );
      y += 15;
      const campo = campoTexto(this, 32, y, this.linhaLista - 24, 28, this.busca, {
        placeholder: 'nome do registro…',
        maxLength: 60,
        chave: 'busca',
        // Filtra a lista enquanto a pessoa digita. Com atraso, senão um redesenho
        // por tecla derruba o campo que está sendo usado e a busca morre na
        // segunda letra.
        aoMudar: (v) => {
          if (v === this.busca) return;
          this.busca = v;
          clearTimeout(this.timerBusca);
          this.timerBusca = setTimeout(() => this.redesenhar(), 160);
        },
        aoConfirmar: (v) => {
          clearTimeout(this.timerBusca);
          if (v !== this.busca) {
            this.busca = v;
            this.redesenhar();
          }
        },
      });
      this.camposVivos.push(campo);
      this.camada.add(campo.box);
      y += 38;
    }

    if (aba.filtroClasse) {
      const sel = criarCampo(this, {
        rotulo: 'Filtrar por classe',
        x: 32,
        y,
        largura: this.linhaLista - 24,
        tipo: 'select',
        valor: this.filtroClasse,
        opcoes: classesCat.map((c) => ({ valor: c.id, rotulo: c.nome ?? c.id })),
        aoMudar: (v) => {
          this.filtroClasse = v;
          this.redesenhar();
        },
      });
      this.camposVivos.push(sel);
      this.camada.add(sel.container);
      y += sel.altura + 6;
    }

    const filtrados = this.filtrar(itens, aba);
    const listaVisiveis = filtrados.slice(0, 200);

    const altLista = this.alturaLista - (y - TOPO) - 44;
    const painelLista = uiPainel(this, 24, y - 6, this.linhaLista - 8, Math.max(60, altLista), 0x100c08, 0.9);
    this.camada.add(painelLista);

    if (!listaVisiveis.length) {
      this.camada.add(
        uiTexto(this, 40, y + 10, 'Nenhum registro encontrado.', { fontSize: '12px' })
          .setOrigin(0, 0)
          .setAlpha(0.7),
      );
    }

    let ly = y + 2;
    const alturaLinha = 44;
    const visiveisPelaTela = Math.max(1, Math.floor((altLista - 10) / alturaLinha));
    const inicio = Math.max(0, Math.min(listaVisiveis.length - 1, (this.deslocLista ?? 0)));
    for (let i = inicio; i < Math.min(listaVisiveis.length, inicio + visiveisPelaTela); i += 1) {
      ly += this.desenharLinhaLista(listaVisiveis[i], 32, ly, this.linhaLista - 32, aba);
    }

    if (listaVisiveis.length > visiveisPelaTela) {
      const total = listaVisiveis.length;
      const primeira = inicio + 1;
      const ultima = Math.min(listaVisiveis.length, inicio + visiveisPelaTela);
      this.camada.add(
        uiTexto(this, 32, y + altLista - 16, `${primeira}–${ultima} de ${total}`, {
          fontSize: '10px',
          color: OURO,
        }).setOrigin(0, 0),
      );
      const maxDesloc = Math.max(0, total - visiveisPelaTela);
      this.deslocLista = inicio;
      const setaCima = this.add
        .text(32 + this.linhaLista - 44, y + 2, '▲', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
        .setOrigin(0.5)
        .setAlpha(inicio > 0 ? 1 : 0.25)
        .setInteractive({ useHandCursor: true });
      if (inicio > 0) {
        setaCima.on('pointerdown', () => {
          this.deslocLista = Math.max(0, this.deslocLista - visiveisPelaTela);
          this.redesenhar();
        });
      }
      const setaBaixo = this.add
        .text(32 + this.linhaLista - 44, y + altLista - 22, '▼', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
        .setOrigin(0.5)
        .setAlpha(inicio < maxDesloc ? 1 : 0.25)
        .setInteractive({ useHandCursor: true });
      if (inicio < maxDesloc) {
        setaBaixo.on('pointerdown', () => {
          this.deslocLista = Math.min(maxDesloc, this.deslocLista + visiveisPelaTela);
          this.redesenhar();
        });
      }
      this.camada.add([setaCima, setaBaixo]);
    }

    // ----- new record -----
    const yNovo = y + altLista + 12;
    const btnNovo = botao(this, 32 + (this.linhaLista - 32) / 2, yNovo, '+ Novo registro', () => {
      this.selecionado = { aba, item: null };
      this.deslocLista = 0;
      this.redesenhar();
    }, { largura: this.linhaLista - 32, altura: 32, tamanho: '13px' });
    this.camada.add(btnNovo.container);

    // ----- right column: form -----
    if (this.selecionado?.aba?.id === aba.id) {
      this.desenharFormulario(campos, aba, this.selecionado.item);
    } else {
      this.camada.add(
        uiTexto(
          this,
          this.linhaLista + 40,
          TOPO + 20,
          `Escolha um registro na lista ou crie um novo.\n\nTudo o que você preencher aqui aparece no jogo: a descrição vai para a wiki (tecla H), a imagem aparece na ficha do item e no inventário.`,
          { fontSize: '12px', color: PERGAMINHO, wordWrap: { width: Math.max(200, this.scale.width - this.linhaLista - 90) } },
        ).setOrigin(0, 0).setAlpha(0.7),
      );
    }
  }

  /**
   * Preenche as opcoes que dependem de OUTROS cadastros.
   *
   * Fica aqui (e nao no schema) porque depende de dados carregados: a lista de
   * blocos possiveis para um talento so existe depois de ler `items`.
   */
  camposComOpcoes(campos, ctx) {
    const { itensCat, monstrosCat, classesCat, talentosCat } = ctx;

    return campos.map((campo) => {
      const c = { ...campo };
      switch (campo.chave) {
        case 'preRequisitos': {
          // Só talentos da mesma classe podem ser pré-requisito: exigir um
          // talento de outra vocação tornaria a árvore impossível de fechar.
          const daClasse = talentosCat.filter((t) => !this.filtroClasse || t.classeId === this.filtroClasse);
          c.opcoes = daClasse.map((t) => ({ valor: t.id, rotulo: `${t.nome} (${t.id})` }));
          c.dica = 'Talentos que precisam estar desbloqueados antes. Vazio = talento raiz.';
          break;
        }
        case 'classeId':
          c.opcoes = classesCat.map((k) => ({ valor: k.id, rotulo: k.nome ?? k.id }));
          break;
        case 'monstrosPossiveis':
          c.opcoes = monstrosCat.map((m) => ({ valor: m.id, rotulo: `${m.nome} (${m.id})` }));
          break;
        case 'extracao':
          c.opcoes = itensCat
            .filter((i) => (i.uso ?? []).includes('extracao') || i.tipo === 'bloco')
            .map((i) => ({ valor: i.id, rotulo: i.nome ?? i.id }));
          break;
        default:
          break;
      }
      return c;
    });
  }

  filtrar(itens, aba) {
    let lista = itens ?? [];
    if (aba.filtroClasse) lista = lista.filter((t) => t.classeId === this.filtroClasse);
    const termo = String(this.busca ?? '').trim().toLowerCase();
    if (termo) {
      lista = lista.filter((i) =>
        [i.nome, i.id, i.descricao, i.bioma, i.tipo].some((v) =>
          String(v ?? '').toLowerCase().includes(termo),
        ),
      );
    }
    return lista;
  }

  desenharLinhaLista(item, x, y, largura, aba) {
    const altura = 40;
    const sel = this.selecionado?.item?.id === item.id && this.selecionado?.aba?.id === aba.id;

    const caixa = caixaArredondada(this, x, y, largura, altura, {
      raio: 8,
      preenchimento: sel ? 0x2f2418 : 0x1d1710,
      borda: sel ? OURO : 0x2e241a,
      larguraBorda: sel ? 2 : 1,
      origem: [0, 0],
    });

    // thumbnail
    const img = this.add.image(x + 22, y + altura / 2, 'painel').setDisplaySize(28, 28);
    if (item.imagem) {
      this.load.image(`thumb_${item.id}`, item.imagem);
      this.load.once(`filecomplete-thumb_${item.id}`, () => {
        if (img.scene) img.setTexture(`thumb_${item.id}`);
      });
      this.load.start();
    }

    const nome = this.add
      .text(x + 42, y + 6, String(item.nome ?? item.id).slice(0, 26), {
        ...FONTE_UI,
        fontSize: '12px',
        color: OURO,
      })
      .setOrigin(0, 0);
    const det = this.add
      .text(x + 42, y + 23, String(aba.resumo?.(item) ?? '').slice(0, 34), {
        ...FONTE_UI,
        fontSize: '9px',
        color: PERGAMINHO,
      })
      .setOrigin(0, 0)
      .setAlpha(0.7);

    const zone = this.add
      .rectangle(x, y, largura, altura, 0xffffff, 0)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      caixa.caixa.clear();
      caixa.caixa.fillStyle(0x2a2018, 1);
      caixa.caixa.fillRoundedRect(0, 0, largura, altura, 8);
      caixa.caixa.lineStyle(1, OURO, 1);
      caixa.caixa.strokeRoundedRect(0, 0, largura, altura, 8);
    });
    zone.on('pointerout', () => {
      caixa.caixa.clear();
      caixa.caixa.fillStyle(sel ? 0x2f2418 : 0x1d1710, 1);
      caixa.caixa.fillRoundedRect(0, 0, largura, altura, 8);
      caixa.caixa.lineStyle(sel ? 2 : 1, sel ? OURO : 0x2e241a, 1);
      caixa.caixa.strokeRoundedRect(0, 0, largura, altura, 8);
    });
    zone.on('pointerdown', () => {
      this.selecionado = { aba, item };
      this.redesenhar();
    });

    const apagar = this.add
      .text(x + largura - 14, y + altura / 2, '✕', { ...FONTE_UI, fontSize: '13px', color: '#c96a5a' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    apagar.on('pointerover', () => apagar.setColor('#ff9a8a'));
    apagar.on('pointerout', () => apagar.setColor('#c96a5a'));
    apagar.on('pointerdown', () => this.confirmarApagar(aba, item));

    this.camada.add([caixa, img, nome, det, zone, apagar]);
    return altura + 4;
  }

  /**
   * Confirmação de exclusão.
   *
   * Antes usava `window.confirm`, que o navegador pode bloquear e que nunca
   * aparece em tela cheia dentro do canvas. Um modal próprio também permite
   * avisar o QUE será perdido — apagar um item que 12 receitas usam não é a
   * mesma coisa que apagar um registro órfão.
   */
  confirmarApagar(aba, item) {
    const nome = String(item.nome ?? item.id);
    const aviso = this._avisarDependencias(aba.id, item.id);

    const largura = Math.min(420, this.scale.width - 80);
    const altura = 190 + (aviso ? 46 : 0);
    const x = (this.scale.width - largura) / 2;
    const y = (this.scale.height - altura) / 2;

    // Acima de `camada` (depth 20): sem isso o modal aparece ATRÁS do painel.
    const MODAL_DEPTH = 80000;
    const fundo = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.6)
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(MODAL_DEPTH);
    const modal = uiPainel(this, x, y, largura, altura, 0x1a140e, 1).setDepth(MODAL_DEPTH + 1);

    const cx = x + largura / 2;
    const t1 = uiTitulo(this, cx, y + 22, 'Apagar registro?', '16px').setOrigin(0.5, 0).setDepth(MODAL_DEPTH + 2);
    const t2 = uiTexto(this, cx, y + 52, nome, { fontSize: '13px', color: OURO, align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(MODAL_DEPTH + 2);
    const t3 = uiTexto(
      this,
      cx,
      y + 78,
      aviso ? `Aviso: ${aviso}` : 'Esta ação não pode ser desfeita.',
      {
        fontSize: '11px',
        color: aviso ? '#e0a05a' : PERGAMINHO,
        align: 'center',
        wordWrap: { width: largura - 48 },
      },
    )
      .setOrigin(0.5, 0)
      .setDepth(MODAL_DEPTH + 2);

    const btnSim = botao(this, cx - 90, y + altura - 34, 'Apagar', async () => {
      fechar();
      await this.apagarRegistro(aba, item);
    }, { largura: 140, altura: 32, cor: 0x7a2f2a, corHover: 0x9a3a33, corTexto: '#ffe6e0' });

    const btnNao = botao(this, cx + 90, y + altura - 34, 'Cancelar', fechar, {
      largura: 140,
      altura: 32,
      cor: 0x3a2c20,
      corHover: 0x4a3828,
      corTexto: PERGAMINHO,
    });

    btnSim.container.setDepth(MODAL_DEPTH + 2);
    btnNao.container.setDepth(MODAL_DEPTH + 2);

    const fechar = () => {
      fundo.destroy();
      modal.destroy(true);
      t1.destroy();
      t2.destroy();
      t3.destroy();
      btnSim.container.destroy(true);
      btnNao.container.destroy(true);
      this.status('');
    };
  }

  /** Monta o aviso de dependências (o que para de funcionar ao apagar). */
  _avisarDependencias(abaId, id) {
    const c = this.caches;
    const conta = (lista, idChave) => (lista ?? []).filter((x) => (x[idChave] ?? [])?.includes(id)).length;
    switch (abaId) {
      case 'itens': {
        const receitas = c.receitas ?? [];
        const emReceita = conta(receitas, 'insumos') + conta(receitas, 'saida');
        const emLoot =
          conta(c.monstros ?? [], 'loot') +
          conta(c.reinos ?? [], 'lootGlobal') +
          (c.receitas ?? []).filter((r) => (r.saida ?? []).some((s) => s.itemId === id)).length;
        const partes = [];
        if (emReceita) partes.push(`${emReceita} receita(s)`);
        if (emLoot) partes.push(`${emLoot} tabela(s) de loot`);
        return partes.length ? `usado em ${partes.join(' e ')}` : '';
      }
      case 'talentos': {
        const dependentes = (c.talentosCat ?? []).filter((t) => (t.preRequisitos ?? []).includes(id)).length;
        return dependentes ? `${dependentes} talento(s) dependem deste` : '';
      }
      case 'monstros': {
        const em = (c.reinos ?? []).filter((r) => (r.monstrosPossiveis ?? []).includes(id)).length;
        return em ? `${em} reino(s) usam este monstro` : '';
      }
      default:
        return '';
    }
  }

  async apagarRegistro(aba, item) {
    try {
      await aba.repo.remover(item.id);
      this.invalidarCache();
      if (this.selecionado?.item?.id === item.id) this.selecionado = null;
      this.status('Apagado.');
      this.redesenhar();
    } catch (erro) {
      this.status('Erro ao apagar: ' + (erro?.message ?? erro), '#e0806a');
    }
  }

  // ---------- formulário ----------

  desenharFormulario(campos, aba, item) {
    const x0 = this.linhaLista + 40;
    const larguraUtil = Math.max(260, this.scale.width - x0 - 44);

    const titulo = item ? `Editar: ${item.nome ?? item.id}` : `Novo registro em ${aba.label}`;
    this.camada.add(uiTitulo(this, x0, TOPO, titulo, '15px').setOrigin(0, 0));

    // ID + slug visíveis: é assim que o admin referencia o registro nos campos
    // de texto livre (insumos, loot, pré-requisitos), então escondê-lo só gera
    // erro de digitação.
    const idTexto = item?.id ? `id: ${item.id}` : 'id: gerado ao salvar';
    this.camada.add(
      uiTexto(this, x0, TOPO + 24, idTexto, { fontSize: '10px', color: PERGAMINHO })
        .setOrigin(0, 0)
        .setAlpha(0.6),
    );

    let y = TOPO + 44;
    const refs = {};

    for (const campo of campos) {
      if (y > this.scale.height - 90) break;

      const valorBruto = item?.[campo.chave];
      const valor = this.valorInicial(campo, valorBruto);

      const ctrl = criarCampo(this, {
        rotulo: campo.rotulo,
        x: x0,
        y,
        largura: Math.min(larguraUtil, campo.tipo === 'area' || campo.tipo === 'imagem' ? 420 : 300),
        tipo: campo.tipo,
        valor,
        opcoes: campo.opcoes ?? [],
        dica: campo.dica ?? '',
        obrigatorio: campo.obrigatorio,
        placeholder: campo.placeholder ?? '',
        multilinha: campo.tipo === 'area',
        pastaUpload: campo.pastaUpload ?? aba.pastaUpload ?? 'imagens',
        // Propaga a chave do esquema para o controle: sem isso, o formulario
        // nao sabia qual campo era qual, e o botao Salvar nao conseguia
        // montar o objeto final.
        chave: campo.chave,
      });

      refs[campo.chave] = { ctrl, campo };
      this.camposVivos.push(ctrl);
      this.camada.add(ctrl.container);
      y += ctrl.altura;
    }

    // Ações
    const yAcao = Math.min(y + 8, this.scale.height - 74);
    const btnSalvar = botao(
      this,
      x0 + 90,
      yAcao,
      item ? 'Salvar alterações' : 'Criar registro',
      () => this.salvar(campos, aba, item, refs),
      { largura: 180, altura: 34, tamanho: '13px' },
    );
    this.camada.add(btnSalvar.container);

    const btnCancelar = botao(this, x0 + 290, yAcao, 'Cancelar', () => {
      this.selecionado = null;
      this.redesenhar();
    }, { largura: 140, altura: 34, tamanho: '13px', cor: 0x3a2c20, corHover: 0x4a3828, corTexto: PERGAMINHO });
    this.camada.add(btnCancelar.container);

    if (item) {
      const btnApagar = botao(this, x0 + 450, yAcao, 'Apagar', () => this.confirmarApagar(aba, item), {
        largura: 120,
        altura: 34,
        tamanho: '13px',
        cor: 0x7a2f2a,
        corHover: 0x9a3a33,
        corTexto: '#ffe6e0',
      });
      this.camada.add(btnApagar.container);
    }
  }

  /** Converte o valor gravado no Firestore para o que o campo deve exibir. */
  valorInicial(campo, bruto) {
    if (bruto === null || bruto === undefined || bruto === '') {
      // Defaults sensatos para não obrigar o admin a preencher o óbvio.
      switch (campo.chave) {
        case 'tipo':
          return campo.opcoes?.[0]?.valor ?? null;
        case 'raridade':
          return 'comum';
        case 'uso':
          return [];
        default:
          return campo.tipo === 'numero' ? '' : '';
      }
    }
    const ser = serializadores[campo.chave];
    if (ser) return ser(bruto);
    if (campo.tipo === 'multiselec') return Array.isArray(bruto) ? bruto : [bruto];
    if (campo.tipo === 'select' && typeof bruto === 'string') return bruto;
    if (campo.tipo === 'area' && typeof bruto === 'object') return JSON.stringify(bruto);
    return bruto;
  }

  /**
   * Le todos os campos do formulario para um objeto plano.
   *
   * Campo vazio e DESCARTADO em vez de gravado como `''`: um item que já tinha
   * `defesa: 12` e que o admin deixe a caixa em branco deve manter 12, não
   * virar 0. `numero` é a exceção — vazio ali significa zero de fato.
   */
  coletar(campos, refs) {
    const form = {};
    for (const campo of campos) {
      const ref = refs[campo.chave];
      if (!ref) continue;

      let v = ref.ctrl.obter();

      if (campo.tipo === 'numero') {
        const limpo = String(v ?? '').trim().replace(',', '.');
        v = limpo === '' ? 0 : Number(limpo);
        if (!Number.isFinite(v)) v = 0;
      }
      if (campo.parse) v = campo.parse(v);

      const vazio =
        v === '' ||
        v === null ||
        v === undefined ||
        (Array.isArray(v) && v.length === 0) ||
        (campo.tipo === 'area' && v === '{}');

      if (vazio) {
        // Lista/area parseada que virou objeto vazio também não deve ser gravada.
        if (!(campo.parse && typeof v === 'object' && Object.keys(v).length === 0)) {
          continue;
        }
      }
      form[campo.chave] = v;
    }
    return form;
  }

  async salvar(campos, aba, item, refs) {
    const form = this.coletar(campos, refs);

    for (const campo of campos) {
      if (!campo.obrigatorio) continue;
      const v = form[campo.chave];
      const vazio = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
      if (vazio) {
        this.status(`Preencha o campo obrigatório: ${campo.rotulo}`, '#e0806a');
        return;
      }
    }

    const dados = this.normalizar(campos, form, item);

    try {
      if (item) await aba.repo.salvar(item.id, dados);
      else await aba.repo.criar(dados);
      this.invalidarCache();
      this.selecionado = null;
      this.status('Salvo.');
      this.redesenhar();
    } catch (erro) {
      console.error(erro);
      this.status('Erro ao salvar: ' + (erro?.message ?? erro), '#e0806a');
    }
  }

  /** Ajusta tipos que o Firestore não valida sozinho. */
  normalizar(campos, form, item) {
    const out = { ...form };
    for (const campo of campos) {
      if (campo.tipo === 'numero' && out[campo.chave] !== undefined) {
        out[campo.chave] = Number(out[campo.chave]) || 0;
      }
    }

    // A classe do talento vem do FILTRO da lista, não de um campo do
    // formulário. Sem isto, um talento criado pelo admin nascia sem
    // `classeId` e não aparecia em árvore nenhuma — o registro existia, o
    // painel dizia "salvo", e o jogo não mudava.
    if (this.aba?.filtroClasse) out.classeId = this.filtroClasse;

    // Slug estável: é o que o resto do jogo usa para referenciar o registro em
    // campos de texto livre. Mantemos o existente ao editar.
    if (!item && out.nome && !out.slug) {
      out.slug = slugify(out.nome);
    }
    if (item?.id && !item.slug && out.nome) {
      out.slug = slugify(out.nome);
    }
    return out;
  }

  // ---------- abas especiais: portais ----------

  async desenharPortais(geracao) {
    const portais = await this.carregar('portais', () => repoPortais.listar());
    if (!this.valido(geracao)) return;

    this.camada.add(uiTitulo(this, 32, TOPO, 'PORTÕES PUBLICADOS', '15px').setOrigin(0, 0));
    this.camada.add(
      uiTexto(
        this,
        32,
        TOPO + 26,
        'Cada jogador publica aqui o resumo da base que os amigos encontram pelo Portal Arcano. Desmarque para esconder uma base sem apagar o progresso dela.',
        { fontSize: '11px', wordWrap: { width: this.linhaLista } },
      )
        .setOrigin(0, 0)
        .setAlpha(0.75),
    );

    let y = TOPO + 72;
    if (!portais.length) {
      this.camada.add(
        uiTexto(this, 32, y, 'Nenhum portal publicado ainda.', { fontSize: '12px' }).setOrigin(0, 0),
      );
      return;
    }

    const alturaLinha = 48;
    for (const p of portais.slice(0, 30)) {
      const cx = 32 + (this.linhaLista - 32) / 2;
      const ativo = Boolean(p.ativo);

      const caixa = caixaArredondada(this, cx, y + 20, this.linhaLista - 24, 44, {
        raio: 8,
        preenchimento: 0x1d1710,
        borda: ativo ? 0x8fd18f : 0x3a2c20,
        larguraBorda: 1,
        origem: [0.5, 0],
      });
      this.camada.add(caixa);

      this.camada.add(
        this.add
          .text(44, y + 8, `${p.nome ?? 'Viajante'} — ${p.nomeBase ?? 'Acampamento'}`, {
            ...FONTE_UI,
            fontSize: '12px',
            color: OURO,
          })
          .setOrigin(0, 0),
      );
      this.camada.add(
        this.add
          .text(44, y + 26, `nível ${p.nivel ?? 1} · ${ativo ? 'portal ativo' : 'oculto'}`, {
            ...FONTE_UI,
            fontSize: '10px',
            color: ativo ? '#8fd18f' : '#a8967a',
          })
          .setOrigin(0, 0),
      );

      const btn = botao(this, cx + (this.linhaLista - 24) / 2 - 44, y + 34, ativo ? 'Ocultar' : 'Publicar', async () => {
        try {
          await repoPortais.salvar(p.id, { ativo: !ativo });
          delete this.caches.portais;
          this.status(ativo ? 'Portal ocultado.' : 'Portal publicado.');
          this.redesenhar();
        } catch (erro) {
          this.status('Erro: ' + (erro?.message ?? erro), '#e0806a');
        }
      }, {
        largura: 88,
        altura: 22,
        tamanho: '11px',
        cor: ativo ? 0x3a2c20 : 0x8fd18f,
        corHover: ativo ? 0x4a3828 : 0xa8e0a8,
        corTexto: ativo ? PERGAMINHO : '#14100c',
      });
      this.camada.add(btn.container);

      y += alturaLinha + 4;
    }
  }

  // ---------- abas especiais: jogadores ----------

  async desenharJogadores(geracao) {
    const [usuarios, admins] = await Promise.all([
      this.carregar('usuarios', () => repoUsuarios.listar()),
      this.carregar('admins', () => listarAdmins()),
    ]);
    if (!this.valido(geracao)) return;

    this.camada.add(uiTitulo(this, 32, TOPO, 'JOGADORES', '15px').setOrigin(0, 0));
    this.camada.add(
      uiTexto(
        this,
        32,
        TOPO + 26,
        'Promova a conta que gerencia o painel. A lista vem de users/{uid} e só aparece depois que a pessoa entrou no jogo uma vez.',
        { fontSize: '11px', wordWrap: { width: this.linhaLista } },
      )
        .setOrigin(0, 0)
        .setAlpha(0.75),
    );

    let y = TOPO + 72;
    if (!usuarios.length) {
      this.camada.add(
        uiTexto(this, 32, y, 'Nenhum usuário cadastrado ainda.', { fontSize: '12px' }).setOrigin(0, 0),
      );
      return;
    }

    for (const u of usuarios.slice(0, 40)) {
      const ehAdm = admins.includes(u.id);
      const cx = 32 + (this.linhaLista - 32) / 2;
      const w = this.linhaLista - 24;

      const caixa = caixaArredondada(this, cx, y + 21, w, 46, {
        raio: 8,
        preenchimento: ehAdm ? 0x2f2418 : 0x1d1710,
        borda: ehAdm ? OURO : 0x2e241a,
        larguraBorda: 1,
        origem: [0.5, 0],
      });
      this.camada.add(caixa);

      this.camada.add(
        this.add
          .text(44, y + 8, String(u.nome ?? u.email ?? u.id).slice(0, 26), {
            ...FONTE_UI,
            fontSize: '12px',
            color: OURO,
          })
          .setOrigin(0, 0),
      );
      this.camada.add(
        this.add
          .text(44, y + 26, `${u.email ?? ''} · nv ${u.nivel ?? 1}${ehAdm ? ' · ADMIN' : ''}`, {
            ...FONTE_UI,
            fontSize: '10px',
            color: ehAdm ? '#8fd18f' : PERGAMINHO,
          })
          .setOrigin(0, 0)
          .setAlpha(ehAdm ? 1 : 0.7),
      );

      const btn = botao(this, cx + w / 2 - 46, y + 36, ehAdm ? 'Rebaixar' : 'Promover', async () => {
        try {
          await definirAdminUid(u.id, !ehAdm);
          delete this.caches.admins;
          this.status(ehAdm ? 'Acesso de admin removido.' : 'Promovido a admin.');
          this.redesenhar();
        } catch (erro) {
          this.status('Erro: ' + (erro?.message ?? erro), '#e0806a');
        }
      }, {
        largura: 92,
        altura: 22,
        tamanho: '11px',
        cor: ehAdm ? 0x3a2c20 : 0xd4af6a,
        corHover: ehAdm ? 0x4a3828 : 0xe6c47c,
        corTexto: ehAdm ? PERGAMINHO : '#14100c',
      });
      this.camada.add(btn.container);

      y += 50;
    }
  }

  // ---------- fechar ----------

  fechar() {
    this.scene.stop('Admin');
    if (this.scene.isPaused('World')) this.scene.resume('World');
    else if (!this.scene.isActive('World')) this.scene.start('World');
  }
}

function slugify(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}