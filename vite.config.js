import { defineConfig } from 'vite';
import { createRequire } from 'node:module';

// O `package.json` é a FONTE ÚNICA da versão. Ela entra no bundle por `define`
// (ver `src/dados/versao.js`), e `testes/logica.mjs` exige que os changelogs
// concordem com ela. Antes a versão aparecia escrita à mão em três lugares
// diferentes — e já divergiram (`0.1.0` no package.json, `0.1.2` no
// changelog, `0.3.0` na tela de novidades do lobby).
const pkg = createRequire(import.meta.url)('./package.json');

// GitHub Pages publica em https://<usuario>.github.io/<nome-do-repo>/
// Se voce renomear o repo, atualize o `base` aqui.
export default defineConfig({
  base: '/jogo_imperiall_2026/',

  define: {
    // Build timestamp para forçar novo hash a cada build
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __BUILD_ID__: JSON.stringify(Math.random().toString(36).substring(7)),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Separar em chunks deixa o cache do navegador mais eficiente
        // e evita que uma mudanca no Firebase rebaixe todo o jogo.
        // No Vite 8 (Rolldown) manualChunks precisa ser funcao.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          return undefined;
        },
      },
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
});