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
  TIPOS_NPC,
  MOVIMENTOS_NPC,
  PROCESSOS_ESTACAO,
  TIPOS_BIOMA,
  TAMANHOS_MUNDO,
  TIPOS_SERVIDOR,
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

// Rótulos dos PROCESSOS de estação. Sem este mapa o `comRotulo()` geraria
// "Impressora 3d" e "Forja avancada" — o painel mostra o que o jogador lê.
export const ROTULOS_PROCESSO = {
  cozinhar: 'Cozinhar',
  ferreiro: 'Trabalhar metal',
  alquimia: 'Alquimiar',
  costura: 'Costurar',
  carpintaria: 'Trabalhar madeira',
  agricultura: 'Cultivar',
  mineracao: 'Minerar',
  pesca: 'Pescar',
  caca: 'Caçar',
  madeira: 'Coletar madeira',
  impressora_3d: 'Impressão 3D',
  sintetizador: 'Sintetizar material',
  recicladora: 'Reciclar',
  forja_avancada: 'Forja avançada',
  estacao_cientifica: 'Análise científica',
  fabrica: 'Fabricar em série',
  montadora: 'Montar máquina',
  refinaria: 'Refinar material',
  estacao_energia: 'Gerar energia',
  impressora_arcana: 'Impressão arcana',
  conversor_materia: 'Converter matéria',
};

// Descrição curta do que cada PROCESSO faz — aparece como dica no seletor,
// porque o jogador não deve ter que adivinhar o que "Estação Científica" faz.
export const DESCRICAO_PROCESSO = {
  cozinhar: 'Transforma ingredientes em comida e bebidas.',
  ferreiro: 'Fundir e forjar minério em barras, lâminas e armaduras.',
  alquimia: 'Reagentes viram poções, elixires e materiais instáveis.',
  costura: 'Tecidos e couro viram roupas, bolsas e paraquedas.',
  carpintaria: 'Madeira e tábuas viram móveis, ferramentas e navios.',
  agricultura: 'Preparar terra, semear, regar e colher.',
  mineracao: 'Extrair e processar minério em barras.',
  pesca: 'Lançar linha e trazer peixes, conchas e trinkets.',
  caca: 'Abater fauna por carne, couro e troféus.',
  madeira: 'Derrubar árvores e processar toras em tábuas.',
  impressora_3d: 'Imprimir peças a partir de descritores de material.',
  sintetizador: 'Criar materiais novos a partir de ingredientes.',
  recicladora: 'Transformar sucata e peças quebradas em material reaproveitável.',
  forja_avancada: 'Metalurgia avançada — ligas com durezas altas.',
  estacao_cientifica: 'Analisar amostras: revela receitas e propriedades.',
  fabrica: 'Produzir grandes volumes em fila automática.',
  montadora: 'Juntar módulos de máquina para formar máquinas completas.',
  refinaria: 'Purificar minério bruto em lingotes de alta pureza.',
  estacao_energia: 'Converter combustível em energia para o mundo.',
  impressora_arcana: 'Materializar itens a partir de essência arcana.',
  conversor_materia: 'Transmutar um material no tipo de outro.',
};

/** Monta {valor, rotulo} a partir de um enum, com mapa opcional de rótulos. */
function comRotulo(enumObj, rotulos = {}) {
  return Object.values(enumObj).map((v) => ({
    valor: v,
    rotulo: rotulos[v] ?? `${v.charAt(0).toUpperCase()}${v.slice(1)}`,
  }));
}

/**
 * Igual a comRotulo, mas cada opção também carrega `descricao`.
 * Usado no seletor de processos das estações: o admin precisa saber o que
 * "Estação Científica" faz antes de marcar, não descobrir depois no jogo.
 */
