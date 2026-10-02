// Regras de jogo: combate, mineracao, construcao, fabricacao, Orbes e
// conquistas. Tudo puro (sem Phaser) para ser testavel.
//
// Cada `acao` recebe o estado do jogador e devolve o novo estado mais um
// resumo do que aconteceu, para a cena poder mostrar toasts e salvar.

import {
  adicionarItem,
  removerItem,
  consumirItem,
  contarItem,
  aplicarOrbe,
  nivelDeUpgrades,
  estatisticasComUpgrades,
  consumirConsumivel,
  avaliarConquistas,
  aplicarConquistas,
  somarMapas,
} from './personagem.js';
import { colocarBloco, danificarBloco, chaveBloco } from './mundo.js';

// ---------- combate ----------

/**
 * Calcula o dano de um golpe do jogador contra um alvo.
 * @returns {number} dano final (ja com reducao de defesa)
 */
export function calcularDano({ poder, fis = 0, men = 0, defesaAlvo = 0, multiplicador = 1, criticoPct = 0 }) {
  const base = (poder ?? 0) * 0.5 + fis * 1.6 + men * 1.9;
  let dano = base * (multiplicador ?? 1);
  const critico = criticoPct > 0 && Math.random() * 100 < criticoPct;
  if (critico) dano *= 1.8;
  dano -= defesaAlvo * 0.6;
  return { dano: Math.max(1, Math.floor(dano)), critico };
}

/** Dano que o jogador recebe, ja considerando reducao e escudo. */
export function calcularDanoRecebido({ dano, reducaoPct = 0, escudoPct = 0, defesa = 0 }) {
  let d = Math.max(0, (dano ?? 0) - defesa * 0.35);
  if (reducaoPct) d *= 1 - reducaoPct / 100;
  if (escudoPct) d *= 1 - escudoPct / 100;
  return Math.max(0, Math.floor(d));
}

/** Spend de Poder. Devolve true/false. */
export function gastarPoder(estado, quantidade) {
  const custo = Math.max(0, Math.floor(quantidade ?? 0));
  if ((estado.poder ?? 0) < custo) return false;
  estado.poder -= custo;
  return true;
}

// ---------- mineracao ----------

/**
 * Extrai um no de recurso do mundo e devolve o que caiu no inventario.
 * @returns {{ok: boolean, motivo?: string, ganhos?: Array<{itemId:string,qtd:number}>, xp?: number}}
 */
export function minerar({ catalogo, estado, itemId, forcaMineracao }) {
  const def = catalogo?.indice?.itens?.[itemId];
  if (!def) return { ok: false, motivo: 'Recurso desconhecido.' };
  if ((estado.nivel ?? 1) < (def.nivelMin ?? 1)) {
    return { ok: false, motivo: `Requer nivel ${def.nivelMin}.` };
  }

  const multiplicador = (forcaMineracao ?? 1) * (def.resistMineracao ?? 1);
  const qtdMin = 1;
  const qtdMax = Math.max(1, Math.round(2 + multiplicador * 0.5));
  const qtd = qtdMin + Math.floor(Math.random() * (qtdMax - qtdMin + 1));

  adicionarItem(estado.inventario, itemId, qtd, def?.stackMax ?? 1000, [], def?.perecivel ?? false, def?.tempoEstragarSegundos ?? 0);
  estado.stats.blocosColetados = (estado.stats.blocosColetados ?? 0) + 1;
  estado.stats.itensColetados = (estado.stats.itensColetados ?? 0) + qtd;

  return { ok: true, ganhos: [{ itemId, qtd }], xp: 4 + Math.round(multiplicador * 2) };
}

/**
 * Minera um bloco que o jogador colocou na base (recupera parte do material).
 */
export function derrubarBlocoDaBase({ estado, catalogo, col, linha }) {
  const chave = chaveBloco(col, linha);
  const bloco = estado.base?.blocos?.[chave];
  if (!bloco) return { ok: false, motivo: 'Nao ha bloco aqui.' };

  const destruido = danificarBloco(estado.base, col, linha, bloco.vidaMax * 2);
  if (!destruido) return { ok: false, motivo: 'Bloco resistiu.' };

  const def = catalogo?.indice?.itens?.[destruido.itemId];
  const qtd = 1;
  adicionarItem(estado.inventario, destruido.itemId, qtd, def?.stackMax ?? 1000, destruido.upgrades ?? [], def?.perecivel ?? false, def?.tempoEstragarSegundos ?? 0);
  estado.stats.blocosColetados = (estado.stats.blocosColetados ?? 0) + 1;
  return { ok: true, ganhos: [{ itemId: destruido.itemId, qtd }], xp: 2 };
}

