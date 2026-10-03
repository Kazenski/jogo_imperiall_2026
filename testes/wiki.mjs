// Prova o cruzamento da wiki: um item e TUDO que o envolve.
//
// Um join errado aqui produz "nenhuma receita usa ferro" — silencioso, e
// parecido com dado faltando. Então a cobertura é de formato (array e texto) e
// de origem (cada coleção que pode conter o item).
import { normalizarLista, normalizarConteudoBaus, referenciasDoItem, propriedadesDoItem } from '../src/core/wiki.js';

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

const CATALOGO = {
  itens: [
    { id: 'ferro', nome: 'Ferro', tipo: 'bloco', uso: ['estrutura', 'extracao'], slotsUpgrade: 1 },
    { id: 'pedra', nome: 'Pedra', tipo: 'bloco', uso: ['estrutura'] },
    { id: 'espada_ferro', nome: 'Espada de Ferro', tipo: 'equipavel', dano: 12, defeito: 0 },
    { id: 'pocao_vida', nome: 'Poção de Vida', tipo: 'consumivel', uso: ['utilizacao'] },
    { id: 'bau_comum', nome: 'Baú Comum', tipo: 'bloco', uso: ['estrutura'] },
  ],
  recipes: [
    { id: 'r1', nome: 'Espada de Ferro', estacao: 'forja', nivelMin: 2, tempoMs: 2000, custoPoder: 5,
      insumos: [{ itemId: 'ferro', qtd: 3 }, { itemId: 'pedra', qtd: 1 }], saida: [{ itemId: 'espada_ferro', qtd: 1 }] },
    { id: 'r2', nome: 'Poção de Vida', estacao: 'alambique', nivelMin: 1, tempoMs: 1500,
      insumos: 'ferro:1, agua:2', saida: 'pocao_vida:2' },
  ],
  monsters: [
    { id: 'm1', nome: 'Slime', faixaMin: 1, loot: 'ferro:20:2, pedra:80:5' },
    { id: 'm2', nome: 'Golem', faixaMin: 5, loot: [{ itemId: 'ferro', chance: 90, qtdMax: 4 }] },
  ],
  worldTemplates: [{ id: 'r9', nome: 'Campo', recursosAbundantes: ['pedra'] }],
  biomas: [
    { id: 'b1', nome: 'Floresta', blocosNativos: ['pedra'], blocosSuperficie: ['ferro'] },
  ],
  chunks: [
    { id: 'c1', nome: 'Mina', mundoId: 'r9', recursos: ['ferro'],
      conteudoBaus: [{ bauId: 'bau_comum', itens: [{ itemId: 'ferro', chance: 40, qtdMax: 2 }] }],
      itensChao: [{ itemId: 'pedra', qtd: 3 }] },
  ],
  npcs: [
    { id: 'n1', nome: 'Ferreiro', mundoId: 'r9', loja: 'ferro:10:25' },
  ],
  skills: [{ id: 't1', nome: 'Mão Firme' }],
};

