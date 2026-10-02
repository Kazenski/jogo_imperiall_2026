/**
 * Versão do jogo — injetada do `package.json` pelo Vite (`define`).
 *
 * **Regra do repositório: não escrever a versão à mão em lugar nenhum.**
 * `package.json` é a fonte da verdade. Este módulo é o único jeito de chegar
 * nela de dentro do jogo, e `testes/logica.mjs` falha se:
 *
 * - a última seção `## [x.y.z]` do `CHANGELOG_TECNICO.md` não bater com ela;
 * - o `CHANGELOG.md` não citar a mesma versão;
 * - algum `.js` tiver um literal de versão solto (tipo `'v0.3.0'`).
 *
 * Já aconteceu: o package.json dizia `0.1.0`, o changelog dizia `0.1.2` e a
 * tela "NOVIDADES" do lobby anunciava `0.3.0`. Três verdades, nenhuma certa.
 *
 * O `typeof` com guarda é porque `npm test` roda em Node puro, onde `define` do
 * Vite não existe. Ali o valor é `'0.0.0-dev'` de propósito: um fallback
 * silencioso com a versão real em vez disso seria pior que um valor obviamente
 * errado.
 */
export const VERSAO_JOGO =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

/** Mesma coisa já formatada para o jogador: `v0.1.3`. */
export const VERSAO_EXIBIDA = `v${VERSAO_JOGO}`;