// Verificacao da logica pura (personagem/catalogo). Rodar com:
//   node testes/logica.mjs
import fs from 'node:fs';
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
  talentoDisponivel,
  atributosAtendidos,
  talentosAtivos,
  redefinirArvore,
  avaliarConquistas,
  aplicarConquistas,
  somarMapas,
  bonusEquipados,
} from '../src/core/personagem.js';
import { calcularNivel, xpParaProximoNivel } from '../src/core/progresso.js';
import { ESTAÇÕES } from '../src/core/enums.js';
// O mapa de rótulos vive na cena de Fabricação. Aqui ele é lido do arquivo,
// em vez de importado, para não puxar o Phaser inteiro para o Node.
const ROTULOS_ESTACAO = Object.fromEntries(
  [...fs.readFileSync(new URL('../src/scenes/FabricacaoScene.js', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .matchAll(/^\s{2}([a-z_]+):\s*'([^']+)',$/gm)]
    .filter((m) => Object.values(ESTAÇÕES).includes(m[1]))
    .map((m) => [m[1], m[2]]),
);
import {
  CAMPOS_ITEM,
  CAMPOS_TALENTO,
  CAMPOS_MONSTRO,
  CAMPOS_RECEITA,
  CAMPOS_REINO,
  CAMPOS_CONQUISTA,
  CAMPOS_CLASSE,
  RESUMO,
  serializadores,
} from '../src/dados/schemaAdmin.js';
import { TERMOS, PRIVACIDADE, VERSAO_TERMOS, DATA_TERMOS } from '../src/dados/legal.js';
import { RACAS, RACA_PADRAO } from '../src/dados/racas.js';

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

// =====================================================================
// Receita aponta para uma estação que existe
//
// A tela de Fabricação Percorre as estações com `Object.keys(ESTAÇÕES)`, que
// devolve as CHAVES do enum (`BANCO_TRABALHO`). Mas as receitas guardam o
// VALOR (`forja`). Trocar a aba passava a chave, nenhuma receita batia, e o
// painel dizia ao jogador que nada estava liberado no nível dele — sem nenhum
// erro no console.
//
// Este teste existe para impedir que as duas representações voltem a divergir.
// =====================================================================
console.log('\n== receitas e estações ==');
{
  const valores = new Set(Object.values(ESTAÇÕES));
  ok(valores.size === Object.keys(ESTAÇÕES).length, 'valores de estação são únicos (chave e valor não se repetem)');

  const estacaoRuim = catalogo.recipes.filter((r) => !valores.has(r.estacao));
  ok(
    estacaoRuim.length === 0,
    `toda receita aponta para uma estação real (ruins: ${estacaoRuim.map((r) => `${r.id}->${r.estacao}`).join(', ') || 'nenhum'})`,
  );

  // Toda estação precisa ter ao menos um rótulo amigável na tela, senão a aba
  // mostra `PRENSA_ARCANA` ao jogador.
  const semRotulo = [...valores].filter((e) => !ROTULOS_ESTACAO[e]);
  ok(semRotulo.length === 0, `toda estação tem rótulo amigável (faltando: ${semRotulo.join(',') || 'nenhum'})`);
}

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

// =====================================================================
// Ramos de talento e pre-requisito de atributo
//
// A arvoreganhou duas coisas novas: `ramo` (agrupa e da cor a linha) e
// `preRequisitoNiveis` (exige ponto em um ATRIBUTO, e nao nivel de jogador).
// A segunda e a que mais quebrava: o admin cadastrava "Fisico 5" e o talento
// ficava permanentemente travado, porque nada no codigo checava o atributo.
// =====================================================================
console.log('\n== ramos de talento ==');

const semRamo = catalogo.skills.filter((t) => !t.ramo);
ok(semRamo.length === 0, `todo talento tem ramo definido (sem ramo: ${semRamo.length})`);

// posX/posY precisa ser inteiro >= 0: e a grade de desenho da arvore.
const posInvalida = catalogo.skills.filter(
  (t) => !Number.isInteger(t.posX ?? 0) || !Number.isInteger(t.posY ?? 0) || (t.posX ?? 0) < 0 || (t.posY ?? 0) < 0,
);
ok(posInvalida.length === 0, `posicoes de arvore validas (ruins: ${posInvalida.map((t) => t.id).join(',') || 'nenhum'})`);

// Dois talentos na mesma celula: a linha de um cobriria o nome do outro.
const porCelula = new Map();
for (const t of catalogo.skills) {
  const chave = `${t.classeId}:${t.posX}:${t.posY}`;
  porCelula.set(chave, [...(porCelula.get(chave) ?? []), t.id]);
}
const colidindo = [...porCelula.entries()].filter(([, ids]) => ids.length > 1);
ok(colidindo.length === 0, `nenhuma celula com dois talentos (colisoes: ${colidindo.map(([k, v]) => k + '=' + v.join('+')).join(' ') || 'nenhuma'})`);

// Pre-requisito de atributo tem que apontar para um atributo existente.
const atributosValidos = new Set(['fis', 'men', 'soc']);
const attrRuim = [];
for (const t of catalogo.skills) {
  for (const attr of Object.keys(t.preRequisitoNiveis ?? {})) {
    if (!atributosValidos.has(attr)) attrRuim.push(`${t.id}.${attr}`);
  }
}
ok(attrRuim.length === 0, `pre-requisitos de atributo validos (ruins: ${attrRuim.join(',') || 'nenhum'})`);

console.log('\n== pre-requisito de atributo na pratica ==');
{
  // Talento de teste: raiz, exige Físico 3 e custa 1 ponto.
  const fake = {
    id: 'teste_attr',
    nome: 'Teste de requisito',
    classeId: 'guerreiro',
    tipo: 'passiva',
    nivelMin: 1,
    custoPontos: 1,
    ramo: 'forca',
    posX: 0,
    posY: 9,
    preRequisitos: [],
    preRequisitoNiveis: { fis: 3 },
    efeitos: {},
  };

  const e1 = estadoInicial();
  e1.vocacaoId = 'guerreiro';
  e1.pontosTalento = 5;
  e1.atributos = { fis: 0, men: 0, soc: 0 };
  ok(!talentoDisponivel(e1, fake), 'sem atributo suficiente: indisponivel');

  let r = desbloquearTalento(e1, fake, catalogo);
  ok(!r.ok && /atributos/i.test(r.motivo), `bloqueio explica o motivo: "${r.motivo}"`);

  e1.atributos.fis = 3;
  ok(atributosAtendidos(e1, fake.preRequisitoNiveis), 'atributo no limite conta como atendido');
  ok(talentoDisponivel(e1, fake), 'com atributo suficiente: disponivel');

  r = desbloquearTalento(e1, fake, catalogo);
  ok(r.ok, 'desbloqueia apos investir no atributo');
  ok(e1.pontosTalento === 4, 'custo em pontos descontado');
  ok(!talentoDisponivel(e1, fake), 'ja desbloqueado nao aparece como disponivel');

  // Atributo NAO volta sozinho ao subir de nivel: e o jogador que distribui.
  const e2 = estadoInicial();
  e2.atributos = { fis: 5, men: 0, soc: 0 };
  ok(atributosAtendidos(e2, { fis: 5 }), 'limite exato conta');
  ok(!atributosAtendidos(e2, { fis: 6 }), 'abaixo do limite reprova');
  ok(atributosAtendidos(e2, undefined), 'sem requisito: sempre atendido');
}

console.log('\n== esquema do painel administrativo ==');
{
  // Toda colecao editavel precisa de um esquema, senao o admin cai numa aba
  // sem nenhum campo — que foi o primeiro sintoma de "nao aparece nada".
  const esquemas = {
    itens: CAMPOS_ITEM,
    classes: CAMPOS_CLASSE,
    talentos: CAMPOS_TALENTO,
    monstros: CAMPOS_MONSTRO,
    receitas: CAMPOS_RECEITA,
    reinos: CAMPOS_REINO,
    conquistas: CAMPOS_CONQUISTA,
  };

  for (const [nome, campos] of Object.entries(esquemas)) {
    ok(campos.length > 0, `${nome}: ${campos.length} campo(s)`);
    const semChave = campos.filter((c) => !c.chave || !c.rotulo);
    ok(semChave.length === 0, `${nome}: todo campo tem chave e rotulo (ruins: ${semChave.length})`);
    const chavesDuplicadas = campos
      .map((c) => c.chave)
      .filter((c, i, a) => a.indexOf(c) !== i);
    ok(chavesDuplicadas.length === 0, `${nome}: sem chaves repetidas (${chavesDuplicadas.join(',') || 'ok'})`);
  }

  // Todo esquema tem descricao: e o texto que aparece na wiki (H).
  const semDescricao = Object.entries(esquemas)
    .filter(([, campos]) => !campos.some((c) => c.chave === 'descricao' && c.tipo === 'area'))
    .map(([nome]) => nome);
  ok(semDescricao.length === 0, `todo esquema tem descricao longa (faltando: ${semDescricao.join(',') || 'nenhum'})`);

  // Item precisa de imagem e de uso — sao os dois campos que o admin mais
  // esqueca, e sem eles o item aparece no jogo sem ficha.
  ok(CAMPOS_ITEM.some((c) => c.chave === 'imagem' && c.tipo === 'imagem'), 'item tem upload de imagem');
  ok(CAMPOS_ITEM.some((c) => c.chave === 'uso' && c.tipo === 'multiselec'), 'item tem multiselec de usos');
  ok(CAMPOS_TALENTO.some((c) => c.chave === 'ramo'), 'talento tem ramificacao');
  ok(CAMPOS_TALENTO.some((c) => c.chave === 'corRamo'), 'talento tem cor do ramo');
  ok(CAMPOS_TALENTO.some((c) => c.chave === 'preRequisitos'), 'talento tem pre-requisitos');
  ok(CAMPOS_TALENTO.some((c) => c.chave === 'preRequisitoNiveis'), 'talento tem pre-requisito de nivel');
  // `classeId` NAO e campo do formulario: vem do filtro de classe da lista.
  // Se virasse campo, o admin poderia gravar um talento na classe errada.
  ok(!CAMPOS_TALENTO.some((c) => c.chave === 'classeId'), 'classe do talento vem do filtro, nao do formulario');

  // Todo tipo de campo precisa existir em ui/formularios.js.
  const tiposImplementados = new Set(['texto', 'numero', 'area', 'select', 'multiselec', 'imagem']);
  const tiposUsados = new Set(Object.values(esquemas).flatMap((c) => c.map((f) => f.tipo)));
  const tiposDesconhecidos = [...tiposUsados].filter((t) => !tiposImplementados.has(t));
  ok(tiposDesconhecidos.length === 0, `todo tipo de campo tem widget (desconhecidos: ${tiposDesconhecidos.join(',') || 'nenhum'})`);

  // Todo resumo de lista existe e devolve texto.
  for (const [nome, campos] of Object.entries(esquemas)) {
    const res = RESUMO[nome];
    ok(typeof res === 'function', `${nome}: lista tem resumo`);
    if (typeof res === 'function') {
      let quebrou = false;
      try {
        res({ nome: 'x' });
      } catch {
        quebrou = true;
      }
      ok(!quebrou, `${nome}: resumo aguenta registro quase vazio`);
    }
  }

  // Serializadores bidirecionais: o que o admin digita volta a ser o objeto.
  const efeitos = { vidaMax: 18, fis: 2, reducaoDanoPct: -5 };
  const textoEfeitos = serializadores.efeitos(efeitos);
  ok(typeof textoEfeitos === 'string' && textoEfeitos.includes('vidaMax'), 'efeitos serializam para texto');

  const loot = [{ itemId: 'pedra', chance: 60, qtdMin: 1, qtdMax: 2 }];
  ok(serializadores.loot(loot).includes('pedra'), 'loot serializa para texto');
  ok(serializadores.efeitos(null) === '', 'serializador tolera null');
}

console.log('\n== termos e privacidade (LGPD / ECA Digital) ==');
{
  ok(typeof VERSAO_TERMOS === 'string' && VERSAO_TERMOS.length > 0, `versao dos termos: ${VERSAO_TERMOS}`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(DATA_TERMOS), `data de vigencia: ${DATA_TERMOS}`);
  ok(TERMOS.length >= 8, `termos: ${TERMOS.length} secoes`);
  ok(PRIVACIDADE.length >= 4, `privacidade: ${PRIVACIDADE.length} secoes`);

  const semTitulo = [...TERMOS, ...PRIVACIDADE].filter((s) => !s.titulo || !s.corpo);
  ok(semTitulo.length === 0, `toda secao tem titulo e corpo (vazias: ${semTitulo.length})`);

  // O canal de contato e o que torna o texto exigivel pelo art. 8 do CDC e
  // pelo art. 41 da LGPD. Sem ele, o documento e decorativo.
  const temContato = [...TERMOS, ...PRIVACIDADE].some((s) => /kazenski\.developer@gmail\.com/.test(s.corpo));
  ok(temContato, 'ha canal de contato nos textos legais');

  // Direitos do titular precisam estar NOMEADOS, nao sugeridos.
  const tudo = [...TERMOS, ...PRIVACIDADE].map((s) => s.corpo).join(' ').toLowerCase();
  for (const direito of ['acesso', 'exclus', 'correç', 'portabilidade', 'consentimento', '15 dias']) {
    ok(tudo.includes(direito), `direito do titular declarado: "${direito}"`);
  }

  // O texto promete um botao de apagar. Se o botao sumir, o texto mente.
  ok(tudo.includes('apagar meu progresso'), 'o texto aponta o botao de apagar dados');
}

console.log('\n== racas ==');
{
  ok(RACAS.length >= 3, `racas: ${RACAS.length}`);
  const ids = RACAS.map((r) => r.id);
  ok(new Set(ids).size === ids.length, 'ids de raca unicos');
  ok(ids.includes(RACA_PADRAO), 'raca padrao existe na lista');
  const semTexto = RACAS.filter((r) => !r.nome || !r.descricao || r.descCurta.length < 8);
  ok(semTexto.length === 0, `toda raca tem nome, descricao e resumo (ruins: ${semTexto.map((r) => r.id).join(',') || 'nenhum'})`);
}

// =====================================================================
// Chamadas para funções que não existem
//
// Dois bugs reais de uma vez vieram daqui, e os dois derrubavam uma TELA
// INTEIRA em vez de falhar um detalhe:
//
//   - `AjudaScene.create()` chamava `this.montar()`, mas o método se chama
//     `redimensionar()`. A wiki não abria.
//   - `TalentosScene.corDoRamo()` chamava `corDeNome()`, que nunca foi
//     escrita. A tela de Talentos não abria.
//
// Os dois só apareceram quando o painel foi aberto no navegador. Nenhum deles
// aparece no `npm run build` (imports resolvem) nem no `npm test` (as cenas não
// são importadas, porque precisam do Phaser). Esta verificação é estática
// justamente para fechar essa fresta.
// =====================================================================
console.log('\n== chamadas para funções inexistentes (cenas e ui) ==');
{
  /**
   * Remove comentários e strings, trocando o conteúdo por espaços.
   *
   * Sem isso, `// desenharLista(...)` e `'o método close() fecha'` viram
   * "funções não declaradas" e o teste acusa 200 fantasmas. Espaços em vez de
   * texto vazio preservam as posições, então o resto da análise continua válida.
   */
  function soCodigo(src) {
    let saida = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
      const dois = src.slice(i, i + 2);
      if (dois === '//') {
        while (i < n && src[i] !== '\n') {
          saida += ' ';
          i += 1;
        }
      } else if (dois === '/*') {
        while (i < n && src.slice(i, i + 2) !== '*/') {
          saida += src[i] === '\n' ? '\n' : ' ';
          i += 1;
        }
        saida += '  ';
        i += 2;
      } else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
        const aspas = src[i];
        saida += ' ';
        i += 1;
        while (i < n && src[i] !== aspas) {
          if (src[i] === '\\') {
            saida += '  ';
            i += 2;
            continue;
          }
          saida += src[i] === '\n' ? '\n' : ' ';
          i += 1;
        }
        saida += ' ';
        i += 1;
      } else {
        saida += src[i];
        i += 1;
      }
    }
    return saida;
  }

  const pasta = new URL('../src/', import.meta.url);
  const subpastas = ['scenes', 'ui', 'core', 'dados'];
  const arquivos = [];
  for (const sub of subpastas) {
    for (const arq of fs.readdirSync(new URL(sub + '/', pasta))) {
      if (arq.endsWith('.js')) arquivos.push(sub + '/' + arq);
    }
  }

  // Globais e palavras-chave. Sem esta lista, `setTimeout(...)` e
    // `Math.round(...)` seriam apontados como funções inexistentes, e
    // `super(...)`/`get lista()` como funções não declaradas.
    const globais = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'do', 'else',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask',
    'structuredClone', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame',
    'console', 'Math', 'JSON', 'Object', 'Array', 'Number', 'String', 'Boolean',
    'Date', 'Map', 'Set', 'Promise', 'Symbol', 'RegExp', 'Error', 'isNaN', 'isFinite',
    'parseInt', 'parseFloat', 'decodeURIComponent', 'encodeURIComponent',
    'Infinity', 'NaN', 'undefined', 'Phaser', 'Uint8Array', 'Blob', 'File',
    'FileReader', 'Image', 'URL', 'URLSearchParams', 'TextDecoder', 'TextEncoder',
    'Intl', 'WeakMap', 'Proxy', 'Reflect', 'BigInt', 'globalThis', 'createImageBitmap',
    'firebase', 'document', 'window', 'localStorage', 'navigator', 'history', 'location',
    'super', 'import', 'async', 'get', 'set', 'of', 'new', 'void', 'delete', 'yield',
    'case', 'extends', 'static', 'await', 'then', 'catch',
  ]);

  // Identificadores aceitam letras acentuadas.
  //
  // Isto NÃO é detalhe: o `\b` do JavaScript só reconhece [A-Za-z0-9_], então em
  // `aplicarBônus(` o `ô` conta como NÃO-palavra e o nome era lido como `nus(`.
  // Como o código do jogo é escrito em português, metade dos identificadores tem
  // acento — a verificação acusaria a maior parte de fantasmas se isto ficasse.
  const ID = '[\\p{L}\\p{N}_$]';
  const umId = new RegExp(`^${ID}+$`, 'u');
  const declaracao = new RegExp(`(?:function|class)\\s+(${ID}+)`, 'gu');
  const variavel = new RegExp(`(?:const|let|var)\\s+(${ID}+)`, 'gu');
  const metodo = new RegExp(`^\\s{2,}(?:async\\s+|get\\s+|set\\s+)?(${ID}+)\\s*\\(`, 'gmu');
  const metodoComAssinatura = new RegExp(`^\\s{2,}(?:async\\s+|get\\s+|set\\s+)?(${ID}+)\\s*\\([^)]*\\)\\s*\\{`, 'gmu');
  const chamada = new RegExp(`(^|[^\\p{L}\\p{N}_$.])(${ID}+)\\s*\\(`, 'gu');

  const naoDeclarados = [];
  for (const rel of arquivos) {
    const bruto = fs.readFileSync(new URL(rel, pasta), 'utf8').replace(/\r\n/g, '\n');
    // Os imports saem do código antes da limpeza: eles precisam ser lidos do
    // texto original, com o caminho entre aspas.
    const src = soCodigo(bruto);

    // Tudo que o arquivo declara ou importa fica disponível.
    const disponiveis = new Set();
    // `import { a, b as c }` — o NOME que vale é o do lado direito do `as`,
    // que é como o arquivo se refere à coisa.
    for (const m of bruto.matchAll(/import\s+([^'"]+?)\s+from\s+['"][^'"]+['"]/gu)) {
      for (const parte of m[1].replace(/[{}]/g, ',').split(',')) {
        const limpo = parte.trim().replace(/^\*\s+/, '').split(/\s+as\s+/u).pop().trim();
        if (umId.test(limpo)) disponiveis.add(limpo);
      }
    }
    for (const m of src.matchAll(declaracao)) disponiveis.add(m[1]);
    for (const m of src.matchAll(variavel)) disponiveis.add(m[1]);
    // Métodos de classe, com `async`, `get` ou `set` na frente.
    for (const m of src.matchAll(metodo)) disponiveis.add(m[1]);
    for (const m of src.matchAll(metodoComAssinatura)) disponiveis.add(m[1]);
    // Desestruturação: `const { a, b: c } = ...` e `export { a as b }`.
    for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/gu)) {
      for (const parte of m[1].split(',')) {
        const limpo = parte.trim().split(':').pop().split('=')[0].trim();
        if (umId.test(limpo)) disponiveis.add(limpo);
      }
    }
    for (const m of bruto.matchAll(/export\s*\{([^}]*)\}/gu)) {
      for (const parte of m[1].split(',')) {
        const limpo = parte.trim().split(/\s+as\s+/u).pop().trim();
        if (umId.test(limpo)) disponiveis.add(limpo);
      }
    }
    // Parâmetros: `function f(a, { b, c })`, `metodo(a, b)`, `(x, y) =>`.
    for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/gu)) {
      for (const parte of m[1].split(',')) {
        const limpo = parte.trim().replace(/^\.\.\./u, '').split(/[:=]/u)[0].trim();
        if (umId.test(limpo)) disponiveis.add(limpo);
        // Parâmetro desestruturado: `{ a, b: c }`.
        for (const d of parte.matchAll(/([\p{L}\p{N}_$]+)\s*:\s*([\p{L}\p{N}_$]+)/gu)) {
          disponiveis.add(d[2]);
        }
      }
    }

    // Só interessam chamadas de função: identificador SOLTO seguido de `(`.
    // Com `.` antes é método (`obj.metodo()`) e fica de fora.
    for (const m of src.matchAll(chamada)) {
      const nome = m[2];
      if (globais.has(nome)) continue;
      if (disponiveis.has(nome)) continue;
      naoDeclarados.push(`${rel}: ${nome}()`);
    }
  }

  const suspeitas = [...new Set(naoDeclarados)];
  ok(suspeitas.length === 0, `toda função chamada existe (suspeitas: ${suspeitas.join(', ') || 'nenhuma'})`);
}

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM\n' : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
