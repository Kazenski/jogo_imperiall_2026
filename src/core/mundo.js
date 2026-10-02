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

// =====================================================================
// CHUNKS — a unidade de geração do mundo
// =====================================================================
//
// Um chunk é um retângulo do mundo com regras próprias: o que há na
// superfície, o que há no subsolo, que mobs nascem, que NPCs aparecem, e que
// altura o terreno tem. O mundo deixa de ser um sorteio uniforme sobre a área
// inteira e passa a ser um tabuleiro que o admin desenha.
//
// Duas decisões que valem explicar, porque as duas mudam o que o admin vê:
//
// 1. DETERMINISMO POR SEMENTE. Um chunk com `seedBase` "caverna-1" gera
//    exatamente o mesmo terreno, os mesmos nós e as mesmas mobs sempre, para
//    qualquer jogador, em qualquer máquina. Sem isso o mundo seria diferente
//    para cada conta e o admin não conseguiria balancear nada — ele mudaria
//    um parâmetro e não veria o efeito.
//
// 2. O MAPA DO ADMIN É A VERDADE, O SORTEIO SÓ PREENCHE O RESTO.
//    `chunkVigente` primeiro procura um chunk posicionado exatamente na
//    célula. Se existir, ele manda — é o que o admin desenhou. O sorteio por
//    peso só acontece nas células vazias. Assim dá para desenhar um caminho
//    seguro no meio de um reino perigoso sem o sorteio desfazer o desenho.

export const TAMANHO_CHUNK_PADRAO = 32;

/** Converte coordenadas de bloco em coordenadas de chunk. */
export function blocoParaChunk(bloco, tamanho = TAMANHO_CHUNK_PADRAO) {
  return Math.floor(bloco / tamanho);
}

/** Converte coordenadas de chunk na origem, em bloco, do canto de cima. */
export function chunkParaBloco(chunk, tamanho = TAMANHO_CHUNK_PADRAO) {
  return chunk * tamanho;
}

/**
 * Índice `x,y` -> lista de chunks, para a busca por célula ser O(1).
 *
 * Sem isto, `chunkVigente` varreria a lista inteira de chunks por célula
 * consultada. A geração pergunta qual é o chunk de cada coluna do terreno —
 * numa exploração longa isso são milhares de varreduras de uma lista que
 * cresce a cada chunk cadastrado no painel.
 */
