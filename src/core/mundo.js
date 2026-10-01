// Geracao do mundo (Reinos Etereos) e das bases.
//
// Puro e deterministico: a mesma `seed` gera sempre o mesmo mundo. Assim o
// mundo do jogador e reproduzivel entre sessoes e entre jogadores diferentes.

import { monstrosParaNivel, reinosParaNivel } from './catalogo.js';

export const TAMANHO_BLOCO = 32;

// ---------- PRNG deterministico ----------

/** Hash de string para semente numerica (xorshift32). */
export function hashSemente(texto) {
  let h = 2166136261;
  const s = String(texto ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function criarRng(semente) {
  let estado = hashSemente(semente);
  return function proximo() {
    estado ^= estado << 13;
    estado >>>= 0;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 4294967296;
  };
}

export function inteiro(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function escolher(rng, lista) {
  if (!lista?.length) return null;
  return lista[Math.floor(rng() * lista.length)];
}

// ---------- geracao de um reino ----------

/**
 * Gera os nos de recurso de um reino.
 * @param {object} reino  template de reino (do catalogo)
 * @param {number} colunas
 * @param {number} linhas
 * @param {string} seedExtra
 * @returns {Array<{col:number, linha:number, itemId:string}>}
 */
export function gerarNosDeRecurso(reino, colunas, linhas, seedExtra = '') {
  const rng = criarRng(`${reino?.seedBase ?? 'reino'}:${seedExtra}:recursos`);
  const recursos = reino?.recursosAbundantes ?? ['terra', 'pedra'];
  const nos = [];

  // densidade: mais recursos em reinos faceis, menos emreis dificeis
  const densidade = Math.max(0.06, 0.22 - (reino?.dificuldade ?? 1) * 0.03);

  for (let linha = 0; linha < linhas; linha += 1) {
    for (let col = 0; col < colunas; col += 1) {
      if (rng() > densidade) continue;
      // concentra recursos raros: 70% usa o primeiro (abundante)
      const itemId = rng() < 0.7 ? recursos[0] : escolher(rng, recursos);
      if (!itemId) continue;
      nos.push({ col, linha, itemId });
    }
  }

  return nos;
}

/** Pontos de spawn de monstros, longe do centro (area de nascimento). */
export function gerarSpawns(reino, catalogo, nivel, quantidade = 24, seedExtra = '') {
  const rng = criarRng(`${reino?.seedBase ?? 'reino'}:${seedExtra}:spawns`);
  const candidatos = (reino?.monstrosPossiveis ?? [])
    .map((id) => catalogo?.indice?.monsters?.[id])
    .filter(Boolean);

  const pool = candidatos.length ? candidatos : monstrosParaNivel(catalogo, nivel);
  if (!pool.length) return [];

  const centroCol = 0.5;
  const centroLinha = 0.5;
  const spawns = [];

  for (let i = 0; i < quantidade; i += 1) {
    // distribuicao em anel: mais longe do centro = mais perigoso
    const anel = 0.2 + rng() * 0.55;
    const ang = rng() * Math.PI * 2;
    const cx = 0.5 + Math.cos(ang) * anel;
    const cy = 0.5 + Math.sin(ang) * anel * 0.7;

    const monstro = pool[Math.floor(rng() * pool.length)];

    spawns.push({
      x: limitar(cx, 0.03, 0.97),
      y: limitar(cy, 0.03, 0.97),
      monstroId: monstro.id,
      distanciaCentro: distancia(0.5, 0.5, cx, cy),
    });
  }

  return spawns;
}

function limitar(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distancia(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Sorteia os niveis/variacoes de um monstro conforme a distancia do centro.
 * Monstros longe do centro ganham niveis extras (zonas de perigo).
 */
export function nivelarMonstro(monstro, distanciaCentro, nivelBase) {
  const bonus = Math.floor(distanciaCentro * 40);
  const nivel = Math.max(
    1,
    Math.min(monstro.faixaMax ?? 999, nivelBase + bonus),
  );
  // escala linear dentro da faixa
  const faixaMin = monstro.faixaMin ?? 1;
  const faixaMax = monstro.faixaMax ?? nivel;
  const t = faixaMax === faixaMin ? 0 : (nivel - faixaMin) / (faixaMax - faixaMin);

  const vida = Math.round((monstro.vidaMax ?? 50) * (0.5 + t * 0.6));
  const dano = Math.round((monstro.danoBase ?? 5) * (0.5 + t * 0.6));
  const poder = Math.round((monstro.poderMax ?? 10) * (0.5 + t * 0.6));

  return {
    nivel,
    vidaMax: vida,
    vida,
    dano,
    poder,
    fis: Math.round((monstro.fis ?? 0) * (0.5 + t * 0.6)),
    men: Math.round((monstro.men ?? 0) * (0.5 + t * 0.6)),
    soc: Math.round((monstro.soc ?? 0) * (0.5 + t * 0.6)),
    defesa: Math.round((monstro.defesa ?? 0) * (0.5 + t * 0.6)),
  };
}

// ---------- base do jogador ----------

export const chaveBloco = (col, linha) => `${col},${linha}`;

export function criarBaseVazia(nome = 'Acampamento Imperial') {
  return {
    nome,
    nivel: 1,
    visivel: false,
    cor: 0xd4af6a,
    blocos: {},
  };
}

/** Coloca um bloco na base, com vida proporcional ao item. */
export function colocarBloco(base, col, linha, itemId, vidaMax = 100) {
  base.blocos ??= {};
  base.blocos[chaveBloco(col, linha)] = {
    itemId,
    vida: vidaMax,
    vidaMax,
    upgrades: [],
    colocadoEm: null,
  };
  return base.blocos[chaveBloco(col, linha)];
}

/** Aplica dano a um bloco. Devolve o bloco destruido ou null. */
export function danificarBloco(base, col, linha, dano) {
  const chave = chaveBloco(col, linha);
  const bloco = base.blocos?.[chave];
  if (!bloco) return null;

  bloco.vida -= dano;
  if (bloco.vida <= 0) {
    delete base.blocos[chave];
    return bloco; // destruido
  }
  return null;
}

/** Lista os blocos em coordenadas de tela (para o minimapa/ordenar por profundidade). */
export function listarBlocos(base) {
  return Object.entries(base?.blocos ?? {}).map(([chave, bloco]) => {
    const [col, linha] = chave.split(',').map(Number);
    return { col, linha, ...bloco };
  });
}

/** Quantos blocos de um item existem na base. */
export function contarBlocos(base, itemId) {
  return listarBlocos(base).filter((b) => b.itemId === itemId).length;
}

// ---------- selecao de reino ----------

/** Escolhe o reino de entrada de um jogador: o primeiro acessivel. */
export function reinoInicial(catalogo, nivel = 1) {
  const acessiveis = reinosParaNivel(catalogo, nivel);
  if (!acessiveis.length) return catalogo?.worldTemplates?.[0] ?? null;
  return acessiveis[0];
}

/** Verifica se o jogador tem nivel para entrar em um reino. */
export function podeEntrarNoReino(reino, nivel) {
  return nivel >= (reino?.faixaMin ?? 1);
}
