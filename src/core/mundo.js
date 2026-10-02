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

/** Os tamanhos de chunk que o painel oferece. Espelha `CAMPOS_CHUNK`. */
export const TAMANHOS_CHUNK = [8, 16, 32, 64];

/** Lado do chunk em blocos, com o valor do chunk caindo no padrão. */
export function tamanhoDoChunk(chunk) {
  const n = Number(chunk?.tamanhoBlocos);
  return TAMANHOS_CHUNK.includes(n) ? n : TAMANHO_CHUNK_PADRAO;
}

/**
 * Chunks que valem para um mundo.
 *
 * `mundoId` vazio = chunk SEM MUNDO, válido para qualquer reino. É o que
 * permite cadastrar uma "caverna genérica" uma vez e usá-la em todos os
 * mundos, em vez de duplicar o registro por mundo.
 *
 * Este filtro é usado em DOIS lugares — posicionamento e sorteio — e precisa
 * ser o MESMO nos dois. Quando os dois divergiram, um chunk sem mundo aparecia
 * só onde o admin posicionou e nunca mais: o sintoma de "cadastrei e não
 * contou".
 */
export function chunksDoMundo(chunks, mundoId) {
  return (chunks ?? []).filter((c) => !c?.mundoId || c.mundoId === mundoId);
}

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

  // Três níveis de desempate, e o último não é opcional.
  //
  // Peso e nome resolvem quase tudo. Mas DOIS chunks podem ter o mesmo peso e
  // o mesmo nome — o painel não impede, e acontece: alguém cria "AAAAAA" duas
  // vezes para testar e esquece de apagar uma. Sem o desempate por `id`, o
  // vencedor passa a depender da ORDEM DE LEITURA do Firestore, que não é
  // garantida. Aí dois jogadores no mesmo mundo veem terrenos diferentes, e o
  // mundo deixa de ser reproduzível — que é a propriedade que sustenta tudo
  // aqui.
  const copia = [...lista].sort((a, b) => {
    const peso = (Number(b.peso) || 0) - (Number(a.peso) || 0);
    if (peso !== 0) return peso;

    const nome = String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt-BR');
    if (nome !== 0) return nome;

    // `id` é único e não depende de nada externo. `localeCompare` devolve 0
    // para nomes iguais, então é aqui que o empate real se resolve.
    return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'pt-BR');
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

  // Mesmo filtro para posicionamento e sorteio. Ver `chunksDoMundo`.
  const doMundo = chunksDoMundo(chunks, reino?.id);
  const porCelula = indexarChunks(doMundo);

  // O sorteio tira do POOL TODO do mundo, chunks posicionados inclusive.
  //
  // Isto é o que dá sentido ao campo `peso`: um chunk posicionado à mão também
  // aparece no preenchimento automático das células vazias, na proporção do
  // peso. Se o sorteio ignorasse os posicionados, "peso" só valeria para
  // chunks que ninguém posicionou — e um chunk de caverna desenhado no canto
  // do mapa nunca apareceria no meio dele.
  //
  // Para o mesmo chunk servem os dois papéis: rareza e fixidez são coisas
  // diferentes, e quem decide é o admin, por chunk.
  const candidatos = doMundo;

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

// =====================================================================
// TERRENO — o que o jogador cava
// =====================================================================
//
// Aqui o terreno vira dado de verdade. A ideia é simples de explicar e
// importante de deixar registrada:
//
//   A coluna é o eixo X. A LINHA é a PROFUNDIDADE, não a altura.
//
// Uma coluna tem a superfície numa linha (`altura`) e, abaixo dela, `profundidade`
// camadas de solo. Acima da superfície é céu. O jogador cava para BAIXO, que é
// o gesto que o jogo inteiro convida a fazer — e o que a altura do chunk
// modulates, porque onde a superfície é mais alta há mais terra para cavar.
//
// Por que não "caminhar sobre o morro" (o Starbound literal):
//
//   O jogo é top-down com movimento livre nas 8 direções, sem gravidade. Não
//   existe chão para o jogador pisar — ele passa por cima de tudo, e o único
//   colisor do mundo são 60 árvores decorativas. Dar relevo caminhável exige
//   inventar gravidade, pulo, colisão e reescrever o input: é trocar o jogo,
//   não o mapa. Já cavar e coletar cabe no que existe, porque cavar é REMOVER
//   uma célula da grade — e a grade é a mesma que a base já usa.
//
// Consequência que vale assumir: o relevo é vertical para BAIXO. A coluna mais
// alta não é um morro que se sobe, é uma coluna de terra mais alta. Visualmente
// o degrau entre colunas é desenhado como uma parede de terra, que é exatamente
// o que o jogador espera ver.

/** Chave de célula do terreno. Mesma gramática da base: "x,y". */
export const chaveCelula = (x, y) => `${x},${y}`;

/**
 * Constrói a grade de terreno do mundo.
 *
 * @param {object} reino
 * @param {Array}  chunks  chunks do mundo (pode ser vazio)
 * @param {object} [opcoes]
 * @param {number} [opcoes.largura]  em blocos
 * @param {number} [opcoes.altura]   em linhas (a profundidade máxima do mundo)
 * @param {string} [opcoes.seed]
 * @returns {Map<string, {x:number,y:number,itemId:string,camada:string}>}
 *
 * Só as células CHEIAS entram no mapa. O vazio é ausência de chave, não um
 * objeto `{vazio:true}`: cavar é `delete`, e o mapa encolhe conforme o jogador
 * cava em vez de crescer com entradas nulas.
 */
export function gerarTerrenoMundo(reino, chunks = [], opcoes = {}) {
  const largura = Math.max(1, Number(opcoes.largura) || Number(reino?.largura) || 60);
  const altura = Math.max(1, Number(opcoes.altura) || Number(reino?.altura) || 44);
  const seed = opcoes.seed ?? 'local';

  // Chunks deste mundo.
//
// `!c.mundoId` significa chunk SEM MUNDO: ele serve para qualquer reino. É o
// que permite ter uma "caverna genérica" cadastrada uma vez e usá-la em todos
// os mundos, sem duplicar o registro.
//
// E o filtro tem que ser o MESMO nos dois lugares. Antes o posicionamento usava
// este filtro e o sorteio usava `mundoId === reino.id` — o resultado: um chunk
// sem mundo aparecia onde o admin posicionou e NUNCA mais, em lugar nenhum. Era
// exatamente o sintoma de "cadastrei e não contou".
const doMundo = chunksDoMundo(chunks, reino?.id);
  const porCelula = indexarChunks(doMundo);
  const candidatos = doMundo;

  const celulas = new Map();

  for (let cx = 0; cx * TAMANHO_CHUNK_PADRAO < largura; cx += 1) {
    for (let cy = 0; cy * TAMANHO_CHUNK_PADRAO < altura; cy += 1) {
      const chunk = porCelula.has(`${cx},${cy}`)
        ? chunkVigente(porCelula, cx, cy)
        : sorteiaChunk(candidatos, criarRng(`${reino?.seedBase ?? 'reino'}:${seed}:${cx},${cy}`));
      if (!chunk) continue;

      // O terreno usa o tamanho QUE O ADMIN ESCOLHEU, não o padrão da grade.
      //
      // A grade do MUNDO é sempre em células de 32 (é a unidade do
      // `posX`/`posY` que o painel grava), mas um chunk marcado como 8×8 tem
      // que produzir 8 colunas de terra — não 32. Gerar 32 dentro de uma célula
      // de 32 é certo por acidente; gerar 32 dentro de uma célula que o painel
      // desenhou como pequena não é, e o chunk vaza para o vizinho.
      const lado = tamanhoDoChunk(chunk);
      const colunas = gerarTerreno(chunk, lado);
      const x0 = cx * TAMANHO_CHUNK_PADRAO;
      const y0 = cy * TAMANHO_CHUNK_PADRAO;

      for (const col of colunas) {
        const x = x0 + col.x;
        if (x >= largura) continue;

        // Superfície: em (alturaBase + altura da coluna), se couber na tela.
        const ySuperficie = y0 + col.altura;
        if (col.superficie && ySuperficie < altura) {
          celulas.set(chaveCelula(x, ySuperficie), {
            x,
            y: ySuperficie,
            itemId: col.superficie,
            camada: 'superficie',
          });
        }

        // Subsolo: as `profundidade` linhas ABAIXO da superfície.
        //
        // A profundidade é a mesma da coluna, e não umarola só: um veio de
        // ferro que só existe na camada 2 precisa estar na camada 2 em todas as
        // colunas, senão o jogador cava para baixo e o veio muda de profundidade
        // de coluna para coluna — e não acha.
        const fundo = Math.min(altura - 1, ySuperficie + Math.max(0, col.profundidade));
        for (let y = ySuperficie + 1; y <= fundo; y += 1) {
          if (!col.subsolo) break;
          celulas.set(chaveCelula(x, y), { x, y, itemId: col.subsolo, camada: 'subsolo' });
        }
      }
    }
  }

  return celulas;
}

/**
 * Aplica as escavações e construções do jogador por cima do terreno gerado.
 *
 * O terreno é PROCEDURAL: ele vem da semente, todo mundo gera o mesmo. O que o
 * jogador faz é um SOBREPÕS de exceções — e é só isso que vai para o Firestore.
 *
 * Guardar a grade inteira seria centenas de milhares de caracteres por conta e totalmente
 * redundante: bastam as células que mudaram.
 *
 * @param {Map} celulas  terreno gerado (é modificado no lugar)
 * @param {object} alterado  `{ "x,y": itemId | null }` do perfil do jogador
 * @returns {number} quantas ENTRADAS do perfil foram aplicadas
 *
 * Contar entradas aplicadas, e não células que mudaram de estado: a segunda
 * contagem depende de o terreno procedural já ter a célula, e o terreno muda
 * quando um chunk é cadastrado. O número que o painel quer mostrar é "quantas
 * escavações minhas estão aqui", que é o tamanho do registro do jogador.
 */
export function aplicarAlteracoesTerreno(celulas, alterado) {
  let quantas = 0;
  for (const [chave, itemId] of Object.entries(alterado ?? {})) {
    const [x, y] = chave.split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    if (itemId === null || itemId === undefined) {
      // `null` = cavado. A célula some do mapa. Não importa se já tinha sumido:
      // o registro do jogador é a verdade, não o estado do procedural.
      celulas.delete(chave);
    } else {
      celulas.set(chave, { x, y, itemId, camada: 'jogador' });
    }
    quantas += 1;
  }
  return quantas;
}

/**
 * Cava uma célula. Devolve o bloco removido, ou null se não havia nada.
 *
 * Não apaga em `alterado`: quem decide o que é permanente é o `salvarTerreno`
 * do jogador, e escavar e voltar atrás (sem custo) é o que torna a escavação
 * reversível sem bureaucracy.
 */
export function escavarCelula(celulas, x, y) {
  const chave = chaveCelula(x, y);
  const celula = celulas.get(chave);
  if (!celula) return null;
  celulas.delete(chave);
  return celula;
}

/** Coloca um bloco numa célula vazia. Devolve a célula, ou null se estava cheia. */
export function colocarCelula(celulas, x, y, itemId) {
  const chave = chaveCelula(x, y);
  if (celulas.has(chave)) return null;
  const celula = { x, y, itemId, camada: 'jogador' };
  celulas.set(chave, celula);
  return celula;
}

/**
 * Baús e itens no chão que o chunk manda, já com o loot sorteado.
 *
 * O loot é sorteado na generation, e não na hora de abrir: um baú tem que ter
 * o MESMO conteúdo para o mesmo mundo, ou o jogador abre duas vezes e leva
 * coisas diferentes. Isso é o que `conteudoBaus` faz — a chance é avaliada uma
 * vez só, aqui.
 */
export function espalharBausEItens(chunk, tamanho = TAMANHO_CHUNK_PADRAO, seedExtra = '') {
  const x0 = chunkParaBloco(Number(chunk?.posX) || 0);
  const y0 = chunkParaBloco(Number(chunk?.posY) || 0);

  const baus = chunk?.baus ?? [];
  const chance = limitar(Number(chunk?.chanceBaus) || 0, 0, 1);
  const maximo = Math.max(0, Number(chunk?.quantidadeBaus) || 0);

  const lootPorBau = new Map(
    (Array.isArray(chunk?.conteudoBaus) ? chunk.conteudoBaus : []).map((b) => [
      b.bauId,
      Array.isArray(b.itens) ? b.itens : [],
    ]),
  );

  const listaBaus = [];
  if (baus.length && chance > 0 && maximo > 0) {
    const rng = criarRng(sementeDoChunk(chunk, `baus:${seedExtra}`));
    const area = tamanho * tamanho;
    for (let i = 0; i < area && listaBaus.length < maximo; i += 1) {
      if (rng() >= chance) continue;
      const bauId = escolher(rng, baus);
      if (!bauId) continue;
      listaBaus.push({
        bauId,
        x: x0 + inteiro(rng, 0, tamanho - 1),
        y: y0 + inteiro(rng, 0, tamanho - 1),
        itens: sortearLoot(lootPorBau.get(bauId) ?? [], rng),
        aberto: false,
      });
    }
  }

  const itensChao = chunk?.itensChao ?? [];
  const densItens = limitar(Number(chunk?.densidadeItensChao) || 0, 0, 1);
  const listaChao = [];
  if (itensChao.length && densItens > 0) {
    const rng = criarRng(sementeDoChunk(chunk, `itensChao:${seedExtra}`));
    const total = Math.round(tamanho * tamanho * densItens);
    for (let i = 0; i < total; i += 1) {
      listaChao.push({
        itemId: escolher(rng, itensChao),
        qtd: inteiro(rng, 1, 3),
        x: x0 + inteiro(rng, 0, tamanho - 1),
        y: y0 + inteiro(rng, 0, tamanho - 1),
      });
    }
  }

  return { baus: listaBaus, itensChao: listaChao };
}

/** Sorteia o conteúdo de um baú. `chance` é de 0 a 100. */
export function sortearLoot(itens, rng) {
  const sorteados = [];
  for (const entrada of itens ?? []) {
    if (!entrada?.itemId) continue;
    if (rng() * 100 >= limitar(Number(entrada.chance) || 0, 0, 100)) continue;
    sorteados.push({
      itemId: entrada.itemId,
      qtd: inteiro(rng, entrada.qtdMin ?? 1, entrada.qtdMax ?? 1),
    });
  }
  return sorteados;
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