// ---------- construcao ----------

/**
 * Coloca um bloco na base. Consome o item do inventario.
 */
export function construir({ estado, catalogo, col, linha, itemId, alcance }) {
  const def = catalogo?.indice?.itens?.[itemId];
  if (!def) return { ok: false, motivo: 'Item desconhecido.' };
  if (!def.uso?.includes('estrutura') && def.tipo !== 'estrutura') {
    return { ok: false, motivo: `${def.nome} nao serve para construcao.` };
  }
  if ((estado.nivel ?? 1) < (def.nivelMin ?? 1)) {
    return { ok: false, motivo: `Requer nivel ${def.nivelMin}.` };
  }
  if (contarItem(estado.inventario, itemId) < 1) {
    return { ok: false, motivo: 'Voce nao tem este bloco.' };
  }

  const limiteX = Math.max(6, alcance ?? 3) * 2;
  const limiteY = Math.max(6, alcance ?? 3) * 2;
  if (Math.abs(col) > limiteX || Math.abs(linha) > limiteY) {
    return { ok: false, motivo: 'Longe demais da sua base.' };
  }

  const chave = chaveBloco(col, linha);
  if (estado.base?.blocos?.[chave]) {
    return { ok: false, motivo: 'Ja existe um bloco aqui.' };
  }

  consumirItem(estado.inventario, itemId, 1);
  const vida = def.vidaBloco ?? 100;
  colocarBloco(estado.base, col, linha, itemId, vida);
  estado.stats.blocosColocados = (estado.stats.blocosColocados ?? 0) + 1;

  return { ok: true, xp: 5 };
}

// ---------- fabricacao ----------

/**
 * Verifica se a receita pode ser executada agora.
 * @returns {{ok: boolean, motivo?: string}}
 */
export function podeFabricar({ catalogo, estado, receitaId, nivelEstacao = 1 }) {
  const receita = catalogo?.indice?.recipes?.[receitaId];
  if (!receita) return { ok: false, motivo: 'Receita desconhecida.' };
  if ((receita.nivelMin ?? 1) > (nivelEstacao ?? 1)) {
    return { ok: false, motivo: `Estacao precisa de nivel ${receita.nivelMin}.` };
  }
  for (const insumo of receita.insumos ?? []) {
    if (contarItem(estado.inventario, insumo.itemId) < (insumo.qtd ?? 1)) {
      const def = catalogo.indice.itens[insumo.itemId];
      return { ok: false, motivo: `Falta ${def?.nome ?? insumo.itemId} (${insumo.qtd}).` };
    }
  }
  if ((receita.custoPoder ?? 0) > (estado.poder ?? 0)) {
    return { ok: false, motivo: `Poder insuficiente (${receita.custoPoder}).` };
  }
  return { ok: true };
}

/**
 * Executa uma receita: consome insumos, produz a saida.
 * @returns {{ok:boolean, motivo?:string, producao?:Array, xp?:number}}
 */
export function fabricar({ catalogo, estado, receitaId }) {
  const checagem = podeFabricar({ catalogo, estado, receitaId });
  if (!checagem.ok) return checagem;

  const receita = catalogo.indice.recipes[receitaId];
  for (const insumo of receita.insumos ?? []) {
    consumirItem(estado.inventario, insumo.itemId, insumo.qtd ?? 1);
  }
  if (!gastarPoder(estado, receita.custoPoder ?? 0)) {
    return { ok: false, motivo: 'Poder insuficiente.' };
  }

  const producao = [];
  for (const saida of receita.saida ?? []) {
    const def = catalogo.indice.itens[saida.itemId];
    adicionarItem(estado.inventario, saida.itemId, saida.qtd ?? 1, def?.stackMax ?? 1000, [], def?.perecivel ?? false, def?.tempoEstragarSegundos ?? 0);
    producao.push({ itemId: saida.itemId, qtd: saida.qtd ?? 1 });
    estado.stats.itensCriados = (estado.stats.itensCriados ?? 0) + (saida.qtd ?? 1);
  }

  return { ok: true, producao, xp: 12 + producao.length * 6 };
}

// ---------- Orbes Arcanos ----------

