// Trava de integridade entre a conta Google e os personagens.
//
// Existe por causa de dois bugs da mesma família, ambos com o mesmo formato:
//
//   1. `LoginScene` importava `garantirPerfil` de `core/progresso.js` em vez de
//      `garantirPerfilUsuario` de `core/usuarios.js`. O `users/{uid}` nunca era
//      criado, e a aba Jogadores do admin mostrava só o dono.
//
//   2. `LoginScene` passava ao salão o perfil de `users/{uid}`, que não tem o
//      campo `personagens`. O salão lia `perfil.personagens`, vinha `undefined`,
//      e mostrava "0/10 heróis" com a conta cheia de heróis no Firestore.
//
// Os dois são o mesmo erro: DUAS coleções, UM nome. `users` = identidade,
// `jogadores` = personagens. Nada impede uma refatoração de misturá-los de novo
// — a suíte passava, o build passava, e o jogo só falhava em produção.
//
// Estes testes existem para que essa troca de documento seja um erro de build.
//
// Uso:  node testes/integridade.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RAIZ, 'src');

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

function ler(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n/g, '\n');
}

// ---------------------------------------------------------------------
// 1. Os dois documentos existem, com nomes que não se confundem
// ---------------------------------------------------------------------
console.log('\n== os dois perfis ==');
{
  const progresso = ler('core/progresso.js');
  const usuarios = ler('core/usuarios.js');

  ok(
    progresso.includes('export async function carregarPerfilJogador'),
    'core/progresso.js tem carregarPerfilJogador (le jogadores/{uid})',
  );
  ok(
    usuarios.includes('export async function garantirPerfilUsuario'),
    'core/usuarios.js tem garantirPerfilUsuario (le users/{uid})',
  );

  // A isca. Existiu um `garantirPerfil` em progresso.js idêntico no propósito
  // ao de usuarios.js, e ele já foi importado por engano uma vez.
  ok(
    !/export\s+(async\s+)?function\s+garantirPerfil\s*\(/.test(progresso),
    'core/progresso.js NAO exporta mais um `garantirPerfil` (a isca foi removida)',
  );

  // O documento de `users` não pode ter `personagens`: se um dia tiver, os dois
  // documentos passam a se parecer e a distinção perde força.
  const perfilInicialUsuarios = usuarios.slice(
    usuarios.indexOf('function perfilInicial'),
    usuarios.indexOf('function perfilInicial') + 900,
  );
  ok(
    !perfilInicialUsuarios.includes('personagens'),
    'o perfil de `users` nao tem `personagens` (as duas coleções seguem distintas)',
  );
}

// ---------------------------------------------------------------------
// 2. O salão recebe o documento de `jogadores`
// ---------------------------------------------------------------------
console.log('\n== o que o salão recebe ==');
{
  const login = ler('scenes/LoginScene.js');
  const lobby = ler('scenes/LobbyScene.js');

  ok(
    login.includes('carregarPerfilJogador'),
    'LoginScene carrega o perfil de `jogadores` (tem a lista de heróis)',
  );

  // O ponto exato do bug: `perfil:` no contexto do lobby tem que ser o perfil
  // de `jogadores`, não o de `users`.
  const contexto = login.slice(login.indexOf('const contexto = {'), login.indexOf('// --- Termos ---'));
  ok(
    /perfil:\s*perfilJogador/.test(contexto),
    'o `perfil` enviado ao salão é o de `jogadores`',
  );
  ok(
    /perfilUsuario/.test(contexto),
    'o perfil de `users` viaja em campo separado (`perfilUsuario`)',
  );
  ok(
    !/perfil:\s*perfilUsuario/.test(contexto),
    'o perfil de `users` NÃO é enviado como `perfil`',
  );

  // E o salão tem de ler o que recebe.
  ok(
    lobby.includes('this.perfil?.personagens'),
    'LobbyScene lê `perfil.personagens` — o campo que só existe em `jogadores`',
  );
}

// ---------------------------------------------------------------------
// 3. Leitura falha NUNCA vira "perfil vazio"
// ---------------------------------------------------------------------
console.log('\n== falha de leitura não pode virar perfil vazio ==');
{
  const progresso = ler('core/progresso.js');
  const corpo = progresso.slice(
    progresso.indexOf('export async function carregarPerfilJogador'),
    progresso.indexOf('/** Cria um novo personagem'),
  );

  ok(corpo.includes('PerfilIlegivelError'), 'carregarPerfilJogador lança PerfilIlegivelError');
  ok(
    !corpo.includes('return lerPerfilLocal(uid) ??'),
    'carregarPerfilJogador NÃO cai no espelho local quando a leitura falha',
  );

  // O espelho local é aceito só no caminho sem servidor (modo local / sem
  // conta), que é o único caso em que ele é a fonte da verdade.
  const guardaLocal = corpo.slice(0, corpo.indexOf('const TEMPO_MAXIMO_MS'));
  ok(
    /if \(!uid \|\| !firebaseDisponivel\(\)\)/.test(guardaLocal),
    'o espelho local só é usado no modo sem servidor',
  );

  // A escrita não pode mais ser engolida em silêncio: se o servidor não
  // confirmou, o jogador tem de ser avisado, senão ele acha que salvou.
  const salvar = progresso.slice(
    progresso.indexOf('async function salvarPerfil'),
    progresso.indexOf('// =====================================================================', progresso.indexOf('async function salvarPerfil')),
  );
  ok(
    !salvar.includes('salvou so local'),
    'salvarPerfil não engole a falha de escrita',
  );

  // Só o caminho COM servidor interessa aqui: no modo local o espelho é a
  // fonte da verdade e ser gravado antes não é erro nenhum.
  const caminhoServidor = salvar.slice(salvar.indexOf('firebaseDisponivel() && uid'));
  ok(
    caminhoServidor.lastIndexOf('gravarPerfilLocal(perfil)') >
      caminhoServidor.indexOf('await setDoc('),
    'no caminho com servidor, o espelho local é gravado DEPOIS da confirmação',
  );
}

// ---------------------------------------------------------------------
// 4. "Não tem herói" e "não consegui ler" são telas diferentes
// ---------------------------------------------------------------------
console.log('\n== o salão distingue vazio de falha ==');
{
  const lobby = ler('scenes/LobbyScene.js');
  const slots = lobby.slice(lobby.indexOf('criarSlots(x, y, w, h)'), lobby.indexOf('for (let i = 0; i < personagens.length; i++)'));

  ok(
    slots.includes('if (this.uid && !this.perfil)'),
    'perfil ilegível com conta Google não cai no texto de "nenhum herói"',
  );
  ok(
    slots.includes('RECARREGAR'),
    'o salão oferece RECARREGAR em vez de sugerir criar um herói',
  );
  ok(
    slots.includes('Nenhum herói no salão ainda'),
    'o texto de lista vazia continua existindo para o caso verdadeiro',
  );
}

console.log(`\n${falhas === 0 ? 'TODOS OS TESTES PASSARAM' : `${falhas} FALHA(S)`}`);
process.exit(falhas ? 1 : 0);