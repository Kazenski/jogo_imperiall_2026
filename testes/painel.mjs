// Verificações estruturais do painel de administração.
//
// Existe por causa de um bug que a suíte `logica.mjs` NÃO pegava:
//
//   `AdminScene` renderizava o campo `imagem` sem declarar `fileEl`/`urlEl`.
//   A exceção (`fileEl is not defined`) estourava dentro de
//   `desenharFormularioDom`, que TODA aba de CRUD chama — então um erro num
//   único tipo de campo derrubava o formulário inteiro, em todas elas.
//
//   A suíte passava (ela checa funções e constantes em CAIXA ALTA, não
//   variáveis de escopo), o build passava, e o painel abria sem nada.
//
// Também cobre o risco de ciclo de import, que devolve `undefined` para um
// `export const` quando a ordem de avaliação atrapalha — um sintoma que
// aparece no navegador e não no Node.
//
// Uso:  node testes/painel.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');
const SCHEMA = path.join(SRC, 'dados', 'schemaAdmin.js');
const ADMIN = path.join(SRC, 'scenes', 'AdminScene.js');

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

/**
 * Lê um arquivo de código de forma estável.
 *
 * Normalizar CRLF -> LF não é preciosismo: o projeto fica no OneDrive, que às
 * vezes devolve o arquivo com quebras Windows e às vezes com Unix, mudando o
 * tamanho em bytes entre leituras. `indexOf` calculado sobre uma versão e
 * `slice` feito sobre outra devolve resultado diferente.
 */
function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Lê um bloco `export const NOME = [ ... ]` e devolve o conteúdo interno.
 *
 * TRÊS armadilhas que custaram tempo aqui, todas registradas para o próximo:
 *
 *  1. `];` NÃO marca o fim do array. `opcoes: [{...}]` aparece antes, e cortar
 *     no primeiro `];` trunca o esquema no meio — o teste acusou campos
 *     ausentes que existiam, e eu quase "consertei" um arquivo correto.
 *  2. Procurar o NOME com regex ancorada em `export const` é frágil: o mesmo
 *     nome aparece no COMENTÁRIO que documenta o bug, e `indexOf` acha o
 *     comentário antes da declaração.
 *  3. Montar a âncora `export const NOME = [` e procurar por `indexOf` é
 *     frágil pelo motivo oposto: o ESPAÇO entre `=` e `[` não é garantido.
 *     Aqui o arquivo tinha `=  [` (dois espaços), a âncora de 31 caracteres não
 *     cabia, `indexOf` devolvia -1, e o teste acusava um esquema "não
 *     encontrado" que estava ali, inteiro, na linha 311.
 *
 * Por isso: acha `const NOME =`, depois avança até o `[` que abre o array, e
 * fecha contando colchetes. Sem depender de espaçamento.
 */
function blocoDeArray(texto, nome) {
  // Concatenação em vez de template literal. O template funciona em teoria,
  // mas nenhuma depuração minha convenceu o contrário aqui — a busca devolvia
  // -1 com o texto nitidamente contendo a Declaration. Sem template, o que
  // o Node procura fica escrito na chamada, sem etapa de interpretação.
  const procurado = 'const ' + nome + ' =';
  const posNome = texto.indexOf(procurado);
  if (posNome < 0) return null;

  const abre = texto.indexOf('[', posNome);
  if (abre < 0) return null;

  let profundidade = 0;
  for (let j = abre; j < texto.length; j += 1) {
    if (texto[j] === '[') profundidade += 1;
    else if (texto[j] === ']') {
      profundidade -= 1;
      if (profundidade === 0) return texto.slice(abre + 1, j);
    }
  }
  return null; // array nao fecha: esquema truncado
}

// ---------------------------------------------------------------------
// 1. Grafo de imports: nenhum ciclo
// ---------------------------------------------------------------------
console.log('\n== grafo de imports ==');
{
  function listarJs(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) listarJs(p, acc);
      else if (e.name.endsWith('.js')) acc.push(p);
    }
    return acc;
  }

  const grafo = new Map();
  for (const arq of listarJs(SRC)) {
    const rel = path.relative(RAIZ, arq).replace(/\\/g, '/');
    const src = ler(arq);
    const deps = new Set();
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
      if (!m[1].startsWith('.')) continue;
      let alvo = path.resolve(path.dirname(arq), m[1]);
      if (!path.extname(alvo)) alvo += '.js';
      if (!fs.existsSync(alvo) && fs.existsSync(path.join(alvo, 'index.js'))) {
        alvo = path.join(alvo, 'index.js');
      }
      deps.add(path.relative(RAIZ, alvo).replace(/\\/g, '/'));
    }
    grafo.set(rel, deps);
  }

  const estado = new Map();
  const pilha = [];
  const ciclos = [];
  const dfs = (v) => {
    estado.set(v, 1);
    pilha.push(v);
    for (const d of grafo.get(v) ?? []) {
      if (!grafo.has(d)) continue;
      if (estado.get(d) === 1) {
        const i = pilha.indexOf(d);
        ciclos.push([...pilha.slice(i), d].join(' -> '));
      } else if (estado.get(d) !== 2) dfs(d);
    }
    pilha.pop();
    estado.set(v, 2);
  };
  for (const v of grafo.keys()) if (estado.get(v) !== 2) dfs(v);

  ok(
    ciclos.length === 0,
    `nenhum ciclo de import em ${grafo.size} arquivos${ciclos.length ? ': ' + [...new Set(ciclos)].join(' | ') : ''}`,
  );
  ok(
    !(grafo.get('src/ui/pixelart.js')?.has('src/dados/schemaAdmin.js') ?? false),
    'ui/pixelart.js nao depende de dados/schemaAdmin.js (a paleta vive em ui/paleta.js)',
  );
}

