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

/**
 * Carrega todo o catalogo. Se o Firebase nao estiver disponivel, devolve a
 * semente. Nunca lanca: falhas viram avisos e o jogo continua com a semente.
 */
export async function carregarCatalogo() {
  const catalogo = {};
  const avisos = [];

  for (const [chave, repo] of Object.entries(FONTES)) {
    const semente = SEMENTE[chave] ?? [];
    catalogo[chave] = semente.map((item) => ({ ...item }));

    if (!firebaseDisponivel()) continue;

    try {
      const registros = await repo.listar();
      catalogo[chave] = mesclar(registros, semente);
    } catch (erro) {
      avisos.push(`${chave}: ${erro?.message ?? erro}`);
      console.warn(`[catalogo] usando semente em "${chave}" (${erro?.message ?? erro})`);
    }
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
  return catalogo;
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
