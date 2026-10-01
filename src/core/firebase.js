// Camada de autenticacao e acesso ao Firestore.
// Se o Firebase nao estiver configurado (.env.local ausente), tudo aqui
// vira no-op e o jogo usa apenas o armazenamento local.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, firebaseHabilitado } from '../config.js';

let auth = null;
let db = null;

if (firebaseHabilitado) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function firebaseDisponivel() {
  return firebaseHabilitado;
}

export function pegarAuth() {
  return auth;
}

export function pegarDb() {
  return db;
}

const provedorGoogle = new GoogleAuthProvider();
// Garante que a conta Google escolhida traga nome e avatar para a UI.
provedorGoogle.addScope('profile');
provedorGoogle.addScope('email');

/**
 * Abre o popup de login do Google.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function entrarComGoogle() {
  if (!auth) throw new Error('Firebase nao configurado.');
  const credencial = await signInWithPopup(auth, provedorGoogle);
  return credencial.user;
}

export async function sairDaConta() {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Observa mudancas de sessao.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} funcao para cancelar a observacao
 */
export function observarLogin(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function traduzirErro(error) {
  const codigo = error?.code ?? '';

  switch (codigo) {
    case 'auth/popup-closed-by-user':
      return 'Login cancelado.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou o popup. Libere popups para este site.';
    case 'auth/network-request-failed':
      return 'Falha de rede no login. Verifique sua conexao.';
    case 'auth/account-exists-with-different-credential':
      return 'Ja existe uma conta com esse e-mail usando outro metodo.';
    case 'auth/operation-not-allowed':
      return 'Ative o provedor Google em Firebase > Authentication > Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'Domínio nao autorizado. Adicione o dominio em Authentication > Settings.';
    default:
      return error?.message ?? 'Erro desconhecido no login.';
  }
}