// Verificacao da logica pura (personagem/catalogo). Rodar com:
//   node testes/logica.mjs
import { carregarCatalogo, buscarClasse, receitasDaEstacao, monstrosParaNivel } from '../src/core/catalogo.js';
import {
  estadoInicial,
  calcularDerivados,
  inventarioInicial,
  adicionarItem,
  consumirItem,
  contarItem,
  aplicarOrbe,
  nivelDeUpgrades,
  estatisticasComUpgrades,
  desbloquearTalento,
  talentosAtivos,
  redefinirArvore,
  avaliarConquistas,
  aplicarConquistas,
  somarMapas,
  bonusEquipados,
} from '../src/core/personagem.js';
import { calcularNivel, xpParaProximoNivel } from '../src/core/progresso.js';

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log('  ok  -', msg);
  else {
    falhas += 1;
    console.log('  FAIL-', msg);
  }
}

console.log('\n== catalogo (semente) ==');
const catalogo = await carregarCatalogo();
ok(catalogo.itens.length >= 20, `itens: ${catalogo.itens.length}`);
ok(catalogo.classes.length === 4, `classes: ${catalogo.classes.length}`);
ok(catalogo.skills.length >= 20, `talentos: ${catalogo.skills.length}`);
ok(catalogo.monsters.length === 6, `monstros: ${catalogo.monsters.length}`);
ok(catalogo.recipes.length === 9, `receitas: ${catalogo.recipes.length}`);
ok(catalogo.worldTemplates.length === 4, `reinos: ${catalogo.worldTemplates.length}`);
ok(catalogo.achievements.length === 7, `conquistas: ${catalogo.achievements.length}`);

// todo item tem uso definido
const semUso = catalogo.itens.filter((i) => !Array.isArray(i.uso) || !i.uso.length);
ok(semUso.length === 0, `todos os itens tem uso definido (sem uso: ${semUso.length})`);

// ids unicos
for (const chave of Object.keys(catalogo.indice)) {
  const lista = catalogo[chave === 'worldTemplates' ? 'worldTemplates' : chave];
  const ids = lista.map((i) => i.id);
  ok(new Set(ids).size === ids.length, `ids unicos em ${chave}`);
}

console.log('\n== atributos derivados ==');
const e1 = estadoInicial();
e1.vocacaoId = 'guerreiro';
e1.nivel = 10;
e1.atributos = { fis: 10, men: 5, soc: 5 };
const d1 = calcularDerivados(e1, buscarClasse(catalogo, 'guerreiro'), []);
ok(d1.fis > 5, `FIS derivado: ${d1.fis}`);
ok(d1.vidaMax > 80, `Vida maxima: ${d1.vidaMax}`);
ok(d1.defesa > 0, `Defesa: ${d1.defesa}`);
ok(d1.poderMineracao > 0, `Poder de mineracao: ${d1.poderMineracao}`);

// nivel 1 sem classe nao quebra
const d0 = calcularDerivados(estadoInicial(), null, []);
ok(Number.isFinite(d0.vidaMax) && d0.vidaMax > 0, `derivados sem classe: vida ${d0.vidaMax}`);

console.log('\n== inventario ==');
const inv = inventarioInicial();
adicionarItem(inv, 'pedra', 10);
ok(contarItem(inv, 'pedra') === 10, 'adicionou 10 pedras');
adicionarItem(inv, 'pedra', 5);
ok(inv.itens.length === 1, 'empilhou (1 pilha)');
ok(contarItem(inv, 'pedra') === 15, 'total 15 pedras');
consumirItem(inv, 'pedra', 6);
ok(contarItem(inv, 'pedra') === 9, 'consumiu 6');
adicionarItem(inv, 'picareta_ferro', 1, 1);
ok(contarItem(inv, 'picareta_ferro') === 1, 'adicionou ferramenta');

// slots/uid unicos
const uids = inv.itens.map((p) => p.uid);
ok(new Set(uids).size === uids.length, `uids unicos: ${uids.join(',')}`);