// ---------------------------------------------------------------------
console.log('\n== normalizar listas ==');
{
  ok(normalizarLista('ferro:3, madeira:2').length === 2, 'texto item:qtd vira 2 entradas');
  ok(normalizarLista('ferro:3')[0].qtd === 3, 'o segundo campo de item:qtd é quantidade');
  ok(normalizarLista('ferro:20:2')[0].chance === 20, 'o segundo campo de item:chance:qtd é chance');
  ok(normalizarLista('ferro:20:2')[0].qtd === 2, 'e o terceiro é quantidade');

  ok(normalizarLista([{ itemId: 'a', qtdMax: 5, chance: 30 }])[0].qtd === 5, 'array usa qtdMax');
  ok(normalizarLista(undefined).length === 0, 'undefined nao quebra');
  ok(normalizarLista(null).length === 0, 'null nao quebra');
  ok(normalizarLista('').length === 0, 'texto vazio nao quebra');
  ok(normalizarLista('   ').length === 0, 'so espacos nao quebra');

  ok(normalizarLista('a:2:100', { preco: true })[0].preco === 100, 'loja: item:qtd:preco');
  ok(normalizarLista('a:2:100', { preco: true })[0].qtd === 2, 'loja: o segundo ainda e quantidade');

  ok(normalizarLista('a::2').length === 1, 'campo vazio no meio nao descarta a entrada');
  ok(normalizarLista('a:0').length === 1, 'quantidade zero nao descarta a entrada');
  ok(normalizarLista(':5').length === 0, 'item vazio descarta');
  ok(normalizarLista('a:1, a:2').length === 2, 'duplicatas sao mantidas (sao pilhas diferentes)');
  ok(normalizarLista('a|b;c, d').length === 4, 'aceita barra, ponto-e-virgula e virgula');

  const bau = normalizarConteudoBaus('bau_a:ferro:40:2, bau_a:pedra:90:5, bau_b:ouro:10:1');
  ok(bau.length === 2, 'conteudoBaus agrupa por bau');
  ok(bau[0].bauId === 'bau_a' && bau[0].itens.length === 2, 'o primeiro baus tem 2 itens');
  ok(normalizarConteudoBaus(null).length === 0, 'conteudoBaus nulo nao quebra');
  ok(normalizarConteudoBaus([]).length === 0, 'conteudoBaus vazio nao quebra');
}

// ---------------------------------------------------------------------
console.log('\n== receitas ==');
{
  const ferro = referenciasDoItem(CATALOGO, 'ferro');
  ok(ferro.producao.length === 0, 'ferro nao e produzido por receita nenhuma');
  ok(ferro.consumo.length === 2, `ferro e usado em 2 receitas (veio ${ferro.consumo.length})`);

  const nomes = ferro.consumo.map((c) => c.receita).sort();
  ok(nomes.join(',') === 'Espada de Ferro,Poção de Vida', `usa em: ${nomes.join(' e ')}`);

  const espada = ferro.consumo.find((c) => c.receita === 'Espada de Ferro');
  ok(espada.estacao === 'Forja', `a estação sai com nome legível (${espada.estacao})`);
  ok(espada.nivelMin === 2, 'e o nível mínimo');
  ok(espada.outros.length === 1 && espada.outros[0].nome === 'Pedra',
    `e os outros insumos por nome (${espada.outros.map((o) => o.nome).join(', ')})`);
  ok(espada.outros[0].qtd === 1, 'com a quantidade');

  const pocao = ferro.consumo.find((c) => c.receita === 'Poção de Vida');
  ok(pocao.outros.length === 1, 'a receita em TEXTO tambem foi entendida');
  ok(pocao.outros[0].nome === 'Agua', `inclusive itens que nao existem no catalogo (${pocao.outros[0].nome})`);
  ok(pocao.outros[0].desconhecido === true, 'e sao marcados como referencia pendurada');
  ok(espada.outros[0].desconhecido === false, 'item que existe NAO e marcado');

  const producao = referenciasDoItem(CATALOGO, 'espada_ferro');
  ok(producao.producao.length === 1, 'a espada é produzida por 1 receita');
  ok(producao.producao[0].quantidade === 1, 'com a quantidade produzida');
  ok(producao.producao[0].segundos === 2, 'e o tempo em segundos');
}

