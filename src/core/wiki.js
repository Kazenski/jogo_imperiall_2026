// Wiki: o que dá para fazer com um item.
//
// POR QUE ISTO É UM MÓDULO SEPARADO DA CENA
//
// A resposta é um cruzamento de coleções: um item aparece como `saida` de uma
// receita, como `insumos` de outra, como `loot` de um monstro, como `loja` de um
// NPC, como `recursos` de um chunk, dentro de um `conteudoBaus`. Cada uma tem
// um formato diferente, e um erro de join aqui produz "nenhuma receita usa
// ferro" — que é silencioso e parece um dado faltando, não um bug.
//
// Então a lógica fica aqui, pura, sem Phaser, e é testada direto. A cena só
// desenha o que este arquivo devolve.
//
// TOLERÂNCIA A FORMATO
//
// Todo campo de lista (`insumos`, `loot`, `loja`, `conteudoBaus`) pode chegar de
// duas formas: como ARRAY (o que o painel grava, já parseado) ou como TEXTO
// (`ferro:3, madeira:2`, o que alguém digitou à mão ou um documento antigo).
// `normalizarLista` aceita as duas. Um wiki que só lê array mostra lista vazia
// justamente nos documentos que o jogador mais precisa ver.

import { ROTULOS_ESTACAO } from '../dados/schemaAdmin.js';

// =====================================================================
// Normalização de listas
// =====================================================================

/**
 * Converte um campo de lista em `[{ itemId, qtd, chance }]`.
 *
 * Aceita array de objetos, array de strings, ou texto separado por vírgula,
 * barra ou ponto-e-vírgula. O número de campos é deduzido pelo que existe:
 *
 *   `item:chance:qtd`  → loot de monstro, baú   (o meio é chance de 0 a 100)
 *   `item:qtd`          → insumo, saída, loja   (o meio é quantidade)
 *
 * Deduzir pelo MEIO e não pela chave é o que faz `loja` (item:qtd:preco) cair
 * em `item:chance:qtd` e mostrar "chance 500". Por isso `preco` é lido pelo
 * último campo quando a chave é conhecida.
 */
export function normalizarLista(valor, { preco = false } = {}) {
  const partes = [];

  if (Array.isArray(valor)) {
    for (const v of valor) {
      if (typeof v === 'string') partes.push(v);
      else if (v && typeof v === 'object' && v.itemId) partes.push(v);
    }
  } else if (typeof valor === 'string') {
    for (const p of valor.split(/[|;,\n]/)) {
      const t = p.trim();
      if (t) partes.push(t);
    }
  }

  const saida = [];
  for (const p of partes) {
    if (typeof p === 'object') {
      saida.push({
        itemId: String(p.itemId).trim(),
        qtd: Number(p.qtdMax ?? p.qtd ?? 1) || 1,
        chance: Number(p.chance ?? 0) || 0,
        preco: p.preco != null ? Number(p.preco) || 0 : null,
      });
      continue;
    }

    const campos = String(p).split(':').map((s) => s.trim());
    const itemId = (campos[0] ?? '').trim();
    if (!itemId) continue;

    if (preco) {
      // `item:qtd:preco`
      saida.push({
        itemId,
        qtd: Number(campos[1]) || 1,
        chance: 0,
        preco: Number(campos[2]) || 0,
      });
      continue;
    }

    if (campos.length >= 3) {
      // `item:chance:qtd`
      saida.push({ itemId, chance: Number(campos[1]) || 0, qtd: Number(campos[2]) || 1, preco: null });
    } else {
      saida.push({ itemId, chance: 0, qtd: Number(campos[1]) || 1, preco: null });
    }
  }

  return saida;
}

/** Normaliza a lista de loot de baú, que vem agrupada por baú. */
export function normalizarConteudoBaus(valor) {
  if (!Array.isArray(valor)) {
    // Texto puro: `bauId:itemId:chance:qtd`
    const porBau = new Map();
    for (const p of String(valor ?? '').split(/[|;,\n]/)) {
      const campos = p.split(':').map((s) => s.trim());
      if (campos.length < 4 || !campos[0] || !campos[1]) continue;
      if (!porBau.has(campos[0])) porBau.set(campos[0], []);
      porBau.get(campos[0]).push({
        itemId: campos[1],
        chance: Number(campos[2]) || 0,
        qtd: Number(campos[3]) || 1,
        preco: null,
      });
    }
    return [...porBau.entries()].map(([bauId, itens]) => ({ bauId, itens }));
  }

  return valor
    .filter((b) => b && b.bauId)
    .map((b) => ({ bauId: b.bauId, itens: normalizarLista(b.itens) }));
}