console.log('\n== orbes arcanos ==');
const pilha = inv.itens.find((p) => p.itemId === 'pedra');
const r1 = aplicarOrbe(pilha, 'orbe_arcano_menor', 3, 10, 1);
ok(r1.ok, `aplicou orbe menor (nivel ${nivelDeUpgrades(pilha)})`);
const rFora = aplicarOrbe(pilha, 'orbe_arcano_epico', 3, 10, 1);
ok(!rFora.ok, `orbe fora de faixa rejeitado: ${rFora.motivo}`);
// esgota slots: 3 slots precisam de 3 aplicacoes
aplicarOrbe(pilha, 'orbe_arcano_menor', 3, 10, 1);
aplicarOrbe(pilha, 'orbe_arcano_menor', 3, 10, 1);
const rSlots = aplicarOrbe(pilha, 'orbe_arcano_menor', 3, 10, 1);
ok(!rSlots.ok, `slots cheios rejeitam: ${rSlots.motivo}`);
ok(nivelDeUpgrades(pilha) === 3, `nivel de upgrade travou em ${nivelDeUpgrades(pilha)}`);

const defPedra = catalogo.indice.itens.pedra;
const up = estatisticasComUpgrades({ ...defPedra, defesa: 10 }, pilha);
ok(up.defesa > 10, `defesa escalou com ${up.nivelOrbe} orbe(s): ${up.defesa}`);

console.log('\n== talentos ==');
const e2 = estadoInicial();
e2.vocacaoId = 'guerreiro';
e2.nivel = 10;
e2.pontosTalento = 10;
const gVigor = catalogo.indice.skills.g_vigor;
ok(desbloquearTalento(e2, gVigor, catalogo).ok, 'desbloqueou Vigor Bestial');
const gPunho = catalogo.indice.skills.g_punho;
ok(desbloquearTalento(e2, gPunho, catalogo).ok, 'desbloqueou Punho de Ferro (pre-req ok)');
ok(e2.pontosTalento === 8, `pontos descontados: ${e2.pontosTalento}`);

// pre-requisito ausente
const e3 = estadoInicial();
e3.vocacaoId = 'guerreiro';
e3.nivel = 10;
e3.pontosTalento = 10;
ok(!desbloquearTalento(e3, catalogo.indice.skills.g_espada, catalogo).ok, 'bloqueia sem pre-requisito');

// classe errada
ok(!desbloquearTalento(e3, catalogo.indice.skills.a_foco, catalogo).ok, 'bloqueia talento de outra classe');

// nivel insuficiente
ok(!desbloquearTalento(e3, catalogo.indice.skills.g_espada, catalogo).ok, 'bloqueia por pre-req/ nivel');

const ativos = talentosAtivos(catalogo, e2);
ok(ativos.length === 2, `talentos ativos: ${ativos.length}`);
const d2 = calcularDerivados(e2, buscarClasse(catalogo, 'guerreiro'), ativos);
ok(d2.vidaMax > calcularDerivados({ ...e2, arvoreDesbloqueada: [] }, buscarClasse(catalogo, 'guerreiro'), []).vidaMax,
  `talento aumentou Vida: ${d2.vidaMax}`);

// respec
const devolvidos = redefinirArvore(e2, catalogo);
ok(e2.arvoreDesbloqueada.length === 0, 'respec limpou a arvore');
ok(e2.pontosTalento === 10, `respec devolveu ${devolvidos} pontos`);

console.log('\n== equipamentos ==');
const e4 = estadoInicial();
e4.nivel = 15;
e4.vocacaoId = 'guerreiro';
const inv4 = inventarioInicial();
adicionarItem(inv4, 'armadura_placas', 1, 1);
e4.inventario = inv4;
const uidArm = inv4.itens[0].uid;
inv4.equipado.corpo = uidArm;
const bonus = bonusEquipados(e4, catalogo);
ok(bonus.defesa > 0, `bonus de armadura: defesa +${bonus.defesa}, vida +${bonus.vidaMax}`);

