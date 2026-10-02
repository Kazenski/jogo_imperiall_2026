// Persistencia da progressao do jogador — **MULTI-PERSONAGEM (até 10)**.
//
// Duas fontes, mesma interface:
//  - Firebase Firestore (quando logado com Google): sincroniza entre dispositivos.
//  - localStorage (sem login ou sem Firebase configurado).
//
// Estrutura do documento `jogadores/{uid}` (perfil do jogador):
// {
//   uid, nome, email, foto,
//   personagens: [
//     { id, nome, racaId, vocacaoId, nivel, xp, ouro, pontosTalento, pontosAtributo,
//       pontosAtributoExtras, atributos, vida, vidaMax, poder, poderMax,
//       inventario, arvoreDesbloqueada, conquistasDesbloqueada, orbes,
//       imagensPortais, base, stats, posicao,
//       criadoEm, atualizadoEm }
//   ],
//   personagemAtivoId: string | null,
//   nome, email, foto, criadoEm, atualizadoEm, ultimoLogin
// }
//
// localStorage espelha: `jogador_{uid}` = { personagens: [...], ativoId: ... }

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  NOME_COLECAO_JOGADORES,
  NOME_COLECAO_PORTAIS,
  CHAVE_PROGRESSO_LOCAL,
} from '../config.js';
import { pegarDb, firebaseDisponivel } from './firebase.js';
import { estadoInicial } from './personagem.js';

const MAX_PERSONAGENS = 10;
const CHAVE_LOBBY_LOCAL = 'imperiall_lobby';

/** Estado inicial de UM personagem (sem uid/nome globais). */
export function estadoInicialPersonagem() {
  return {
    ...estadoInicial(),
    id: null,
    nome: 'Viajante',
    racaId: 'humano',
    vocacaoId: null,
    criadoEm: null,
    atualizadoEm: null,
  };
}

/** Curva de dificuldade: nivel 1->2 custa 100, e vai crescendo. */
export function xpParaProximoNivel(nivel = 1) {
  return Math.floor(100 * Math.pow(Math.max(1, nivel), 1.35));
}

export function calcularNivel(xpTotal) {
  let nivel = 1;
  let restante = Math.max(0, xpTotal);
  while (restante >= xpParaProximoNivel(nivel)) {
    restante -= xpParaProximoNivel(nivel);
    nivel += 1;
  }
  return { nivel, xpNoNivel: restante, faltam: xpParaProximoNivel(nivel) - restante };
}

export function xpTotalParaNivel(nivel) {
  let total = 0;
  for (let n = 1; n < nivel; n += 1) total += xpParaProximoNivel(n);
  return total;
}

/** Perfil inicial do jogador (conta Google). */
/** Remove campos undefined (Firestore não aceita). */
function sanitizarParaFirestore(obj) {
  const limpo = {};
  for (const [k, v] of Object.entries(obj)) {
    limpo[k] = v === undefined ? null : v;
  }
  return limpo;
}

/** Perfil inicial do jogador (conta Google). */
function perfilInicial(uid, userInfo) {
  return {
    uid,
    nome: userInfo?.displayName ?? 'Viajante',
    email: userInfo?.email ?? null,
    foto: userInfo?.photoURL ?? null,
    personagens: [],
    personagemAtivoId: null,
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
    ultimoLogin: Date.now(),
  };
}

