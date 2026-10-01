export const TIPOS_ITEM = {
  BLOCO: 'bloco',
  RECURSO: 'recurso',
  FERRAMENTA: 'ferramenta',
  EQUIPAVEL: 'equipavel',
  MAQUINA: 'maquina',
  ORBE: 'orbe',
  CONSUMIVEL: 'consumivel',
  ESTRUTURA: 'estrutura',
  COMPONENTE: 'componente',
};

export const USOS_ITEM = {
  EXTRACAO: 'extracao',
  TRANSFORMACAO: 'transformacao',
  UTILIZACAO: 'utilizacao',
  ESTRUTURA: 'estrutura',
  EQUIPAVEL: 'equipavel',
  MAQUINA: 'maquina',
};

export const RARIDADES = {
  COMUM: 'comum',
  INCOMUM: 'incomum',
  RARO: 'raro',
  EPICO: 'epico',
  LENDARIO: 'lendario',
};

export const ESTAÇÕES = {
  BANCO_TRABALHO: 'banco_trabalho',
  FORJA: 'forja',
  ALQUIMIA: 'alquimia',
  TORNO: 'torno',
  PRENSA_ARCANA: 'prensa_arcana',
  OFICINA: 'oficina',
};

export const TIPOS_ORBE = {
  ORBE_ARCANO_MENOR: 'orbe_arcano_menor',
  ORBE_ARCANO_MEDIO: 'orbe_arcano_medio',
  ORBE_ARCANO_SUPERIOR: 'orbe_arcano_superior',
  ORBE_ARCANO_EPICO: 'orbe_arcano_epico',
  ORBE_ARCANO_LENDARIO: 'orbe_arcano_lendario',
};

export const FAIXAS_NIVEL_ORBE = {
  [TIPOS_ORBE.ORBE_ARCANO_MENOR]: { min: 1, max: 10 },
  [TIPOS_ORBE.ORBE_ARCANO_MEDIO]: { min: 11, max: 25 },
  [TIPOS_ORBE.ORBE_ARCANO_SUPERIOR]: { min: 26, max: 40 },
  [TIPOS_ORBE.ORBE_ARCANO_EPICO]: { min: 41, max: 60 },
  [TIPOS_ORBE.ORBE_ARCANO_LENDARIO]: { min: 61, max: 999 },
};

export const TIPOS_HABILIDADE = {
  PASSIVA: 'passiva',
  ATIVA: 'ativa',
  MENTAL: 'mental',
  SOCIAL: 'social',
};

export const COMPORTAMENTOS_MONSTRO = {
  PASSIVO: 'passivo',
  AGRESSIVO: 'agressivo',
  TERRITORIAL: 'territorial',
  ERRANTE: 'errante',
};

export const TIPOS_ACHIEVEMENT = {
  EXPLORACAO: 'exploracao',
  CONSTRUCAO: 'construcao',
  PROGRESSO: 'progresso',
  COLETA: 'coleta',
  COMBATE: 'combate',
  SOCIAL: 'social',
  ASCENSAO: 'ascensao',
};