console.log('\n== conquistas ==');
const e5 = estadoInicial();
e5.nivel = 12;
e5.stats.inimigosDerrotados = 30;
e5.stats.blocosColocados = 60;
const novas = avaliarConquistas(catalogo, e5);
ok(novas.length >= 3, `conquistas detectadas: ${novas.map((c) => c.id).join(', ')}`);
const recompensa = aplicarConquistas(e5, novas);
ok(recompensa.xp > 0 && recompensa.ouro > 0, `recompensa: ${recompensa.xp} xp, ${recompensa.ouro} ouro`);
ok(Object.keys(recompensa.orbes).length > 0, `orbes: ${JSON.stringify(recompensa.orbes)}`);
const segunda = avaliarConquistas(catalogo, e5);
ok(segunda.length === 0, 'nao repete conquistas ja conquistadas');
const soma = somarMapas({ a: 1 }, { a: 2, b: 3 });
ok(soma.a === 3 && soma.b === 3, `somarMapas: ${JSON.stringify(soma)}`);

console.log('\n== nivel e xp ==');
ok(calcularNivel(0).nivel === 1, '0 xp = nivel 1');
ok(xpParaProximoNivel(1) === 100, 'nivel 1->2 custa 100');
ok(calcularNivel(100).nivel === 2, '100 xp = nivel 2');
ok(calcularNivel(100 + xpParaProximoNivel(2)).nivel === 3, 'acumulado = nivel 3');

console.log('\n== receitas e spawns ==');
ok(receitasDaEstacao(catalogo, 'forja', 1).length === 2, 'receitas de forja no nivel 1');
ok(receitasDaEstacao(catalogo, 'prensa_arcana', 1).length === 0, 'prensa bloqueada no nivel 1');
ok(receitasDaEstacao(catalogo, 'prensa_arcana', 20).length > 0, 'prensa liberada no nivel 20');
ok(monstrosParaNivel(catalogo, 1).length > 0, 'monstros no nivel 1');
ok(monstrosParaNivel(catalogo, 1).every((m) => m.faixaMin <= 1), 'spawns do nivel 1 sao validos');

// loot dos monstros referencia itens existentes
const lootQuebrado = [];
for (const m of catalogo.monsters) {
  for (const l of m.loot ?? []) {
    if (!catalogo.indice.itens[l.itemId]) lootQuebrado.push(`${m.id}->${l.itemId}`);
  }
}
ok(lootQuebrado.length === 0, `loot referencia itens validos (ruins: ${lootQuebrado.join(',') || 'nenhum'})`);

// receitas referenciam itens validos
const recQuebrada = [];
for (const r of catalogo.recipes) {
  for (const i of [...(r.insumos ?? []), ...(r.saida ?? [])]) {
    if (!catalogo.indice.itens[i.itemId]) recQuebrada.push(`${r.id}->${i.itemId}`);
  }
}
ok(recQuebrada.length === 0, `receitas referenciam itens validos (ruins: ${recQuebrada.join(',') || 'nenhum'})`);

// pre-requisitos de talentos existem
const preQuebrado = [];
for (const t of catalogo.skills) {
  for (const p of t.preRequisitos ?? []) {
    if (!catalogo.indice.skills[p]) preQuebrado.push(`${t.id}->${p}`);
  }
}
ok(preQuebrado.length === 0, `pre-requisitos validos (ruins: ${preQuebrado.join(',') || 'nenhum'})`);

// talentos de classe existente
const orfaos = catalogo.skills.filter((t) => !catalogo.indice.classes[t.classeId]);
ok(orfaos.length === 0, `talentos orfaos: ${orfaos.length}`);

console.log('\n== portais por nivel ==');
ok(catalogo.worldTemplates.every((r) => r.faixaMin >= 1), 'reinos com nivel min valido');

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM\n' : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
