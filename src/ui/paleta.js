// =====================================================================
//  A paleta de 36 cores do painel administrativo.
//
//  Módulo separado de propósito.
//
//  Este arquivo mora em `ui/` e é importado por `ui/pixelart.js`. Antes a
//  paleta vivia em `dados/schemaAdmin.js`, e o pixelart importava de lá. Isso
//  criava um CICLO:
//
//      AdminScene -> pixelart.js -> schemaAdmin.js -> (AdminScene, enums...)
//
//  Com o ciclo, `schemaAdmin.js` era avaliado enquanto `pixelart.js` ainda
//  estava no meio da avaliação, e `CAMPOS_CLASSSE` voltava `undefined` — o
//  que aparecia como "Cannot read properties of undefined (reading 'map')" ao
//  abrir o formulário de Classes, e nada mais do painel abria junto.
//
//  Em Node a suíte de testes passava: a ordem de importação dos módulos ES
//  resolve o ciclo de um jeito, e a do Vite, de outro. Por isso o bug só
//  aparecia no navegador — que é exatamente onde o admin vive.
//
//  Quebrar o ciclo é mais barato que tentar prever qual import resolveria o
//  primeiro. Que a paleta tenha um arquivo só dela.
// =====================================================================

/**
 * 36 cores em 6 famílias × 6 tons (claro → escuro).
 *
 * A grade no painel é 6 colunas, então seis famílias de seis fecham o desenho
 * sem sobra. Escolher por família — e não por "cor bonita" — evita o problema
 * de ter dez tons de verde e nenhum cinza: o admin precisa diferenciar
 * classes, e escolher duas classes com a mesma cor torna isso invisível.
 */
export const CORES_PALETA = [
  // Dourado imperial (cor da casa)
  '#f2ddb0', '#e8c87a', '#d4af6a', '#bb8f45', '#9a7130', '#7a5822',
  // Verde
  '#cfe6a8', '#a8cf72', '#7ba23f', '#5d8029', '#43611b', '#2c440f',
  // Azul
  '#bcdcf5', '#8cc0ea', '#4a90d9', '#2f6ea8', '#1d4d78', '#0f2f4a',
  // Roxo
  '#ddbde8', '#c394d0', '#8a4a9c', '#6b3579', '#4d2259', '#33133b',
  // Vermelho
  '#f5b8b8', '#e08a8a', '#c94a5a', '#a63441', '#7f222c', '#5a151c',
  // Neutros (cinzas, branco e preto)
  '#ffffff', '#d9dee3', '#a8b2bc', '#6b7680', '#3d454d', '#141619',
];
