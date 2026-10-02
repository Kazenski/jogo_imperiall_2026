// Trava o contrato do terreno cavável.
//
// Existe por causa de uma decisão de projeto que é fácil de errar sem perceber:
// a LINHA do terreno é a PROFUNDIDADE, não a altura. O jogo é top-down sem
// gravidade, então "caminhar sobre o morro" não existe — o que dá sentido a
// cavar é haver camadas abaixo da superfície. Estes testes fixam essa leitura.
//
// A cobertura de RENDERIZAÇÃO não está aqui: ela precisa de Phaser. Para ver o
// terreno, abra `teste-terreno.html` com o dev server no ar.
//
// Uso:  node testes/terreno.mjs

import * as M from '../src/core/mundo.js';

const CHUNK = {
  id: 'c1',
  nome: 'colina de ferro',
  mundoId: 'r1',
  posX: 0,
  posY: 0,
  tamanhoBlocos: 32,
  peso: 5,
  blocosNativos: ['pedra', 'ferro', 'grama'],
  blocosSuperficie: ['grama'],
  blocosSubSolo: ['terra'],
  alturaBase: 10,
  alturaVariacao: 4,
  suavizarAltura: 3,
  profundidadeMin: 5,
  profundidadeMax: 10,
  baus: ['bau_comum', 'bau_rare'],
  chanceBaus: 0.02,
  quantidadeBaus: 4,
  conteudoBaus: [
    { bauId: 'bau_comum', itens: [
      { itemId: 'pedra', chance: 70, qtdMin: 1, qtdMax: 4 },
      { itemId: 'ferro', chance: 30, qtdMin: 1, qtdMax: 2 },
    ] },
    { bauId: 'bau_rare', itens: [
      { itemId: 'pocao_vida', chance: 25, qtdMin: 1, qtdMax: 1 },
    ] },
  ],
  itensChao: ['pancada'],
  densidadeItensChao: 0.01,
};

const MUNDO = { id: 'r1', largura: 64, altura: 40, seedBase: 'reino-a' };

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

const terreno = M.gerarTerrenoMundo(MUNDO, [CHUNK], { seed: 'u1' });

// ---------------------------------------------------------------------
console.log('\n== a grade existe ==');
{
  ok(terreno.size > 0, `o terreno foi gerado (${terreno.size} células)`);

  let superficie = 0;
  let subsolo = 0;
  for (const cel of terreno.values()) {
    if (cel.camada === 'superficie') superficie += 1;
    else subsolo += 1;
  }
  ok(superficie > 0, `há superfície (${superficie} células)`);
  ok(subsolo > superficie, `há mais subsolo que superfície — é o que dá para cavar (${subsolo})`);

  ok(
    [...terreno.values()].every((c) => typeof c.itemId === 'string' && c.itemId.length > 0),
    'toda célula tem um bloco de verdade, não placeholder',
  );
}

// ---------------------------------------------------------------------
console.log('\n== toda coluna do mundo tem chão ==');
{
  // Sem isto, o jogador anda por cima de buracos infinitos num mundo gerado
  // com `peso: 0` — que só existe onde o admin posicionou.
  const colunas = new Set();
  for (let x = 0; x < MUNDO.largura; x += 1) {
    for (let y = 0; y < MUNDO.altura; y += 1) {
      if (terreno.get(M.chaveCelula(x, y))?.camada === 'superficie') { colunas.add(x); break; }
    }
  }
  ok(colunas.size === MUNDO.largura,
    `todas as ${MUNDO.largura} colunas têm superfície (veio ${colunas.size})`);
}

