// Persistencia da progressao do jogador.
//
// Duas fontes, mesma interface:
//  - Firebase Firestore (quando logado): sincroniza entre dispositivos.
//  - localStorage (sem login ou sem Firebase configurado).
//
// O documento do jogador fica em `jogadores/{uid}`.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
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

export function progressoInicial(uid = null) {
  return {
    uid,
    nome: 'Viajante',
    nivel: 1,
    xp: 0,
    ouro: 0,
    base: {
      nome: 'Acampamento sem nome',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
    },
    stats: {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      diasSobrevividos: 0,
    },
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
  let restante = xpTotal;
  while (restante >= xpParaProximoNivel(nivel)) {
    restante -= xpParaProximoNivel(nivel);
    nivel += 1;
  }
  return { nivel, xpNoNivel: restante, faltam: xpParaProximoNivel(nivel) - restante };
}

// ---------- localStorage ----------

function lerLocal(uid) {
  try {
    const bruto = localStorage.getItem(CHAVE_PROGRESSO_LOCAL);
    if (!bruto) return progressoInicial(uid);
    return { ...progressoInicial(uid), ...JSON.parse(bruto) };
  } catch {
    return progressoInicial(uid);
  }
}

function gravarLocal(dados) {
  try {
    localStorage.setItem(CHAVE_PROGRESSO_LOCAL, JSON.stringify(dados));
  } catch (erro) {
    console.warn('[progresso] falha ao gravar localmente:', erro);
  }
}

// ---------- Firestore ----------

function semDados(valor) {
  return !valor || !Object.keys(valor).length;
}

async function lerFirestore(uid) {
  const db = pegarDb();
  if (!db) return null;

  const snapshot = await getDoc(doc(db, NOME_COLECAO_JOGADORES, uid));
  if (!snapshot.exists()) return progressoInicial(uid);

  return { ...progressoInicial(uid), ...snapshot.data(), uid };
}

/**
 * Carrega a progressao do jogador. Sem uid, cai no armazenamento local.
 * @param {string | null} uid
 */
export async function carregarProgresso(uid = null) {
  if (!uid || !firebaseDisponivel()) return lerLocal(uid);

  try {
    const dados = await lerFirestore(uid);
    // Mantem o espelho local atualizado para o caso do login cair.
    gravarLocal(dados);
    return dados;
  } catch (erro) {
    console.warn('[progresso] leitura no Firestore falhou, usando local:', erro);
    return lerLocal(uid);
  }
}

/**
 * Salva a progressao (merge). Com uid vai pro Firestore, sem uid vai pro local.
 * @param {string | null} uid
 * @param {Partial<ReturnType<typeof progressoInicial>>} dados
 */
export async function salvarProgresso(uid, dados) {
  const base = uid && firebaseDisponivel() ? await carregarProgresso(uid) : lerLocal(uid);
  const mesclado = { ...base, ...dados, uid: uid ?? base.uid, atualizadoEm: null };

  gravarLocal(mesclado);

  if (uid && firebaseDisponivel()) {
    try {
      await setDoc(doc(pegarDb(), NOME_COLECAO_JOGADORES, uid), mesclado, { merge: true });
      await updateDoc(doc(pegarDb(), NOME_COLECAO_JOGADORES, uid), {
        atualizadoEm: serverTimestamp(),
      });
    } catch (erro) {
      console.warn('[progresso] escrita no Firestore falhou, salvou so local:', erro);
    }
  }

  return mesclado;
}

/**
 * Adiciona XP, subindo de nivel quantas vezes necessario.
 * @returns {Promise<{dados: object, subiuDeNivel: number}>}
 */
export async function adicionarXp(uid, quantidade) {
  const atual = await carregarProgresso(uid);
  const xpTotal = (atual.xp ?? 0) + Math.max(0, Math.floor(quantidade));
  const antes = calcularNivel(atual.xp ?? 0);
  const depois = calcularNivel(xpTotal);

  const dados = await salvarProgresso(uid, { xp: xpTotal });
  return { dados, subiuDeNivel: depois.nivel - antes.nivel };
}

// ---------- Bases / portais ----------

/**
 * Marca a base do jogador como visivel para os amigos encontrarem o portal.
 * Espelha na colecao publica `portais`, que e o que a lista de amigos consulta.
 * @param {string} uid
 * @param {boolean} visivel
 */
export async function definirBaseVisivel(uid, visivel) {
  const atual = await carregarProgresso(uid);
  const dados = await salvarProgresso(uid, {
    base: { ...atual.base, visivel },
  });

  if (!uid || !firebaseDisponivel()) return dados;

  try {
    await setDoc(
      doc(pegerDb(), NOME_COLECAO_PORTAIS, uid),
      {
        uid,
        nome: dados.nome,
        nomeBase: dados.base?.nome ?? 'Acampamento',
        nivel: dados.nivel ?? 1,
        cor: dados.base?.cor ?? 0xd4af6a,
        ativo: visivel,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (erro) {
    console.warn('[progresso] nao foi possivel publicar o portal:', erro);
  }

  return dados;
}

/**
 * Lista os portais disponiveis (bases de outros jogadores publicadas).
 * @param {string} meuUid
 * @param {number} maximo
 */
export async function listarPortais(meuUid, maximo = 20) {
  if (!meuUid || !firebaseDisponivel()) return [];

  try {
    const db = pegarDb();
    const consulta = query(
      collection(db, NOME_COLECAO_PORTAIS),
      where('ativo', '==', true),
      limit(maximo),
    );

    const snapshot = await getDocs(consulta);
    return snapshot.docs
      .filter((d) => d.id !== meuUid)
      .map((d) => {
        const dados = d.data();
        return {
          uid: d.id,
          nome: dados.nome ?? 'Viajante',
          nomeBase: dados.nomeBase ?? 'Acampamento',
          nivel: dados.nivel ?? 1,
          cor: dados.cor ?? 0xd4af6a,
        };
      });
  } catch (erro) {
    console.warn('[progresso] nao foi possivel listar portais:', erro);
    return [];
  }
}