const fs = require('fs');
const path = 'C:\\Users\\Edu\\OneDrive\\Documents\\jogo_imperiall\\jogo_imperiall_2026\\README.md';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const oldSection = `## Fluxo do jogador

A ordem das telas é uma **regra**, não preferência de layout:

\`\`\`
Boot (texturas procedurais)
  └─> Login ──> Termos ──> Criação do personagem ──> Mundo
                 (LGPD)       (não ser atacado)
                                       │
                                       └─> painéis: Mochila · Talentos ·
                                           Fabricação · Reinos · Wiki (H) ·
                                           Personagem · Admin (F2)
\`\`\`

Por que cada etapa existe:

- **Termos antes do mundo** — é o único momento em que o aceite precisa ser
  explícito. Depois de gravar a versão, o jogo não pergunta de novo até a
  próxima alteração do documento legal (\`VERSAO_TERMOS\` em \`src/dados/legal.js\`).
- **Criação antes do mundo** — o mundo gera monstros em volta do ponto de
  entrada. Sem personagem definido, o jogador aparecia no meio deles.
- **Wiki como tecla H** — toda a escrita do administrador (\`descricao\`,
  \`imagem\`) é lida de lá. Se o admin não escreveu, a wiki mostra os campos
  numéricos em vez de um cartão vazio.

---`;

const newSection = `## Fluxo do jogador

A ordem das telas é uma **regra**, não preferência de layout:

\`\`\`
Boot (texturas procedurais)
  └─> Login ──> Termos ──> Criação do personagem ──> Mundo
                 (LGPD)       (não ser atacado)
                                       │
                                       └─> painéis: Mochila · Talentos ·
                                           Fabricação · Reinos · Wiki (H) ·
                                           Personagem · Admin (F2)
\`\`\`

Por que cada etapa existe:

- **Termos antes do mundo** — é o único momento em que o aceite precisa ser
  explícito. Depois de gravar a versão, o jogo não pergunta de novo até a
  próxima alteração do documento legal (\`VERSAO_TERMOS\` em \`src/dados/legal.js\`).
- **Criação antes do mundo** — o mundo gera monstros em volta do ponto de
  entrada. Sem personagem definido, o jogador aparecia no meio deles.
- **Wiki como tecla H** — toda a escrita do administrador (\`descricao\`,
  \`imagem\`) é lida de lá. Se o admin não escreveu, a wiki mostra os campos
  numéricos em vez de um cartão vazio.

### Novidades no fluxo (Out/2026)

- **Posição persistente** — o jogador **nasce onde parou**. \`estado.posicao\`
  salva a cada 10s (se moveu >20px) e no shutdown de \`WorldScene\`.
- **Mapa 60x44** — área 6x maior (2640x1936). Mais biomas, bases maiores.
- **Portal posicionavel** — Shift+P alterna 4 posicoes (dir/esq/cima/baixo),
  salvo em \`estado.portalOffsetIdx\`. Efeitos visuais: aro runico, particulas,
  runas orbitando, placa flutuante.
- **Itens ate 1k + pereciveis** — \`stackMax\` padrao 1000. Campo \`perecivel\` +
  \`tempoEstragarSegundos\` no cadastro; \`dataValidade\` carimbada na criacao;
  pilhas so unem se validade **exatamente igual**.

---`;

if (content.includes(oldSection)) {
  content = content.replace(oldSection, newSection);
  fs.writeFileSync(path, content);
  console.log('OK - substituido');
} else {
  console.log('NAO ENCONTRADO');
  const idx = content.indexOf('## Fluxo do jogador');
  console.log('Idx:', idx);
  console.log('Primeiros 800 chars:', content.slice(idx, idx + 800));
}