// Trava o que causou os menus da wiki escaparem do painel.
//
// `botao(scene, x, y, ...)` tem `origem: [0.5, 0.5]` por padrao: x/y e o
// CENTRO. Quem escreve `botao(this, x + 10, ly, ..., { largura: L - 20 })`
// le como canto superior esquerdo, e o botao sai meia largura para fora do
// painel — 98px para fora, na wiki. Como L/2 passa de 100px, o efeito e
// invisivel no codigo e evidente na tela.
//
// O mesmo vale para `alinhamento`: o default era 'left', mas a formula usada
// dava exatamente `largura / 2`. Entao 'left' nao fazia nada e todo botao do
// jogo estava centralizado por acidente.
//
// Checks abaixo: o que precisa ser verdade daqui para frente.
import fs from 'node:fs';

let falhas = 0;
const ok = (cond, msg, extra = '') => {
  if (cond) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    if (extra) console.log(`         ${extra}`);
    falhas += 1;
  }
};

const ler = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------
// Comentarios
//
// Sem isto o scanner casa com `botao()` dentro de um comentario, e o check da
// formula antiga casa com a formula citada no comentario que a documenta. Foi
// exatamente o que aconteceu na primeira versao deste teste: dois "botao sem
// origem" que eram so texto, e uma "formula antiga" que era so a minha
// explicacao.
//
// Detecta por faixa, sem reescrever o arquivo — assim uma URL com "//" nao
// vira comentário (o `:` antes e o que distingue).
// ---------------------------------------------------------------------
function intervalosDeComentario(src) {
  const faixas = [];
  let i = 0;

  while (i < src.length - 1) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const fim = src.indexOf('*/', i + 2);
      const f = fim === -1 ? src.length : fim + 2;
      faixas.push([i, f]);
      i = f;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '/' && src[i - 1] !== ':') {
      let fim = src.indexOf('\n', i);
      if (fim === -1) fim = src.length;
      faixas.push([i, fim]);
      i = fim;
      continue;
    }
    i += 1;
  }
  return faixas;
}

const emComentario = (faixas, pos) => faixas.some(([a, b]) => pos >= a && pos < b);

// Extrai a chamada balanceada que comeca em `botao(`.
function chamada(src, inicio) {
  let prof = 0;
  for (let j = inicio; j < src.length; j += 1) {
    if (src[j] === '(') prof += 1;
    else if (src[j] === ')') {
      prof -= 1;
      if (prof === 0) return { texto: src.slice(inicio + 1, j), fim: j };
    }
  }
  return null;
}

function chamadasDeBotao(src) {
  const faixas = intervalosDeComentario(src);
  const achadas = [];
  let pos = 0;

  while ((pos = src.indexOf('botao(', pos)) !== -1) {
    if (emComentario(faixas, pos)) {
      pos += 6;
      continue;
    }
    if (/export function\s*$/.test(src.slice(Math.max(0, pos - 30), pos))) {
      pos += 6;
      continue;
    }
    const c = chamada(src, pos + 5);
    if (!c) break;
    achadas.push({
      linha: src.slice(0, pos).split('\n').length,
      args: c.texto,
      x: (c.texto.split(',')[1] ?? '').trim(),
    });
    pos = c.fim + 1;
  }
  return achadas;
}

// ---------------------------------------------------------------------
console.log('\n== a wiki declara a origem de todos os botoes ==');
{
  const src = ler('src/scenes/AjudaScene.js');
  const todas = chamadasDeBotao(src);
  ok(todas.length >= 4, `a wiki tem ${todas.length} chamada(s) de botao()`);

  const semOrigem = todas.filter((c) => !/origem\s*:/.test(c.args));
  ok(
    semOrigem.length === 0,
    'toda chamada da wiki declara `origem`',
    semOrigem.map((c) => `linha ${c.linha}: x = ${c.x}`).join('\n         '),
  );
}

// ---------------------------------------------------------------------
console.log('\n== `botao()` nao centraliza por acidente ==');
{
  const src = ler('src/ui/comuns.js');
  const codigo = (() => {
    // Remove comentarios para os checks de codigo, nao o arquivo.
    const faixas = intervalosDeComentario(src).sort((a, b) => b[0] - a[0]);
    let s = src;
    for (const [a, b] of faixas) s = s.slice(0, a) + ' '.repeat(b - a) + s.slice(b);
    return s;
  })();

  // O default de `alinhamento` precisa ser 'center'. Se voltar a ser 'left',
  // todo botao do jogo que nao passa `alinhamento` herda 'left' — e o default
  // volta a significar "centralizado" sem ninguem perceber.
  const bloco = codigo.slice(codigo.indexOf('export function botao('));
  const defaultAlinhamento = bloco.match(/alinhamento\s*=\s*'(\w+)'/)?.[1];
  ok(
    defaultAlinhamento === 'center',
    `default de alinhamento e 'center' (veio: ${defaultAlinhamento})`,
    "Um default 'left' faz 'left' significar 'centralizado' de novo.",
  );

  ok(
    !/textoX\s*=\s*padding\s*\+\s*\(largura\s*-\s*padding\s*\*\s*2\)\s*\/\s*2/.test(codigo),
    'a formula que neutralizava `alinhamento: left` nao esta no codigo',
  );

  // 'left' tem de trocar a ORIGEM do texto, nao so o x: com origem 0.5 o texto
  // continua centralizado em `textoX` por mais que o x mude.
  ok(
    /setOrigin\(alinhadoEsquerda \? 0 : 0\.5, 0\.5\)/.test(codigo),
    "com 'left' o texto usa origem 0 (esquerda) e nao 0.5 (centro)",
  );

  // E o default de `origem` tem de continuar sendo o centro — e o comentario
  // ao lado precisa dizer isso, porque foi o silencio dele que causou o bug.
  ok(
    /origem\s*=\s*\[0\.5,\s*0\.5\]/.test(codigo),
    'o default de origem continua sendo o centro (documentado, nao adivinhado)',
  );
}

// ---------------------------------------------------------------------
console.log('\n== inventario: outros botoes sem origem declarada ==');
console.log('   Nao falha o teste: nenhuma destas foi medida ainda.');
{
  const scene = 'src/scenes';
  const arquivos = fs.readdirSync(scene).filter((f) => f.endsWith('.js') && f !== 'AjudaScene.js');
  let total = 0;

  for (const arq of arquivos) {
    const src = ler(`${scene}/${arq}`);
    const suspeitas = chamadasDeBotao(src).filter(
      (c) => !/origem\s*:/.test(c.args) && /[+-]\s*\d+\s*$/.test(c.x),
    );
    if (!suspeitas.length) continue;
    total += suspeitas.length;
    console.log(`  ${arq}: ${suspeitas.length}`);
    for (const c of suspeitas) console.log(`      linha ${c.linha}  x = ${c.x}`);
  }

  console.log(`\n  total: ${total} chamada(s) com o mesmo padrao de risco.`);
  console.log('  "algo + numero" dentro de painel de largura conhecida precisa');
  console.log('  declarar origem. Pares simetricos (centro -/+ N) sao centralizacao');
  console.log('  de proposito e nao precisam.');
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);