// Trava o contrato do sistema de chunks.
//
// Existe porque o painel e o motor de chunks precisam concordar em três coisas
// que não se ligam sozinhas:
//
//  1. A CÉLULA DO MAPA É UM CHUNK, não um bloco. Se o painel voltar a usar o
//     tamanho do mundo como lado da grade, o admin posiciona numa célula que
//     não corresponde a lugar nenhum do mundo.
//
//  2. O QUE O ADMIN DESENHO VENCE O SORTEIO. Um chunk posicionado à mão não
//     pode ser substituído pelo preenchimento automático — senão o desenho
//     some e o admin não sabe se o bug é dele ou do gerador.
//
//  3. O MESMO MUNDO PARA TODO MUNDO. A geração tem de ser determinística pela
//     semente, senão cada jogador vê um reino diferente e nenhum ajuste de
//     balanceamento vale para ninguém.
//
// Uso:  node testes/chunks.mjs

import * as M from '../src/core/mundo.js';

const RAIZ_CHUNK = {
  id: 'c1',
  nome: 'caverna de ferro',
  mundoId: 'r1',
  posX: 1,
  posY: 1,
  tamanhoBlocos: 32,
  blocosSuperficie: ['pedra', 'terra'],
  blocosSubSolo: ['ferro'],
  alturaBase: 12,
  alturaVariacao: 3,
  suavizarAltura: 2,
  profundidadeMin: 2,
  profundidadeMax: 5,
  recursos: ['ferro', 'ouro'],
  densidadeRecursos: 0.1,
  mobsNativas: ['slime'],
  densidadeMobs: 0.3,
  npcs: ['ferreiro'],
  estacoes: ['forja'],
  peso: 5,
};

const MUNDO = { id: 'r1', largura: 128, altura: 128, seedBase: 'reino-a' };

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

// ---------------------------------------------------------------------
// 0. Chunk SEM MUNDO vale para qualquer mundo
// ---------------------------------------------------------------------
//
// Este é o caso que quebrou na prática: o admin cadastrou chunks e nada
// aparecia no jogo. O filtro de mundo era aplicado no POSICIONAMENTO e não no
// SORTEIO, então um chunk sem `mundoId` aparecia na célula onde foi posicionado
// e em mais lugar nenhum — mesmo com peso 7.
console.log('\n== chunk sem mundo ==');
{
  ok(
    M.chunksDoMundo([{ id: 'a' }, { id: 'b', mundoId: 'r1' }, { id: 'c', mundoId: 'r2' }], 'r1')
      .map((c) => c.id)
      .join(',') === 'a,b',
    'sem mundo + do mundo atual entram; de outro mundo não',
  );
  ok(
    M.chunksDoMundo([{ id: 'a' }], undefined).length === 1,
    'mundo indefinido ainda aceita o chunk sem mundo',
  );

  const semMundo = { ...RAIZ_CHUNK, mundoId: undefined, peso: 7 };
  const comPesoZero = { ...RAIZ_CHUNK, mundoId: 'r1', peso: 0 };
  const MUNDO_A = { id: 'r1', largura: 128, altura: 128, seedBase: 'a' };

  const sorteado = M.gerarMundoEmChunks(MUNDO_A, [semMundo], 'u1');
  // `sorteado: true` = saiu do sorteio por peso. É ESSA linha que estava
  // faltando: o teste contava as células posicionadas e dava 1, parecendo
  // que o chunk não aparecia em lugar nenhum.
  const sorteadas = sorteado.celulas.filter((c) => c.sorteado);
  const posicionadas = sorteado.celulas.filter((c) => !c.sorteado);

  ok(
    sorteadas.length > 0,
    `chunk SEM mundo e peso 7 aparece no preenchimento automatico (${sorteadas.length} celulas)`);
  ok(
    posicionadas.length === 1,
    `e so a celula posicionada fica de fora do sorteio (${posicionadas.length})`);

  const soPesoZero = M.gerarMundoEmChunks(MUNDO_A, [comPesoZero], 'u1');
  ok(soPesoZero.celulas.every((c) => c.sorteado === false),
    'peso 0 nunca é sorteado — só existe onde foi posicionado');
  ok(soPesoZero.celulas.length === 1,
    `peso 0 só cobre a célula posicionada (${soPesoZero.celulas.length})`);

  // O terreno tem de obedecer a MESMA regra, senão o mapa e o chão divergem.
  const terreno = M.gerarTerrenoMundo(MUNDO_A, [semMundo], { seed: 'u1' });
  ok(terreno.size > 0, `o terreno também usa o chunk sem mundo (${terreno.size} células)`);

  const soDoOutroMundo = M.gerarTerrenoMundo(
    MUNDO_A,
    [{ ...RAIZ_CHUNK, mundoId: 'OUTRO' }],
    { seed: 'u1' },
  );
  ok(soDoOutroMundo.size === 0, 'chunk de outro mundo não gera terreno aqui');
}

