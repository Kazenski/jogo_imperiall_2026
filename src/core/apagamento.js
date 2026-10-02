// Exclusão de dados do jogador.
//
// Botão "Apagar meu progresso" (aba Personagem, tecla V). É a exigência mais
// concreta da LGPD que o jogador pode exercitar sozinho: o direito de
// eliminação (art. 18, VI) precisa ter um caminho de UM clique, e não um e-mail
// para o suporte.
//
// A ordem importa. `jogadores/{uid}` é o documento com mais volume (blocos da
// base uno por uno) e apaga por último, para que uma falha no meio não deixe
// o jogador com o portal publicado apontando para uma base apagada.

import { doc, deleteDoc, getDoc, getDocs, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { NOME_COLECAO_JOGADORES, NOME_COLECAO_PORTAIS, CHAVE_PROGRESSO_LOCAL } from '../config.js';
import { pegarDb, firebaseDisponivel } from './firebase.js';

/**
 * Apaga tudo que pertence a um uid.
 *
 * @param {string} uid
 * @returns {Promise<{ok: boolean, apagados: string[], erro?: string}>}
 */
export async function apagarDadosDoJogador(uid) {
  if (!uid) {
    return { ok: false, apagados: [], erro: 'Sem sessão ativa.' };
  }
  if (!firebaseDisponivel()) {
    limparLocal();
    return { ok: true, apagados: ['localStorage'] };
  }

  const db = pegarDb();
  const apagados = [];
  const erros = [];

  // 1. Portal público primeiro: é o menor e é o que os outros jogadores veem.
  try {
    await deleteDoc(doc(db, NOME_COLECAO_PORTAIS, uid));
    apagados.push('portal');
  } catch (erro) {
    // Documento pode não existir; isso não é falha de verdade.
    console.warn('[apagar] portal:', erro?.message ?? erro);
  }

  // 2. Progresso privado
  try {
    await deleteDoc(doc(db, NOME_COLECAO_JOGADORES, uid));
    apagados.push('progresso');
  } catch (erro) {
    erros.push(`progresso: ${erro?.message ?? erro}`);
  }

  // 3. Perfil (mantém o login funcionando, sem histórico de jogo)
  try {
    await deleteDoc(doc(db, 'users', uid));
    apagados.push('perfil');
  } catch (erro) {
    erros.push(`perfil: ${erro?.message ?? erro}`);
  }

  // 4. Coleções derivadas que possam existir por versões anteriores.
  for (const colecao of ['bases', 'amigos', 'logs']) {
    try {
      const snap = await getDocs(collection(db, colecao));
      const meus = snap.docs.filter((d) => d.id === uid || d.data()?.uid === uid);
      for (const d of meus) {
        await deleteDoc(d.ref);
        apagados.push(colecao);
      }
    } catch (erro) {
      console.warn(`[apagar] ${colecao}:`, erro?.message ?? erro);
    }
  }

  limparLocal();

  return erros.length
    ? { ok: false, apagados, erro: erros.join(' · ') }
    : { ok: true, apagados };
}

/**
 * Deixa o documento `users/{uid}` com o mínimo, para que a conta Google
 * continue utilizável sem nenhum dado de jogo.
 *
 * Usado quando o jogador quer só recomeçar e não perder o acesso.
 */
export async function resetarProgresso(uid) {
  if (!uid) return { ok: false, erro: 'Sem sessão ativa.' };
  if (!firebaseDisponivel()) {
    limparLocal();
    return { ok: true };
  }
  const db = pegarDb();
  await setDoc(
    doc(db, NOME_COLECAO_JOGADORES, uid),
    { criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() },
    { merge: true },
  );
  await setDoc(doc(db, NOME_COLECAO_PORTAIS, uid), { ativo: false }, { merge: true });
  limparLocal();
  return { ok: true };
}

export async function temConsentimento(uid, versao) {
  if (!uid || !firebaseDisponivel()) return true; // sem conta, nada a consentir
  try {
    const db = pegarDb();
    const snap = await getDoc(doc(db, NOME_COLECAO_JOGADORES, uid));
    const t = snap.data()?.termos;
    return t?.versao === versao;
  } catch {
    // Falha de rede não pode trancar o jogador fora do jogo; o aceite fica como
    // pendente e a tela de termos aparece de novo.
    return false;
  }
}

function limparLocal() {
  try {
    localStorage.removeItem(CHAVE_PROGRESSO_LOCAL);
  } catch {
    /* modo privado pode bloquear */
  }
}