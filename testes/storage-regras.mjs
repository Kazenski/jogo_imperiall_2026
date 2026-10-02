// Prova de que as regras deStorage Dismissão o que o painel precisa.
//
// Existe por causa do erro que apareceu no console do admin:
//
//   POST .../o?name=classes%2F1790975985005-phfg7d.png  403 (Forbidden)
//
// Um 403 na hora de enviar a imagem da classe. A regra que decide isso é
// `ehAdmin()`, que consulta `system/admins` no Firestore de dentro da regra de
// Storage — e essa consulta cruzada é o tipo de coisa que pode estar certa no
// papel e errada no bucket.
//
// Por que um teste e não "testei no navegador": o emulador aplica as MESMAS
// regras do projeto, sem depender de conta Google e sem risco de escrever no
// bucket real. Se a lógica está certa aqui, ela está certa lá — e se alguém
// mexer na regra, este arquivo quebra na hora.
//
// O que precisa ser verdade, para o admin conseguir working no painel:
//   1. admin na lista     consegue enviar em `classes/`
//   2. admin não envia fora das pastas do catálogo
//   3. admin não envia um HTML disfarçado de imagem
//   4. não-admin é barrado em qualquer pasta
//
// Como rodar (o emulador é iniciado e derrubado por este comando):
//   node testes/storage-regras.mjs
// e o atalho que realmente importa:
//
//   npx firebase-tools emulators:exec --only auth,firestore,storage \
//     --project demo-jogo "node testes/storage-regras.mjs"

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, doc, setDoc } from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage,
  ref as refStorage,
  uploadBytes,
  getMetadata,
} from 'firebase/storage';

const HOST = '127.0.0.1';
const PORTA_AUTH = 9099;
const PORTA_FIRESTORE = 8080;
const PORTA_STORAGE = 9199;

const ROTULO_ADMIN = 'admin-de-teste';
const ROTULO_COMUM = 'jogador-comum';

// Configuração falsa: no emulador o bucket não existe, e o SDK só precisa de
// uma string com formato de URL.
const config = {
  projectId: 'demo-jogo',
  apiKey: 'fake-api-key',
  authDomain: 'demo-jogo.firebaseapp.com',
  storageBucket: 'demo-jogo.firebasestorage.app',
};

let falhas = 0;
function ok(condicao, msg) {
  if (condicao) console.log(`  ok   - ${msg}`);
  else {
    console.log(`  FAIL - ${msg}`);
    falhas += 1;
  }
}

/**
 * Conecta os três serviços do emulador e devolve os handles.
 *
 * Uma única instância de app: `initializeApp` com o mesmo nome duas vezes
 * lança "[DEFAULT] already exists", e o teste chama isto várias vezes para
 * poder trocar de usuário. Guardar os handles é o que torna a troca possível.
 */
let conexao = null;
function conectar() {
  if (conexao) return conexao;

  const app = initializeApp(config, 'emulador');
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:${PORTA_AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, PORTA_FIRESTORE);
  const storage = getStorage(app);
  connectStorageEmulator(storage, HOST, PORTA_STORAGE);

  conexao = { app, auth, db, storage };
  return conexao;
}

/**
 * Cria (ou reaproveita) uma conta no emulador e entra nela.
 *
 * O uid NÃO pode ser escolhido: o emulador gera um aleatório, igual ao Google.
 * E isso não atrapalha o teste — pelo contrario, obriga a.seedear
 * `system/admins` com o uid que o servidor devolveu, que é exatamente o
 * caminho que o projeto real usa para criar o primeiro admin (a regra de
 * bootstrap exige que o autor esteja na própria lista).
 *
 * @returns {Promise<string>} o uid da conta, para usar nas verificações
 */
async function entrarComo(rotulo) {
  const { auth } = conectar();
  const email = `${rotulo}@teste.local`;
  const senha = 'senha-de-teste-123';
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    // Já existia de uma execução anterior do teste.
    if (e?.code !== 'auth/email-already-in-use') throw e;
  }
  await signInWithEmailAndPassword(auth, email, senha);

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error(`login de "${rotulo}" nao devolveu uid`);
  return uid;
}

// =====================================================================