// ---------------------------------------------------------------------
// 0b. O cenário real que deu "cadastrei e não contou"
// ---------------------------------------------------------------------
//
// Os três chunks exatamente como apareceram no painel: nenhum com mundo, dois
// com peso 0, e todos posicionados perto. Reproduzido aqui porque é o caso que
// o admin vive.
console.log('\n== cenário real do painel ==');
{
  const CHUNKS_DO_PAINEL = [
    { id: 'a1', nome: 'AAAAAA', mundoId: undefined, peso: 0, posX: 1, posY: 1, tamanhoBlocos: 16,
      blocosSuperficie: ['grama'], blocosSubSolo: ['terra'], alturaBase: 10,
      alturaVariacao: 2, profundidadeMin: 4, profundidadeMax: 8, mobsNativas: ['slime'] },
    { id: 'a2', nome: 'AAAAAA', mundoId: undefined, peso: 0, posX: 1, posY: 1, tamanhoBlocos: 16,
      blocosSuperficie: ['grama'], blocosSubSolo: ['terra'], alturaBase: 10,
      alturaVariacao: 2, profundidadeMin: 4, profundidadeMax: 8, mobsNativas: ['slime'] },
    { id: 'c1', nome: 'Chunk0001', mundoId: undefined, peso: 7, posX: 1, posY: 0, tamanhoBlocos: 8,
      blocosSuperficie: ['grama'], blocosSubSolo: ['terra'], alturaBase: 10,
      alturaVariacao: 2, profundidadeMin: 4, profundidadeMax: 8, mobsNativas: ['slime'] },
  ];

  const mundo = { id: 'r1', largura: 60, altura: 44, seedBase: 'reino' };
  const terreno = M.gerarTerrenoMundo(mundo, CHUNKS_DO_PAINEL, { seed: 'u1' });

  ok(terreno.size > 0, `o terreno nasce dos 3 chunks (${terreno.size} células)`);

  const comChao = new Set();
  let superficie = 0;
  let subsolo = 0;
  for (const cel of terreno.values()) {
    if (cel.camada === 'superficie') { superficie += 1; comChao.add(cel.x); }
    else subsolo += 1;
  }
  ok(comChao.size > 0, `há chão em ${comChao.size} colunas`);
  ok(subsolo > 0, `e ${subsolo} células de subsolo para cavar`);
  ok(superficie > 0, `com ${superficie} de superfície`);

  // O chunk de peso 7 tem de aparecer além do ponto onde foi posicionado.
  const celulas = M.gerarMundoEmChunks(mundo, CHUNKS_DO_PAINEL, 'u1').celulas;
  const sorteadas = celulas.filter((c) => c.sorteado);
  ok(sorteadas.length > 0,
    `o chunk de peso 7 preenche ${sorteadas.length} células fora do desenho`);

  // Os dois de peso 0 estão na MESMA célula (1,1) e têm o MESMO nome. É o caso
  // em que peso e nome não desempatam, e quem vence não pode depender da ordem
  // de leitura do Firestore — ou dois jogadores veem terrenos diferentes.
  const indice = M.indexarChunks(CHUNKS_DO_PAINEL);
  const vencedor = M.chunkVigente(indice, 1, 1);
  ok(['a1', 'a2'].includes(vencedor?.id), `na célula 1,1 vence um dos dois (${vencedor?.id})`);

  const invertido = M.indexarChunks([...CHUNKS_DO_PAINEL].reverse());
  ok(M.chunkVigente(invertido, 1, 1)?.id === vencedor?.id,
    `a ordem de leitura não muda quem vence (${M.chunkVigente(invertido, 1, 1)?.id})`);

  const soODuplicado = M.indexarChunks([
    { id: 'zzz', nome: 'igual', peso: 0, posX: 5, posY: 5 },
    { id: 'aaa', nome: 'igual', peso: 0, posX: 5, posY: 5 },
  ]);
  ok(M.chunkVigente(soODuplicado, 5, 5)?.id === 'aaa',
    'com nome e peso iguais, o desempate é pelo id (menor primeiro)');
}