function comDescricao(enumObj, rotulos = {}, descricoes = {}) {
  return Object.values(enumObj).map((v) => ({
    valor: v,
    rotulo: rotulos[v] ?? `${v.charAt(0).toUpperCase()}${v.slice(1)}`,
    descricao: descricoes[v] ?? '',
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
// SELETOR DE CORES — 36 cores pré-definidas
// =====================================================================

// 36 cores em 6 famílias × 6 tons (claro → escuro).
//
// A grade no painel é 6 colunas, então seis famílias de seis fecham o desenho
// sem sobra. Escolher por família — e não por "cor bonita" — evita o problema
// de ter dez tons de verde e nenhum cinza: o admin precisa diferencia
// classes, e escolher duas classes com a mesma cor torna isso invisível.
//
// A paleta mora em `ui/paleta.js` e é reexportada aqui por compatibilidade.
// NÃO defina a paleta neste arquivo: `ui/pixelart.js` precisa dela, e mantê-la
// aqui criava o ciclo
//
//     AdminScene -> pixelart.js -> schemaAdmin.js -> ...
//
// que fazia `CAMPOS_CLASSSE` chegar `undefined` no navegador — a aba Classes
// abria em branco e nenhuma outra aba junto. A suíte em Node passava, porque a
// ordem de resolução de módulos ES difere da do Vite. Ver `ui/paleta.js`.
export { CORES_PALETA } from '../ui/paleta.js';

// =====================================================================
// DICIONÁRIO DE EFEITOS — nome e descrição de cada atributo
// =====================================================================

export const EFEITOS_DESCRICOES = {
  fis: { nome: 'Físico', descricao: 'Força muscular e resistência corporal' },
  men: { nome: 'Mental', descricao: 'Inteligência, memória e poder arcano' },
  soc: { nome: 'Social', descricao: 'Carisma, persuasão e liderança' },
  vidaMax: { nome: 'Vida Máxima', descricao: 'Pontos de vida máximos do personagem' },
  poderMax: { nome: 'Poder Máximo', descricao: 'Pontos de poder/mana máximos' },
  defesa: { nome: 'Defesa', descricao: 'Reduz o dano recebido' },
  regenVida: { nome: 'Regeneração de Vida', descricao: 'Vida recuperada por segundo' },
  regenPoder: { nome: 'Regeneração de Poder', descricao: 'Poder recuperado por segundo' },
  carga: { nome: 'Carga', descricao: 'Capacidade de inventário' },
  poderMineracao: { nome: 'Poder de Mineração', descricao: 'Velocidade e eficiência ao minerar' },
  poderPct: { nome: 'Poder (%)', descricao: 'Aumento percentual de poder' },
  xpPct: { nome: 'XP (%)', descricao: 'Aumento percentual de experiência' },
  ouroBonus: { nome: 'Bônus de Ouro', descricao: 'Ouro extra ganho' },
  vendaPct: { nome: 'Venda (%)', descricao: 'Aumento percentual no valor de venda' },
  reducaoDanoPct: { nome: 'Redução de Dano (%)', descricao: 'Redução percentual de dano recebido' },
  alcanceConstrucao: { nome: 'Alcance de Construção', descricao: 'Distância máxima para construir' },
  velocidadeMaquinaPct: { nome: 'Velocidade de Máquina (%)', descricao: 'Aumento percentual na velocidade de máquinas' },
  escudoPct: { nome: 'Escudo (%)', descricao: 'Aumentual percentual de escudo' },
  reparo: { nome: 'Reparo', descricao: 'Capacidade de reparar itens' },
};

// =====================================================================
// ITENS  (recursos, blocos, ferramentas, equipamentos, maquinas, orbes)
// =====================================================================

export const CAMPOS_ITEM = [
  { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Machado de Ferro' },
  { chave: 'descricao', rotulo: 'Descrição (aparece na wiki e na ficha)', tipo: 'area', placeholder: 'Explique o que é, para que serve e de onde vem.' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'itens', pixelArt: true,
    dica: 'Envie um arquivo pronto ou desenhe aqui. O editor é 32×32, do tamanho exato de um bloco do mundo.' },
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
  { chave: 'imagem', rotulo: 'Imagem / retrato', tipo: 'imagem', pastaUpload: 'classes', pixelArt: true,
    dica: 'Envie um arquivo pronto ou desenhe aqui. O editor é 32×32, do tamanho exato de um bloco do mundo.' },
  { chave: 'cor', rotulo: 'Cor', tipo: 'cor' },
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
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'monstros', pixelArt: true,
    dica: 'Envie um arquivo pronto ou desenhe aqui. O editor é 32×32, do tamanho exato de um bloco do mundo.' },
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
  { chave: 'nome', rotulo: 'Nome do mundo', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area' },
  { chave: 'imagem', rotulo: 'Imagem do mundo', tipo: 'imagem', pastaUpload: 'reinos' },

  // ---- Geometria do mundo ----
  { chave: 'tamanho', rotulo: 'Tamanho', tipo: 'select', opcoes: comRotulo(TAMANHOS_MUNDO),
    dica: 'Define quantos blocos o mapa tem em cada lado.' },
  { chave: 'largura', rotulo: 'Largura em blocos', tipo: 'numero',
    dica: 'Sobrescreve o tamanho acima quando preenchido.' },
  { chave: 'altura', rotulo: 'Altura em blocos', tipo: 'numero',
    dica: 'Sobrescreve o tamanho acima quando preenchido.' },
  { chave: 'seedBase', rotulo: 'Seed base', tipo: 'texto',
    dica: 'Mesmo seed = mesmo mundo sempre. Deixe vazio para o jogo sortear.' },

  // ---- Biomas que compõem este mundo ----
  { chave: 'biomas', rotulo: 'Biomas do mundo', tipo: 'multiselec', opcoes: [],
    fonte: 'biomas', dica: 'Cada bioma define seus próprios blocos e mobs nativos.' },
  { chave: 'blocosNativos', rotulo: 'Blocos nativos extras', tipo: 'multiselec', opcoes: [],
    fonte: 'blocos', dica: 'Blocos que aparecem em qualquer bioma deste mundo.' },
  { chave: 'mobsNativas', rotulo: 'Mobs nativas do mundo', tipo: 'multiselec', opcoes: [],
    fonte: 'monstros', dica: 'Criaturas que aparecem em qualquer bioma deste mundo.' },

  // ---- Perigos e recompensa ----
  { chave: 'dificuldade', rotulo: 'Dificuldade (1-5)', tipo: 'numero' },
  { chave: 'faixaMin', rotulo: 'Nível mín.', tipo: 'numero' },
  { chave: 'faixaMax', rotulo: 'Nível máx.', tipo: 'numero' },
  { chave: 'monstrosPossiveis', rotulo: 'Monstros possíveis', tipo: 'multiselec', opcoes: [],
    fonte: 'monstros', dica: 'Pool geral de spawn deste mundo.' },
  { chave: 'lootGlobal', rotulo: 'Loot do mundo', tipo: 'area',
    placeholder: 'pedra:70:3, madeira:70:4',
    dica: 'item:chance:quantidade', parse: parseLoot },
  { chave: 'clima', rotulo: 'Clima', tipo: 'select',
    opcoes: [
      { valor: 'claro', rotulo: 'Sempre claro' },
      { valor: 'noite', rotulo: 'Noite recorrente' },
      { valor: 'chuva', rotulo: 'Chuva frequente' },
      { valor: 'tempestade', rotulo: 'Tempestades' },
      { valor: 'neblina', rotulo: 'Neblina' },
    ] },
  { chave: 'relogioMundo', rotulo: 'Relógio do mundo', tipo: 'area',
    placeholder: 'ciclo:24,minutosDia:30,minutosNoite:15',
    dica: 'ciclo = horas por dia · minutosDia/Noite = duração real de cada período. Vazio = usa o padrão.' },
];

// =====================================================================
// ESTAÇÕES DE USO (máquinas e artifícios de craft)
// =====================================================================

export const CAMPOS_ESTACAO = [
  { chave: 'nome', rotulo: 'Nome da estação', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Mesa Alquímica' },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area', placeholder: 'O que essa estação faz no jogo.' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'estacoes' },
  { chave: 'cor', rotulo: 'Cor', tipo: 'cor' },
  { chave: 'nivelMin', rotulo: 'Nível mínimo para usar', tipo: 'numero' },
  { chave: 'custoPoder', rotulo: 'Custo de poder por uso', tipo: 'numero' },
  { chave: 'processos', rotulo: 'Processos que realiza', tipo: 'listaProcessos',
    opcoes: comDescricao(PROCESSOS_ESTACAO, ROTULOS_PROCESSO, DESCRICAO_PROCESSO),
    dica: 'Mantenha marcado cada processo que a máquina executa. É isto que decide quais receitas aparecem nesta estação.' },
  { chave: 'classesPermitidas', rotulo: 'Classes que podem usar', tipo: 'multiselec', opcoes: [],
    fonte: 'classes', vazioSignifica: 'Todas as classes',
    dica: 'Deixe tudo desmarcado para liberar para qualquer vocação.' },
  { chave: 'slots', rotulo: 'Slots de receita simultânea', tipo: 'numero',
    dica: 'Quantas receitas a máquina pode processar ao mesmo tempo.' },
  { chave: 'consumoEnergia', rotulo: 'Consumo de energia por uso', tipo: 'numero' },
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
// BIOMAS
// =====================================================================

export const CAMPOS_BIOMA = [
  { chave: 'nome', rotulo: 'Nome do bioma', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area',
    dica: 'Aparece na wiki do jogador ao entrar neste bioma.' },
  { chave: 'imagem', rotulo: 'Imagem', tipo: 'imagem', pastaUpload: 'biomas' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: comRotulo(TIPOS_BIOMA) },
  { chave: 'cor', rotulo: 'Cor', tipo: 'cor' },

  // ---- Geração ----
  { chave: 'peso', rotulo: 'Peso na geração', tipo: 'numero',
    dica: 'Probabilidade relativa de este bioma aparecer num mundo. Maior = mais comum.' },
  { chave: 'minX', rotulo: 'Área mínima X', tipo: 'numero' },
  { chave: 'minY', rotulo: 'Área mínima Y', tipo: 'numero' },
  { chave: 'dificuldade', rotulo: 'Dificuldade base (1-5)', tipo: 'numero' },
  { chave: 'temperatura', rotulo: 'Temperatura', tipo: 'numero',
    dica: 'Afeta crescimento de plantações e desgaste de equipamento.' },

  // ---- Blocos ----
  { chave: 'blocosNativos', rotulo: 'Blocos nativos', tipo: 'multiselec', opcoes: [],
    fonte: 'blocos', dica: 'Blocos gerados naturalmente neste bioma.' },
  { chave: 'chaveBloco', rotulo: 'Bloco de superfície', tipo: 'select', opcoes: [],
    fonte: 'blocos', dica: 'O bloco que fica no topo do terreno.' },
  { chave: 'chaveSubSolo', rotulo: 'Bloco de subsolo', tipo: 'select', opcoes: [],
    fonte: 'blocos', dica: 'O bloco que fica logo abaixo da superfície.' },

  // ---- Mobs ----
  { chave: 'mobsNativos', rotulo: 'Mobs nativas', tipo: 'multiselec', opcoes: [],
    fonte: 'monstros', dica: 'Criaturas que aparecem aqui por padrão.' },
  { chave: 'densidadeMobs', rotulo: 'Densidade de mobs', tipo: 'numero',
    dica: 'Spawns por área. 0 = bioma sem spawn natural.' },
  { chave: 'npcsNativos', rotulo: 'NPCs nativos deste bioma', tipo: 'multiselec', opcoes: [],
    fonte: 'npcs', dica: 'NPCs considerados habitantes deste bioma.' },
];

// =====================================================================
// NPCs DO MUNDO
// =====================================================================

export const CAMPOS_NPC = [
  { chave: 'nome', rotulo: 'Nome do NPC', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area',
    dica: 'O que este NPC é no Império. O jogador lê isto ao interagir.' },
  { chave: 'imagem', rotulo: 'Retrato', tipo: 'imagem', pastaUpload: 'npcs', pixelArt: true,
    dica: 'Envie um arquivo pronto ou desenhe aqui. O editor é 32×32, do tamanho exato de um bloco do mundo.' },
  { chave: 'cor', rotulo: 'Cor', tipo: 'cor' },

  // ---- Onde ele vive ----
  { chave: 'mundoId', rotulo: 'Mundo', tipo: 'select', opcoes: [], fonte: 'reinos',
    dica: 'O NPC é nativo deste mundo.' },
  { chave: 'biomaId', rotulo: 'Bioma', tipo: 'select', opcoes: [], fonte: 'biomas',
    dica: 'Bioma onde ele fica. Deixe vazio para Anywhere no mundo.' },
  { chave: 'posX', rotulo: 'Posição X (bloco)', tipo: 'numero',
    dica: 'Definida no mapa quadriculado ao lado. Este campo espelha aquele valor.' },
  { chave: 'posY', rotulo: 'Posição Y (bloco)', tipo: 'numero',
    dica: 'Definida no mapa quadriculado ao lado.' },

  // ---- Comportamento ----
  { chave: 'movimento', rotulo: 'Padrão de movimento', tipo: 'select',
    opcoes: [
      { valor: 'parado', rotulo: 'Parado — nunca sai do ponto' },
      { valor: 'suave', rotulo: 'Suave — 3 blocos e volta ao ponto' },
      { valor: 'medio', rotulo: 'Médio — 7 blocos, 3 andadas, depois volta' },
      { valor: 'alto', rotulo: 'Alto — 12 blocos, 5 andadas, depois volta' },
    ],
    dica: 'Define o raio e quantas andadas o NPC dá antes de retornar ao ponto fixo.' },

  // ---- Tipos (checkbox) ----
  { chave: 'tipos', rotulo: 'Funções deste NPC', tipo: 'multiselec',
    opcoes: [
      { valor: 'dialogo', rotulo: 'Tem diálogo', descricao: 'Fala com o jogador ao interagir.' },
      { valor: 'missao', rotulo: 'Tem missão', descricao: 'Entrega e recebe quests.' },
      { valor: 'loja', rotulo: 'Tem loja', descricao: 'Vende itens ao jogador.' },
      { valor: 'movimenta', rotulo: 'Se movimenta', descricao: 'Anda pelo mapa conforme o padrão acima.' },
      { valor: 'sempre_aparente', rotulo: 'Sempre aparente', descricao: 'Nunca some do mapa, nem em áreas remotas.' },
    ],
    dica: 'Marque uma ou várias. NPC de história pode ter diálogo e loja ao mesmo tempo.' },

  // ---- Aparência ----
  { chave: 'classeId', rotulo: 'Classe (aparência)', tipo: 'select', opcoes: [], fonte: 'classes',
    dica: 'Define o visual do NPC no mapa.' },
  { chave: 'tamanho', rotulo: 'Escala do NPC', tipo: 'numero',
    dica: '1 = tamanho normal.' },

  // ---- Inviolável (sempre ligado, por desenho) ----
  { chave: 'inviolavel', rotulo: 'Inviolável', tipo: 'fixo', valorFixo: true,
    dica: 'NPCs não tomam dano e não podem ser mortos. Regra fixa do jogo.' },

  // ---- Diálogo ----
  { chave: 'dialogo', rotulo: 'Diálogo padrão', tipo: 'area',
    placeholder: 'Bom dia, viajante. Precisa de mantimentos?' },

  // ---- Missões ----
  { chave: 'missoes', rotulo: 'Missões que oferece', tipo: 'area',
    placeholder: 'mata_20_slime:1,minere_ferro:1',
    dica: 'missaoId:repetições. Vazio = este NPC não dá missões.' },

  // ---- Loja ----
  { chave: 'loja', rotulo: 'Itens da loja', tipo: 'area',
    placeholder: 'espada_ferro:1:500,pocao_vida:5:120',
    dica: 'itemId:quantidade:preço em ouro. Vazio = este NPC não vende nada.' },
  { chave: 'lojaMoeda', rotulo: 'Moeda da loja', tipo: 'select',
    opcoes: [
      { valor: 'ouro', rotulo: 'Ouro' },
      { valor: 'npc', rotulo: 'Moeda própria do NPC' },
      { valor: 'item', rotulo: 'Troca por itens' },
    ] },
  { chave: 'lojaDesconto', rotulo: 'Desconto da loja (%)', tipo: 'numero' },
];

// =====================================================================
// SERVIDORES
// =====================================================================

export const CAMPOS_SERVIDOR = [
  { chave: 'nome', rotulo: 'Nome do servidor', tipo: 'texto', obrigatorio: true },
  { chave: 'descricao', rotulo: 'Descrição', tipo: 'area' },
  { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: comRotulo(TIPOS_SERVIDOR),
    dica: 'Sobrevivência = sem trapaça · Criativo = recursos infinitos · PvP = combate entre jogadores · Coop = cooperative · Hardcore = morte permanente · RPG = regras de RPG.' },
  { chave: 'regiao', rotulo: 'Região', tipo: 'texto',
    placeholder: 'Brasil', dica: 'Usado para agrupar servidores na lista do jogador.' },
  { chave: 'maxJogadores', rotulo: 'Máximo de jogadores', tipo: 'numero' },
  { chave: 'status', rotulo: 'Status', tipo: 'select',
    opcoes: [
      { valor: 'aberto', rotulo: 'Aberto' },
      { valor: 'fechado', rotulo: 'Fechado' },
      { valor: 'manutencao', rotulo: 'Em manutenção' },
    ] },

  // Tudo abaixo é seleção de conteúdo. Vazio = o servidor NÃO oferece aquilo,
  // porque a diferença entre "não configurado" e "proibido" importa quando o
  // servidor serve a partidas competitivas com regras distintas.
  { chave: 'classesPermitidas', rotulo: 'Classes liberadas', tipo: 'multiselec', opcoes: [],
    fonte: 'classes', dica: 'Classes que podem ser escolhidas ao entrar neste servidor.' },
  { chave: 'mundosPermitidos', rotulo: 'Mundos liberados', tipo: 'multiselec', opcoes: [],
    fonte: 'reinos', dica: 'Mundos que podem ser visitados neste servidor.' },
  { chave: 'estacoesPermitidas', rotulo: 'Estações liberadas', tipo: 'multiselec', opcoes: [],
    fonte: 'estacoes', dica: 'Máquinas disponíveis para construção neste servidor.' },
  { chave: 'biomasPermitidos', rotulo: 'Biomas liberados', tipo: 'multiselec', opcoes: [],
    fonte: 'biomas', dica: 'Biomas que podem aparecer nos mundos deste servidor.' },
  { chave: 'npcsPermitidos', rotulo: 'NPCs liberados', tipo: 'multiselec', opcoes: [],
    fonte: 'npcs', dica: 'NPCs ativos neste servidor.' },
  { chave: 'itensPermitidos', rotulo: 'Itens liberados', tipo: 'multiselec', opcoes: [],
    fonte: 'blocos', dica: 'Itens e blocos que podem ser obtidos aqui.' },
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
  biomas: (d) => `${d.tipo ?? '—'} · ${(d.blocosNativos ?? []).length} blocos · ${(d.mobsNativos ?? []).length} mobs`,
  npcs: (d) => `${(d.tipos ?? []).join(', ') || '—'} · movimento ${d.movimento ?? 'suave'}`,
  servidores: (d) => `${d.tipo ?? '—'} · máx ${d.maxJogadores ?? 20} jogadores`,
};