const lista = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

// =====================================================================
// Cruzamento
// =====================================================================

/**
 * Tudo o que dá para fazer com um item.
 *
 * Devolve sempre as mesmas chaves — mesmo vazias. A cena precisa poder dizer
 * "nenhuma receita usa isto" sem checar se a chave existe.
 *
 * @param {object} catalogo  o catálogo já carregado
 * @param {string} itemId
 * @returns {{
 *   item: object|null,
 *   producao: Array<object>,
 *   consumo: Array<object>,
 *   ondeEncontrar: Array<object>,
 *   propriedades: Array<[string, string]>,
 * }}
 */
export function referenciasDoItem(catalogo, itemId) {
  const cat = catalogo ?? {};
  const id = String(itemId ?? '').trim();
  const item = lista(cat.itens).find((i) => i.id === id) ?? null;

  const vazio = {
    item,
    producao: [],
    consumo: [],
    ondeEncontrar: [],
    propriedades: [],
  };
  if (!id) return vazio;

  // Nome legível de um item, com dois cuidado.
//
//  1. Item que NÃO está no catálogo: mostra o id com a primeira letra
//     maiúscula, em vez do id cru. `agua` na tela parece texto quebrado;
//     `Agua` parece um item.
//  2. E marca `desconhecido`, porque um insumo apontando para um item
//     inexistente é DADO QUEBRADO — e o painel não avisa. O wiki passa a
//     dizer isso na tela, que é onde o jogador (e o admin) vão olhar.
  const tabelaItens = new Map(lista(cat.itens).map((i) => [i.id, i]));
  const arranhar = (s) => String(s ?? '').replace(/[_.]/g, ' ');
  const capitalizar = (s) => {
    const t = arranhar(s);
    return t ? t[0].toUpperCase() + t.slice(1) : '';
  };
  const nomeDeItem = (x) => tabelaItens.get(x)?.nome ?? capitalizar(x);
  const desconhecido = (x) => !tabelaItens.has(x);
  const nomeDeReceita = (x) => x?.nome ?? x?.id ?? 'receita';
  const rotuloEstacao = (e) => ROTULOS_ESTACAO[e] ?? e ?? '—';

  // ---------- 1. Receitas que produzem ----------
  for (const r of lista(cat.recipes)) {
    for (const s of normalizarLista(r.saida)) {
      if (s.itemId !== id) continue;
      vazio.producao.push({
        receitaId: r.id,
        receita: nomeDeReceita(r),
        descricao: r.descricao ?? '',
        estacao: rotuloEstacao(r.estacao),
        nivelMin: Number(r.nivelMin) || 1,
        segundos: Math.round((Number(r.tempoMs) || 0) / 100) / 10,
        custoPoder: Number(r.custoPoder) || 0,
        quantidade: s.qtd,
      });
    }
  }

  // ---------- 2. Receitas que consomem ----------
  for (const r of lista(cat.recipes)) {
    const insumos = normalizarLista(r.insumos);
    const usa = insumos.find((i) => i.itemId === id);
    if (!usa) continue;
    vazio.consumo.push({
      receitaId: r.id,
      receita: nomeDeReceita(r),
      descricao: r.descricao ?? '',
      estacao: rotuloEstacao(r.estacao),
      nivelMin: Number(r.nivelMin) || 1,
      quantidade: usa.qtd,
      outros: insumos
        .filter((i) => i.itemId !== id)
        .map((i) => ({ nome: nomeDeItem(i.itemId), qtd: i.qtd, desconhecido: desconhecido(i.itemId) })),
    });
  }

  // ---------- 3. Onde encontrar ----------
  // Mundo (recursos abundantemente distribuídos)
  for (const m of lista(cat.worldTemplates)) {
    if (lista(m.recursosAbundantes).includes(id)) {
      vazio.ondeEncontrar.push({
        tipo: 'mundo',
        titulo: m.nome ?? m.id,
        detalhe: 'recurso abundante',
        item: nomeDeItem(id),
      });
    }
  }

  // Biomas
  for (const b of lista(cat.biomas)) {
    const grupos = [
      ['blocosNativos', 'bloco nativo'],
      ['blocosSuperficie', 'superfície'],
      ['blocosSubSolo', 'subsolo'],
    ];
    for (const [campo, rotulo] of grupos) {
      if (lista(b[campo]).includes(id)) {
        vazio.ondeEncontrar.push({
          tipo: 'bioma',
          titulo: b.nome ?? b.id,
          detalhe: rotulo,
          item: nomeDeItem(id),
        });
      }
    }
  }

  // Chunks: recursos, blocos do terreno, baús e itens no chão
  for (const c of lista(cat.chunks)) {
    const onde = c.mundoId ? lista(cat.worldTemplates).find((m) => m.id === c.mundoId)?.nome : null;
    const rotulo = `${c.nome ?? c.id}${onde ? ` (${onde})` : ''}`;

    for (const [campo, texto] of [
      ['recursos', 'nó de recurso'],
      ['blocosNativos', 'bloco nativo'],
      ['blocosSuperficie', 'superfície'],
      ['blocosSubSolo', 'subsolo'],
    ]) {
      if (lista(c[campo]).includes(id)) {
        vazio.ondeEncontrar.push({ tipo: 'chunk', titulo: rotulo, detalhe: texto, item: nomeDeItem(id) });
      }
    }

    for (const bau of normalizarConteudoBaus(c.conteudoBaus)) {
      const achado = bau.itens.find((i) => i.itemId === id);
      if (!achado) continue;
      vazio.ondeEncontrar.push({
        tipo: 'bau',
        titulo: rotulo,
        detalhe: `baú ${bau.bauId}`,
        chance: achado.chance,
        quantidade: achado.qtd,
        item: nomeDeItem(id),
      });
    }

    for (const i of normalizarLista(c.itensChao)) {
      if (i.itemId !== id) continue;
      vazio.ondeEncontrar.push({
        tipo: 'itemChao',
        titulo: rotulo,
        detalhe: 'item no chão',
        quantidade: i.qtd,
        item: nomeDeItem(id),
      });
    }
  }

  // Monstros: loot
  for (const m of lista(cat.monsters)) {
    for (const l of normalizarLista(m.loot)) {
      if (l.itemId !== id) continue;
      vazio.ondeEncontrar.push({
        tipo: 'monstro',
        titulo: m.nome ?? m.id,
        detalhe: 'dropa ao matar',
        chance: l.chance,
        quantidade: l.qtd,
        nivel: Number(m.faixaMin) || 1,
        item: nomeDeItem(id),
      });
    }
  }

  // NPCs: loja
  for (const n of lista(cat.npcs)) {
    for (const l of normalizarLista(n.loja, { preco: true })) {
      if (l.itemId !== id) continue;
      vazio.ondeEncontrar.push({
        tipo: 'loja',
        titulo: n.nome ?? n.id,
        detalhe: 'vende',
        preco: l.preco,
        quantidade: l.qtd,
        mundo: n.mundoId ? lista(cat.worldTemplates).find((m) => m.id === n.mundoId)?.nome : null,
        item: nomeDeItem(id),
      });
    }
  }

  return { ...vazio, propriedades: propriedadesDoItem(item, cat) };
}