// ---------------------------------------------------------------------
// 1. Grade: a célula é o chunk
// ---------------------------------------------------------------------
console.log('\n== a célula do mapa é um chunk ==');
{
  // Mundo de 128 blocos com chunk de 32 é uma grade 4×4 — não 128×128.
  ok(
    M.TAMANHO_CHUNK_PADRAO === 32,
    'o chunk padrão é 32 blocos (metade da largura de um mundo médio)',
  );
  ok(M.blocoParaChunk(0) === 0 && M.blocoParaChunk(32) === 1 && M.blocoParaChunk(63) === 1,
    'blocoParaChunk coloca 0..31 no chunk 0 e 32..63 no chunk 1');
  ok(M.blocoParaChunk(64, 16) === 4, 'blocoParaChunk respeita o tamanho do chunk');
  ok(M.chunkParaBloco(2, 32) === 64, 'chunkParaBloco volta para o primeiro bloco');

  // O terreno tem de gerar o número de colunas que o admin marcou. Gerar
  // sempre 32 dentro de uma célula que o painel desenhou como 8×8 faz o chunk
  // vazar para o vizinho.
  ok(M.tamanhoDoChunk({ tamanhoBlocos: 8 }) === 8, 'o chunk usa o tamanho escolhido');
  ok(M.tamanhoDoChunk({ tamanhoBlocos: 64 }) === 64, 'tamanho grande respeitado');
  ok(M.tamanhoDoChunk({}) === 32, 'sem tamanho, cai no padrão');
  ok(M.tamanhoDoChunk({ tamanhoBlocos: 7 }) === 32, 'tamanho fora da lista cai no padrão');
  ok(M.tamanhoDoChunk(null) === 32, 'chunk nulo cai no padrão');

  const pequeno = M.gerarTerreno(
    { ...RAIZ_CHUNK, tamanhoBlocos: 8 },
    M.tamanhoDoChunk({ tamanhoBlocos: 8 }),
  );
  ok(pequeno.length === 8, `terreno de um chunk 8×8 tem 8 colunas (${pequeno.length})`);
}

// ---------------------------------------------------------------------
// 2. O desenho do admin vence o sorteio
// ---------------------------------------------------------------------
console.log('\n== o mapa do admin manda ==');
{
  const indice = M.indexarChunks([RAIZ_CHUNK]);
  ok(indice.has('1,1'), 'o chunk posicionado entra no índice da célula');
  ok(!indice.has('5,5'), 'célula sem chunk não aparece no índice');

  const achado = M.chunkVigente(indice, 1, 1);
  ok(achado?.id === 'c1', 'a célula posicionada devolve o chunk que o admin pôs ali');
  ok(M.chunkVigente(indice, 5, 5, () => 0) === null,
    'célula vazia sem candidatos devolve null em vez de adivinhar');

  // Dois chunks na mesma célula: o de MAIOR peso vence, e empate desempata pelo
  // nome — para o resultado não depender da ordem de leitura do Firestore.
  const dois = M.indexarChunks([
    { ...RAIZ_CHUNK, id:'fraco', nome:'a-fraco', peso: 1 },
    { ...RAIZ_CHUNK, id:'forte', nome:'z-forte', peso: 9 },
  ]);
  ok(M.chunkVigente(dois, 1, 1)?.id === 'forte', 'com dois chunks na célula, o de maior peso vence');

  const empate = M.indexarChunks([
    { ...RAIZ_CHUNK, id:'b', nome:'b', peso: 5 },
    { ...RAIZ_CHUNK, id:'a', nome:'a', peso: 5 },
  ]);
  ok(M.chunkVigente(empate, 1, 1)?.id === 'a', 'empate de peso desempata pelo nome (ordem estável)');
}