// ---------------------------------------------------------------------
console.log('\n== onde encontrar ==');
{
  const ferro = referenciasDoItem(CATALOGO, 'ferro');
  const tipos = ferro.ondeEncontrar.map((o) => o.tipo).sort();

  ok(tipos.includes('bau'), 'aparece dentro de baú de chunk');
  ok(tipos.includes('bioma'), 'aparece como superfície de bioma');
  ok(tipos.includes('monstro'), 'aparece como drop de monstro');
  ok(!tipos.includes('mundo'), 'e NÃO aparece como recurso do mundo (ali é pedra)');

  const bau = ferro.ondeEncontrar.find((o) => o.tipo === 'bau');
  ok(bau.chance === 40 && bau.quantidade === 2, `baú traz chance e quantidade (${bau.chance}%, x${bau.quantidade})`);
  ok(String(bau.titulo).includes('Mina'), 'e o nome do chunk');
  ok(String(bau.titulo).includes('Campo'), 'com o mundo entre parênteses');

  const drops = ferro.ondeEncontrar.filter((o) => o.tipo === 'monstro');
  ok(drops.length === 2, `os 2 monstros dropam ferro (${drops.map((d) => `${d.titulo}:${d.chance}%`).join(', ')})`);

  const pedra = referenciasDoItem(CATALOGO, 'pedra');
  ok(pedra.ondeEncontrar.some((o) => o.tipo === 'mundo'), 'pedra é recurso abundante de um mundo');
  ok(pedra.ondeEncontrar.some((o) => o.tipo === 'itemChao'), 'e aparece no chão de um chunk');
  ok(pedra.ondeEncontrar.some((o) => o.tipo === 'bioma'), 'e é bloco nativo de bioma');

  const bauItem = referenciasDoItem(CATALOGO, 'bau_comum');
  ok(bauItem.ondeEncontrar.length === 0, 'um baú que não está em lugar nenhum não inventa origem');
}

// ---------------------------------------------------------------------
console.log('\n== loja de NPC ==');
{
  const ferro = referenciasDoItem(CATALOGO, 'ferro');
  const loja = ferro.ondeEncontrar.find((o) => o.tipo === 'loja');
  ok(Boolean(loja), 'o ferreiro vende ferro');
  ok(loja.titulo === 'Ferreiro', 'com o nome do NPC');
  ok(loja.preco === 25, `e o preço (${loja.preco} ouro)`);
  ok(loja.mundo === 'Campo', 'e o mundo onde ele está');
}

// ---------------------------------------------------------------------
console.log('\n== propriedades ==');
{
  const ferro = referenciasDoItem(CATALOGO, 'ferro');
  const props = new Map(ferro.propriedades);
  ok(props.get('Tipo') === 'bloco', 'mostra o tipo');
  ok(props.get('Uso') === 'estrutura, extracao', 'mostra os usos');
  ok(props.get('Slots de orbe') === '1', 'mostra os slots de orbe');

  ok(propriedadesDoItem(null).length === 0, 'item inexistente não quebra');
  ok(propriedadesDoItem({}).length === 0, 'item vazio devolve lista vazia');

  const efeitos = propriedadesDoItem({ tipo: 'ferramenta', efeitos: { dano: 5, velocidade: -1 } });
  const mapa = new Map(efeitos);
  ok(mapa.get('dano') === '+5', 'efeito positivo ganha sinal');
  ok(mapa.get('velocidade') === '-1', 'efeito negativo mantém o sinal');

  const pre = propriedadesDoItem({ preRequisitos: ['t1'] }, CATALOGO);
  ok(new Map(pre).get('Pré-requisitos') === 'Mão Firme', 'pré-requisito sai pelo nome, não pelo id');
}

// ---------------------------------------------------------------------
console.log('\n== entradas vazias ==');
{
  const nada = referenciasDoItem(CATALOGO, '');
  ok(nada.item === null && nada.producao.length === 0, 'item vazio devolve tudo nulo');
  ok(referenciasDoItem(null, 'ferro').producao.length === 0, 'catalogo nulo nao quebra');
  ok(referenciasDoItem({}, 'ferro').item === null, 'catalogo sem itens nao quebra');
  ok(referenciasDoItem(CATALOGO, 'nao_existe').item === null, 'item inexistente devolve item nulo');

  const semReceitas = referenciasDoItem({ itens: CATALOGO.itens }, 'ferro');
  ok(semReceitas.producao.length === 0 && semReceitas.consumo.length === 0, 'sem receitas nao quebra');
  ok(semReceitas.propriedades.length > 0, 'e ainda mostra as propriedades do item');
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);