// ---------------------------------------------------------------------
console.log('\n== a altura varia e respeita o intervalo ==');
{
  const alturas = [];
  const profs = [];
  for (let x = 0; x < MUNDO.largura; x += 1) {
    let sup = null;
    let sub = 0;
    for (let y = 0; y < MUNDO.altura; y += 1) {
      const cel = terreno.get(M.chaveCelula(x, y));
      if (!cel) continue;
      if (cel.camada === 'superficie' && sup === null) sup = y;
      else if (cel.camada === 'subsolo') sub += 1;
    }
    alturas.push(sup);
    profs.push(sub);
  }

  const min = Math.min(...alturas);
  const max = Math.max(...alturas);
  ok(min >= CHUNK.alturaBase - CHUNK.alturaVariacao,
    `altura mínima não desce abaixo da base (${min} >= ${CHUNK.alturaBase - CHUNK.alturaVariacao})`);
  ok(max <= CHUNK.alturaBase + CHUNK.alturaVariacao,
    `altura máxima não sobe acima do teto (${max} <= ${CHUNK.alturaBase + CHUNK.alturaVariacao})`);
  ok(max > min, `o terreno tem relevo de verdade (${min}..${max})`);

  ok(profs.every((p) => p >= CHUNK.profundidadeMin && p <= CHUNK.profundidadeMax),
    `profundidade dentro de ${CHUNK.profundidadeMin}..${CHUNK.profundidadeMax}`);
  ok(new Set(profs).size > 1, 'a profundidade varia entre colunas');
}

// ---------------------------------------------------------------------
console.log('\n== determinismo ==');
{
  const outro = M.gerarTerrenoMundo(MUNDO, [CHUNK], { seed: 'outro-jogador' });
  const igual = (a, b) =>
    a.size === b.size && [...a].every(([k, v]) => b.get(k)?.itemId === v.itemId);

  ok(igual(terreno, M.gerarTerrenoMundo(MUNDO, [CHUNK], { seed: 'u1' })),
    'repetir a geração dá o mesmo terreno');
  ok(igual(terreno, outro), 'dois jogadores veem o mesmo terreno');
}

// ---------------------------------------------------------------------
console.log('\n== escavar ==');
{
  const alvo = [...terreno.entries()].find(([, c]) => c.camada === 'subsolo');
  const [x, y] = alvo[0].split(',').map(Number);

  const removido = M.escavarCelula(terreno, x, y);
  ok(removido?.itemId === alvo[1].itemId, 'escavar devolve o bloco que estava ali');
  ok(!terreno.has(M.chaveCelula(x, y)), 'a célula sai do mapa');
  ok(M.escavarCelula(terreno, x, y) === null, 'escavar de novo não devolve nada');
  ok(M.escavarCelula(terreno, 9999, 9999) === null, 'escavar fora do mapa não devolve nada');
}

// ---------------------------------------------------------------------
console.log('\n== colocar ==');
{
  ok(M.colocarCelula(terreno, 0, 30, 'pedra')?.itemId === 'pedra', 'coloca em célula livre');
  ok(M.colocarCelula(terreno, 0, 30, 'pedra') === null, 'recusa célula ocupada');
  ok(M.colocarCelula(terreno, 900, 900, 'pedra') !== null, 'permite fora do mapa visível');
  ok(terreno.get(M.chaveCelula(0, 30))?.camada === 'jogador', 'marca como camada do jogador');
}

// ---------------------------------------------------------------------
console.log('\n== o registro do jogador vence o procedural ==');
{
  const registro = {
    '1,1': null,        // cavado
    '2,2': 'ferro',     // colocado
    'lixo': 'pedra',    // chave quebrada: tem de ser ignorada
    'a,b': 'pedra',     // NaN: tem de ser ignorada
  };

  const procedural = new Map([
    ['1,1', { x: 1, y: 1, itemId: 'terra', camada: 'subsolo' }],
    ['2,2', { x: 2, y: 2, itemId: 'terra', camada: 'subsolo' }],
  ]);

  const aplicadas = M.aplicarAlteracoesTerreno(procedural, registro);

  ok(aplicadas === 2, `só as 2 chaves válidas entraram (${aplicadas})`);
  ok(!procedural.has('1,1'), 'cavado some do mapa mesmo havendo terra procedural');
  ok(procedural.get('2,2')?.itemId === 'ferro', 'o bloco do jogador substitui o procedural');
  ok(procedural.get('2,2')?.camada === 'jogador', 'e é marcado como do jogador');
  ok(![...procedural.keys()].some((k) => k.includes('NaN')), 'chave inválida não cria célula NaN');

  const antes = procedural.size;
  M.aplicarAlteracoesTerreno(procedural, registro);
  ok(procedural.size === antes, 'aplicar duas vezes não muda nada (idempotente)');

  ok(M.aplicarAlteracoesTerreno(procedural, null) === 0, 'perfil sem registro não quebra');
  ok(M.aplicarAlteracoesTerreno(procedural, undefined) === 0, 'perfil indefinido não quebra');
}