// ---------------------------------------------------------------------
// 3. Sorteio por peso
// ---------------------------------------------------------------------
console.log('\n== sorteio por peso ==');
{
  ok(M.sorteiaChunk([], () => 0) === null, 'sem chunks, o sorteio devolve null');
  ok(M.sorteiaChunk([{ ...RAIZ_CHUNK, peso: 0 }], () => 0) === null,
    'peso 0 = nunca sorteado (só onde o admin posicionou)');

  const pool = [
    { id:'comum', nome:'comum', peso: 8 },
    { id:'raro', nome:'raro', peso: 2 },
  ];
  // rng fixo: 0 -> primeiro alvo, 0.99 -> último.
  ok(M.sorteiaChunk(pool, () => 0)?.id === 'comum', 'sorteio pega o primeiro quando rng = 0');
  ok(M.sorteiaChunk(pool, () => 0.99)?.id === 'raro', 'sorteio pega o último quando rng = 0.99');

  // Contagem: peso 8 contra 2 tem que sair ~80/20 em muitas amostras.
  const rng = M.criarRng('amostragem-peso');
  let raro = 0;
  for (let i = 0; i < 2000; i += 1) if (M.sorteiaChunk(pool, rng)?.id === 'raro') raro += 1;
  ok(raro > 250 && raro < 550, `peso 8:2 dá ~20% de raro (veio ${(raro / 20).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------
// 4. Determinismo
// ---------------------------------------------------------------------
console.log('\n== mesma semente, mesmo mundo ==');
{
  const a = M.gerarMundoEmChunks(MUNDO, [RAIZ_CHUNK], 'jogador-1');
  const b = M.gerarMundoEmChunks(MUNDO, [RAIZ_CHUNK], 'jogador-2');
  ok(JSON.stringify(a.celulas) === JSON.stringify(b.celulas),
    'dois jogadores diferentes veem o mesmo mundo');

  const c = M.gerarMundoEmChunks(MUNDO, [RAIZ_CHUNK], 'jogador-1');
  ok(JSON.stringify(a.celulas) === JSON.stringify(c.celulas), 'repetir a geração dá o mesmo resultado');

  ok(M.sementeDoChunk(RAIZ_CHUNK) !== M.sementeDoChunk({ ...RAIZ_CHUNK, biomaId: 'outro' }),
    'o bioma entra na semente (mesmo nome em biomas diferentes não gera igual)');
}

// ---------------------------------------------------------------------
// 5. A grade do mundo cobre todos os chunks
// ---------------------------------------------------------------------
console.log('\n== o mundo é preenchido ==');
{
  const w = M.gerarMundoEmChunks(MUNDO, [RAIZ_CHUNK], 'u1');
  ok(w.celulas.length === 16, `mundo 128x128 com chunk 32 dá 4x4 = 16 células (veio ${w.celulas.length})`);

  const desenhada = w.celulas.find((c) => c.cx === 1 && c.cy === 1);
  ok(desenhada && desenhada.nome === RAIZ_CHUNK.nome, 'a célula desenhada tem o chunk do admin');
  ok(desenhada && desenhada.sorteado === false, 'a célula desenhada é marcada como NÃO sorteada');

  const sorteada = w.celulas.find((c) => c.cx !== 1 || c.cy !== 1);
  ok(sorteada && sorteada.sorteado === true,
    'as outras células são marcadas como sorteadas (o painel mostra a diferença)');

  // Mundo pequeno com chunk grande: a grade encolhe, não estoura.
  //
  // A célula (0,0) existe e é preenchida pelo SORTEIO — o chunk está em (1,1),
  // que não cabe num mundo de 1×1 célula. Ou seja: o chunk posicionado fora do
  // mundo é ignorado como posição, mas continua(valendo no sorteio. É o
  // comportamento certo: um chunk pesado que o admin registrou deve existir em
  // algum lugar do mundo, mesmo que ninguém o posicionou.
  const pequeno = M.gerarMundoEmChunks({ id:'r1', largura: 32, altura: 32 }, [RAIZ_CHUNK], 'u1');
  ok(pequeno.celulas.length === 1,
    `mundo 32x32 com chunk 32 dá 1x1 = 1 célula (veio ${pequeno.celulas.length})`);
  ok(pequeno.celulas[0].sorteado === true,
    'a célula fora do desenho do admin é marcada como sorteada');
  ok(pequeno.celulas.every((c) => c.cx === 0 && c.cy === 0),
    'nenhuma célula nasce fora dos limites do mundo');
}

// ---------------------------------------------------------------------
// 6. Conteúdo e terreno
// ---------------------------------------------------------------------
console.log('\n== conteudo e terreno ==');
{
  const c = M.gerarConteudo(RAIZ_CHUNK, 32);
  ok(c.recursos.length === Math.round(32 * 32 * 0.1),
    `recursos = área × densidade (${c.recursos.length})`);
  ok(c.npcs.length === 1 && c.npcs[0].npcId === 'ferreiro', 'NPC entra uma vez, na posição sorteada');
  ok(c.estacoes.length === 1, 'estação entra uma vez');
  ok(c.recursos.every((r) => r.col >= 0 && r.col < 32 && r.linha >= 0 && r.linha < 32),
    'todo recurso cai dentro do chunk');
  ok(c.mobs.every((m) => m.x >= 0 && m.x < 1 && m.y >= 0 && m.y < 1),
    'mobs usam coordenada normalizada 0..1');

  // Densidade 0 e lista vazia: nada, e sem exceção.
  const vazio = M.gerarConteudo({ ...RAIZ_CHUNK, recursos: [], mobsNativas: [] }, 32);
  ok(vazio.recursos.length === 0 && vazio.mobs.length === 0, 'sem lista de blocos/mobs, não gera nada');
  const zerado = M.gerarConteudo({ ...RAIZ_CHUNK, densidadeRecursos: 0, densidadeMobs: 0 }, 32);
  ok(zerado.recursos.length === 0 && zerado.mobs.length === 0, 'densidade 0 não gera nada');

  // Densidade fora de 0..1 não pode explodir nem virar negativo.
  const altissima = M.gerarConteudo({ ...RAIZ_CHUNK, densidadeRecursos: 99 }, 32);
  ok(altissima.recursos.length === 32 * 32, 'densidade > 1 é limitada a um recurso por bloco');

  const t = M.gerarTerreno(RAIZ_CHUNK, 32);
  ok(t.length === 32, 'terreno tem uma coluna por bloco de largura');
  ok(t.every((col) => col.profundidade >= 2 && col.profundidade <= 5),
    'profundidade respeita o mínimo e o máximo');
  ok(t.every((col) => col.x >= 0 && col.x < 32), 'coluna sabe o próprio X');
  ok(t.every((col) => col.profundidade === 0 || col.subsolo),
    'profundidade > 0 exige um bloco de subsolo escolhido');

  // Profundidade mínima acima do máximo não pode inverter o intervalo.
  const invertido = M.gerarTerreno({ ...RAIZ_CHUNK, profundidadeMin: 9, profundidadeMax: 2 }, 32);
  ok(invertido.every((col) => col.profundidade === 9),
    'profundidadeMin > profundidadeMax trava no mínimo, não gera número impossível');
}

// ---------------------------------------------------------------------
// 7. Heightmap
// ---------------------------------------------------------------------
console.log('\n== altura do terreno ==');
{
  const plano = M.gerarHeightmap({ ...RAIZ_CHUNK, alturaVariacao: 0 }, 32);
  ok(plano.length === 32, 'heightmap tem uma altura por coluna');
  ok(plano.every((h) => h === RAIZ_CHUNK.alturaBase), 'variação 0 dá chão plano na altura base');

  const bruto = M.gerarHeightmap({ ...RAIZ_CHUNK, alturaVariacao: 10, suavizarAltura: 0 }, 32);
  const suave = M.gerarHeightmap({ ...RAIZ_CHUNK, alturaVariacao: 10, suavizarAltura: 3 }, 32);
  const degraus = (a) => a.reduce((s, h, i) => (i ? s + Math.abs(h - a[i - 1]) : 0), 0);
  ok(degraus(suave) <= degraus(bruto),
    `suavizar reduz o degrau entre colunas (${degraus(suave)} <= ${degraus(bruto)})`);

  ok(M.gerarHeightmap(RAIZ_CHUNK, 64).length === 64, 'o heightmap segue o tamanho pedido');

  // Variação negativa não pode gerar altura invertida de forma absurda.
  const neg = M.gerarHeightmap({ ...RAIZ_CHUNK, alturaVariacao: -5 }, 32);
  ok(neg.every((h) => h === RAIZ_CHUNK.alturaBase),
    'variação negativa é tratada como zero');
}

// ---------------------------------------------------------------------
// 8. Semente vazia não vira mundo diferente a cada chamada
// ---------------------------------------------------------------------
console.log('\n== chunk sem seedBase ==');
{
  const semSeed = { ...RAIZ_CHUNK, seedBase: '' };
  const a = M.gerarConteudo(semSeed, 32);
  const b = M.gerarConteudo(semSeed, 32);
  ok(JSON.stringify(a) === JSON.stringify(b),
    'sem seedBase explícita ainda é estável (cai no nome do chunk)');
  ok(M.sementeDoChunk(semSeed).includes('caverna de ferro'),
    'a semente cai no nome do chunk quando seedBase está vazia');
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);