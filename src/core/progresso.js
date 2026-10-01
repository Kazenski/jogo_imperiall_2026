// Persistencia da progressao do jogador.
//
// Duas fontes, mesma interface:
//  - Firebase Firestore (quando logado com Google): sincroniza entre dispositivos.
//  - localStorage (sem login ou sem Firebase configurado).
//
// Documento privado: `jogadores/{uid}`.
// Documento publico (amigos/portais): `portais/{uid}`.

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

export function progressoInicial(uid = null) {
  const estado = estadoInicial();
  return {
    ...estado,
    uid,
    nome: 'Viajante',
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

/** XP total acumulado necessario para alcancar `nivel`. */
export function xpTotalParaNivel(nivel) {
  let total = 0;
  for (let n = 1; n < nivel; n += 1) total += xpParaProximoNivel(n);
  return total;
}

// ---------- normalizacao ----------

function mesrarObjeto(base, dados) {
  const saida = { ...base, ...(dados ?? {}) };
  saida.atributos = { ...base.atributos, ...(dados?.atributos ?? {}) };
  saida.stats = { ...base.stats, ...(dados?.stats ?? {}) };
  saida.base = { ...base.base, ...(dados?.base ?? {}) };
  saida.base.blocos = dados?.base?.blocos ?? {};
  saida.inventario = { ...base.inventario, ...(dados?.inventario ?? {}) };
  saida.inventario.itens ??= [];
  saida.inventario.proximoUid = Math.max(
    1,
    (dados?.inventario?.proximoUid ?? 1),
    ...saida.inventario.itens.map((p) => (p.uid ?? 0) + 1),
  );
  saida.inventario.equipado = { ...base.inventario.equipado, ...(dados?.inventario?.equipado ?? {}) };
  saida.arvoreDesbloqueada ??= [];
  saida.conquistasDesbloqueadas ??= [];
  saida.orbes ??= {};
  saida.imagensPortais ??= {};
  return saida;
}

// ---------- localStorage ----------

function lerLocal(uid) {
  try {
    const bruto = localStorage.getItem(CHAVE_PROGRESSO_LOCAL);
    if (!bruto) return progressoInicial(uid);
    const dados = JSON.parse(bruto);
    return mesrarObjeto(progressoInicial(uid), dados);
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

async function lerFirestore(uid) {
  const db = pegarDb();
  if (!db) return null;

  const snapshot = await getDoc(doc(db, NOME_COLECAO_JOGADORES, uid));
  if (!snapshot.exists()) return null;

  return mesrarObjeto(progressoInicial(uid), snapshot.data());
}

/**
 * Carrega a progressao do jogador. Sem uid, cai no armazenamento local.
 * Com uid, tenta Firestore e cai para o espelho local em caso de falha.
 */
export async function carregarProgresso(uid = null) {
  if (!uid || !firebaseDisponivel()) return lerLocal(uid);

  try {
    const dados = await lerFirestore(uid);
    if (!dados) {
      // Primeiro acesso: cria o documento.
      const novo = progressoInicial(uid);
      await setDoc(
        doc(pegarDb(), NOME_COLECAO_JOGADORES, uid),
        { ...novo, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() },
        { merge: true },
      );
      gravarLocal(novo);
      return novo;
    }
    // Mantem o espelho local atualizado para o caso do login cair.
    gravarLocal(dados);
    return dados;
  } catch (erro) {
    console.warn('[progresso] leitura no Firestore falhou, usando local:', erro);
    return lerLocal(uid);
  }
}

/**
 * Salva a progressao (merge). Com uid vai para o Firestore, sem uid vai para o local.
 * @param {string|null} uid
 * @param {object} dados
 */
export async function salvarProgresso(uid, dados) {
  const base = uid && firebaseDisponivel() ? await carregarProgresso(uid) : lerLocal(uid);
  const mesclado = mesrarObjeto(base, dados);
  mesclado.uid = uid ?? base.uid;
  mesclado.atualizadoEm = null;

  gravarLocal(mesclado);

  if (uid && firebaseDisponivel()) {
    try {
      await setDoc(
        doc(pegarDb(), NOME_COLECAO_JOGADORES, uid),
        { ...mesclado, atualizadoEm: serverTimestamp() },
        { merge: true },
      );
    } catch (erro) {
      console.warn('[progresso] escrita no Firestore falhou, salvou so local:', erro);
    }
  }

  return mesclado;
}

/**
 * Adiciona XP, subindo de nivel quantas vezes necessario.
 * @returns {Promise<{dados: object, subiuDeNivel: number, nivel: number}>}
 */
export async function adicionarXp(uid, quantidade) {
  const atual = await carregarProgresso(uid);
  const xpTotal = (atual.xp ?? 0) + Math.max(0, Math.floor(quantidade));
  const antes = calcularNivel(atual.xp ?? 0);
  const depois = calcularNivel(xpTotal);

  const dados = await salvarProgresso(uid, { xp: xpTotal, nivel: depois.nivel });
  return { dados, subiuDeNivel: depois.nivel - antes.nivel, nivel: depois.nivel };
}

// ---------- Bases / portais ----------

/**
 * Marca a base do jogador como visivel para os amigos encontrarem o portal.
 * Espelha na colecao publica `portais`, que e o que a lista de amigos consulta.
 */
export async function definirBaseVisivel(uid, visivel) {
  const atual = await carregarProgresso(uid);
  const dados = await salvarProgresso(uid, {
    base: { ...atual.base, visivel },
  });

  if (!uid || !firebaseDisponivel()) return dados;

  try {
    await setDoc(
      doc(pegarDb(), NOME_COLECAO_PORTAIS, uid),
      {
        uid,
        nome: dados.nome,
        nomeBase: dados.base?.nome ?? 'Acampamento',
        nivel: dados.nivel ?? 1,
        cor: dados.base?.cor ?? 0xd4af6a,
        ativo: Boolean(visivel),
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
 */
export async function listarPortais(meuUid, maximo = 30) {
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
          atualizadoEm: dados.atualizadoEm ?? null,
        };
      });
  } catch (erro) {
    console.warn('[progresso] nao foi possivel listar portais:', erro);
    return [];
  }
}