/** Atributos do item, na ordem em que o jogador procura. */
export function propriedadesDoItem(item, catalogo = {}) {
  if (!item) return [];

  const linhas = [];
  const add = (rotulo, valor) => {
    if (valor === null || valor === undefined || valor === '' || valor === 0) return;
    linhas.push([rotulo, String(valor)]);
  };

  add('Tipo', item.tipo);
  add('Raridade', item.raridade);
  add('Nível mínimo', item.nivelMin);
  add('Uso', lista(item.uso).join(', '));
  add('Dano', item.dano);
  add('Defesa', item.defesa);
  add('Vida máx.', item.vidaMax);
  add('Poder máx.', item.poderMax);
  add('Alcance', item.alcance);
  add('Velocidade', item.velocidade);
  add('Slots de orbe', item.slotsUpgrade);
  add('Tempo deominated', item.tempoEstragarSegundos);
  add('Estoque empilhável', item.empilhavel);

  if (item.perecivel) linhas.push(['Perecível', 'sim — estraga com o tempo']);

  const efeitos = Object.entries(item.efeitos ?? {});
  for (const [k, v] of efeitos) linhas.push([k, `${Number(v) >= 0 ? '+' : ''}${v}`]);

  const bonus = Object.entries(item.bonusPorNivel ?? {});
  for (const [k, v] of bonus) linhas.push([`Por nível: ${k}`, `${Number(v) >= 0 ? '+' : ''}${v}`]);

  const req = lista(item.preRequisitos).map(
    (id) => lista(catalogo.skills).find((t) => t.id === id)?.nome ?? id,
  );
  if (req.length) linhas.push(['Pré-requisitos', req.join(', ')]);

  return linhas;
}