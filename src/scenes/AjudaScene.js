import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { buscarItem, buscarClasse, buscarTalento, buscarMonstro, buscarReino } from '../core/catalogo.js';
import { FAIXAS_NIVEL_ORBE } from '../core/enums.js';
import { referenciasDoItem } from '../core/wiki.js';
import {
  painel as uiPainel,
  botao,
  chip,
  campoTexto,
  caixaArredondada,
  texto as uiTexto,
  titulo as uiTitulo,
  aoTeclar,
  restaurarFoco,
  FONTE_UI,
} from '../ui/comuns.js';
import { texturaDeUrl } from '../ui/formularios.js';
import { TEXTURAS } from './BootScene.js';

// =====================================================================
// Wiki do Império
//
// Tecla H. Substitui a lista curta de teclas por uma enciclopédia que puxa o
// texto do ADMINISTRADOR: tudo aqui é montado a partir dos campos
// `descricao` e `imagem` que se cadastram no painel (F2).
//
// Por que uma cena e nao um modal na WorldScene: o conteúdo é longo e precisa
// de busca e rolagem. Um modal sobreposto impediria o mundo de continuar
// desenhando por baixo a cada quadro, e a lista de teclas antiga não tinha
// espaço para texto corrido.
// =====================================================================

const SECOES = [
  { id: 'controles', rotulo: 'Controles' },
  { id: 'itens', rotulo: 'Itens' },
  { id: 'talentos', rotulo: 'Talentos' },
  { id: 'classes', rotulo: 'Classes' },
  { id: 'monstros', rotulo: 'Monstros' },
  { id: 'reinos', rotulo: 'Reinos' },
  { id: 'orbes', rotulo: 'Orbes' },
  { id: 'conquistas', rotulo: 'Conquistas' },
];

const ROTULO_USO = {
  extracao: 'Extração',
  transformacao: 'Transformação',
  utilizacao: 'Utilização',
  estrutura: 'Estrutura',
  equipavel: 'Equipável',
  maquina: 'Máquina',
};

const ROTULO_RARIDADE = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

const COR_RARIDADE = {
  comum: 0x8a8a8a,
  incomum: 0x6fbf5f,
  raro: 0x5f9fd4,
  epico: 0xbf6fdf,
  lendario: 0xe0a83a,
};

const LARGURA_LISTA = 268;
const PREVIEW = 96;

