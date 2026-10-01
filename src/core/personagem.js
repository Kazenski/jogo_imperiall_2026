// Personagem do jogador: atributos derivados, inventario, equipamentos,
// Orbes Arcanos, talentos e conquistas.
//
// Tudo aqui e PURO (sem Phaser e sem Firebase) para poder ser testado e
// reaproveitado. A persistencia vive em `progresso.js`.

import { FAIXAS_NIVEL_ORBE } from './enums.js';

// ---------- estado inicial ----------

export function inventarioInicial() {
  return {
    itens: [], // [{ uid, itemId, qtd, upgrades: [ { orbeId, nivel } ] }]
    proximoUid: 1,
    equipado: { ferramenta: null, mao: null, corpo: null, anel: null },
  };
}

export function estadoInicial() {
  return {
    atributos: { fis: 0, men: 0, soc: 0 },
    nivel: 1,
    xp: 0,
    ouro: 0,
    pontosTalento: 0,
    pontosAtributo: 0,
    vocacaoId: null,
    vida: 100,
    vidaMax: 100,
    poder: 100,
    poderMax: 100,
    inventario: inventarioInicial(),
    arvoreDesbloqueada: [],
    conquistasDesbloqueadas: [],
    orbes: {}, // { orbeId: quantidade }
    imagensPortais: {},
    base: {
      nome: 'Acampamento Imperial',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
      blocos: {}, // "x,y": { itemId, vida, vidaMax, upgrades }
    },
    stats: {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      blocosColocados: 0,
      blocosColetados: 0,
      itensColetados: 0,
      itensCriados: 0,
      diasSobrevividos: 0,
      portaisConstruidos: 0,
    },
  };
}

// ---------- atributos e derivados ----------

/** Pontos por nivel (a partir do 2). */
export function pontosPorNivel(nivel) {
  return Math.max(0, Math.floor((nivel - 1) / 2)) + Math.max(0, nivel - 1);
}

/**
 * Calcula os atributos derivados (Vida, Poder, Defesa, Regen, Carga)
 * a partir de FIS/MEN/SOC + classe + talentos.
 */
export function calcularDerivados(estado, classe, talentosAtivos = []) {
  const base = { fis: 5, men: 5, soc: 5 };
  const extras = (chave) =>
    talentosAtivos.reduce((soma, t) => soma + (Number(t.efeitos?.[chave]) || 0), 0);

  const bonus = classe?.bonusPorNivel ?? {};
  const nivel = estado.nivel ?? 1;

  const fis = base.fis + (estado.atributos?.fis ?? 0) + (classe?.fis ?? 0) + extras('fis')
    + (bonus.fis ?? 0) * (nivel - 1);
  const men = base.men + (estado.atributos?.men ?? 0) + (classe?.men ?? 0) + extras('men')
    + (bonus.men ?? 0) * (nivel - 1);
  const soc = base.soc + (estado.atributos?.soc ?? 0) + (classe?.soc ?? 0) + extras('soc')
    + (bonus.soc ?? 0) * (nivel - 1);

  // Escalas: FIS pesa em Vida e Defesa, MEN em Poder, SOC em suporte/carga.
  let vidaMax = 80 + fis * 8 + (classe?.vidaBase ?? 100) * 0.35 + extras('vidaMax')
    + (bonus.vidaMax ?? 0) * (nivel - 1);
  let poderMax = 60 + men * 7 + (classe?.poderBase ?? 40) * 0.5 + extras('poderMax')
    + (bonus.poderMax ?? 0) * (nivel - 1);

  const defesa = Math.floor(fis * 1.2 + extras('defesa') + (bonus.defesa ?? 0) * (nivel - 1));
  const regen = Math.floor(0.6 + men * 0.12 + extras('regenVida'));
  const regenPoder = Math.floor(2 + men * 0.45 + extras('regenPoder'));
  const carga = 100 + soc * 12 + extras('carga');
  const poderMineracao = 3 + fis * 0.4 + soc * 0.2 + extras('poderMineracao')
    + (bonus.poderMineracao ?? 0) * (nivel - 1);

  // Percentuais dos talentos
  const somaPct = (chave) => talentosAtivos.reduce((s, t) => s + (Number(t.efeitos?.[chave]) || 0), 0);
  const poderPct = somaPct('poderPct');
  const xpPct = somaPct('xpPct');
  const vendaPct = somaPct('vendaPct');
  const reducaoDanoPct = somaPct('reducaoDanoPct');
  const ouroBonus = somaPct('ouroBonus') + extras('ouroBonus');

  if (poderPct) poderMax = Math.floor(poderMax * (1 + poderPct / 100));
  if (xpPct) { /* aplicado no ganho de XP */ }

  return {
    fis: Math.floor(fis),
    men: Math.floor(men),
    soc: Math.floor(soc),
    vidaMax: Math.floor(vidaMax),
    poderMax: Math.floor(poderMax),
    defesa,
    regen,
    regenPoder,
    carga: Math.floor(carga),
    poderMineracao: Math.floor(poderMineracao),
    pct: { poderPct, xpPct, vendaPct, reducaoDanoPct, ouroBonus },
    alcanceConstrucao: 2 + extras('alcanceConstrucao'),
    velocidadeMaquinaPct: extras('velocidadeMaquinaPct'),
    escudoPct: extras('escudoPct'),
    reparo: extras('reparo'),
  };
}