export function indexarChunks(chunks) {
  const porCelula = new Map();
  for (const c of chunks ?? []) {
    if (!c) continue;
    const x = Number(c.posX);
    const y = Number(c.posY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const chave = `${Math.round(x)},${Math.round(y)}`;
    if (!porCelula.has(chave)) porCelula.set(chave, []);
    porCelula.get(chave).push(c);
  }
  return porCelula;
}

/**
 * O chunk que manda na célula (cx, cy).
 *
 * Quando há vários na mesma célula, o de MAIOR peso vence: é o que o admin
 * marca como "isto aqui é meu, não sorteia". Empate é resolvido pelo nome para
 * o resultado não depender da ordem de leitura do Firestore — dois jogadores
 * precisam ver o mesmo mundo.
 */
export function chunkVigente(porCelula, cx, cy, rng = null) {
  const lista = porCelula?.get(`${Math.round(cx)},${Math.round(cy)}`);
  if (!lista?.length) return sorteiaChunk(null, rng);
  if (lista.length === 1) return lista[0];

  const copia = [...lista].sort((a, b) => {
    const peso = (Number(b.peso) || 0) - (Number(a.peso) || 0);
    if (peso !== 0) return peso;
    return String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR');
  });
  return copia[0];
}

/**
 * Sorteia um chunk entre os de um bioma, pelo peso.
 *
 * Separado de `chunkVigente` para poder ser testado sozinho: é a função que
 * decide a "cara" de cada célula vazia do mundo.
 */
export function sorteiaChunk(chunks, rng) {
  const validos = (chunks ?? []).filter((c) => (Number(c.peso) || 0) > 0);
  if (!validos.length) return null;
  const total = validos.reduce((s, c) => s + (Number(c.peso) || 0), 0);
  let alvo = rng() * total;
  for (const c of validos) {
    alvo -= Number(c.peso) || 0;
    if (alvo <= 0) return c;
  }
  return validos[validos.length - 1];
}

/**
 * Semente do chunk. Determinística e independente da ordem de percurso.
 *
 * Inclui `mundoId`, `biomaId` e a posição: dois chunks com o mesmo nome em
 * biomas diferentes precisam gerar coisas diferentes, senão o bioma vira
 * decoração.
 */
export function sementeDoChunk(chunk, extras = '') {
  const base = chunk?.seedBase || chunk?.nome || chunk?.id || 'chunk';
  return [
    base,
    chunk?.mundoId ?? '',
    chunk?.biomaId ?? '',
    chunk?.posX ?? 0,
    chunk?.posY ?? 0,
    extras,
  ].join(':');
}

/**
 * Heightmap do chunk: uma altura por coluna, já suavizada.
 *
 * Existe agora mesmo sem o terreno ter altura renderizada. Registrar o dado
 * cedo significa que a etapa seguinte — desenhar o perfil — é só ler o que o
 * admin já preencheu, e dá para conferir o resultado pelo painel antes de
 *ligationar ao jogo.
 *
 * @returns {number[]} altura de cada coluna, em blocos, em ordem crescente de X
 */
export function gerarHeightmap(chunk, tamanho = TAMANHO_CHUNK_PADRAO, seedExtra = '') {
  const rng = criarRng(sementeDoChunk(chunk, `altura:${seedExtra}`));
  const base = Number(chunk?.alturaBase) || 0;
  const variacao = Math.max(0, Number(chunk?.alturaVariacao) || 0);
  const passos = Math.max(0, Number(chunk?.suavizarAltura) || 1);

  const bruto = [];
  for (let x = 0; x < tamanho; x += 1) {
    bruto.push(base + Math.round((rng() * 2 - 1) * variacao));
  }

  if (variacao === 0 || passos === 0) return bruto;

  // Média móvel: um platô não deve virar zigue-zague de um bloco em um bloco.
  const suavizado = bruto.slice();
  for (let x = 0; x < tamanho; x += 1) {
    let soma = 0;
    let conta = 0;
    for (let k = -passos; k <= passos; k += 1) {
      const i = x + k;
      if (i < 0 || i >= tamanho) continue;
      soma += bruto[i];
      conta += 1;
    }
    suavizado[x] = Math.round(soma / Math.max(1, conta));
  }
  return suavizado;
}

/**
 * Terreno do chunk: colunas com altura, bloco de superfície e subsolo.
 *
 * O formato é o que o mundo vai consumir, então é deliberadamente simples de
 * guardar em documento por chunk: colunas paralelas em vez de um objeto com
 * chave "x,y", porque chave composta vira string, vira documento grande e
 * custa leitura.
 */
export function gerarTerreno(chunk, tamanho = TAMANHO_CHUNK_PADRAO, seedExtra = '') {
  const rng = criarRng(sementeDoChunk(chunk, `terreno:${seedExtra}`));
  const altura = gerarHeightmap(chunk, tamanho, seedExtra);

  const superficie = chunk?.blocosSuperficie ?? [];
  const subsolo = chunk?.blocosSubSolo ?? [];
  const profMin = Math.max(0, Number(chunk?.profundidadeMin) || 0);
  const profMax = Math.max(profMin, Number(chunk?.profundidadeMax) ?? profMin);

  const colunas = [];
  for (let x = 0; x < tamanho; x += 1) {
    const prof = inteiro(rng, profMin, profMax);
    colunas.push({
      x,
      altura: altura[x],
      profundidade: prof,
      superficie: escolher(rng, superficie),
      subsolo: escolher(rng, subsolo),
    });
  }
  return colunas;
}

/**
 * Tudo que um chunk espalha dentro de si: recursos, mobs, NPCs, estações.
 *
 * Cada tipo tem o seu PRNG, derivado da semente do chunk mais um sufixo. Um
 * único `rng` compartilhado faria a lista de mobs mudar quando o admin mexesse
 * na densidade de recursos — o mesmo efeito colateral que o teste de regressão
 * do pixel art pegou no editor de cores.
 */
export function gerarConteudo(chunk, tamanho = TAMANHO_CHUNK_PADRAO) {
  const area = tamanho * tamanho;
  const recursos = chunk?.recursos ?? [];
  const mobs = chunk?.mobsNativas ?? [];
  const npcs = chunk?.npcs ?? [];
  const estacoes = chunk?.estacoes ?? [];

  const densRecursos = limitar(Number(chunk?.densidadeRecursos) || 0, 0, 1);
  const densMobs = limitar(Number(chunk?.densidadeMobs) || 0, 0, 1);

  const listaRecursos = [];
  if (recursos.length && densRecursos > 0) {
    const rng = criarRng(sementeDoChunk(chunk, 'recursos'));
    const total = Math.round(area * densRecursos);
    for (let i = 0; i < total; i += 1) {
      listaRecursos.push({
        col: inteiro(rng, 0, tamanho - 1),
        linha: inteiro(rng, 0, tamanho - 1),
        itemId: escolher(rng, recursos),
      });
    }
  }

  // Mobs escalam com a ÁREA, não só com a densidade: um chunk 64×64 com a mesma
  // densidade de um 8×8 tem 64× mais volume, e treating density as a flat rate
  // makes big chunks absurdly crowded.
  const listaMobs = [];
  if (mobs.length && densMobs > 0) {
    const rng = criarRng(sementeDoChunk(chunk, 'mobs'));
    const total = Math.round(area * densMobs * 0.1);
    for (let i = 0; i < total; i += 1) {
      listaMobs.push({
        x: Number((rng()).toFixed(4)),
        y: Number((rng()).toFixed(4)),
        monstroId: escolher(rng, mobs),
      });
    }
  }

  const listaNpcs = [];
  if (npcs.length) {
    const rng = criarRng(sementeDoChunk(chunk, 'npcs'));
    for (const npcId of npcs) {
      listaNpcs.push({ npcId, x: Number(rng().toFixed(4)), y: Number(rng().toFixed(4)) });
    }
  }

  const listaEstacoes = [];
  if (estacoes.length) {
    const rng = criarRng(sementeDoChunk(chunk, 'estacoes'));
    for (const estacaoId of estacoes) {
      listaEstacoes.push({ estacaoId, x: Number(rng().toFixed(4)), y: Number(rng().toFixed(4)) });
    }
  }

  return { recursos: listaRecursos, mobs: listaMobs, npcs: listaNpcs, estacoes: listaEstacoes };
}

/**
 * O mundo inteiro, montado chunk a chunk.
 *
 * Não substitui `gerarNosDeRecurso` ainda — os dois convivem até o terreno com
 * altura entrar em cena. Serve para o painel conseguir responder "como está o
 * meu reino?" sem abrir o jogo.
 */
export function gerarMundoEmChunks(reino, chunks, seedExtra = '') {
  const cols = Number(reino?.largura) || 60;
  const linhas = Number(reino?.altura) || 44;
  const tamanho = TAMANHO_CHUNK_PADRAO;

  const porCelula = indexarChunks(
    (chunks ?? []).filter((c) => !c?.mundoId || c.mundoId === reino?.id),
  );

  // O sorteio tira do POOL TODO do mundo, chunks posicionados inclusive.
  //
  // Isto é o que dá sentido ao campo `peso`: um chunk posicionado à mão também
  // aparece no preenchimento automático das células vazias, na proporção do
  // peso. Se o sorteio ignorasse os posicionados, "peso" só valeria para
  // chunks que ninguém posicionou — e um chunk de caverna desenhado no canto
  // do mapa nunca apareceria no meio dele.
  //
  // Para o mesmo chunk serve os dois papéis: rareza e fixidez são coisas
  // diferentes, e quem decide é o admin, por chunk.
  const candidatos = (chunks ?? []).filter((c) => c?.mundoId === reino?.id);

  const rng = criarRng(`${reino?.seedBase ?? 'reino'}:${seedExtra}:chunks`);
  const celulas = [];

  for (let cy = 0; cy * tamanho < linhas; cy += 1) {
    for (let cx = 0; cx * tamanho < cols; cx += 1) {
      const posicionado = porCelula.has(`${cx},${cy}`);
      const chunk = posicionado
        ? chunkVigente(porCelula, cx, cy)
        : sorteiaChunk(candidatos, rng);
      if (!chunk) continue;
      celulas.push({
        cx,
        cy,
        chunkId: chunk.id ?? null,
        nome: chunk.nome ?? '—',
        // `sorteado` distingue "o admin desenhou aqui" de "o preenchimento
        // automático pôs algo aqui". Sem essa marca o painel não consegue
        // mostrar o desenho do admin por baixo do sorteio.
        sorteado: !posicionado,
        conteudo: gerarConteudo(chunk, tamanho),
      });
    }
  }
  return { cols, linhas, tamanho, celulas };
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
