// Definição declarativa de TODOS os cadastros do painel administrativo.
//
// Antes these campos estavam espalhados dentro do AdminScene, em `switch` e
// closures diferentes — o que significava que a aba "Classes" não tinha o
// campo `imagem`, a aba "Talentos" não tinha cor, e nenhuma tinha preview.
// Esquecer um campo era invisível na revisão de código e invisível para quem
// usava o painel.
//
// Aqui a lista é a FONTE da verdade. `painelLista` e `painelTalentos` leem
// estes arrays; acrescentar um cadastro novo é acrescentar um bloco aqui.
//
// Tipos aceitos por `tipo` (implementados em `ui/formularios.js`):
//   texto      uma linha
//   numero     uma linha, só dígitos (e opcionalmente negativo)
//   area       várias linhas — use para `descricao`, que é o texto que o
//              jogador lê na wiki e na ficha do item
//   select     lista de escolha única (aceita string ou {valor, rotulo})
//   multiselec chips de escolha múltipla
//   imagem     preview + envio para o Storage (ou colar URL)
//
// Chaves especiais de um campo:
//   obrigatorio  mostra * e bloqueia o salvamento se vazio
//   dica         texto de ajuda abaixo do campo
//   parse        converte o valor bruto do input no valor gravado
//   opcoes       lista (string[] ou {valor, rotulo}[])
//   pastaUpload  prefixo no Firebase Storage
//   emRelacao    true = o valor é controlado por outro registro (aparece cinza)

import {
  TIPOS_ITEM,
  USOS_ITEM,
  RARIDADES,
  ESTAÇÕES,
  TIPOS_HABILIDADE,
  COMPORTAMENTOS_MONSTRO,
  TIPOS_ACHIEVEMENT,
} from '../core/enums.js';

/** Rótulos legíveis para enumswhose valores são snake_case. */
export const ROTULOS_ESTACAO = {
  banco_trabalho: 'Banco de Trabalho',
  forja: 'Forja',
  alquimia: 'Mesa Alquímica',
  torno: 'Torno Rúnico',
  prensa_arcana: 'Prensa Arcana',
  oficina: 'Oficina',
};

// Conversão enums -> {valor, rotulo}, preservando a ordem de declaracao.
function comRotulo(enumObj, prefixo = '') {
  return Object.values(enumObj).map((v) => ({
    valor: v,
    rotulo: `${prefixo}${v.charAt(0).toUpperCase()}${v.slice(1)}`,
  }));
}

/** "dano:chance:qtd" -> lista de loot. */
const parseLoot = (v) =>
  String(v ?? '')
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [itemId, chance, qtd] = p.split(':');
      return {
        itemId: (itemId ?? '').trim(),
        chance: Number(chance) || 0,
        qtdMin: 1,
        qtdMax: Number(qtd) || 1,
      };
    })
    .filter((l) => l.itemId);

/** "item:qtd" -> lista de ingredientes. */
const parseListaQtd = (v) =>
  String(v ?? '')
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [itemId, qtd] = p.split(':');
      return { itemId: (itemId ?? '').trim(), qtd: Number(qtd) || 1 };
    })
    .filter((i) => i.itemId);

/** "tipo:qtd" -> lista de orbes. */
const parseListaTipo = (v) =>
  String(v ?? '')
    .split(/[|,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [tipo, qtd] = p.split(':');
      return { tipo: (tipo ?? '').trim(), qtd: Number(qtd) || 1 };
    })
    .filter((o) => o.tipo);

/** "chefe:valor" -> objeto de efeitos (aceita '+5' e números negativos). */
const parseEfeitos = (v) => {
  const saida = {};
  for (const parte of String(v ?? '').split(/[|;]/)) {
    const [k, val] = parte.split(':');
    if (!k?.trim()) continue;
    const limpo = String(val ?? '').trim().replace(/^\+/, '');
    const n = Number(limpo);
    saida[k.trim()] = Number.isFinite(n) ? n : limpo;
  }
  return saida;
};

const efeitosTexto = (v) =>
  Object.entries(v ?? {})
    .map(([k, val]) => `${k}:${val >= 0 ? '+' : ''}${val}`)
    .join(', ');