/** Aplica os percentuais de XP/Ouro ao ganho bruto. */
export function aplicarBônus(derivados, { xp = 0, ouro = 0, emPortal = false, xpPortalPct = 0 }) {
  let xpFinal = xp * (1 + derivados.pct.xpPct / 100);
  if (emPortal) xpFinal *= 1 + xpPortalPct / 100;
  const ouroFinal = ouro * (1 + derivados.pct.ouroBonus / 100);
  return { xp: Math.floor(xpFinal), ouro: Math.floor(ouroFinal) };
}

// ---------- inventario ----------

export function novoUidInventario(inv) {
  const uid = inv.proximoUid ?? 1;
  inv.proximoUid = uid + 1;
  return uid;
}

/** Adiciona itens, empilhando quando possivel. */
export function adicionarItem(inv, itemId, qtd = 1, stackMax = 999, upgrades = []) {
  inv.itens ??= [];
  if (upgrades?.length) {
    // Itens com upgrade nunca empilham: cada pilha tem seu proprio historico.
    for (let i = 0; i < qtd; i += 1) {
      inv.itens.push({
        uid: novoUidInventario(inv),
        itemId,
        qtd: 1,
        upgrades: upgrades.map((u) => ({ ...u })),
      });
    }
    return inv;
  }

  const existente = inv.itens.find((p) => p.itemId === itemId && !p.upgrades?.length);
  if (existente && existente.qtd + qtd <= stackMax) {
    existente.qtd += qtd;
    return inv;
  }

  inv.itens.push({ uid: novoUidInventario(inv), itemId, qtd, upgrades: [] });
  return inv;
}

export function removerItem(inv, uid, qtd = Infinity) {
  const pilha = inv.itens?.find((p) => p.uid === uid);
  if (!pilha) return 0;
  const removido = Math.min(pilha.qtd, qtd);
  pilha.qtd -= removido;
  if (pilha.qtd <= 0) {
    inv.itens = inv.itens.filter((p) => p.uid !== uid);
  }
  return removido;
}

export function contarItem(inv, itemId) {
  return (inv.itens ?? []).reduce((s, p) => (p.itemId === itemId ? s + p.qtd : s), 0);
}

export function temItem(inv, itemId, qtd = 1) {
  return contarItem(inv, itemId) >= qtd;
}

/** Consome uma quantidade, preferindo pilhas com menos upgrades. */
export function consumirItem(inv, itemId, qtd = 1) {
  let restante = qtd;
  const ordenadas = [...(inv.itens ?? [])]
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => (a.upgrades?.length ?? 0) - (b.upgrades?.length ?? 0));

  for (const pilha of ordenadas) {
    if (restante <= 0) break;
    const consumo = Math.min(pilha.qtd, restante);
    removerItem(inv, pilha.uid, consumo);
    restante -= consumo;
  }
  return qtd - restante;
}

export function slotsUsados(inv) {
  return (inv.itens ?? []).length;
}

// ---------- Orbes Arcanos ----------

export function faixaDoOrbe(orbeId) {
  return FAIXAS_NIVEL_ORBE[orbeId] ?? null;
}

/** O orbe e compativel com o nivel atual do item? */
export function orbeAceito(orbeId, nivelItem) {
  const faixa = faixaDoOrbe(orbeId);
  if (!faixa) return false;
  return nivelItem >= faixa.min && nivelItem <= faixa.max;
}

export function nivelDeUpgrades(pilha) {
  return (pilha.upgrades ?? []).reduce((s, u) => s + (u.nivel ?? 0), 0);
}

