import { defineConfig } from 'vite';

// GitHub Pages publica em https://<usuario>.github.io/<nome-do-repo>/
// Se voce renomear o repo, atualize o `base` aqui.
export default defineConfig({
  base: '/jogo_imperiall_2026/',

  define: {
    // Build timestamp para forçar novo hash a cada build
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
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