export class AjudaScene extends Phaser.Scene {
  constructor() {
    super('Ajuda');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado ?? null;
    this.catalogo = dados?.catalogo ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');

    this.secao = 'controles';
    this.busca = '';
    this.selecionado = null; // registro aberto no painel da direita
    // Id do item com a página de detalhe aberta. Separado de `selecionado`
    // porque a ficha (cartão) e a página completa são dois estados: o jogador
    // escolhe um item, vê a ficha, e aí clica para o cruzamento completo.
    this.detalheAberto = null;

    this.raiz = this.add.container(0, 0);
    this.campos = [];

    // O desenho inteiro mora em `redimensionar`: a wiki é um painel só, e
    // reconstruir do zero é o que mantém busca, seleção e geometria coerentes
    // depois de um filtro. A chamada dupla abaixo é o que abria a tela.
    this.redimensionar(true);

    const aoRedimensionar = () => this.redimensionar();
    this.scale.on(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, aoRedimensionar);
      this.limparCampos();
    });

    aoTeclar(this, 'ESC', () => this.fechar());
    aoTeclar(this, 'H', () => this.fechar());
  }

  limparCampos() {
    for (const c of this.campos ?? []) {
      try {
        c.destruir();
      } catch {
        /* o <input> do DOM pode ja ter sido removido */
      }
    }
    this.campos = [];
  }

  redimensionar(primeiraVez = false) {
    const { width, height } = this.scale;

    // Foco e cursor são guardados antes de o campo do DOM ser destruído.
    const foco = this._foco;
    this.limparCampos();
    this.raiz.removeAll(true);

    const margem = 16;
    const w = Math.max(560, width - margem * 2);
    const h = Math.max(380, height - margem * 2);
    const x0 = Math.round((width - w) / 2);
    const y0 = Math.round((height - h) / 2);

    this.geometria = { x0, y0, w, h };

    // Fundo + moldura
    this.raiz.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82).setInteractive(),
    );
    this.raiz.add(uiPainel(this, x0, y0, w, h));

    this.raiz.add(uiTitulo(this, x0 + 24, y0 + 18, 'WIKI DO IMPÉRIO', '20px'));
    this.raiz.add(
      uiTexto(this, x0 + 24, y0 + 46, 'Tudo que você está lendo foi cadastrado pelo administrador do Império.', {
        fontSize: '11px',
      })
        .setAlpha(0.65)
        .setOrigin(0, 0),
    );

    // Botão fechar
    this.raiz.add(
      botao(this, x0 + w - 24, y0 + 30, 'Fechar  [H / ESC]', () => this.fechar(), {
        largura: 150,
        altura: 28,
        tamanho: '12px',
        cor: 0x2a2018,
        corHover: 0x3a2c20,
        corBorda: 0x8a6a2f,
        corTexto: PERGAMINHO,
      }).container,
    );

    this.montarBusca(x0 + 24, y0 + 66, w - 48);
    this.montarNavegacao(x0 + 16, y0 + 104, h - 180);
    this.montarConteudo(x0 + 16 + LARGURA_LISTA + 12, y0 + 104, w - LARGURA_LISTA - 52, h - 150);

    if (!primeiraVez) this.status('');

    // Devolve o foco ao campo de busca depois de a tela inteira ter sido
    // reconstruída. Sem esta linha, digitar "ma" na busca redesenha o painel,
    // destrói o `<input>` e a terceira letra vai para lugar nenhum.
    if (foco?.chave) restaurarFoco(this, foco, this.campos);
  }

  // ---------- busca ----------

  montarBusca(x, y, largura) {
    this.raiz.add(uiTexto(this, x, y, 'Buscar em tudo', { fontSize: '11px' }).setOrigin(0, 0).setAlpha(0.8));
    const campo = campoTexto(this, x, y + 15, largura, 30, this.busca, {
      placeholder: 'ex.: machado, extração, vigor, goblin…',
      maxLength: 60,
      chave: 'busca',
      // Filtra a cada tecla. O foco é devolvido no fim de `redimensionar`,
      // senão o redesenho do resultado derrubaria o campo no meio da busca.
      aoMudar: (v) => {
        if (v === this.busca) return;
        this.busca = v;
        this.selecionado = null;
        this.detalheAberto = null;
        clearTimeout(this.timerBusca);
        this.timerBusca = setTimeout(() => this.redimensionar(), 160);
      },
      aoConfirmar: (v) => {
        clearTimeout(this.timerBusca);
        this.busca = v;
        this.selecionado = null;
        this.detalheAberto = null;
        // Buscar leva direto para Itens: é onde vive 90% do que se procura.
        if (v.trim()) this.secao = 'itens';
        this.redimensionar();
      },
    });
    this.campos.push(campo);
    this.raiz.add(campo.box);
    this.statusBar = uiTexto(this, x, y + 50, '', { fontSize: '10px', color: OURO }).setOrigin(0, 0).setAlpha(0.8);
    this.raiz.add(this.statusBar);
  }

  status(msg) {
    this.statusBar?.setText(msg ?? '');
  }

  // ---------- navegação lateral ----------

  montarNavegacao(x, y, altura) {
    this.raiz.add(
      uiPainel(this, x, y, LARGURA_LISTA, altura, 0x100c08, 0.9),
    );

    const lista = this.navegacaoVisivel();
    let ly = y + 8;
    for (const s of lista) {
      const ativo = s.id === this.secao;
      const b = botao(this, x + 10, ly, s.rotulo, () => {
        this.secao = s.id;
        this.busca = '';
        this.selecionado = null;
        this.detalheAberto = null;
        this.redimensionar();
      }, {
        largura: LARGURA_LISTA - 20,
        altura: 26,
        tamanho: '12px',
        cor: ativo ? 0xd4af6a : 0x1a140e,
        corHover: ativo ? 0xd4af6a : 0x2a2018,
        corBorda: ativo ? 0x8a6a2f : 0x2e241a,
        corTexto: ativo ? '#14100c' : PERGAMINHO,
        alinhamento: 'left',
      });
      this.raiz.add(b.container);
      ly += 30;
    }

    if (!lista.length) {
      this.raiz.add(
        uiTexto(this, x + 12, y + 12, 'Nada encontrado para essa busca.', { fontSize: '11px' })
          .setOrigin(0, 0)
          .setAlpha(0.7),
      );
    }

    // Atalhos no rodapé da coluna
    const rodape = y + altura - 30;
    this.raiz.add(
      uiTexto(
        this,
        x + 12,
        rodape,
        this.busca ? 'Busca ativa — limpar para ver o índice.' : 'Escolha um tema à esquerda.',
        { fontSize: '10px', wordWrap: { width: LARGURA_LISTA - 24 } },
      )
        .setOrigin(0, 0)
        .setAlpha(0.55),
    );
  }

  navegacaoVisivel() {
    const termo = String(this.busca ?? '').trim().toLowerCase();
    if (!termo) return SECOES;
    // Com busca ativa a navegação vira "onde há resultados".
    return SECOES.filter((s) => this.resultadosDe(s.id, termo).length > 0);
  }

  // ---------- área de conteúdo ----------

  montarConteudo(x, y, largura, altura) {
    this.conteudoX = x;
    this.conteudoY = y;
    this.conteudoW = largura;
    this.conteudoH = altura;

    this.raiz.add(uiPainel(this, x - 6, y - 6, largura + 12, altura + 12, 0x100c08, 0.9));

    if (this.secao === 'controles') return this.paginaControles(x, y, largura, altura);

    const termo = String(this.busca ?? '').trim().toLowerCase();
    const todos = termo ? this.resultadosDe(this.secao, termo) : this.registrosDaSecao(this.secao);
    this.status(`${todos.length} registro(s).`);

    if (!todos.length) {
      this.raiz.add(
        uiTexto(
          this,
          x + 8,
          y + 16,
          termo
            ? `Nada encontrado para "${this.busca}".\n\nO administrador ainda pode cadastrar isso — peça no painel (F2).`
            : 'Nenhum registro cadastrado nesta categoria.\n\nPeça ao administrador para cadastrar (painel F2).',
          { fontSize: '12px', wordWrap: { width: largura - 24 }, lineSpacing: 4 },
        )
          .setOrigin(0, 0)
          .setAlpha(0.75),
      );
      return;
    }

    // Item selecionado à esquerda; lista rolável de registros abaixo.
    const sel = this.selecionado && todos.find((t) => t.id === this.selecionado.id);

    // Item selecionado abre a PÁGINA COMPLETA, não a ficha de cartão.
    //
    // A ficha mostra nome, descrição e atributos — e param aí. A pergunta que o
    // jogador faz ao clicar num item é outra: "o que eu faço COM ele?". Isso
    // exige cruzar receitas, monstros, chunks, biomas e NPCs, o que não cabe no
    // cartão e é informação que o painel não mostra em lugar nenhum.
    if (sel && this.detalheAberto === sel.id) {
      return this.paginaDetalheItem(sel, x, y, largura, altura, todos);
    }

    const alturaCartao = Math.min(altura - 190, 250);
    this.desenharFicha(sel ?? todos[0], x + 4, y + 4, largura - 16, alturaCartao, !!sel);

    // Lista compacta
    let ly = y + alturaCartao + 16;
    const altLista = altura - alturaCartao - 22;
    this.raiz.add(uiTexto(this, x + 4, ly, 'Todos os registros', { fontSize: '11px', color: OURO }).setOrigin(0, 0));

    ly += 18;
    const alturaLinha = 26;
    const cabem = Math.max(1, Math.floor((altLista - 8) / alturaLinha));
    const inicio = Math.max(0, Math.min(todos.length - 1, this.desloc ?? 0));

    this.raiz.add(uiPainel(this, x - 2, ly - 2, largura + 4, altLista + 4, 0x0c0906, 0.85));

    for (let i = inicio; i < Math.min(todos.length, inicio + cabem); i += 1) {
      const r = todos[i];
      const ativo = (sel?.id ?? todos[inicio]?.id) === r.id;
      const b = botao(this, x + 2, ly, r.nome ?? r.id, () => {
        // Clique num item ABRE a página de detalhe. Nos outros tipos o clique
        // continua só selecionando: o cruzamento de "o que dá para fazer" só
        // existe para itens.
        this.selecionado = r;
        this.detalheAberto = this.secao === 'itens' ? r.id : null;
        this.desloc = 0;
        this.redimensionar();
      }, {
        largura: largura - 6,
        altura: 24,
        tamanho: '11px',
        cor: ativo ? 0x2f2418 : 0x120e0a,
        corHover: 0x2a2018,
        corBorda: ativo ? OURO : 0x241a12,
        corTexto: ativo ? OURO : PERGAMINHO,
        alinhamento: 'left',
      });
      this.raiz.add(b.container);
      ly += alturaLinha;
    }

    // Rolagem
    const total = todos.length;
    this.desloc = inicio;
    const maxDesloc = Math.max(0, total - cabem);
    if (maxDesloc > 0) {
      const bx = x + largura - 16;
      const topo = y + alturaCartao + 32;
      const baixo = topo + altLista - 26;
      const setaCima = this.add
        .text(bx, topo, '▲', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
        .setOrigin(0.5)
        .setAlpha(inicio > 0 ? 1 : 0.25)
        .setInteractive({ useHandCursor: true });
      if (inicio > 0) {
        setaCima.on('pointerdown', () => {
          this.desloc = Math.max(0, this.desloc - cabem);
          this.redimensionar();
        });
      }
      const setaBaixo = this.add
        .text(bx, baixo, '▼', { ...FONTE_UI, fontSize: '10px', color: PERGAMINHO })
        .setOrigin(0.5)
        .setAlpha(inicio < maxDesloc ? 1 : 0.25)
        .setInteractive({ useHandCursor: true });
      if (inicio < maxDesloc) {
        setaBaixo.on('pointerdown', () => {
          this.desloc = Math.min(maxDesloc, this.desloc + cabem);
          this.redimensionar();
        });
      }
      this.raiz.add([
        setaCima,
        setaBaixo,
        uiTexto(this, bx - 12, topo + altLista / 2 - 8, `${inicio + 1}/${total}`, {
          fontSize: '9px',
          color: PERGAMINHO,
          wordWrap: { width: 28 },
        })
          .setOrigin(0.5, 0)
          .setAlpha(0.7),
      ]);
    }
  }

  // ---------- ficha do registro ----------

  /**
   * Desenha a ficha de UM registro: imagem, descrição e o que ele se
   * transforma / produz.
   *
   * `descricao` é o texto do admin — quando ele falta, mostro os campos
   * numéricos para que a wiki nunca apresente um cartão em branco.
   */
  desenharFicha(registro, x, y, largura, altura, temSelecao) {
    if (!registro) return;
    const cat = this.catalogo;

    this.raiz.add(
      caixaArredondada(this, x, y, largura, altura, {
        raio: 10,
        preenchimento: 0x16110c,
        borda: 0x8a6a2f,
        larguraBorda: 1,
        bordaInterna: OURO,
        alfaBordaInterna: 0.18,
        origem: [0, 0],
      }),
    );

    // Preview quadrado à esquerda
    const px = x + 12;
    const py = y + 12;
    this.raiz.add(
      caixaArredondada(this, px, py, PREVIEW, PREVIEW, {
        raio: 8,
        preenchimento: 0x0d0a07,
        borda: COR_RARIDADE[registro.raridade] ?? 0x3a2c20,
        larguraBorda: 2,
        origem: [0, 0],
      }),
    );

    const img = this.add.image(px + PREVIEW / 2, py + PREVIEW / 2, 'painel').setDisplaySize(PREVIEW - 14, PREVIEW - 14);
    this.raiz.add(img);
    if (registro.imagem) {
      const chave = `wiki_${registro.id}`;
      texturaDeUrl(this, registro.imagem, chave).then((c) => {
        if (c && img.scene) img.setTexture(c);
      });
    }

    // Texto à direita do preview
    const tx = px + PREVIEW + 14;
    const tw = Math.max(120, x + largura - tx - 14);
    let ty = y + 12;

    this.raiz.add(
      uiTitulo(this, tx, ty, String(registro.nome ?? registro.id), '16px')
        .setOrigin(0, 0)
        .setWordWrapWidth(tw),
    );
    ty += 26;

    const tags = [];
    if (registro.tipo) tags.push(cap(registro.tipo));
    if (registro.raridade) tags.push(ROTULO_RARIDADE[registro.raridade] ?? registro.raridade);
    if (registro.nivelMin) tags.push(`nível ${registro.nivelMin}+`);
    if (registro.vocacao || registro.classeId) {
      const c = buscarClasse(cat, registro.classeId ?? registro.vocacao);
      if (c) tags.push(c.nome);
    }
    if (registro.ramo) tags.push(registro.ramo);

    let chipX = tx;
    for (const t of tags) {
      const c = chip(this, chipX, ty, t, 0x241c14, OURO);
      this.raiz.add(c);
      chipX += c.largura + 5;
      if (chipX > x + largura - 60) break;
    }
    ty += 22;

    // Descrição do administrador
    const descricao = String(registro.descricao ?? '').trim();
    if (descricao) {
      const alturaDesc = Math.min(
        Math.max(34, y + altura - ty - 18),
        descricao.length * 0.55 + 8,
      );
      this.raiz.add(
        uiTexto(this, tx, ty, descricao, {
          fontSize: '12px',
          color: PERGAMINHO,
          wordWrap: { width: tw },
          lineSpacing: 3,
        })
          .setOrigin(0, 0)
          .setFixedSize(tw, alturaDesc)
          .setAlpha(0.92),
      );
    }

    // Detalhe técnico: o que o admin NÃO escreveu em texto.
    const linhas = this.linhasTecnicas(registro);
    if (linhas.length) {
      let ly = y + altura - 12 - (linhas.length - 1) * 16;
      for (const l of linhas) {
        this.raiz.add(
          uiTexto(this, tx, ly, l, { fontSize: '10px', color: OURO })
            .setOrigin(0, 0)
            .setAlpha(0.85),
        );
        ly += 16;
      }
    } else if (!descricao) {
      this.raiz.add(
        uiTexto(this, tx, ty, 'O administrador ainda não escreveu a descrição deste registro.', {
          fontSize: '11px',
          color: PERGAMINHO,
          wordWrap: { width: tw },
        })
          .setOrigin(0, 0)
          .setAlpha(0.5),
      );
    }

    // Bloco "o que vira" para itens — é a informação que o jogador mais procura.
    if (registro.tipo === 'bloco' || (registro.uso ?? []).includes('extracao')) {
      const rende = this.descreverRendimento(registro);
      if (rende) {
        this.raiz.add(
          uiTexto(this, x + 12, y + PREVIEW + 22, `Ao extrair: ${rende}`, {
            fontSize: '11px',
            color: OURO,
            wordWrap: { width: largura - 24 },
          })
            .setOrigin(0, 0)
            .setAlpha(0.9),
        );
      }
    }
  }

  /** Linhas "atributo: valor" prontas para exibição. */
  linhasTecnicas(registro) {
    const campos = [
      ['vidaMax', 'Vida máx.'],
      ['poderMax', 'Poder máx.'],
      ['danoBase', 'Dano'],
      ['defesa', 'Defesa'],
      ['poderMineracao', 'Mineração'],
      ['curaVida', 'Cura'],
      ['slotsUpgrade', 'Slots de Orbe'],
      ['nivelMaxUpgrade', 'Upgrade máx.'],
      ['custoPontos', 'Custo em pontos'],
      ['faixaMin', 'Nível mín.'],
      ['faixaMax', 'Nível máx.'],
      ['dificuldade', 'Dificuldade'],
      ['comportamento', 'Comportamento'],
      ['xpRecompensa', 'XP'],
    ];
    const out = [];
    for (const [chave, rotulo] of campos) {
      const v = registro[chave];
      if (v === null || v === undefined || v === '' || v === 0) continue;
      out.push(`${rotulo}: ${v}`);
      if (out.length >= 4) break;
    }
    return out;
  }

  /** "Ao extrair este bloco, você recebe…" */
  descreverRendimento(registro) {
    const lista = registro.rende ?? registro.rendimento ?? null;
    if (Array.isArray(lista) && lista.length) {
      return lista
        .map((r) => `${r.itemId} ×${r.qtd ?? 1}`)
        .map((s) => {
          const [id, q] = s.split(' ×');
          const def = buscarItem(this.catalogo, id);
          return `${def?.nome ?? id} ×${q ?? 1}`;
        })
        .join(', ');
    }
    if (typeof lista === 'string' && lista.trim()) {
      return lista
        .split(/[,;|]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [id, q] = p.split(':');
          const def = buscarItem(this.catalogo, id);
          return `${def?.nome ?? id} ×${q || 1}`;
        })
        .join(', ');
    }
    if (registro.rendimentoMin || registro.rendimentoMax) {
      return `de ${registro.rendimentoMin ?? 1} a ${registro.rendimentoMax ?? 1} unidade(s)`;
    }
    return '';
  }

  // ---------- dados por seção ----------

  registrosDaSecao(secao) {
    const c = this.catalogo ?? {};
    switch (secao) {
      case 'itens':
        return c.itens ?? [];
      case 'talentos':
        return c.skills ?? [];
      case 'classes':
        return c.classes ?? [];
      case 'monstros':
        return c.monsters ?? [];
      case 'reinos':
        return c.worldTemplates ?? [];
      case 'conquistas':
        return c.achievements ?? [];
      default:
        return [];
    }
  }

  /**
   * Busca textual por seção.
   *
   * Casa em nome, descrição, tipo, uso, efeitos — ou seja, o que o jogador
   * digitou é comparado com o MESMO texto que o admin cadastrou. Buscar "vigor"
   * e achar um talento cujo efeito é `fis:+2` só funciona porque o efeito entra
   * na busca como texto legível.
   */
  resultadosDe(secao, termo) {
    return this.registrosDaSecao(secao).filter((r) => {
      const alvo = this.textoPesquisavel(r).toLowerCase();
      return termo.split(/\s+/).every((p) => alvo.includes(p));
    });
  }

  textoPesquisavel(r) {
    const partes = [
      r.nome,
      r.descricao,
      r.tipo,
      r.raridade,
      r.bioma,
      r.ramo,
      r.estacao,
      (r.uso ?? []).map((u) => ROTULO_USO[u] ?? u).join(' '),
      (r.preRequisitos ?? []).map((id) => buscarTalento(this.catalogo, id)?.nome ?? id).join(' '),
      (r.monstrosPossiveis ?? []).map((id) => buscarMonstro(this.catalogo, id)?.nome ?? id).join(' '),
      Object.entries(r.efeitos ?? {})
        .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
        .join(' '),
      Object.entries(r.bonusPorNivel ?? {})
        .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
        .join(' '),
    ];

    // O cruzamento entra na busca de ITENS.
    //
    // É o que faz "ferro" achar o item Ferro (óbvio) e também achar a Espada de
    // Ferro e a Poção de Vida — porque elas são feitas com ferro. E buscar
    // "Golem" acha o ferro, porque o Golem dropa. Sem isto, metade do
    // conhecimento que a página de detalhe mostra seria invisível para a busca,
    // e o jogador teria que saber o nome do item para chegar nele.
    if (r?.tipo || this.secao === 'itens') {
      try {
        const info = referenciasDoItem(this.catalogo, r?.id);
        if (info?.consumo?.length) {
          partes.push(
            ...info.consumo.map(
              (c) => `${c.receita} ${c.estacao} ${c.outros.map((o) => o.nome).join(' ')}`,
            ),
          );
        }
        if (info?.producao?.length) {
          partes.push(...info.producao.map((p) => `${p.receita} ${p.estacao}`));
        }
        if (info?.ondeEncontrar?.length) {
          partes.push(...info.ondeEncontrar.map((o) => `${o.titulo} ${o.detalhe}`));
        }
      } catch {
        // Um item com dado quebrado não pode derrubar a busca inteira.
      }
    }

    return partes.filter(Boolean).join(' · ');
  }

  // ---------- página de detalhe de um item ----------

  /**
   * Tudo sobre um item, em colunas, com rolagem.
   *
   * Três colunas porque é a leitura que o jogador faz: O QUE É (propriedades),
   * COMO SE FAZ (receitas que usam e que produzem) e ONDE SE ACHA (mundo,
   * bioma, chunk, baú, monstro, loja).
   *
   * As seções vazias são omitidas de propósito: uma coluna "Como se faz" com
   * "nenhuma receita usa pedra" é ruído. Mas `vazio()` no fim é honesto — o
   * jogador precisa saber se a busca não achou ou se realmente não existe.
   */
  paginaDetalheItem(item, x, y, largura, altura, todos) {
    const info = referenciasDoItem(this.catalogo, item.id);
    const colunas = Math.max(2, Math.min(3, Math.floor(largura / 300)));
    const vao = 12;
    const larguraCol = (largura - vao * (colunas - 1)) / colunas;

    // Botão de voltar: a página ocupa a lista inteira, então sem ele o
    // jogador fica preso aqui.
    //
    // `botao()` devolve `{ container, largura }` — o GameObject é `.container`.
    // Passar o objeto inteiro para `Container.add` estoura com
    // "gameObject.once is not a function", que não aponta para a causa.
    this.raiz.add(
      botao(this, x + largura - 116, y, '← Voltar à lista', () => {
        this.detalheAberto = null;
        this.redimensionar();
      }, { largura: 112, altura: 24, tamanho: '11px' }).container,
    );

    this.raiz.add(
      uiTitulo(this, x, y + 4, String(item.nome ?? item.id), '20px')
        .setOrigin(0, 0)
        .setWordWrapWidth(largura - 130),
    );

    let topo = y + 34;
    const descricao = String(item.descricao ?? '').trim();
    if (descricao) {
      const alt = Math.min(78, descricao.length * 0.42 + 14);
      this.raiz.add(
        uiTexto(this, x, topo, descricao, {
          fontSize: '12px',
          color: PERGAMINHO,
          wordWrap: { width: largura - 20 },
          lineSpacing: 3,
        })
          .setOrigin(0, 0)
          .setFixedSize(largura - 20, alt)
          .setAlpha(0.92),
      );
      topo += alt + 8;
    }

    const grupos = [];

    if (info.propriedades.length) {
      grupos.push({
        titulo: 'O que é',
        cor: OURO,
        linhas: info.propriedades.map(([r, v]) => `${r}: ${v}`),
      });
    }

    if (info.consumo.length) {
      grupos.push({
        titulo: 'Usado para fazer',
        cor: 0x8fbf72,
        linhas: info.consumo.map((c) => {
          const outros = c.outros.length
            ? ` (+ ${c.outros.map((o) => `${o.nome} x${o.qtd}`).join(', ')})`
            : '';
          const aviso = c.outros.some((o) => o.desconhecido) ? '  ⚠ ingrediente não cadastrado' : '';
          return `${c.quantidade}x · ${c.receita} — ${c.estacao}, nv ${c.nivelMin}+${outros}${aviso}`;
        }),
      });
    }

    if (info.producao.length) {
      grupos.push({
        titulo: 'Produzido por',
        cor: 0x7fbfe0,
        linhas: info.producao.map((p) => {
          const tempo = p.segundos ? `, ${p.segundos}s` : '';
          const poder = p.custoPoder ? `, ${p.custoPoder} poder` : '';
          return `${p.quantidade}x · ${p.receita} — ${p.estacao}, nv ${p.nivelMin}+${tempo}${poder}`;
        }),
      });
    }

    if (info.ondeEncontrar.length) {
      grupos.push({
        titulo: 'Onde achar',
        cor: 0xd9b06a,
        linhas: info.ondeEncontrar.map((o) => {
          const extras = [];
          if (o.chance) extras.push(`${o.chance}%`);
          if (o.quantidade) extras.push(`x${o.quantidade}`);
          if (o.preco) extras.push(`${o.preco} ouro`);
          if (o.nivel) extras.push(`nv ${o.nivel}+`);
          const sufixo = extras.length ? ` (${extras.join(', ')})` : '';
          return `${o.titulo} — ${o.detalhe}${sufixo}`;
        }),
      });
    }

    // Ordena por assunto: o que é, como se faz, onde se acha.
    const ordem = ['O que é', 'Usado para fazer', 'Produzido por', 'Onde achar'];
    grupos.sort((a, b) => ordem.indexOf(a.titulo) - ordem.indexOf(b.titulo));

    // Altura REAL de cada grupo, medida.
    //
    // Estimar 15px por linha é o que atropelava o texto: uma linha que quebra
    // ocupa duas, e a seguinte era desenhada por cima. Medir com o próprio
    // Phaser é o que resolve — inclusive quando o admin escreve uma descrição
    // de três linhas e o nome do item é enorme.
    const larguraTexto = larguraCol - 16;
    const ALTURA_TITULO = 24;
    const ESPACO_LINHA = 4;
    const RODAPE = 10;

    const medidos = grupos.map((g) => {
      const textos = g.linhas.map(
        (l) =>
          this.add
            .text(0, 0, `• ${l}`, {
              fontSize: '11px',
              color: PERGAMINHO,
              wordWrap: { width: larguraTexto },
              lineSpacing: 2,
            })
            .setOrigin(0, 0)
            .setAlpha(0.9),
      );
      const conteudo = textos.reduce((soma, t) => soma + t.height, 0);
      const espaco = Math.max(0, textos.length - 1) * ESPACO_LINHA;
      return { grupo: g, textos, altura: ALTURA_TITULO + conteudo + espaco + RODAPE };
    });

    if (!grupos.length) {
      grupos.push({
        titulo: 'Sem informação',
        cor: PERGAMINHO,
        linhas: [
          'Nenhuma receita, monstro, chunk, bioma ou loja menciona este item.',
          'O administrador ainda pode cadastrar isso no painel (F2).',
        ],
      });
    }

    // Distribui os grupos pelas colunas, equilibrando a altura MEDIDA.
    const alturas = medidos.map((m) => m.altura);
    const alturasPorCol = new Array(colunas).fill(0);
    const porCol = Array.from({ length: colunas }, () => []);
    for (let i = 0; i < medidos.length; i += 1) {
      const menor = alturasPorCol.indexOf(Math.min(...alturasPorCol));
      porCol[menor].push(i);
      alturasPorCol[menor] += alturas[i];
    }

    const disponivel = altura - (topo - y) - 8;

    for (let c = 0; c < colunas; c += 1) {
      const cx = x + c * (larguraCol + vao);
      let cy = topo;

      // Uma coluna pode não caber inteira: o resto vira "mais abaixo", com o nome.
      for (const gi of porCol[c]) {
        const m = medidos[gi];
        const g = m.grupo;

        if (cy - topo + m.altura > disponivel) {
          const resto = porCol[c]
            .slice(porCol[c].indexOf(gi))
            .map((k) => `${medidos[k].grupo.titulo} (${medidos[k].grupo.linhas.length})`)
            .join(', ');
          if (resto) {
            this.raiz.add(
              uiTexto(this, cx, cy + 4, `mais abaixo: ${resto}`, {
                fontSize: '10px',
                wordWrap: { width: larguraCol },
                color: PERGAMINHO,
              })
                .setOrigin(0, 0)
                .setAlpha(0.6),
            );
          }
          break;
        }

        this.raiz.add(this.add.rectangle(cx, cy, larguraCol, m.altura, 0x16110c, 0.7).setOrigin(0, 0));
        this.raiz.add(
          uiTexto(this, cx + 8, cy + 6, g.titulo, { fontSize: '12px', color: g.cor })
            .setOrigin(0, 0),
        );

        let ly = cy + ALTURA_TITULO;
        for (const t of m.textos) {
          t.setPosition(cx + 8, ly);
          this.raiz.add(t);
          ly += t.height + ESPACO_LINHA;
        }
        cy += m.altura + vao;
      }
    }

    this.status(
      `${todos.length} registro(s) · ${info.producao.length} receita(s) produzem · ` +
        `${info.consumo.length} usam · ${info.ondeEncontrar.length} origem(es)`,
    );
  }

  // ---------- página de controles ----------

  paginaControles(x, y, largura, altura) {
    this.status('');
    const grupos = [
      {
        titulo: 'Mover e olhar',
        linhas: [
          ['Andar', 'W A S D  ou  setas'],
          ['Correr (segurar)', 'Shift'],
          ['Mover o mapa', 'arraste com o botão esquerdo'],
          ['Interagir, atacar, coletar, usar', 'E'],
          ['Colocar o bloco selecionado', 'Q'],
          ['Descartar / soltar', 'G'],
        ],
      },
      {
        titulo: 'Império',
        linhas: [
          ['Publicar ou ocultar sua base no Portal Arcano', 'B'],
          ['Personagem, atributos e equipamentos', 'V'],
          ['Mochila e aplicação de Orbes', 'I'],
          ['Árvore de Talentos', 'T'],
          ['Fabricação', 'C'],
          ['Reinos Etéreos', 'R'],
          ['Lista de portais dos amigos', 'P'],
          ['Este wiki', 'H'],
          ['Fechar o que estiver aberto', 'ESC'],
        ],
      },
    ];

    if (this.isAdmin) {
      grupos.push({ titulo: 'Administração', linhas: [['Painel do administrador', 'F2']] });
    }

    const meiaLargura = (largura - 24) / 2;
    grupos.forEach((grupo, gi) => {
      const coluna = gi % 2;
      const gx = x + 8 + coluna * (meiaLargura + 8);
      let gy = y + 10;

      this.raiz.add(uiTitulo(this, gx, gy, grupo.titulo, '14px').setOrigin(0, 0));
      gy += 24;

      for (const [rotulo, tecla] of grupo.linhas) {
        const alturaLinha = 22;
        this.raiz.add(
          this.add
            .text(gx, gy, rotulo, { ...FONTE_UI, fontSize: '11px', color: PERGAMINHO, wordWrap: { width: meiaLargura - 90 } })
            .setOrigin(0, 0)
            .setAlpha(0.88),
        );
        this.raiz.add(
          this.add
            .text(gx + meiaLargura - 12, gy, tecla, { ...FONTE_UI, fontSize: '11px', color: OURO, align: 'right' })
            .setOrigin(1, 0)
            .setAlpha(0.95),
        );
        gy += alturaLinha;
      }
    });

    // Explicação dos sistemas, na mesma linguagem da wiki
    let by = y + Math.floor(grupos.length / 2) * 250 + 30;
    this.raiz.add(uiTitulo(this, x + 8, by, 'Como o Império funciona', '14px').setOrigin(0, 0));
    by += 22;

    const textos = [
      ['Portais Arcanos', 'Sua base tem um portal. Com ele visível, amigos o encontram pelo menu de portais e podem atravessar para visitar e ajudar.'],
      ['Orbes Arcanos', 'Reforçam um item até o limite de slots que ele tem. O tipo de orbe tem de ser compatível com o SEU nível — um orbe médio não funciona em alguém do nível 5.'],
      ['Vocações', 'Cada vocação tem uma árvore de talentos própria, dividida em ramos. Talentos connectados exigem o anterior.'],
      ['Reinos Etéreos', 'Mundos paralelos com bioma, monstros e recursos próprios. O nível deles é o que limita quem entra.'],
      ['Conquistas', 'Metas automáticas que dão XP, ouro e orbes ao serem cumpridas.'],
    ];

    for (const [titulo, corpo] of textos) {
      if (by > y + altura - 50) break;
      this.raiz.add(
        uiTexto(this, x + 8, by, titulo, { fontSize: '12px', color: OURO }).setOrigin(0, 0),
      );
      this.raiz.add(
        uiTexto(this, x + 8 + 110, by, corpo, {
          fontSize: '11px',
          color: PERGAMINHO,
          wordWrap: { width: largura - 140 },
          lineSpacing: 2,
        })
          .setOrigin(0, 0)
          .setAlpha(0.85),
      );
      by += 34;
    }
  }

  // ---------- fechar ----------

  fechar() {
    this.scene.stop('Ajuda');
  }
}

/** "orbe_arcano_menor" -> "Orbe arcano menor" */
function cap(s) {
  return String(s)
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export { ROTULO_USO, ROTULO_RARIDADE, COR_RARIDADE, FAIXAS_NIVEL_ORBE };