/**
 * Aplica um Orbe Arcano numa pilha.
 *
 * Regras:
 *  - a faixa do Orbe precisa cobrir o NIVEL DO JOGADOR (sao tiers de progressao:
 *    Orbe Menor ate o nivel 10, Medio ate o 25, e assim por diante);
 *  - a pilha tem um numero limitado de slots;
 *  - `nivelMaxUpgrade` limita quantas vezes o item pode ser reforçado.
 *
 * @param {object} pilha pilha do inventario
 * @param {string} orbeId
 * @param {number} [slotsUpgrade]
 * @param {number} [nivelMaxUpgrade]
 * @param {number} [nivelJogador] nivel do jogador, usado para validar a faixa
 * @returns {{ok: boolean, motivo?: string, nivel?: number}}
 */
export function aplicarOrbe(pilha, orbeId, slotsUpgrade, nivelMaxUpgrade, nivelJogador) {
  const faixa = faixaDoOrbe(orbeId);
  if (!faixa) return { ok: false, motivo: 'Orbe desconhecido.' };

  if (nivelJogador !== undefined && !orbeAceito(orbeId, nivelJogador)) {
    return {
      ok: false,
      motivo: `Orbe exige nivel entre ${faixa.min} e ${faixa === FAIXAS_NIVEL_ORBE[orbeId] && faixa.max === 999 ? '999' : faixa.max}.`,
    };
  }

  // Cada aplicacao consome um slot (Orbes do mesmo tipo empilham no mesmo slot,
  // mas ainda assim contam para o limite).
  const usados = nivelDeUpgrades(pilha);
  if (slotsUpgrade !== undefined && usados >= slotsUpgrade) {
    return { ok: false, motivo: 'Todos os slots de Orbe estao preenchidos.' };
  }

  const nivel = nivelDeUpgrades(pilha);
  if (nivelMaxUpgrade !== undefined && nivel >= nivelMaxUpgrade) {
    return { ok: false, motivo: 'Item ja esta no nivel maximo de upgrade.' };
  }

  pilha.upgrades ??= [];
  const existente = pilha.upgrades.find((u) => u.orbeId === orbeId);
  if (existente) existente.nivel = (existente.nivel ?? 0) + 1;
  else pilha.upgrades.push({ orbeId, nivel: 1 });

  return { ok: true, nivel: nivelDeUpgrades(pilha) };
}

/** Estatisticas finais de um item considerando upgrades. */
export function estatisticasComUpgrades(item, pilha) {
  const n = nivelDeUpgrades(pilha ?? { upgrades: [] });
  const resultado = { ...(item ?? {}) };
  const camposEscalaveis = [
    'defesa', 'vidaMax', 'poderMax', 'poderMineracao', 'danoBase', 'curaVida',
  ];

  for (const campo of camposEscalaveis) {
    const valor = Number(item?.[campo]);
    if (Number.isFinite(valor) && valor) {
      resultado[campo] = Math.floor(valor * (1 + n * 0.18));
    }
  }

  for (const campo of ['fis', 'men', 'soc']) {
    const valor = Number(item?.[campo]);
    if (Number.isFinite(valor) && valor) {
      resultado[campo] = Math.floor(valor + n * Math.ceil(valor * 0.08));
    }
  }

  resultado.nivelOrbe = n;
  return resultado;
}

// ---------- equipamentos ----------

export const SLOTS = ['ferramenta', 'mao', 'corpo', 'anel'];

/** Some os bonus de todos os itens equipados (ja com upgrades). */
export function bonusEquipados(estado, catalogo) {
  const bonus = {
    defesa: 0, vidaMax: 0, poderMax: 0, poderMineracao: 0,
    fis: 0, men: 0, soc: 0, carga: 0, alcanceConstrucao: 0,
  };

  for (const slot of SLOTS) {
    const uid = estado.inventario?.equipado?.[slot];
    if (!uid) continue;
    const pilha = estado.inventario.itens?.find((p) => p.uid === uid);
    if (!pilha) continue;
    const def = catalogo?.indice?.itens?.[pilha.itemId];
    if (!def) continue;
    const stats = estatisticasComUpgrades(def, pilha);
    for (const chave of Object.keys(bonus)) {
      bonus[chave] += Number(stats?.[chave]) || 0;
    }
  }

  return bonus;
}

// ---------- talentos ----------

export function talentoDisponivel(estado, talento, arvore) {
  if (!talento) return false;
  if ((arvore ?? estado.arvoreDesbloqueada ?? []).includes(talento.id)) return false;
  if (estado.nivel < (talento.nivelMin ?? 1)) return false;
  if (talento.classeId && talento.classeId !== estado.vocacaoId) return false;

  const arvoreAtual = arvore ?? estado.arvoreDesbloqueada ?? [];
  const pre = talento.preRequisitos ?? [];
  return pre.every((id) => arvoreAtual.includes(id));
}