/** Gera ID único de personagem. */
function novoPersonagemId() {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Lê o lobby do localStorage. */
function lerLobbyLocal(uid) {
  try {
    const raw = localStorage.getItem(CHAVE_LOBBY_LOCAL + (uid ? `_${uid}` : ''));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Grava o lobby no localStorage. */
function gravarLobbyLocal(uid, lobby) {
  try {
    localStorage.setItem(CHAVE_LOBBY_LOCAL + (uid ? `_${uid}` : ''), JSON.stringify(lobby));
  } catch {
    /* quota excedida, ignora */
  }
}

/** Lê perfil do jogador do Firestore. */
async function lerPerfilFirestore(uid) {
  const db = pegarDb();
  if (!db) return null;
  const snap = await getDoc(doc(pegarDb(), NOME_COLECAO_JOGADORES, uid));
  return snap.exists() ? snap.data() : null;
}

/** Lê perfil do localStorage. */
function lerPerfilLocal(uid) {
  try {
    const raw = localStorage.getItem(NOME_COLECAO_JOGADORES + (uid ? `_${uid}` : ''));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Grava perfil no localStorage. */
function gravarPerfilLocal(perfil) {
  try {
    localStorage.setItem(NOME_COLECAO_JOGADORES + (perfil.uid ? `_${perfil.uid}` : ''), JSON.stringify(perfil));
  } catch {
    /* quota excedida */
  }
}

/** Converte perfil antigo (single-character) para novo formato multi-char. */
function migrarPerfilAntigo(perfil) {
  if (perfil.personagens) return perfil; // ja migrado

  const estadoAntigo = {
    id: `char_${perfil.criadoEm ?? Date.now()}_legacy`,
    nome: perfil.nome ?? 'Viajante',
    racaId: 'humano',
    vocacaoId: perfil.vocacaoId ?? null,
    nivel: perfil.nivel ?? 1,
    xp: perfil.xp ?? 0,
    ouro: perfil.ouro ?? 0,
    pontosTalento: perfil.pontosTalento ?? 0,
    pontosAtributo: perfil.pontosAtributo ?? 0,
    pontosAtributoExtras: perfil.pontosAtributoExtras ?? 0,
    atributos: perfil.atributos ?? { fis: 0, men: 0, soc: 0 },
    vida: perfil.vida ?? 100,
    vidaMax: perfil.vidaMax ?? 100,
    poder: perfil.poder ?? 100,
    poderMax: perfil.poderMax ?? 100,
    inventario: perfil.inventario ?? { itens: [], equipado: {}, proximoUid: 1 },
    arvoreDesbloqueada: perfil.arvoreDesbloqueada ?? [],
    conquistasDesbloqueadas: perfil.conquistasDesbloqueadas ?? [],
    orbes: perfil.orbes ?? {},
    imagensPortais: perfil.imagensPortais ?? {},
    base: perfil.base ?? {
      nome: 'Acampamento Imperial',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
      blocos: {},
    },
    stats: perfil.stats ?? {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      blocosColocados: 0,
      blocosColetados: 0,
      itensColetados: 0,
      itensCriados: 0,
      diasSobrevividos: 0,
      portaisConstruidos: 0,
    },
    posicao: perfil.posicao ?? { x: 0, y: 0 },
    criadoEm: perfil.criadoEm ?? Date.now(),
    atualizadoEm: perfil.atualizadoEm ?? Date.now(),
  };

  return {
    uid: perfil.uid,
    nome: perfil.nome,
    email: perfil.email,
    foto: perfil.foto,
    personagens: [estadoAntigo],
    personagemAtivoId: estadoAntigo.id,
    criadoEm: perfil.criadoEm ?? Date.now(),
    atualizadoEm: Date.now(),
    ultimoLogin: Date.now(),
  };
}

/** =====================================================================
 *  API PUBLICA — Lobby / Multi-personagem
 * ===================================================================== */

/** Carrega o perfil do jogador (lista de personagens). */
export async function carregarPerfilJogador(uid, userInfo = null) {
  if (!uid || !firebaseDisponivel()) {
    const local = lerPerfilLocal(uid);
    return local ?? perfilInicial(uid, userInfo);
  }

  const SEM_RESPOSTA = Symbol('sem-resposta');
  try {
    const dados = await Promise.race([
      lerPerfilFirestore(uid),
      new Promise((r) => setTimeout(() => r(Symbol('sem-resposta')), 4000)),
    ]);

    let perfil = dados === Symbol('sem-resposta') ? null : dados;

    if (!perfil) {
      // Primeiro login — cria perfil vazio
      const novo = perfilInicial(uid, { displayName: 'Viajante', email: null, photoURL: null });
      await setDoc(doc(pegarDb(), NOME_COLECAO_JOGADORES, uid), sanitizarParaFirestore({
        ...novo,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      }));
      gravarPerfilLocal(novo);
      return novo;
    }

    // Migra perfil antigo se necessário
    if (!perfil.personagens) {
      perfil = migrarPerfilAntigo(perfil);
    }

    // Atualiza ultimoLogin
    perfil.ultimoLogin = Date.now();
    perfil.atualizadoEm = Date.now();

    gravarPerfilLocal(perfil);
    return perfil;
  } catch (erro) {
    console.warn('[progresso] leitura perfil falhou, usando local:', erro);
    const local = lerPerfilLocal(uid);
    return local ?? perfilInicial(uid, userInfo);
  }
}

/** Cria um novo personagem no perfil do jogador. */
export async function criarPersonagem(uid, dadosNovo) {
  const perfil = await carregarPerfilJogador(uid);
  if (perfil.personagens.length >= MAX_PERSONAGENS) {
    throw new Error(`Limite de ${MAX_PERSONAGENS} personagens atingido.`);
  }

  const id = novoPersonagemId();
  const agora = Date.now();
  const novoChar = {
    id,
    nome: dadosNovo.nome ?? 'Viajante',
    racaId: dadosNovo.racaId ?? 'humano',
    vocacaoId: dadosNovo.vocacaoId ?? null,
    nivel: 1,
    xp: 0,
    ouro: 0,
    pontosTalento: 0,
    pontosAtributo: 0,
    pontosAtributoExtras: 0,
    atributos: { fis: 0, men: 0, soc: 0 },
    vida: 100,
    vidaMax: 100,
    poder: 100,
    poderMax: 100,
    inventario: { itens: [], equipado: {}, proximoUid: 1 },
    arvoreDesbloqueada: [],
    conquistasDesbloqueadas: [],
    orbes: {},
    imagensPortais: {},
    base: {
      nome: 'Acampamento Imperial',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
      blocos: {},
    },
    stats: {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      blocosColocados: 0,
      blocosColetados: 0,
      itensColetados: 0,
      itensCriados: 0,
      diasSobrevividos: 0,
      portaisConstruidos: 0,
    },
    posicao: { x: 0, y: 0 },
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  };

  perfil.personagens.push(novoChar);
  perfil.personagemAtivoId = id;
  perfil.atualizadoEm = Date.now();

  await salvarPerfil(uid, perfil);
  return novoChar;
}

/** Carrega o estado COMPLETO de um personagem específico. */
export async function carregarPersonagem(uid, personagemId) {
  const perfil = await carregarPerfilJogador(uid);
  const char = perfil.personagens?.find((p) => p.id === personagemId);
  if (!char) return null;

  // Garante campos novos (migração suave)
  return {
    ...estadoInicialPersonagem(),
    ...char,
    // Garante arrays/objetos
    inventario: char.inventario ?? { itens: [], equipado: {}, proximoUid: 1 },
    arvoreDesbloqueada: char.arvoreDesbloqueada ?? [],
    conquistasDesbloqueadas: char.conquistasDesbloqueadas ?? [],
    orbes: char.orbes ?? {},
    imagensPortais: char.imagensPortais ?? {},
    base: char.base ?? {
      nome: 'Acampamento Imperial',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
      blocos: {},
    },
    stats: char.stats ?? {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      blocosColocados: 0,
      blocosColetados: 0,
      itensColetados: 0,
      itensCriados: 0,
      diasSobrevividos: 0,
      portaisConstruidos: 0,
    },
    posicao: char.posicao ?? { x: 0, y: 0 },
  };
}

/** Salva o estado de UM personagem no perfil do jogador. */
export async function salvarPersonagem(uid, personagemId, estado) {
  const perfil = await carregarPerfilJogador(uid);
  const idx = perfil.personagens?.findIndex((p) => p.id === personagemId);
  if (idx === undefined || idx < 0) {
    throw new Error('Personagem não encontrado.');
  }

  perfil.personagens[idx] = {
    ...perfil.personagens[idx],
    ...estado,
    id: personagemId, // garante id imutavel
    atualizadoEm: Date.now(),
  };
  perfil.atualizadoEm = Date.now();

  await salvarPerfil(uid, perfil);
  return perfil.personagens[idx];
}

/** Apaga um personagem (com confirmacao no caller). */
export async function apagarPersonagem(uid, personagemId) {
  const perfil = await carregarPerfilJogador(uid);
  perfil.personagens = perfil.personagens?.filter((p) => p.id !== personagemId) ?? [];
  if (perfil.personagemAtivoId === personagemId) {
    perfil.personagemAtivoId = perfil.personagens[0]?.id ?? null;
  }
  perfil.atualizadoEm = Date.now();
  await salvarPerfil(uid, perfil);
}

/** Define qual personagem está ativo (selecionado no lobby). */
export async function definirPersonagemAtivo(uid, personagemId) {
  const perfil = await carregarPerfilJogador(uid);
  if (!perfil.personagens?.some((p) => p.id === personagemId)) {
    throw new Error('Personagem não existe.');
  }
  perfil.personagemAtivoId = personagemId;
  perfil.atualizadoEm = Date.now();
  await salvarPerfil(uid, perfil);
}

/** Salva o perfil completo no Firestore + localStorage. */
async function salvarPerfil(uid, perfil) {
  gravarPerfilLocal(perfil);
  // Só escreve no Firestore se tiver uid válido (não local mode)
  if (firebaseDisponivel() && uid) {
    try {
      await setDoc(
        doc(pegarDb(), NOME_COLECAO_JOGADORES, uid),
        sanitizarParaFirestore({ ...perfil, atualizadoEm: serverTimestamp() }),
        { merge: true },
      );
    } catch (erro) {
      console.warn('[progresso] escrita perfil falhou, salvou so local:', erro);
    }
  }
}

// =====================================================================
// API LEGADA (compatibilidade com código existente)
// =====================================================================

/** @deprecated Use carregarPersonagem(uid, personagemAtivoId) */
export async function carregarProgresso(uid = null) {
  if (!uid) return estadoInicialPersonagem();
  const perfil = await carregarPerfilJogador(uid);
  const ativoId = perfil.personagemAtivoId ?? perfil.personagens?.[0]?.id;
  if (!ativoId) return estadoInicialPersonagem();
  return carregarPersonagem(uid, ativoId);
}

/** @deprecated Use salvarPersonagem(uid, personagemAtivoId, dados) */
export async function salvarProgresso(uid, dados) {
  const perfil = await carregarPerfilJogador(uid);
  const ativoId = perfil.personagemAtivoId ?? perfil.personagens?.[0]?.id;
  if (!ativoId) {
    // Fallback: cria personagem se nao existir
    return criarPersonagem(uid, { nome: dados.nome ?? 'Viajante' });
  }
  return salvarPersonagem(uid, ativoId, dados);
}

/** Adiciona XP ao personagem ativo. */
export async function adicionarXp(uid, quantidade) {
  const perfil = await carregarPerfilJogador(uid);
  const ativoId = perfil.personagemAtivoId ?? perfil.personagens?.[0]?.id;
  if (!ativoId) return { dados: null, subiuDeNivel: 0, nivel: 1 };

  const char = perfil.personagens.find((p) => p.id === ativoId);
  if (!char) return { dados: null, subiuDeNivel: 0, nivel: 1 };

  const { calcularNivel, xpParaProximoNivel } = await import('./personagem.js');
  const xpTotal = (char.xp ?? 0) + Math.max(0, Math.floor(quantidade));
  const antes = calcularNivel(char.xp ?? 0);
  const depois = calcularNivel(xpTotal);

  await salvarPersonagem(uid, ativoId, { xp: xpTotal, nivel: depois.nivel });

  return { dados: { ...char, xp: xpTotal, nivel: depois.nivel }, subiuDeNivel: depois.nivel - antes.nivel, nivel: depois.nivel };
}

/** Marca base visivel para o personagem ativo. */
export async function definirBaseVisivel(uid, visivel) {
  const perfil = await carregarPerfilJogador(uid);
  const ativoId = perfil.personagemAtivoId ?? perfil.personagens?.[0]?.id;
  if (!ativoId) return;
  const char = perfil.personagens.find((p) => p.id === ativoId);
  if (!char) return;
  await salvarPersonagem(uid, ativoId, { base: { ...char.base, visivel } });

  // Espelha na colecao publica `portais`
  if (firebaseDisponivel() && uid) {
    try {
      await setDoc(
        doc(pegarDb(), NOME_COLECAO_PORTAIS, uid),
        sanitizarParaFirestore({
          uid,
          nomeBase: char.base?.nome ?? 'Acampamento Imperial',
          nivelBase: char.base?.nivel ?? 1,
          corBase: char.base?.cor ?? 0xd4af6a,
          visivel,
          nivelJogador: char.nivel ?? 1,
          nomeJogador: char.nome,
          atualizadoEm: serverTimestamp(),
        }),
        { merge: true },
      );
    } catch (erro) {
      console.warn('[progresso] nao foi possivel publicar o portal:', erro);
    }
  }
}

/** Lista portais publicos de outros jogadores. */
export async function listarPortais(meuUid, maximo = 30) {
  if (!firebaseDisponivel()) return [];
  try {
    const db = pegarDb();
    const q = query(
      collection(db, NOME_COLECAO_PORTAIS),
      where('visivel', '==', true),
      where('uid', '!=', meuUid ?? ''),
      limit(maximo),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (erro) {
    console.warn('[progresso] falha ao listar portais:', erro);
    return [];
  }
}

/** Lista admins do sistema. */
export async function listarAdmins() {
  if (!firebaseDisponivel()) return [];
  try {
    const db = pegarDb();
    const snap = await getDoc(doc(db, 'system', 'admins'));
    return snap.exists() ? (snap.data().uids ?? []) : [];
  } catch {
    return [];
  }
}

/** Promove/rebaixa admin. */
export async function definirAdminUid(uid, isAdmin) {
  if (!firebaseDisponivel()) return;
  try {
    if (!uid) return;
    const db = pegarDb();
    const adminsRef = doc(db, 'system', 'admins');
    const snap = await getDoc(adminsRef);
    const uids = snap.exists() ? (snap.data().uids ?? []) : [];
    const novos = isAdmin ? [...new Set([...uids, uid])] : uids.filter((u) => u !== uid);
    await setDoc(adminsRef, sanitizarParaFirestore({ uids: novos }), { merge: true });
  } catch (erro) {
    console.warn('[progresso] falha ao definir admin:', erro);
  }
}

/** Verifica se uid é admin. */
export async function ehAdmin(uid) {
  if (!uid) return false;
  const admins = await listarAdmins();
  return admins.includes(uid);
}

/** Garante que o perfil do usuário exista (criado no primeiro login). */
export async function garantirPerfil(user) {
  await carregarPerfilJogador(user.uid, user);
}