const principal = async () => {
  console.log('\n== regra de upload de imagens ==');

  // 1. Entra na conta de admin e se promove a si mesmo em `system/admins`.
  //
  // A ordem importa e é a mesma do projeto real: a regra de bootstrap exige
  // que o autor esteja na própria lista, então não existe `system/admins`
  // antes do primeiro login.
  const uidAdmin = await entrarComo(ROTULO_ADMIN);
  const { db } = conectar();
  await setDoc(doc(db, 'system', 'admins'), { uids: [uidAdmin] });
  console.log(`  (system/admins = [${uidAdmin}])`);

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  // 2. Admin envia uma imagem de verdade na pasta do catálogo.
  //    Este é o caso que falhou com 403 no painel.
  {
    const { storage } = conectar();
    try {
      await uploadBytes(refStorage(storage, 'classes/teste.png'), png, {
        contentType: 'image/png',
      });
      ok(true, 'admin envia imagem em classes/ (o 403 do painel)');
    } catch (e) {
      ok(false, `admin envia imagem em classes/ (${e.code ?? e.message})`);
    }
  }

  // 3. Fora das pastas do catálogo: negado, mesmo para admin.
  {
    const { storage } = conectar();
    try {
      await uploadBytes(refStorage(storage, 'seeds/segredo.png'), png, { contentType: 'image/png' });
      ok(false, 'admin NAO consegue enviar fora das pastas do catalogo');
    } catch (e) {
      ok(e.code === 'storage/unauthorized', `fora das pastas e negado (${e.code})`);
    }
  }

  // 4. HTML disfarçado de imagem: negado. Sem isto o bucket do jogo servia
  //    página falsa com o nome do jogo.
  {
    const { storage } = conectar();
    try {
      await uploadBytes(refStorage(storage, 'classes/pagina.html'), Buffer.from('<h1>oi</h1>'), {
        contentType: 'text/html',
      });
      ok(false, 'admin NAO consegue enviar HTML');
    } catch (e) {
      ok(e.code === 'storage/unauthorized', `HTML e negado (${e.code})`);
    }
  }

  // 5. Quem não é admin é barrado em qualquer pasta.
  {
    const { storage } = conectar();
    await entrarComo(ROTULO_COMUM);
    try {
      await uploadBytes(refStorage(storage, 'classes/invasor.png'), png, { contentType: 'image/png' });
      ok(false, 'jogador comum NAO consegue enviar');
    } catch (e) {
      ok(e.code === 'storage/unauthorized', `jogador comum e barrado (${e.code})`);
    }
  }

  // 6. Deslogado é barrado.
  {
    const { storage } = conectar();
    await signOut(conectar().auth);
    try {
      await uploadBytes(refStorage(storage, 'classes/anonimo.png'), png, { contentType: 'image/png' });
      ok(false, 'deslogado NAO consegue enviar');
    } catch (e) {
      ok(e.code === 'storage/unauthorized', `deslogado e barrado (${e.code})`);
    }
  }

  // 7. Leitura é pública — o preflight CORS não carrega token de auth, então
  //    exigir login na leitura aborta o upload antes mesmo do POST.
  //
  //    Usa `getMetadata`, e não `getDownloadURL`: o download usa uma URL com
  //    token que burla as regras, então passaria mesmo com a leitura negada.
  //    `getMetadata` vai pela API comum e respeita as regras de verdade.
  {
    const { storage } = conectar();
    try {
      const meta = await getMetadata(refStorage(storage, 'classes/teste.png'));
      ok(
        meta.contentType === 'image/png',
        `a imagem enviada e legivel sem estar logado (${meta.contentType})`,
      );
    } catch (e) {
      ok(false, `a imagem enviada e legivel sem estar logado (${e.code ?? e.message})`);
    }
  }
};

principal()
  .catch((e) => {
    console.error('\nERRO no teste:', e?.message ?? e);
    falhas += 1;
  })
  .finally(() => {
    console.log(`\n${falhas === 0 ? 'TODAS AS REGRAS PASSARAM' : `${falhas} FALHA(S)`}`);
    // O emulador é derrubado pelo `emulators:exec`; sair com 1 força o
    // chamador a notar a falha.
    process.exit(falhas ? 1 : 0);
  });