/** Aplica um Orbe Arcano a uma pilha do inventario. */
export function usarOrbe({ catalogo, estado, pilhaUid, orbeId }) {
  const pilha = estado.inventario?.itens?.find((p) => p.uid === pilhaUid);
  if (!pilha) return { ok: false, motivo: 'Pilha nao encontrada.' };

  const qtd = estado.orbes?.[orbeId] ?? 0;
  if (qtd < 1) return { ok: false, motivo: 'Voce nao tem este Orbe.' };

  const def = catalogo?.indice?.itens?.[pilha.itemId];
  const resultado = aplicarOrbe(
    pilha,
    orbeId,
    def?.slotsUpgrade,
    def?.nivelMaxUpgrade,
    estado.nivel,
  );
  if (!resultado.ok) return resultado;

  estado.orbes[orbeId] = qtd - 1;
  if (estado.orbes[orbeId] <= 0) delete estado.orbes[orbeId];

  return { ok: true, nivel: resultado.nivel, itemId: pilha.itemId };
}

// ---------- consumiveis ----------

export function usarConsumivel({ catalogo, estado, pilhaUid }) {
  const pilha = estado.inventario?.itens?.find((p) => p.uid === pilhaUid);
  if (!pilha) return { ok: false, motivo: 'Pilha nao encontrada.' };
  const def = catalogo?.indice?.itens?.[pilha.itemId];
  if (def?.tipo !== 'consumivel') return { ok: false, motivo: 'Isto nao e consumivel.' };

  consumirItem(estado.inventario, pilha.itemId, 1);
  const efeito = consumirConsumivel(estado, def);
  return { ok: true, efeito, nome: def.nome };
}

// ---------- loot ----------

/** Sorteia o loot de um monstro derrotado e devolve as PECAS (nao aplica). */
export function sortearLoot({ catalogo, estado, monstro }) {
  const pecas = [];
  for (const entrada of monstro.loot ?? []) {
    if (Math.random() * 100 > (entrada.chance ?? 0)) continue;
    const def = catalogo?.indice?.itens?.[entrada.itemId];
    if (!def) continue;
    const qtd = (entrada.qtdMin ?? 1) + Math.floor(Math.random() * ((entrada.qtdMax ?? 1) - (entrada.qtdMin ?? 1) + 1));
    pecas.push({ itemId: entrada.itemId, qtd });
  }

  // Orbes caem direto no cofre de Orbes (senao o inventario enche de lixo).
  const chanceOrbe = 6 + (monstro.nivel ?? 1);
  if (Math.random() * 100 < chanceOrbe) {
    pecas.push({ orbe: sortearOrbePorNivel(estado.nivel ?? 1), qtd: 1 });
  }

  return pecas;
}

/** Sorteia o tipo de Orbe compativel com o nivel do jogador. */
export function sortearOrbePorNivel(nivel) {
  const opcoes = [
    { tipo: 'orbe_arcano_menor', ate: 10 },
    { tipo: 'orbe_arcano_medio', ate: 25 },
    { tipo: 'orbe_arcano_superior', ate: 40 },
    { tipo: 'orbe_arcano_epico', ate: 60 },
    { tipo: 'orbe_arcano_lendario', ate: 9999 },
  ];
  return opcoes.find((o) => nivel <= o.ate)?.tipo ?? 'orbe_arcano_menor';
}

/** Aplica as pecas de loot ao estado. */
export function aplicarLoot(estado, pecas) {
  const itens = [];
  const orbes = {};
  for (const peca of pecas ?? []) {
    if (peca.orbe) {
      orbes[peca.orbe] = (orbes[peca.orbe] ?? 0) + (peca.qtd ?? 1);
    } else if (peca.itemId) {
      itens.push(peca);
    }
  }
  return { itens, orbes };
}

// ---------- conquistas ----------

/**
 * Verifica conquistas pos acao do jogador e aplica as recompensas.
 * @returns {Array} conquistas novas
 */
export function processarConquistas({ catalogo, estado }) {
  const novas = avaliarConquistas(catalogo, estado);
  const recompensa = aplicarConquistas(estado, novas);
  if (!recompensa) return [];

  if (recompensa.xp) estado.xpPendente = (estado.xpPendente ?? 0) + recompensa.xp;
  if (recompensa.ouro) estado.ouro = (estado.ouro ?? 0) + recompensa.ouro;
  estado.orbes = somarMapas(estado.orbes, recompensa.orbes);

  return novas.map((c) => ({ ...c, ...recompensa }));
}
