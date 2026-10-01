// Constantes compartilhadas do jogo.
//
// Ficam em um modulo proprio (e nao no topo de cada cena) por dois motivos:
//  1. World's dimensions sao usadas em varias cenas e no HUD.
//  2. Bindings importados sao renomeados explicitamente pelo bundler, ao
//     contrario de `const` no topo de um modulo, que depende de heuristica de
//     mangling e ja causou referencia orfa no bundle (ver README, secao
//     "Vite e o bug de mangling").

/** Tamanho do mundo exploravel, em pixels. */
export const LARGURA_MUNDO = 2400;
export const ALTURA_MUNDO = 1800;

/** Velocidade de caminhada do jogador, em px/segundo. */
export const VELOCIDADE = 220;

/** Quantidade base de arvores espalhadas pelo mundo. */
export const ARVORES_NO_MUNDO = 120;

/** Paleta. */
export const OURO = '#d4af6a';
export const PERGAMINHO = '#f2e6d0';