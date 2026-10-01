// Catalogo do jogo: junta o que o Administrador cadastrou no Firestore com a
// SEMENTE local.
//
// Regra: a SEMENTE garante que o jogo e jogavel mesmo com o painel vazio.
// O que existe no Firestore apenas SOBREPOE a semente (por `id`), entao o
// admin consegue ajustar um item existente sem perder o resto do mundo.

import { repoItens, repoClasses, repoSkills, repoRecipes, repoMonstros, repoWorldTemplates, repoAchievements } from './repos.js';
import { SEMENTE } from '../dados/semente.js';
import { firebaseDisponivel } from './firebase.js';

const FONTES = {
  itens: repoItens,
  classes: repoClasses,
  skills: repoSkills,
  recipes: repoRecipes,
  monsters: repoMonstros,
  worldTemplates: repoWorldTemplates,
  achievements: repoAchievements,
};

function mesclar(registros, semente) {
  const mapa = new Map();
  for (const item of semente ?? []) {
    if (item?.id) mapa.set(item.id, { ...item });
  }
  for (const item of registros ?? []) {
    if (!item?.id) continue;
    mapa.set(item.id, { ...(mapa.get(item.id) ?? {}), ...item });
  }
  return Array.from(mapa.values());
}

/** Quanto tempo esperar o Firestore antes de cair na semente. */
const TEMPO_LIMITE_MS = 4000;

/**
 * Disputa a promise contra um relogio. Devolve `resolvao` quando a promise
 * resolve, ou `resolvao` se ela nao resolver a tempo.
 *
 * Sem isso, uma leitura de Firestore pendurada (rede lenta, aba em segundo
 * plano, projeto dormindo) segura o `create` da cena para sempre e o jogo fica
 * preso em "Forjando o reino...".
 */
function comTempoLimite(promise, ms = TEMPO_LIMITE_MS) {
  return new Promise((resolve) => {
    let resolvido = false;
    const finish = (valor) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(relogio);
      resolve(valor);
    };
    const relogio = setTimeout(() => finish(null), ms);
    promise.then(
      (v) => finish(v),
      () => finish(null),
    );
  });
}

let catalogoCache = null;

/**
 * Carrega todo o catalogo. Se o Firebase nao estiver disponivel, devolve a
 * semente. Nunca lanca e nunca trava: falhas viram avisos e o jogo continua
 * com a semente.
 */
export async function carregarCatalogo({ forcar = false } = {}) {
  if (catalogoCache && !forcar) return catalogoCache;

  const avisos = [];

  // Todas as colecoes em paralelo: 7 leituras sequenciais demoravam 7x mais
  // (e uma travada segurava todas as seguintes).
  const chaves = Object.keys(FONTES);
  const resultados = await Promise.all(
    chaves.map(async (chave) => {
      if (!firebaseDisponivel()) return [chave, null, null];
      try {
        const registros = await comTempoLimite(FONTES[chave].listar());
        return [chave, registros, null];
      } catch (erro) {
        return [chave, null, erro?.message ?? String(erro)];
      }
    }),
  );

  const catalogo = {};
  for (const [chave, registros, erro] of resultados) {
    const semente = SEMENTE[chave] ?? [];
    catalogo[chave] = semente.map((item) => ({ ...item }));

    if (!firebaseDisponivel()) continue;

    if (registros === null) {
      const motivo = erro ?? 'tempo limite esgotado';
      avisos.push(`${chave}: ${motivo}`);
      console.warn(`[catalogo] usando semente em "${chave}" (${motivo})`);
      continue;
    }
    catalogo[chave] = mesclar(registros, semente);
  }

  // Indices de acesso rapido.
  catalogo.indice = {
    itens: indexar(catalogo.itens),
    classes: indexar(catalogo.classes),
    skills: indexar(catalogo.skills),
    recipes: indexar(catalogo.recipes),
    monsters: indexar(catalogo.monsters),
    worldTemplates: indexar(catalogo.worldTemplates),
    achievements: indexar(catalogo.achievements),
  };

  catalogo.avisos = avisos;
  catalogoCache = catalogo;
  return catalogo;
}

/** Descarta o cache (usar apos o admin mudar o catalogo). */
export function limparCacheCatalogo() {
  catalogoCache = null;
}

function indexar(lista) {
  const mapa = {};
  for (const item of lista ?? []) {
    if (item?.id) mapa[item.id] = item;
  }
  return mapa;
}

// ---------- acesso por id (aceita id ou documentId) ----------

export function buscarItem(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.itens?.[id] ?? null;
}

export function buscarClasse(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.classes?.[id] ?? null;
}

export function buscarTalento(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.skills?.[id] ?? null;
}

export function buscarReceita(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.recipes?.[id] ?? null;
}

export function buscarMonstro(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.monsters?.[id] ?? null;
}

export function buscarReino(catalogo, id) {
  if (!id) return null;
  return catalogo?.indice?.worldTemplates?.[id] ?? null;
}

/** Lista receitas de uma estacao, filtrando por nivel minimo. */
export function receitasDaEstacao(catalogo, estacao, nivel = 1) {
  return (catalogo?.recipes ?? []).filter(
    (r) => r.estacao === estacao && (r.nivelMin ?? 1) <= nivel,
  );
}

/** Lista monstros cuja faixa de nivel cobre o nivel do jogador. */
export function monstrosParaNivel(catalogo, nivel) {
  return (catalogo?.monsters ?? []).filter(
    (m) => nivel >= (m.faixaMin ?? 1) && nivel <= (m.faixaMax ?? 999),
  );
}

/** Lista reinos acessiveis ao nivel do jogador. */
export function reinosParaNivel(catalogo, nivel) {
  return (catalogo?.worldTemplates ?? []).filter((r) => nivel >= (r.faixaMin ?? 1));
}
