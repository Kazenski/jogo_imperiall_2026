import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import {
  TIPOS_ITEM,
  USOS_ITEM,
  RARIDADES,
  ESTAÇÕES,
  TIPOS_ORBE,
  FAIXAS_NIVEL_ORBE,
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

const ABAS = [
  { id: 'itens', label: 'Itens' },
  { id: 'classes', label: 'Classes' },
  { id: 'talentos', label: 'Talentos' },
  { id: 'monstros', label: 'Monstros' },
  { id: 'receitas', label: 'Receitas' },
  { id: 'reinos', label: 'Reinos' },
  { id: 'conquistas', label: 'Conquistas' },
];

export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
  }

  create() {
    this.abaAtual = 'itens';
    this.caches = {};
    this.caminhoVolta = [];

    this.cameras.main.setBackgroundColor('#0d0a07');

    this.textoTitulo = this.add
      .text(20, 16, 'ADMINISTRAÇÃO DO IMPÉRIUM', {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        color: OURO,
      })
      .setDepth(10);

    this.textoStatus = this.add
      .text(20, 44, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: PERGAMINHO,
      })
      .setAlpha(0.8)
      .setDepth(10);

    this.areaAbas = this.add.container(0, 0).setDepth(20);
    this.areaConteudo = this.add.container(0, 0).setDepth(5);

    this.montarAbas();

    const fechar = this.add
      .text(this.scale.width - 20, 16, 'Fechar  [F2]', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#e0b64a',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    fechar.on('pointerover', () => fechar.setColor(OURO));
    fechar.on('pointerout', () => fechar.setColor('#e0b64a'));
    fechar.on('pointerdown', () => this.fechar());

    this.input.keyboard.on('keydown-F2', () => this.fechar());
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.caminhoVolta.length) {
        this.caminhoVolta.pop();
        this.desenhar();
      } else {
        this.fechar();
      }
    });

    this.escalaHandler = () => {
      this.textoTitulo.setPosition(20, 16);
      this.textoStatus.setPosition(20, 44);
      fechar.setPosition(this.scale.width - 20, 16);
      this.montarAbas();
      this.desenhar();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, this.escalaHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.escalaHandler);
    });

    this.desenhar();
  }

  // ---------- estrutura ----------

  montarAbas() {
    this.areaAbas.removeAll(true);
    let x = 20;

    for (const aba of ABAS) {
      const ativa = aba.id === this.abaAtual;
      const largura = aba.label.length * 8 + 22;

      const fundo = this.add
        .rectangle(x, 72, largura, 28, ativa ? 0xd4af6a : 0x241c14)
        .setOrigin(0, 0)
        .setStrokeStyle(1, ativa ? 0x8a6a2f : 0x3a2c20)
        .setInteractive({ useHandCursor: true });

      const rotulo = this.add
        .text(x + largura / 2, 86, aba.label, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: ativa ? '#14100c' : PERGAMINHO,
        })
        .setOrigin(0.5);

      fundo.on('pointerdown', () => {
        this.abaAtual = aba.id;
        this.caminhoVolta = [];
        this.montarAbas();
        this.desenhar();
      });

      this.areaAbas.add([fundo, rotulo]);
      x += largura + 6;
    }
  }

  limparConteudo() {
    this.areaConteudo.removeAll(true);
  }

  // ---------- carregamento com cache ----------

  async carregar(chave, fn) {
    if (this.caches[chave]) return this.caches[chave];
    this.status('Carregando...');
    try {
      const dados = await fn();
      this.caches[chave] = dados;
      this.status('');
      return dados;
    } catch (erro) {
      console.error(erro);
      this.status('Erro ao carregar: ' + (erro?.message ?? erro));
      return [];
    }
  }

  status(msg) {
    this.textoStatus.setText(msg ?? '');
  }

  // ---------- redesenho ----------

  async desenhar() {
    this.limparConteudo();
    const topo = 112;

    switch (this.abaAtual) {
      case 'itens':
        return this.painelLista({
          topo,
          titulo: 'ITENS & BLOCOS',
          repo: repoItens,
          ordemPor: 'nome',
          descricao: (d) =>
            `${d.tipo ?? '?'} • uso: ${(d.uso ?? []).join(', ') || '—'} • ${d.raridade ?? 'comum'}` +
            (d.slotsUpgrade ? ` • +${d.slotsUpgrade} orbe(s)` : ''),
          campos: [
            { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
            {
              chave: 'tipo',
              rotulo: 'Tipo',
              tipo: 'select',
              opcoes: Object.values(TIPOS_ITEM),
            },
            {
              chave: 'uso',
              rotulo: 'Usos',
              tipo: 'multiselec',
              opcoes: Object.values(USOS_ITEM),
              dica: 'Extração = veio do mundo; Transformação = insumo de receita; Utilização = uso direto; Estrutura = construção.',
            },
            {
              chave: 'raridade',
              rotulo: 'Raridade',
              tipo: 'select',
              opcoes: Object.values(RARIDADES),
            },
            { chave: 'stackMax', rotulo: 'Máx por pilha', tipo: 'numero' },
            { chave: 'valor', rotulo: 'Valor (ouro)', tipo: 'numero' },
            { chave: 'nivelMin', rotulo: 'Nível mínimo', tipo: 'numero' },
            { chave: 'slotsUpgrade', rotulo: 'Slots de Orbe', tipo: 'numero' },
            { chave: 'nivelMaxUpgrade', rotulo: 'Nível máx. upgrade', tipo: 'numero' },
            {
              chave: 'tiposOrbeAceitos',
              rotulo: 'Orbes aceitos',
              tipo: 'multiselec',
              opcoes: Object.keys(FAIXAS_NIVEL_ORBE),
            },
            { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
          ],
          extra: (form, dados) => {
            const id = dados?.id ?? crypto.randomUUID();
            return {
              ...form,
              slug: (form.slug || form.nome || id)
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, ''),
            };
          },
        });

      case 'classes':
        return this.painelLista({
          topo,
          titulo: 'CLASSES & VOCAÇÕES',
          repo: repoClasses,
          ordemPor: 'nome',
          descricao: (d) =>
            `raiz ${d.nivelMin ?? 1}+ • poder ${d.poderBase ?? 40} • vida ${d.vidaBase ?? 100}` +
            (d.descricao ? '' : ' (sem descrição)'),
          campos: [
            { chave: 'nome', rotulo: 'Nome da Vocação', tipo: 'texto', obrigatorio: true },
            { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
            { chave: 'nivelMin', rotulo: 'Nível mínimo', tipo: 'numero' },
            { chave: 'vidaBase', rotulo: 'Vida base', tipo: 'numero' },
            { chave: 'poderBase', rotulo: 'Poder base', tipo: 'numero' },
            { chave: 'fis', rotulo: 'Físico base', tipo: 'numero' },
            { chave: 'men', rotulo: 'Mental base', tipo: 'numero' },
            { chave: 'soc', rotulo: 'Social base', tipo: 'numero' },
            { chave: 'cor', rotulo: 'Cor (hex)', tipo: 'texto' },
          ],
          extra: (form, dados) => {
            const id = dados?.id ?? crypto.randomUUID();
            return {
              ...form,
              slug: (form.slug || form.nome || id)
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, ''),
            };
          },
        });

      case 'talentos':
        return this.painelTalentos({ topo });

      case 'monstros':
        return this.painelLista({
          topo,
          titulo: 'MONSTROS',
          repo: repoMonstros,
          ordemPor: 'nome',
          descricao: (d) =>
            `nível ${d.faixaMin ?? 1}–${d.faixaMax ?? 5} • vida ${d.vidaMax ?? 50} • ${d.comportamento ?? 'errante'}`,
          campos: [
            { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
            { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
            { chave: 'rarefator', rotulo: 'Raridade', tipo: 'texto' },
            { chave: 'faixaMin', rotulo: 'Nível mín.', tipo: 'numero' },
            { chave: 'faixaMax', rotulo: 'Nível máx.', tipo: 'numero' },
            { chave: 'vidaMax', rotulo: 'Vida máx.', tipo: 'numero' },
            { chave: 'poderMax', rotulo: 'Poder máx.', tipo: 'numero' },
            { chave: 'fis', rotulo: 'Físico', tipo: 'numero' },
            { chave: 'men', rotulo: 'Mental', tipo: 'numero' },
            { chave: 'soc', rotulo: 'Social', tipo: 'numero' },
            { chave: 'danoBase', rotulo: 'Dano base', tipo: 'numero' },
            { chave: 'defesa', rotulo: 'Defesa', tipo: 'numero' },
            { chave: 'alcance', rotulo: 'Alcance', tipo: 'numero' },
            { chave: 'velocidade', rotulo: 'Velocidade', tipo: 'numero' },
            {
              chave: 'comportamento',
              rotulo: 'Comportamento',
              tipo: 'select',
              opcoes: Object.values(COMPORTAMENTOS_MONSTRO),
            },
            { chave: 'xpRecompensa', rotulo: 'XP de recompensa', tipo: 'numero' },
            {
              chave: 'loot',
              rotulo: 'Loot (id:chance:qtd | ...)',
              tipo: 'texto',
              dica: 'Ex.: pedra:80:2, madeira:60:3',
              parse: (v) =>
                String(v ?? '')
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p) => {
                    const [itemId, chance, qtd] = p.split(':');
                    return {
                      itemId: (itemId ?? '').trim(),
                      chance: Number(chance) || 0,
                      qtdMin: 1,
                      qtdMax: Number(qtd) || 1,
                    };
                  })
                  .filter((l) => l.itemId),
            },
          ],
          extra: (form, dados) => {
            const id = dados?.id ?? crypto.randomUUID();
            return {
              ...form,
              slug: (form.slug || form.nome || id)
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, ''),
            };
          },
        });

      case 'receitas':
        return this.painelReceitas({ topo });

      case 'reinos':
        return this.painelReinos({ topo });

      case 'conquistas':
        return this.painelConquistas({ topo });

      default:
        return undefined;
    }
  }

  // ---------- painel genérico de lista + formulário ----------

  async painelLista({ topo, titulo, repo, ordemPor, descricao, campos, extra }) {
    const itens = await this.carregar(ordemPor, () => repo.listar());

    this.areaConteudo.add(
      this.add.text(20, topo, titulo, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );

    if (!itens?.length) {
      this.areaConteudo.add(
        this.add.text(20, topo + 34, 'Nenhum registro ainda. Crie o primeiro ao lado.', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: PERGAMINHO,
        }).setAlpha(0.7),
      );
    }

    // --------- lista ---------
    let y = topo + 40;
    const larguraLista = Math.max(260, this.scale.width * 0.36);

    for (const item of itens) {
      const linha = this.add.container(20, y);
      const caixa = this.add.rectangle(0, 0, larguraLista - 14, 40, 0x1d1710).setOrigin(0, 0);
      const t1 = this.add
        .text(10, 5, String(item.nome ?? item.id), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: OURO,
        })
        .setOrigin(0, 0);
      const t2 = this.add
        .text(10, 21, String(descricao(item)).slice(0, 60), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: PERGAMINHO,
        })
        .setOrigin(0, 0)
        .setAlpha(0.75);

      caixa.setInteractive({ useHandCursor: true });
      caixa.on('pointerdown', () => {
        this.caminhoVolta.push({ tipo: 'form', campos, repo, item, extra });
        this.desenharFormulario(campos, repo, item, extra);
      });

      const apagar = this.add
        .text(larguraLista - 26, 20, 'x', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          color: '#c96a5a',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      apagar.on('pointerdown', async (p, x, y2, ev) => {
        ev.stopPropagation();
        if (!confirm(`Apagar "${item.nome ?? item.id}"?`)) return;
        try {
          await repo.remover(item.id);
          delete this.caches[ordemPor];
          this.status('Apagado.');
          this.desenhar();
        } catch (e) {
          this.status('Erro ao apagar: ' + e.message);
        }
      });

      linha.add([caixa, t1, t2, apagar]);
      this.areaConteudo.add(linha);
      y += 44;
    }

    // --------- botão novo ---------
    const btnNovo = this.add
      .text(20, y + 6, '+ Novo registro', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8fd18f',
      })
      .setInteractive({ useHandCursor: true });
    btnNovo.on('pointerdown', () => {
      this.caminhoVolta.push({ tipo: 'novo', campos, repo, item: null, extra });
      this.desenharFormulario(campos, repo, null, extra);
    });
    this.areaConteudo.add(btnNovo);

    // --------- formulário à direita (se houver) ---------
    const ultimo = this.caminhoVolta[this.caminhoVolta.length - 1];
    if (ultimo?.tipo === 'form' || ultimo?.tipo === 'novo') {
      this.desenharFormulario(ultimo.campos, ultimo.repo, ultimo.item, ultimo.extra);
    }
  }

  desenharFormulario(campos, repo, item, extra) {
    const x0 = Math.max(320, this.scale.width * 0.4);
    let y = 112;
    const camposRef = {};

    const titulo = item ? `Editar: ${item.nome ?? item.id}` : 'Novo registro';
    this.areaConteudo.add(
      this.add.text(x0, y, titulo, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );
    y += 30;

    for (const campo of campos) {
      const rot = this.add.text(x0, y, campo.rotulo + (campo.obrigatorio ? ' *' : ''), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: campo.obrigatorio ? '#e0b64a' : PERGAMINHO,
      });
      this.areaConteudo.add(rot);
      y += 17;

      const valorAtual = item?.[campo.chave];

      if (campo.tipo === 'select') {
        const opcoes = campo.opcoes ?? [];
        const atual = valorAtual ?? opcoes[0];
        let selecionado = atual;
        const rotSel = this.add.text(x0 + 14, y, String(selecionado), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: OURO,
        });
        camposRef[campo.chave] = () => selecionado;
        const seta = this.add
          .text(x0 + this.scale.width * 0.32, y, 'v', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: PERGAMINHO })
          .setInteractive({ useHandCursor: true });
        seta.on('pointerdown', () => {
          const idx = opcoes.indexOf(selecionado);
          selecionado = opcoes[(idx + 1) % opcoes.length];
          rotSel.setText(String(selecionado));
        });
        this.areaConteudo.add([rotSel, seta]);
      } else if (campo.tipo === 'multiselec') {
        const selecionados = new Set(Array.isArray(valorAtual) ? valorAtual : []);
        camposRef[campo.chave] = () => Array.from(selecionados);
        let cx = x0;
        const cy = y;
        for (const op of campo.opcoes ?? []) {
          const at = selecionados.has(op);
          const chip = this.add
            .text(cx, cy, (at ? 'x ' : '') + op, {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '11px',
              color: at ? '#14100c' : PERGAMINHO,
              backgroundColor: at ? '#d4af6a' : '#241c14',
              padding: { x: 6, y: 3 },
            })
            .setInteractive({ useHandCursor: true });
          chip.on('pointerdown', () => {
            if (selecionados.has(op)) selecionados.delete(op);
            else selecionados.add(op);
            const agora = selecionados.has(op);
            chip.setText((agora ? 'x ' : '') + op);
            chip.setColor(agora ? '#14100c' : PERGAMINHO);
            chip.setBackgroundColor(agora ? '#d4af6a' : '#241c14');
          });
          this.areaConteudo.add(chip);
          cx += chip.width + 6;
          if (cx > this.scale.width - 120) break;
        }
      } else {
        const box = this.add
          .rectangle(x0, y, 220, 24, 0x1a140e)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0x3a2c20);
        this.areaConteudo.add(box);

        const input = this.add
          .text(x0 + 8, y + 4, campo.tipo === 'texto' && Array.isArray(valorAtual) ? valorAtual.join(', ') : String(valorAtual ?? ''), {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            color: valorAtual ? PERGAMINHO : '#5a4a3a',
          })
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });

        camposRef[campo.chave] = () => input.text;
        this.areaConteudo.add(input);

        box.on('pointerdown', () => this.promptTexto(campo, input));
        input.on('pointerdown', () => this.promptTexto(campo, input));
      }

      if (campo.dica) {
        this.areaConteudo.add(
          this.add.text(x0, y + 26, campo.dica, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '10px',
            color: PERGAMINHO,
          }).setAlpha(0.5),
        );
        y += 14;
      }
      y += 34;
    }

    // coletar valores
    const coletar = () => {
      const form = {};
      for (const campo of campos) {
        let v = camposRef[campo.chave] ? camposRef[campo.chave]() : undefined;
        if (campo.tipo === 'numero') v = v === '' || v === undefined ? 0 : Number(v);
        if (campo.parse) v = campo.parse(v);
        form[campo.chave] = v;
      }
      return extra ? extra(form, item) : form;
    };

    // salvar
    const btnSalvar = this.add
      .text(x0, y + 8, item ? 'Salvar alterações' : 'Criar registro', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#14100c',
        backgroundColor: '#d4af6a',
        padding: { x: 14, y: 7 },
      })
      .setInteractive({ useHandCursor: true });

    btnSalvar.on('pointerdown', async () => {
      const form = coletar();
      const falta = campos.find((c) => c.obrigatorio && !String(form[c.chave] ?? '').trim());
      if (falta) {
        this.status('Preencha o campo: ' + falta.rotulo);
        return;
      }
      try {
        if (item) {
          await repo.salvar(item.id, form);
        } else {
          await repo.criar(form);
        }
        this.caminhoVolta = [];
        this.status('Salvo.');
        // invalida cache
        for (const k of Object.keys(this.caches)) delete this.caches[k];
        this.desenhar();
      } catch (e) {
        console.error(e);
        this.status('Erro ao salvar: ' + (e?.message ?? e));
      }
    });
    this.areaConteudo.add(btnSalvar);

    // voltar
    const btnVoltar = this.add
      .text(x0 + 180, y + 8, 'Voltar', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#c96a5a',
      })
      .setInteractive({ useHandCursor: true });
    btnVoltar.on('pointerdown', () => {
      this.caminhoVolta.pop();
      this.desenhar();
    });
    this.areaConteudo.add(btnVoltar);
  }

  promptTexto(campo, input) {
    const atual = campo.tipo === 'texto' ? input.text : '';
    const resp = window.prompt(campo.rotulo, atual);
    if (resp !== null) input.setText(resp);
  }

  // ---------- talentos (árvore) ----------

  async painelTalentos({ topo }) {
    const classes = await this.carregar('classes', () => repoClasses.listar());
    const talentos = await this.carregar('skills', () => repoSkills.listar());

    this.areaConteudo.add(
      this.add.text(20, topo, 'ÁRVORE DE TALENTOS', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );

    const x0 = Math.max(320, this.scale.width * 0.4);
    let y = 112;

    // filtro de classe
    const rot = this.add.text(x0, y, 'Classe', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: PERGAMINHO,
    });
    this.areaConteudo.add(rot);
    y += 18;

    let classeSel = this.filtroClasse ?? classes[0]?.id ?? null;
    const rotClasse = this.add.text(x0 + 14, y, String(classeSel ?? '—'), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: OURO,
    });
    const seta = this.add
      .text(x0 + this.scale.width * 0.32, y, 'v', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: PERGAMINHO })
      .setInteractive({ useHandCursor: true });
    seta.on('pointerdown', () => {
      const ids = classes.map((c) => c.id);
      const idx = ids.indexOf(classeSel);
      classeSel = ids[(idx + 1) % ids.length];
      this.filtroClasse = classeSel;
      rotClasse.setText(String(classeSel));
    });
    this.areaConteudo.add([rotClasse, seta]);
    y += 34;

    // campos de talento
    const campos = [
      { chave: 'nome', rotulo: 'Nome do talento', tipo: 'texto', obrigatorio: true },
      { chave: 'classeId', rotulo: 'Classe (id)', tipo: 'texto' },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      {
        chave: 'tipo',
        rotulo: 'Tipo',
        tipo: 'select',
        opcoes: Object.values(TIPOS_HABILIDADE),
      },
      { chave: 'nivelMin', rotulo: 'Nível mín.', tipo: 'numero' },
      { chave: 'custoPontos', rotulo: 'Custo em pontos', tipo: 'numero' },
      { chave: 'custoPoder', rotulo: 'Custo de Poder', tipo: 'numero' },
      { chave: 'ramo', rotulo: 'Ramo (cor da linha)', tipo: 'texto' },
      { chave: 'posX', rotulo: 'Posição X na árvore', tipo: 'numero' },
      { chave: 'posY', rotulo: 'Posição Y na árvore', tipo: 'numero' },
      {
        chave: 'preRequisitos',
        rotulo: 'Pré-requisitos (ids separados por vírgula)',
        tipo: 'texto',
        dica: 'Ex.: t1_vigor,t2_fisico',
        parse: (v) =>
          String(v ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      },
      {
        chave: 'efeitos',
        rotulo: 'Efeitos (chefe:valor | ...)',
        tipo: 'texto',
        dica: 'Ex.: fis:+2,vidaMax:+10',
        parse: (v) => {
          const out = {};
          for (const parte of String(v ?? '').split('|')) {
            const [k, val] = parte.split(':');
            if (!k?.trim()) continue;
            const n = Number(String(val ?? '').replace('+', ''));
            out[k.trim()] = Number.isFinite(n) ? n : String(val ?? '').trim();
          }
          return out;
        },
      },
    ];

    // lista de talentos da classe
    const daClasse = talentos.filter((t) => t.classeId === classeSel);
    let ly = topo + 40;
    for (const t of daClasse) {
      const linha = this.add.text(20, ly, `${t.nome} [${t.tipo}] • ${t.custoPontos ?? 1}pt`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: PERGAMINHO,
      })
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.85);
      linha.on('pointerover', () => linha.setColor(OURO));
      linha.on('pointerout', () => linha.setColor(PERGAMINHO));
      linha.on('pointerdown', () => {
        this.caminhoVolta.push({ tipo: 'talento' });
        this.limparConteudo();
        this.desenharFormulario(campos, repoSkills, t, (f) => f);
      });
      this.areaConteudo.add(linha);
      ly += 22;
    }

    const btnNovo = this.add
      .text(20, ly + 8, '+ Novo talento nesta classe', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8fd18f',
      })
      .setInteractive({ useHandCursor: true });
    btnNovo.on('pointerdown', () => {
      this.caminhoVolta.push({ tipo: 'talento' });
      this.limparConteudo();
      this.desenharFormulario(
        campos.map((c) => (c.chave === 'classeId' ? { ...c, valorFixo: classeSel } : c)),
        repoSkills,
        null,
        (f) => ({ ...f, classeId: classeSel }),
      );
    });
    this.areaConteudo.add(btnNovo);
  }

  // ---------- receitas ----------

  async painelReceitas({ topo }) {
    const itens = await this.carregar('items', () => repoItens.listar());
    const receitas = await this.carregar('recipes', () => repoRecipes.listar());

    this.areaConteudo.add(
      this.add.text(20, topo, 'RECETAS & MÁQUINAS', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );

    const x0 = Math.max(320, this.scale.width * 0.4);
    const campos = [
      { chave: 'nome', rotulo: 'Nome da receita', tipo: 'texto', obrigatorio: true },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      {
        chave: 'estacao',
        rotulo: 'Estação',
        tipo: 'select',
        opcoes: Object.values(ESTAÇÕES),
      },
      {
        chave: 'insumos',
        rotulo: 'Insumos (item:qtd | ...)',
        tipo: 'texto',
        dica: `Itens cadastrados: ${itens.slice(0, 6).map((i) => i.slug ?? i.nome).join(', ') || 'nenhum'}`,
        parse: (v) =>
          String(v ?? '')
            .split('|')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const [itemId, qtd] = p.split(':');
              return { itemId: (itemId ?? '').trim(), qtd: Number(qtd) || 1 };
            })
            .filter((i) => i.itemId),
      },
      {
        chave: 'saida',
        rotulo: 'Saída (item:qtd | ...)',
        tipo: 'texto',
        parse: (v) =>
          String(v ?? '')
            .split('|')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const [itemId, qtd] = p.split(':');
              return { itemId: (itemId ?? '').trim(), qtd: Number(qtd) || 1 };
            })
            .filter((i) => i.itemId),
      },
      { chave: 'tempoMs', rotulo: 'Tempo (ms)', tipo: 'numero' },
      { chave: 'custoPoder', rotulo: 'Custo de Poder', tipo: 'numero' },
      { chave: 'nivelMin', rotulo: 'Nível mín. da estação', tipo: 'numero' },
    ];

    // lista
    let y = topo + 40;
    for (const r of receitas) {
      const linha = this.add.text(20, y, `${r.nome} • ${r.estacao ?? '—'}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: PERGAMINHO,
      }).setInteractive({ useHandCursor: true }).setAlpha(0.85);
      linha.on('pointerover', () => linha.setColor(OURO));
      linha.on('pointerout', () => linha.setColor(PERGAMINHO));
      linha.on('pointerdown', () => {
        this.caminhoVolta.push({ tipo: 'receita' });
        this.limparConteudo();
        this.desenharFormulario(campos, repoRecipes, r, (f) => f);
      });
      this.areaConteudo.add(linha);
      y += 22;
    }

    const btnNovo = this.add
      .text(20, y + 8, '+ Nova receita', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8fd18f',
      })
      .setInteractive({ useHandCursor: true });
    btnNovo.on('pointerdown', () => {
      this.caminhoVolta.push({ tipo: 'receita' });
      this.limparConteudo();
      this.desenharFormulario(campos, repoRecipes, null, (f) => f);
    });
    this.areaConteudo.add(btnNovo);
  }

  // ---------- reinos ----------

  async painelReinos({ topo }) {
    const reinos = await this.carregar('reinos', () => repoWorldTemplates.listar());

    this.areaConteudo.add(
      this.add.text(20, topo, 'REINOS ETÉREOS (mundos paralelos)', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );

    const campos = [
      { chave: 'nome', rotulo: 'Nome do reino', tipo: 'texto', obrigatorio: true },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { chave: 'bioma', rotulo: 'Bioma', tipo: 'texto' },
      { chave: 'dificuldade', rotulo: 'Dificuldade (1-5)', tipo: 'numero' },
      { chave: 'faixaMin', rotulo: 'Nível mín.', tipo: 'numero' },
      { chave: 'faixaMax', rotulo: 'Nível máx.', tipo: 'numero' },
      { chave: 'seedBase', rotulo: 'Seed base', tipo: 'texto' },
      {
        chave: 'monstrosPossiveis',
        rotulo: 'Monstros possíveis (ids separados por vírgula)',
        tipo: 'texto',
        parse: (v) =>
          String(v ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      },
      {
        chave: 'lootGlobal',
        rotulo: 'Loot do mundo (item:chance:qtd | ...)',
        tipo: 'texto',
        parse: (v) =>
          String(v ?? '')
            .split('|')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const [itemId, chance, qtd] = p.split(':');
              return { itemId: (itemId ?? '').trim(), chance: Number(chance) || 0, qtdMin: 1, qtdMax: Number(qtd) || 1 };
            })
            .filter((l) => l.itemId),
      },
    ];

    let y = topo + 40;
    for (const r of reinos) {
      const linha = this.add.text(20, y, `${r.nome} • ${r.bioma ?? '—'} • nível ${r.faixaMin ?? 1}-${r.faixaMax ?? 9}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: PERGAMINHO,
      }).setInteractive({ useHandCursor: true }).setAlpha(0.85);
      linha.on('pointerover', () => linha.setColor(OURO));
      linha.on('pointerout', () => linha.setColor(PERGAMINHO));
      linha.on('pointerdown', () => {
        this.caminhoVolta.push({ tipo: 'reino' });
        this.limparConteudo();
        this.desenharFormulario(campos, repoWorldTemplates, r, (f) => f);
      });
      this.areaConteudo.add(linha);
      y += 22;
    }

    const btnNovo = this.add
      .text(20, y + 8, '+ Novo reino etéreo', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8fd18f',
      })
      .setInteractive({ useHandCursor: true });
    btnNovo.on('pointerdown', () => {
      this.caminhoVolta.push({ tipo: 'reino' });
      this.limparConteudo();
      this.desenharFormulario(campos, repoWorldTemplates, null, (f) => f);
    });
    this.areaConteudo.add(btnNovo);
  }

  // ---------- conquistas ----------

  async painelConquistas({ topo }) {
    const conq = await this.carregar('achievements', () => repoAchievements.listar());

    this.areaConteudo.add(
      this.add.text(20, topo, 'CONQUISTAS & ORBES ARCANOS', {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: OURO,
      }),
    );

    const campos = [
      { chave: 'nome', rotulo: 'Nome da conquista', tipo: 'texto', obrigatorio: true },
      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      {
        chave: 'tipo',
        rotulo: 'Tipo',
        type: 'select',
        opcoes: Object.values(TIPOS_ACHIEVEMENT),
      },
      { chave: 'chave', rotulo: 'Chave de condição (ex.: stats.portaisUsados)', tipo: 'texto' },
      { chave: 'meta', rotulo: 'Meta (número)', tipo: 'numero' },
      { chave: 'recompensaXp', rotulo: 'Recompensa XP', tipo: 'numero' },
      { chave: 'recompensaOuro', rotulo: 'Recompensa Ouro', tipo: 'numero' },
      {
        chave: 'recompensaOrbes',
        rotulo: 'Recompensa Orbes (tipo:qtd | ...)',
        tipo: 'texto',
        dica: Object.keys(FAIXAS_NIVEL_ORBE).join(', '),
        parse: (v) =>
          String(v ?? '')
            .split('|')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => {
              const [tipo, qtd] = p.split(':');
              return { tipo: (tipo ?? '').trim(), qtd: Number(qtd) || 1 };
            })
            .filter((o) => o.tipo),
      },
    ];

    let y = topo + 40;
    for (const c of conq) {
      const linha = this.add.text(20, y, `${c.nome} • ${c.tipo ?? '—'} • meta ${c.meta ?? '?'}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: PERGAMINHO,
      }).setInteractive({ useHandCursor: true }).setAlpha(0.85);
      linha.on('pointerover', () => linha.setColor(OURO));
      linha.on('pointerout', () => linha.setColor(PERGAMINHO));
      linha.on('pointerdown', () => {
        this.caminhoVolta.push({ tipo: 'conquista' });
        this.limparConteudo();
        this.desenharFormulario(campos, repoAchievements, c, (f) => f);
      });
      this.areaConteudo.add(linha);
      y += 22;
    }

    const btnNovo = this.add
      .text(20, y + 8, '+ Nova conquista', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8fd18f',
      })
      .setInteractive({ useHandCursor: true });
    btnNovo.on('pointerdown', () => {
      this.caminhoVolta.push({ tipo: 'conquista' });
      this.limparConteudo();
      this.desenharFormulario(campos, repoAchievements, null, (f) => f);
    });
    this.areaConteudo.add(btnNovo);
  }

  fechar() {
    this.scene.stop('Admin');
    if (this.scene.isPaused('World')) this.scene.resume('World');
    else if (!this.scene.isActive('World')) this.scene.start('World');
  }
}