export function talentosAtivos(catalogo, estado) {
  const arvore = estado.arvoreDesbloqueada ?? [];
  return arvore
    .map((id) => catalogo?.indice?.skills?.[id])
    .filter(Boolean);
}

export function custoTalento(talento) {
  return Number(talento?.custoPontos) || 1;
}

/** Desbloqueia um talento. Devolve {ok, motivo}. */
export function desbloquearTalento(estado, talento, catalogo) {
  if (!talento) return { ok: false, motivo: 'Talento inexistente.' };
  const arvore = estado.arvoreDesbloqueada ?? [];
  if (arvore.includes(talento.id)) return { ok: false, motivo: 'Talento ja desbloqueado.' };
  if (estado.nivel < (talento.nivelMin ?? 1)) {
    return { ok: false, motivo: `Requer nivel ${talento.nivelMin}.` };
  }
  if (talento.classeId && talento.classeId !== estado.vocacaoId) {
    return { ok: false, motivo: 'Talento de outra vocacao.' };
  }
  for (const id of talento.preRequisitos ?? []) {
    if (!arvore.includes(id)) {
      return { ok: false, motivo: 'Pre-requisito ausente.' };
    }
  }
  const custo = custoTalento(talento);
  if ((estado.pontosTalento ?? 0) < custo) {
    return { ok: false, motivo: `Faltam pontos (custo ${custo}).` };
  }

  estado.arvoreDesbloqueada = [...arvore, talento.id];
  estado.pontosTalento = (estado.pontosTalento ?? 0) - custo;
  return { ok: true };
}

/** Devolve todos os pontos de talento (respec). */
export function redefinirArvore(estado, catalogo) {
  let devolvidos = 0;
  const ativos = talentosAtivos(catalogo, estado);
  for (const t of ativos) devolvidos += custoTalento(t);
  estado.arvoreDesbloqueada = [];
  estado.pontosTalento = (estado.pontosTalento ?? 0) + devolvidos;
  return devolvidos;
}

// ---------- conquistas ----------

function lerCaminho(objeto, caminho) {
  return String(caminho ?? '')
    .split('.')
    .reduce((acc, parte) => (acc == null ? acc : acc[parte]), objeto);
}

export function avaliarConquistas(catalogo, estado) {
  const novas = [];
  const contexto = { ...estado, nivel: estado.nivel ?? 1 };
  const jaFeitas = new Set(estado.conquistasDesbloqueadas ?? []);

  for (const c of catalogo?.achievements ?? []) {
    if (jaFeitas.has(c.id)) continue;
    const atual = Number(lerCaminho(contexto, c.chave)) || 0;
    if (atual >= (c.meta ?? 1)) novas.push(c);
  }

  return novas;
}

export function aplicarConquistas(estado, conquistas) {
  if (!conquistas.length) return null;
  estado.conquistasDesbloqueadas = [
    ...new Set([...(estado.conquistasDesbloqueadas ?? []), ...conquistas.map((c) => c.id)]),
  ];
  const orbes = {};
  let ouro = 0;
  let xp = 0;
  for (const c of conquistas) {
    xp += c.recompensaXp ?? 0;
    ouro += c.recompensaOuro ?? 0;
    for (const o of c.recompensaOrbes ?? []) {
      orbes[o.tipo] = (orbes[o.tipo] ?? 0) + (o.qtd ?? 1);
    }
  }
  return { xp, ouro, orbes };
}

/** Soma dos numeros de um item no estado: { orbeId: qtd }. */
export function somarMapas(...mapas) {
  const saida = {};
  for (const mapa of mapas) {
    for (const [k, v] of Object.entries(mapa ?? {})) {
      saida[k] = (saida[k] ?? 0) + (Number(v) || 0);
    }
  }
  return saida;
}

// ---------- consumiveis ----------

export function consumirConsumivel(estado, item) {
  const resultado = { vida: 0, poderMax: 0 };
  if (item?.curaVida) {
    estado.vida = Math.min(estado.vidaMax ?? 100, (estado.vida ?? 0) + item.curaVida);
    resultado.vida = item.curaVida;
  }
  if (item?.poderMax) {
    estado.poderMax = (estado.poderMax ?? 0) + item.poderMax;
    resultado.poderMax = item.poderMax;
  }
  return resultado;
}
