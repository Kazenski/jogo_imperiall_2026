// Raças do Império.
//
// Arquivo separado de `scenes/CriacaoScene.js` por um motivo prático: os testes
// rodam em Node puro, sem Phaser. Se a lista morasse na cena, qualquer teste
// que quisesse conferir as raças teria que carregar o framework inteiro — e a
// regra de "lógica pura fora das cenas" deixaria de valer justamente onde ela
// mais importa.
//
// A raça NÃO concede bônus de atributo. O bônus vem da vocação e dos talentos,
// para que escolher uma raça seja sobre identidade e não sobre qual número sai
// maior. O que a raça oferece aqui é o texto que o jogador lê e a cor que
// identifica o personagem.

export const RACAS = [
  {
    id: 'humano',
    nome: 'Humano do Norte',
    descricao:
      'Procedentes das terras de fronteira, foram os primeiros a erguer Portais Arcanos ' +
      'estáveis. Nenhum talento favorece uma arte sobre outra — e nenhum exclui as outras.',
    cor: 0xd4af6a,
    descCurta: 'Equilibrado · sem estigma de arte',
  },
  {
    id: 'anao',
    nome: 'Anão da Forja',
    descricao:
      'Nascidos sob as montanhas que cercam o Império, os anões tratam pedra como madeira e ' +
      'consideram a forja um lugar de estudo. Quem trabalha com ferramentas e máquinas entre ' +
      'eles aprende mais rápido.',
    cor: 0xb5723a,
    descCurta: 'Ferramentas, máquinas e mineração',
  },
  {
    id: 'elfo',
    nome: 'Elfo do Véu',
    descricao:
      'Atravessam portais que humanos nem percebem, e dizem que devem isso a uma época em que ' +
      'ainda não usavam armadura. Vivem mais, mas comem pouco.',
    cor: 0x7fb98a,
    descCurta: 'Longa vida, portais estáveis',
  },
  {
    id: 'orc',
    nome: 'Orc do Sul',
    descricao:
      'Chegaram ao Império pela rota dos portais, e a porta não fechou atrás deles. Foi a ' +
      'decisão mais fácil que o Império já tomou.',
    cor: 0x8a6a4f,
    descCurta: 'Força bruta, pouca magia',
  },
];

export const RACA_PADRAO = RACAS[0].id;

/** Raça pelo id; cai na padrão quando o id não existe mais no cadastro. */
export function buscarRaca(id) {
  return RACAS.find((r) => r.id === id) ?? RACAS[0];
}