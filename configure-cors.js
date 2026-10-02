// =====================================================================
//  Publica as regras do Firestore e do Storage e ajusta o CORS do bucket.
//
//  Uso:
//    node configure-cors.js          -> mostra o que será feito
//    node configure-cors.js --apply  -> executa de verdade
//
//  ES module, e não CommonJS: o package.json do projeto declara
//  "type": "module", então um `.js` com `require` nem chega a rodar —
//  o Node aborta com "require is not defined in ES module scope".
//
//  Por que este script existe
//  --------------------------
//  Duas coisas diferentes produzem mensagens parecidas, e confundi-las custa
//  tempo:
//
//  1. "Response to preflight request doesn't pass access control check"
//     As regras do STORAGE não estão publicadas. O preflight recebe 403, o
//     navegador chama isso de CORS. Publicar `storage.rules` resolve.
//
//  2. Imagem quebra mesmo com as regras publicadas
//     A configuração de CORS do bucket não inclui o domínio do GitHub Pages.
//     Aí sim é CORS, e resolve-se com `gcloud storage buckets update`.
//
//  O script faz as duas coisas na ordem certa e explica cada etapa.
// =====================================================================

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const BUCKET_PADRAO = 'jogo-imperiall-2026.firebasestorage.app';

const aplicar = process.argv.includes('--apply');
const bucket = process.env.BUCKET || BUCKET_PADRAO;

function executar(comando, descricao) {
  console.log(`\n▶ ${descricao}`);
  console.log(`  $ ${comando}\n`);
  try {
    execSync(comando, { stdio: 'inherit', cwd: RAIZ, shell: 'cmd.exe' });
    console.log('  ✓ ok');
    return true;
  } catch (erro) {
    console.error(`  ✗ falhou (código ${erro?.status ?? 'desconhecido'})`);
    return false;
  }
}

console.log('='.repeat(70));
console.log('  Configuração do Firebase — regras + CORS');
console.log('='.repeat(70));
console.log(`Bucket: ${bucket}`);
console.log(`Modo:   ${aplicar ? 'APLICAR' : 'simulação (use --apply para executar)'}`);

if (!existsSync(path.join(RAIZ, 'storage.rules'))) {
  console.error('\nstorage.rules não encontrado.');
  process.exit(1);
}

if (!aplicar) {
  console.log('\nO que será feito quando rodar com --apply:\n');
  console.log('  1. firebase deploy --only firestore:rules,storage');
  console.log('     Publica as regras. ISSO resolve o erro de preflight/CORS das imagens.\n');
  console.log('  2. Configura o CORS do bucket (via gcloud).\n');
  console.log('Para rodar:\n');
  console.log('  node configure-cors.js --apply');
  console.log('\nSe usar outro bucket:\n');
  console.log('  $env:BUCKET="outro-bucket" ; node configure-cors.js --apply');
  process.exit(0);
}

// ---------------------------------------------------------------------
// 1. Regras
// ---------------------------------------------------------------------
const regrasOk = executar(
  'npx -y firebase-tools@latest deploy --only firestore:rules,storage',
  'Publicando regras do Firestore e do Storage',
);

if (!regrasOk) {
  console.error('\nAs regras não foram publicadas. As imagens continuam quebradas.');
  console.error('Se aparecer "Failed to authenticate", rode antes:');
  console.error('  npx firebase-tools@latest login');
  process.exit(1);
}

// ---------------------------------------------------------------------
// 2. CORS
// ---------------------------------------------------------------------
console.log('\n' + '-'.repeat(70));
console.log('Configurando CORS do bucket (necessário para o GitHub Pages)');
console.log('-'.repeat(70));

const corsPath = path.join(RAIZ, 'cors.json');

// `gcloud storage buckets update --cors-file` SUBSTITUI a configuração
// inteira, então precisamos reaplicar TODAS as origens que o projeto usa —
// não só a nova. Perder uma origem silenciosamente quebra o ambiente local
// semanas depois, quando alguém já esqueceu que ela estava aqui.
const configCors = {
  cors: [
    {
      origin: ['https://kazenski.github.io'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Content-Disposition'],
      maxAgeSeconds: 3600,
    },
    {
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Content-Disposition'],
      maxAgeSeconds: 3600,
    },
  ],
};

// Array direto, sem a chave `cors` em volta — é o formato que o gsutil espera.
// `gcloud storage buckets update --cors-file` aceita o arquivo com a chave e
// "aplica" sem erro, mas não escreve nada: o describe continua devolvendo
// `cors: null` e o bug só aparece depois, como imagem quebrada.
writeFileSync(corsPath, JSON.stringify(configCors, null, 2));
console.log('\ncors.json atualizado.');

const corsOk = executar(
  `gsutil cors set ${corsPath} gs://${bucket}`,
  'Aplicando CORS ao bucket (gsutil)',
);

if (!corsOk) {
  console.log('\nO gsutil não está disponível ou você não tem permissão.');
  console.log('As REGRAS já foram publicadas — as imagens devem funcionar.');
  console.log('Para ajustar o CORS depois:');
  console.log(`  gsutil cors set cors.json gs://${bucket}`);
}

console.log('\n' + '='.repeat(70));
console.log('  Concluído');
console.log('='.repeat(70));
console.log('\nPróximo passo: recompilar e publicar o site.');
console.log('  npm run build');
console.log('  npx firebase-tools@latest deploy --only hosting');
console.log('\nVerifique abrindo o painel e conferindo:');
console.log('  - as imagens carregam nas listas e na prévia;');
console.log('  - a aba Bal. Tabela abre sem "Missing or sufficient permissions";');
console.log('  - enviar uma imagem nova dá "Imagem enviada".');
console.log('\nSe algo ainda falhar, veja README_PERMISSOES.md.');
