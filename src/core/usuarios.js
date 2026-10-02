// Gerenciamento de perfil de usuario (users/{uid}) com role
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getFirestore,
} from 'firebase/firestore';
import { pegarDb, firebaseDisponivel } from './firebase.js';
import { ROLES } from './roles.js';

export function perfilInicial(user) {
  return {
    uid: user?.uid ?? null,
    nome: user?.displayName ?? 'Viajante',
    email: user?.email ?? null,
    foto: user?.photoURL ?? null,
    role: ROLES.JOGADOR,
    vocacaoId: null,
    nivel: 1,
    xp: 0,
    atributos: { fis: 5, men: 5, soc: 5 },
    vidaMax: 100,
    poderMax: 80,
    pontosTalento: 0,
    ouro: 0,
    base: {
      nome: 'Acampamento Imperial',
      nivel: 1,
      visivel: false,
      cor: 0xd4af6a,
    },
    stats: {
      portaisUsados: 0,
      inimigosDerrotados: 0,
      diasSobrevividos: 0,
      blocosColocados: 0,
      blocosColetados: 0,
    },
    conquistasDesbloqueadas: [],
    arvoreDesbloqueada: [],
    criadoEm: null,
    atualizadoEm: null,
  };
}

/**
 * Garante que o usuario exista em `users/{uid}`. Retorna o perfil.
 *
 * O nome distingue este do `garantirPerfil` de `core/progresso.js`, que grava
 * em `jogadores/{uid}`. Os dois fazem parte do login, mas mexem em coleções
 * diferentes — e importar o errado deixava `users` vazio, escondendo do
 * painel todos os jogadores que entraram antes da correção.
 */
export async function garantirPerfilUsuario(user) {
  if (!user?.uid || !firebaseDisponivel()) {
    return perfilInicial(user);
  }

  const db = pegarDb();
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const perfil = perfilInicial(user);
    await setDoc(ref, perfil, { merge: false });
    await setDoc(
      ref,
      { criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() },
      { merge: true },
    );
    return perfil;
  }

  const dados = snap.data();
  return { ...perfilInicial(user), ...dados, uid: user.uid };
}

/** Atualiza perfil parcialmente */
export async function atualizarPerfil(uid, dadosParciais) {
  if (!uid || !firebaseDisponivel()) return null;
  const db = pegarDb();
  const ref = doc(db, 'users', uid);
  await setDoc(ref, dadosParciais, { merge: true });
  await setDoc(ref, { atualizadoEm: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Verifica se uid eh admin (consulta system/admins) */
export async function ehAdmin(uid) {
  if (!uid || !firebaseDisponivel()) return false;
  try {
    const db = pegarDb();
    const ref = doc(db, 'system', 'admins');
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const uids = snap.data().uids || [];
    return Array.isArray(uids) && uids.includes(uid);
  } catch (err) {
    console.warn('[usuarios] erro ao checar admin:', err);
    return false;
  }
}

/** Promove/rebaixa usuario para admin. So admin pode chamar (protegido por Rules) */
export async function definirAdmin(targetUid, tornarAdmin) {
  if (!firebaseDisponivel()) return;
  const db = pegarDb();
  const ref = doc(db, 'system', 'admins');
  const snap = await getDoc(ref);
  const uids = snap.exists() ? snap.data().uids || [] : [];
  const set = new Set(uids);
  if (tornarAdmin) set.add(targetUid);
  else set.delete(targetUid);
  await setDoc(ref, { uids: Array.from(set) }, { merge: true });
}