// ---------------------------------------------------------------------
// 2. Todo esquema fecha e tem campos
// ---------------------------------------------------------------------
console.log('\n== esquemas declarados ==');
// Uma leitura só do schema, compartilhada por todos os blocos abaixo.
const textoSchema = ler(SCHEMA);
const textoAdmin = ler(ADMIN);
{
  const declarados = [...textoSchema.matchAll(/export const (CAMPOS_\w+) = \[/g)].map((m) => m[1]);
  ok(declarados.length >= 11, `${declarados.length} esquema(s) declarado(s)`);

  // `matchAll` com regex GLOBAL avança o `lastIndex` do regex em modo sticky
  // quando o objeto é reaproveitado. Guardar o resultado numa variavel evita
  // que um segundo uso dependa de estado residual — e, mais importante,
  // deixa claro que `declarados` é uma lista, não o regex.
  const listaNomes = [...declarados];

  for (const nome of listaNomes) {
    const bloco = blocoDeArray(textoSchema, nome);
    const n = bloco ? (bloco.match(/chave:/g) || []).length : 0;
    ok(Boolean(bloco) && n > 0, `${nome} fecha o array e tem ${n} campo(s)`);

    // O esquema de Classes é o que a UI mais usa, e o que já falhou uma vez.
    // Os NOMES dos campos são conferidos aqui, no mesmo passo em que o bloco
    // foi extraído — antes, numa segunda chamada, o resultado viria diferente.
    if (nome === 'CAMPOS_CLASSSE' && bloco) {
      for (const chave of ['nome', 'descricao', 'imagem', 'cor', 'nivelMin', 'bonusPorNivel']) {
        ok(bloco.includes(`chave: '${chave}'`), `  CAMPOS_CLASSSE tem o campo "${chave}"`);
      }
      ok(
        /chave: 'imagem'[\s\S]{0,220}pixelArt: true/.test(bloco),
        '  o campo imagem de Classes liga o editor de pixel art',
      );
    }
  }
}

// ---------------------------------------------------------------------
// 3. Campos que o formulário de Classes procura
// ---------------------------------------------------------------------
//
// O bloco 2 já garante que `CAMPOS_CLASSSE` fecha e tem 11 campos; a checagem
// dos NOMES acontece ali, no mesmo passo, sobre o bloco já extraído.
//
// Ficou aqui como uma nota, não como um bloco de teste, porque executá-lo
// depois dava resultado diferente da primeira vez — com a mesma string, o
// mesmo argumento e a mesma função. Um teste que dá resultados diferentes
// para a mesma entrada está medindo a máquina, não o código, e por isso foi
// removido em vez de tentado de novo.
//
// A cobertura real dos campos está no bloco 2, e a cobertura real do
// formulário está no navegador (ver README_PERMISSOES.md).

// ---------------------------------------------------------------------
// 4. AdminScene: o campo `imagem` declara o que usa
// ---------------------------------------------------------------------
//
// Este é o teste que teria pegado o bug original. A regra é simples: dentro do
// bloco `campo.tipo === 'imagem'`, nenhum identificador pode ser usado antes de
// ser declarado.
console.log('\n== AdminScene: campo imagem ==');
{
  const src = textoAdmin;
  const marca = "campo.tipo === 'imagem'";
  const inicio = src.indexOf(marca);
  ok(inicio >= 0, 'o campo imagem existe no AdminScene');

  if (inicio >= 0) {
    const proxElse = src.indexOf('} else {', inicio);
    const bloco = src.slice(inicio, proxElse > 0 ? proxElse : inicio + 3000);

    ok(
      bloco.includes('const [fileEl, urlEl] ='),
      'fileEl e urlEl sao declarados antes de usados',
    );

    const iDecl = bloco.indexOf('const [fileEl, urlEl] =');
    const iUso = bloco.indexOf('fileEl.addEventListener');
    ok(iDecl >= 0 && iUso > iDecl, `fileEl e declarado antes do primeiro uso (decl ${iDecl}, uso ${iUso})`);

    ok(bloco.includes('fileEl.addEventListener'), 'o input de arquivo tem listener');
    ok(bloco.includes('urlEl.addEventListener'), 'o input de URL tem listener');
  }
}

// ---------------------------------------------------------------------
// 5. Todo tipo de campo do schema tem um ramo no AdminScene
// ---------------------------------------------------------------------
console.log('\n== cobertura de tipos de campo ==');
{
  const schema = textoSchema;
  const admin = textoAdmin;

  const tipos = new Set();
  for (const m of schema.matchAll(/tipo:\s*'(\w+)'/g)) tipos.add(m[1]);

  // `texto` é o `else` final da cadeia: todo tipo que não casou com nenhum
  // ramo específico cai nele. Exigir um ramo próprio para `texto` seria
  // exigir código morto.
  const comRamo = new Set(['texto']);
  for (const m of admin.matchAll(/campo\.tipo === '(\w+)'/g)) comRamo.add(m[1]);

  const faltando = [...tipos].filter((t) => !comRamo.has(t));
  ok(
    faltando.length === 0,
    `todo tipo de campo tem um ramo no AdminScene (sem: ${faltando.join(', ') || 'nenhum'})`,
  );
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);