/** Converte qualquer estrutura em texto legível para um campo `texto`. */
function paraTexto(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// =====================================================================
// ITENS  (recursos, blocos, ferramentas, equipamentos, maquinas, orbes)
// =====================================================================

export const CAMPOS_ITEM = [
  { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Machado de Ferro' },
  { chave: 'descricao', rotulo: 'Descrição (aparece na wiki e na ficha)', tipo: 'area', placeholder: 'Explique o que é, para que serve e de onde vem.' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'itens' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: comRotulo(TIPOS_ITEM) },
  { chave: 'uso', rotulo: 'Usos', tipo: 'multiselec', opcoes: comRotulo(USOS_ITEM),
    dica: 'Extração = veio do mundo · Transformação = insumo de receita · Utilização = uso direto · Estrutura = construção · Equipável · Máquina' },
  { chave: 'raridade', rotulo: 'Raridade', tipo: 'select', opcoes: comRotulo(RARIDADES) },
  { chave: 'nivelMin', rotulo: 'Nível mínimo', tipo: 'numero', dica: '0 = disponível desde o início' },
  { chave: 'valor', rotulo: 'Valor em ouro', tipo: 'numero' },
  { chave: 'stackMax', rotulo: 'Máximo por pilha', tipo: 'numero' },

  // Números de combate/uso — todos opcionais; o que for preenchido aparece na
  // ficha do item e é lido pelas regras (consumíveis, máquinas, orbitals).
  { chave: 'danoBase', rotulo: 'Dano base', tipo: 'numero' },
  { chave: 'defesa', rotulo: 'Defesa', tipo: 'numero' },
  { chave: 'vidaMax', rotulo: 'Vida máxima', tipo: 'numero' },
  { chave: 'poderMax', rotulo: 'Poder máximo', tipo: 'numero' },
  { chave: 'poderMineracao', rotulo: 'Poder de mineração', tipo: 'numero' },
  { chave: 'curaVida', rotulo: 'Cura de vida', tipo: 'numero', dica: 'Itens consumíveis' },
  { chave: 'fis', rotulo: 'Bônus Físico', tipo: 'numero' },
  { chave: 'men', rotulo: 'Bônus Mental', tipo: 'numero' },
  { chave: 'soc', rotulo: 'Bônus Social', tipo: 'numero' },

  // Orbes Arcanos
  { chave: 'slotsUpgrade', rotulo: 'Slots de Orbe', tipo: 'numero', dica: 'Quantos reforços o item aceita no total' },
  { chave: 'nivelMaxUpgrade', rotulo: 'Nível máx. de upgrade', tipo: 'numero', dica: '0 = sem limite extra' },
  { chave: 'tiposOrbeAceitos', rotulo: 'Orbes aceitos', tipo: 'multiselec',
    opcoes: [
      { valor: 'orbe_arcano_menor', rotulo: 'Menor (nv 1-10)' },
      { valor: 'orbe_arcano_medio', rotulo: 'Médio (nv 11-25)' },
      { valor: 'orbe_arcano_superior', rotulo: 'Superior (nv 26-40)' },
      { valor: 'orbe_arcano_epico', rotulo: 'Épico (nv 41-60)' },
      { valor: 'orbe_arcano_lendario', rotulo: 'Lendário (nv 61+)' },
    ],
    dica: 'Vazio = aceita todos. O tier precisa cobrir o nível do JOGADOR.' },

  // Extração: o que o item rende quando minerado.
  { chave: 'extracao', rotulo: 'Extrai de (blocos que o geram)', tipo: 'multiselec', opcoes: [],
    dica: 'Preenchido automaticamente ao clicar em "Ver blocos"' },
  { chave: 'rende', rotulo: 'Rende ao extrair', tipo: 'area',
    placeholder: 'madeira:2, pedra:1',
    dica: 'Lista item:quantidade separada por vírgula. É o que o bloco deixa ao ser minerado.' },
  { chave: 'rendimentoMin', rotulo: 'Rendimento mínimo', tipo: 'numero' },
  { chave: 'rendimentoMax', rotulo: 'Rendimento máximo', tipo: 'numero' },
  { chave: 'dureza', rotulo: 'Dureza (golpes para extrair)', tipo: 'numero' },
  { chave: 'vidaBloco', rotulo: 'Vida do bloco', tipo: 'numero' },

  // Perecíveis: alimentos que estragam. Se TRUE, itens com esta flag NAO se
  // empilham com outros da mesma ID se tiverem tempo de validade diferente.
  // O admin cadastra `tempoEstragarSegundos` (ex.: 3600 = 1h) e o jogo
  // atribui `dataValidade = Date.now() + tempoEstragarSegundos * 1000` ao criar.
  { chave: 'perecivel', rotulo: 'Perecível (estraga)', tipo: 'select',
    opcoes: [{ valor: false, rotulo: 'Não' }, { valor: true, rotulo: 'Sim' }],
    dica: 'Alimentos que estragam. Pilhas com validade diferente nao se unem.' },
  { chave: 'tempoEstragarSegundos', rotulo: 'Tempo até estragar (segundos)', tipo: 'numero',
    dica: 'Ex.: 3600 = 1 hora, 86400 = 1 dia. So vale se Perecível = Sim.' },
];

// =====================================================================
// CLASSES / VOCAÇÕES
// =====================================================================

export const CAMPOS_CLASSE = [
  { chave: 'nome', rotulo: 'Nome da Vocação', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'Explique o papel da vocação no Império.' },
  { chave: 'imagem', rotulo: 'Imagem / retrato', tipo: 'imagem', pastaUpload: 'classes' },
  { chave: 'cor', rotulo: 'Cor (hex, ex.: #d4af6a)', tipo: 'texto' },
  { chave: 'nivelMin', rotulo: 'Nível mínimo', tipo: 'numero' },
  { chave: 'vidaBase', rotulo: 'Vida base', tipo: 'numero' },
  { chave: 'poderBase', rotulo: 'Poder base', tipo: 'numero' },
  { chave: 'fis', rotulo: 'Físico base', tipo: 'numero' },
  { chave: 'men', rotulo: 'Mental base', tipo: 'numero' },
  { chave: 'soc', rotulo: 'Social base', tipo: 'numero' },
  { chave: 'bonusPorNivel', rotulo: 'Bônus por nível', tipo: 'area',
    placeholder: 'vidaMax:+4,poderMax:+3,fis:+1',
    dica: 'O que GANHA a cada nível. Ex.: vidaMax:+4,poderMax:+3' },
];

// =====================================================================
// MONSTROS
// =====================================================================

export const CAMPOS_MONSTRO = [
  { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'O que é essa criatura no Império?' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'monstros' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto', placeholder: 'Ex.: bestial, espectro, constructo' },
  { chave: 'raridade', rotulo: 'Raridade', tipo: 'texto' },
  { chave: 'faixaMin', rotulo: 'Nível mínimo', tipo: 'numero' },
  { chave: 'faixaMax', rotulo: 'Nível máximo', tipo: 'numero' },
  { chave: 'vidaMax', rotulo: 'Vida máxima', tipo: 'numero' },
  { chave: 'poderMax', rotulo: 'Poder máximo', tipo: 'numero' },
  { chave: 'fis', rotulo: 'Físico', tipo: 'numero' },
  { chave: 'men', rotulo: 'Mental', tipo: 'numero' },
  { chave: 'soc', rotulo: 'Social', tipo: 'numero' },
  { chave: 'danoBase', rotulo: 'Dano base', tipo: 'numero' },
  { chave: 'defesa', rotulo: 'Defesa', tipo: 'numero' },
  { chave: 'alcance', rotulo: 'Alcance', tipo: 'numero' },
  { chave: 'velocidade', rotulo: 'Velocidade', tipo: 'numero' },
  { chave: 'comportamento', rotulo: 'Comportamento', tipo: 'select', opcoes: comRotulo(COMPORTAMENTOS_MONSTRO) },
  { chave: 'xpRecompensa', rotulo: 'XP de recompensa', tipo: 'numero' },
  { chave: 'loot', rotulo: 'Loot', tipo: 'area',
    placeholder: 'pedra:80:2, madeira:60:3',
    dica: 'item:chance:quantidade · a chance é de 0 a 100',
    parse: parseLoot },
];

// =====================================================================
// RECEITAS
// =====================================================================

export const CAMPOS_RECEITA = [
  { chave: 'nome', rotulo: 'Nome da receita', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area' },
  { chave: 'estacao', rotulo: 'Estação', tipo: 'select', opcoes: comRotulo(ESTAÇÕES) },
  { chave: 'nivelMin', rotulo: 'Nível mín. da estação', tipo: 'numero' },
  { chave: 'insumos', rotulo: 'Insumos', tipo: 'area', placeholder: 'ferro:3, madeira:2',
    dica: 'item:quantidade', parse: parseListaQtd },
  { chave: 'saida', rotulo: 'Saída', tipo: 'area', placeholder: 'espada_ferro:1',
    dica: 'item:quantidade', parse: parseListaQtd },
  { chave: 'tempoMs', rotulo: 'Tempo (segundos)', tipo: 'numero', dica: 'Em segundos (ex.: 2 = 2s). O banco grava ms (×1000).' },
  { chave: 'custoPoder', rotulo: 'Custo de Poder', tipo: 'numero' },
  { chave: 'experiencia', rotulo: 'Experiência concedida', tipo: 'numero' },
];

// =====================================================================
// REINOS ETÉREOS
// =====================================================================

export const CAMPOS_REINO = [
  { chave: 'nome', rotulo: 'Nome do reino', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area' },
  { chave: 'imagem', rotulo: 'Imagem do reino', tipo: 'imagem', pastaUpload: 'reinos' },
  { chave: 'bioma', rotulo: 'Bioma', tipo: 'texto' },
  { chave: 'dificuldade', rotulo: 'Dificuldade (1-5)', tipo: 'numero' },
  { chave: 'faixaMin', rotulo: 'Nível mín.', tipo: 'numero' },
  { chave: 'faixaMax', rotulo: 'Nível máx.', tipo: 'numero' },
  { chave: 'seedBase', rotulo: 'Seed base', tipo: 'texto', dica: 'Deixe vazio para o jogo sortear' },
  { chave: 'monstrosPossiveis', rotulo: 'Monstros possíveis', tipo: 'multiselec', opcoes: [],
    dica: 'Preenchido ao clicar em "Ver monstros"' },
  { chave: 'lootGlobal', rotulo: 'Loot do mundo', tipo: 'area',
    placeholder: 'pedra:70:3, madeira:70:4',
    dica: 'item:chance:quantidade', parse: parseLoot },
];

// =====================================================================
// ESTAÇÕES DE USO (máquinas e artifícios de craft)
// =====================================================================

export const CAMPOS_ESTACAO = [
  { chave: 'nome', rotulo: 'Nome da estação', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Mesa Alquímica' },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'O que essa estação faz no jogo.' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'estacoes' },
  { chave: 'nivelMin', rotulo: 'Nível mínimo para usar', tipo: 'numero' },
  { chave: 'custoPoder', rotulo: 'Custo de poder por uso', tipo: 'numero' },
  { chave: 'cor', rotulo: 'Cor (hex, ex.: #7ba23f)', tipo: 'texto' },
];

// =====================================================================
// CONQUISTAS
// =====================================================================

export const CAMPOS_CONQUISTA = [
  { chave: 'nome', rotulo: 'Nome da conquista', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'O que o jogador precisa fazer.' },
  { chave: 'imagem', rotulo: 'Emblema', tipo: 'imagem', pastaUpload: 'conquistas' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: comRotulo(TIPOS_ACHIEVEMENT) },
  { chave: 'chave', rotulo: 'Condição (caminho)', tipo: 'texto',
    placeholder: 'stats.portaisUsados',
    dica: 'Caminho dentro do estado do jogador. Exemplos: stats.inimigosDerrotados, stats.blocosColocados, stats.itensCriados, nivel, base.blocos (use {} para contar)' },
  { chave: 'meta', rotulo: 'Meta (número)', tipo: 'numero', dica: 'Valor a alcançar. Ex.: 25 portais' },
  { chave: 'recompensaXp', rotulo: 'Recompensa XP', tipo: 'numero' },
  { chave: 'recompensaOuro', rotulo: 'Recompensa Ouro', tipo: 'numero' },
  { chave: 'recompensaOrbes', rotulo: 'Recompensa Orbes', tipo: 'area',
    placeholder: 'orbe_arcano_menor:1',
    dica: 'tipo:quantidade', parse: parseListaTipo },
];

// =====================================================================
// TALENTOS  (a árvore)
// =====================================================================

export const CAMPOS_TALENTO = [
  { chave: 'nome', rotulo: 'Nome do talento', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'O que este talento concede.' },
  { chave: 'imagem', rotulo: 'Ícone', tipo: 'imagem', pastaUpload: 'talentos' },
  { chave: 'ramo', rotulo: 'Ramificação', tipo: 'texto',
    placeholder: 'Ex.: Corpo, Mente, Espírito, Social',
    dica: 'Nome do ramo/linha. Talentos com o mesmo ramo formam um caminho; deixe vazio para talento raiz.' },
  { chave: 'corRamo', rotulo: 'Cor do ramo (hex)', tipo: 'texto',
    placeholder: '#8a6a2f',
    dica: 'Cor da linha que conecta os talentos deste ramo. Ex.: #4f8a4f Corpo · #4f5f8a Mente · #8a4f7a Social · #8a7a2f Espírito' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: comRotulo(TIPOS_HABILIDADE),
    dica: 'Passiva = sempre ativa · Ativa = ability que se usa · Mental = foco · Social = interação' },
  { chave: 'nivelMin', rotulo: 'Nível mínimo', tipo: 'numero', dica: 'Nível do JOGADOR necessário' },
  { chave: 'custoPontos', rotulo: 'Custo em pontos', tipo: 'numero' },
  { chave: 'custoPoder', rotulo: 'Custo de Poder', tipo: 'numero' },
  { chave: 'preRequisitos', rotulo: 'Talentos requeridos', tipo: 'multiselec', opcoes: [],
    dica: 'Vazio = talento raiz, disponível direto.' },
  { chave: 'preRequisitoNiveis', rotulo: 'Níveis requeridos (atributos)', tipo: 'area',
    placeholder: 'fis:5,men:3',
    dica: 'atributo:nível — o talento só abre quando o ATRIBUTO do personagem alcançar este valor. Ex.: fis:5,men:3',
    parse: parseEfeitos },
  { chave: 'efeitos', rotulo: 'Efeitos', tipo: 'area',
    placeholder: 'fis:+2,vidaMax:+10,poderPct:+5',
    dica: 'chefe:valor, separados por vírgula. Use + para bônus. Campos comuns: fis, men, soc, vidaMax, poderMax, defesa, regenVida, regenPoder, carga, poderMineracao, poderPct, xpPct, ouroBonus, vendaPct, reducaoDanoPct, alcanceConstrucao, velocidadeMaquinaPct, escudoPct, reparo',
    parse: parseEfeitos },
  { chave: 'posX', rotulo: 'Coluna na árvore', tipo: 'numero', dica: '0 = primeira coluna. Define o desenho da linha.' },
  { chave: 'posY', rotulo: 'Linha na árvore', tipo: 'numero', dica: '0 = primeira linha' },
];

// =====================================================================
// Textos auxiliares para exibir valores estruturados nos campos de texto
// =====================================================================

export const serializadores = {
  loot: (v) =>
    Array.isArray(v) ? v.map((l) => `${l.itemId}:${l.chance}:${l.qtdMax}`).join(', ') : '',
  insumos: (v) => (Array.isArray(v) ? v.map((i) => `${i.itemId}:${i.qtd}`).join(', ') : ''),
  saida: (v) => (Array.isArray(v) ? v.map((i) => `${i.itemId}:${i.qtd}`).join(', ') : ''),
  recompensaOrbes: (v) => (Array.isArray(v) ? v.map((o) => `${o.tipo}:${o.qtd}`).join(', ') : ''),
  efeitos: efeitosTexto,
  bonusPorNivel: efeitosTexto,
  preRequisitoNiveis: efeitosTexto,
};

export { paraTexto };

// =====================================================================
// Descrição curta usada na lista lateral esquerda
// =====================================================================

export const RESUMO = {
  itens: (d) =>
    `${d.tipo ?? 'item'} · ${(d.uso ?? []).join(', ') || 'sem uso'} · ${d.raridade ?? 'comum'}` +
    (d.slotsUpgrade ? ` · ${d.slotsUpgrade} slot(s) de orbe` : ''),
  classes: (d) =>
    `nv ${d.nivelMin ?? 1}+ · vida ${d.vidaBase ?? 100} · poder ${d.poderBase ?? 40} · ` +
    `fis ${d.fis ?? 0} men ${d.men ?? 0} soc ${d.soc ?? 0}`,
  monstros: (d) =>
    `nv ${d.faixaMin ?? 1}–${d.faixaMax ?? 5} · vida ${d.vidaMax ?? 50} · ${d.comportamento ?? 'errante'}`,
  receitas: (d) => `${ROTULOS_ESTACAO[d.estacao] ?? d.estacao ?? '—'} · nv ${d.nivelMin ?? 1}+`,
  reinos: (d) => `${d.bioma ?? '—'} · nv ${d.faixaMin ?? 1}–${d.faixaMax ?? 9} · diff ${d.dificuldade ?? 1}`,
  estacoes: (d) => `nv ${d.nivelMin ?? 1}+ · custo ${d.custoPoder ?? 0} poder`,
  conquistas: (d) => `${d.tipo ?? '—'} · meta ${d.meta ?? '?'} · chave "${d.chave ?? ''}"`,
  talentos: (d) =>
    `${d.ramo || 'raiz'} · ${d.tipo ?? '—'} · ${d.custoPontos ?? 1}pt · nv ${d.nivelMin ?? 1}` +
    (d.preRequisitos?.length ? ` · requer ${d.preRequisitos.length}` : ''),
};