// ---------------------------------------------------------------------
console.log('\n== baús ==');
{
  const espalha = M.espalharBausEItens(CHUNK, 32);

  ok(espalha.baus.length > 0 && espalha.baus.length <= CHUNK.quantidadeBaus,
    `baus respeitam o teto (${espalha.baus.length} de ${CHUNK.quantidadeBaus})`);
  ok(espalha.baus.every((b) => CHUNK.baus.includes(b.bauId)),
    'todo baú tem um tipo que está na lista do chunk');
  ok(espalha.baus.every((b) => Array.isArray(b.itens)), 'todo baú tem lista de loot');
  ok(
    espalha.baus.every((b) => b.itens.every((i) => typeof i.itemId === 'string' && i.itemId)),
    'o loot é uma lista de itens com quantidade',
  );

  const outro = M.espalharBausEItens(CHUNK, 32);
  ok(JSON.stringify(espalha.baus) === JSON.stringify(outro.baus),
    'mesmo chunk, mesmos baús com o MESMO loot (o mundo é reproduzível)');

  ok(espalha.itensChao.length === Math.round(32 * 32 * CHUNK.densidadeItensChao),
    `itens no chão = área × densidade (${espalha.itensChao.length})`);

  // Zeres e ausências não podem gerar nada nem estourar.
  ok(M.espalharBausEItens({ ...CHUNK, chanceBaus: 0 }, 32).baus.length === 0, 'chance 0 não gera baú');
  ok(M.espalharBausEItens({ ...CHUNK, quantidadeBaus: 0 }, 32).baus.length === 0, 'teto 0 não gera baú');
  ok(M.espalharBausEItens({ ...CHUNK, baus: [] }, 32).baus.length === 0, 'sem lista não gera baú');
  ok(M.espalharBausEItens({ ...CHUNK, itensChao: [] }, 32).itensChao.length === 0, 'sem itens não gera chão');
  ok(M.espalharBausEItens({ ...CHUNK, chanceBaus: 99 }, 32).baus.length <= 999, 'chance absurda não estoura');
}

// ---------------------------------------------------------------------
console.log('\n== sorteio de loot ==');
{
  const rng = M.criarRng('loot');
  ok(M.sortearLoot([{ itemId: 'a', chance: 100 }], () => 0.99).length === 1,
    'chance 100 sempre entra');
  ok(M.sortearLoot([{ itemId: 'a', chance: 0 }], () => 0).length === 0,
    'chance 0 nunca entra');
  ok(M.sortearLoot([{ itemId: 'a', chance: 150 }], () => 0.5).length === 1,
    'chance acima de 100 é limitada e ainda entra');
  ok(M.sortearLoot([{ itemId: 'a', chance: -5 }], () => 0).length === 0,
    'chance negativa não entra');
  ok(M.sortearLoot([], rng).length === 0, 'lista vazia não dá loot');
  ok(M.sortearLoot(null, rng).length === 0, 'lista nula não dá loot');

  const quantidade = M.sortearLoot([{ itemId: 'a', chance: 100, qtdMin: 2, qtdMax: 5 }], () => 0.5)[0];
  ok(quantidade.qtd >= 2 && quantidade.qtd <= 5, `quantidade dentro do intervalo (${quantidade.qtd})`);
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);