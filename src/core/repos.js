// Helpers Firestore para catálogo (Admin CRUD)
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { pegarDb, firebaseDisponivel } from './firebase.js';

function dbOk() {
  return firebaseDisponivel() && pegarDb();
}

/**
 * Lista uma coleção inteira.
 *
 * O `orderBy('nome')` original quebrava de duas formas:
 *
 *  1. Documentos sem o campo `nome` (registros criados antes do campo existir,
 *     ou gravados por script) fazem o Firestore recusar a consulta inteira com
 *     "order by requires a field" — o painel ficava vazio sem explicação.
 *  2. A ordenação acontece no servidor, mas o painel já sabe ordenar na tela
 *     (todas as tabelas de balanceamento têm th clicável). Então a ordenação
 *     aqui é conveniência, não necessidade.
 *
 * Se a consulta ordenada falhar por qualquer motivo, caímos para a leitura
 * simples. Perder a ordem é aceitável; perder a lista inteira não.
 */
async function listarColecao(nome, ordenaPor = 'nome') {
  const db = pegarDb();
  if (!db) return [];
  const col = collection(db, nome);

  if (ordenaPor) {
    try {
      const snap = await getDocs(query(col, orderBy(ordenaPor, 'asc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (erro) {
      console.warn(`[repos] listagem de "${nome}" sem ordenação (${erro?.code ?? erro?.message ?? erro})`);
    }
  }

  const snap = await getDocs(col);
  const linhas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (ordenaPor) {
    linhas.sort((a, b) =>
      String(a[ordenaPor] ?? '').localeCompare(String(b[ordenaPor] ?? ''), 'pt-BR'),
    );
  }
  return linhas;
}

async function obterDoc(nome, id) {
  const db = pegarDb();
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, nome, id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

async function criarDoc(nome, dados) {
  const db = pegarDb();
  if (!db) return null;
  const ref = await addDoc(collection(db, nome), {
    ...dados,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return { id: ref.id };
}

async function salvarDoc(nome, id, dados, merge = true) {
  const db = pegarDb();
  if (!db || !id) return null;
  await setDoc(doc(db, nome, id), { ...dados, atualizadoEm: serverTimestamp() }, { merge });
  return { id };
}

async function removerDoc(nome, id) {
  const db = pegarDb();
  if (!db || !id) return;
  await deleteDoc(doc(db, nome, id));
}

export const repoItens = {
  listar: () => listarColecao('items', 'nome'),
  obter: (id) => obterDoc('items', id),
  criar: (dados) => criarDoc('items', dados),
  salvar: (id, dados, merge) => salvarDoc('items', id, dados, merge),
  remover: (id) => removerDoc('items', id),
};

export const repoClasses = {
  listar: () => listarColecao('classes', 'nome'),
  obter: (id) => obterDoc('classes', id),
  criar: (dados) => criarDoc('classes', dados),
  salvar: (id, dados, merge) => salvarDoc('classes', id, dados, merge),
  remover: (id) => removerDoc('classes', id),
};

export const repoSkills = {
  listar: () => listarColecao('skills', 'nome'),
  obter: (id) => obterDoc('skills', id),
  criar: (dados) => criarDoc('skills', dados),
  salvar: (id, dados, merge) => salvarDoc('skills', id, dados, merge),
  remover: (id) => removerDoc('skills', id),
};

export const repoRecipes = {
  listar: () => listarColecao('recipes'),
  obter: (id) => obterDoc('recipes', id),
  criar: (dados) => criarDoc('recipes', dados),
  salvar: (id, dados, merge) => salvarDoc('recipes', id, dados, merge),
  remover: (id) => removerDoc('recipes', id),
};

export const repoMonstros = {
  listar: () => listarColecao('monsters', 'nome'),
  obter: (id) => obterDoc('monsters', id),
  criar: (dados) => criarDoc('monsters', dados),
  salvar: (id, dados, merge) => salvarDoc('monsters', id, dados, merge),
  remover: (id) => removerDoc('monsters', id),
};

export const repoWorldTemplates = {
  listar: () => listarColecao('worldTemplates', 'nome'),
  obter: (id) => obterDoc('worldTemplates', id),
  criar: (dados) => criarDoc('worldTemplates', dados),
  salvar: (id, dados, merge) => salvarDoc('worldTemplates', id, dados, merge),
  remover: (id) => removerDoc('worldTemplates', id),
};

export const repoAchievements = {
  listar: () => listarColecao('achievements', 'nome'),
  obter: (id) => obterDoc('achievements', id),
  criar: (dados) => criarDoc('achievements', dados),
  salvar: (id, dados, merge) => salvarDoc('achievements', id, dados, merge),
  remover: (id) => removerDoc('achievements', id),
};

// ---------- Além do catálogo: modulatoria do jogo ----------

// Estas colecoes NAO fazem parte do catalogo (o jogador nao as ve no jogo), mas
// o administrador precisa poder ver quem esta jogando e quais bases estao
// publicadas — sem isso, promoted/rebaixar admin e esconder um portal exigem
// abrir o console do Firebase.

export const repoUsuarios = {
  listar: () => listarColecao('users', 'nome'),
  obter: (id) => obterDoc('users', id),
  salvar: (id, dados, merge) => salvarDoc('users', id, dados, merge),
};

export const repoPortais = {
  listar: () => listarColecao('portais', 'nome'),
  obter: (id) => obterDoc('portais', id),
  salvar: (id, dados, merge) => salvarDoc('portais', id, dados, merge),
  remover: (id) => removerDoc('portais', id),
};

export const repoEstacoes = {
  listar: () => listarColecao('estacoes', 'nome'),
  obter: (id) => obterDoc('estacoes', id),
  criar: (dados) => criarDoc('estacoes', dados),
  salvar: (id, dados, merge) => salvarDoc('estacoes', id, dados, merge),
  remover: (id) => removerDoc('estacoes', id),
};

// ---------- Novas coleções ----------

export const repoBiomas = {
  listar: () => listarColecao('biomas', 'nome'),
  obter: (id) => obterDoc('biomas', id),
  criar: (dados) => criarDoc('biomas', dados),
  salvar: (id, dados, merge) => salvarDoc('biomas', id, dados, merge),
  remover: (id) => removerDoc('biomas', id),
};

export const repoNPCs = {
  listar: () => listarColecao('npcs', 'nome'),
  obter: (id) => obterDoc('npcs', id),
  criar: (dados) => criarDoc('npcs', dados),
  salvar: (id, dados, merge) => salvarDoc('npcs', id, dados, merge),
  remover: (id) => removerDoc('npcs', id),
};

export const repoServidores = {
  listar: () => listarColecao('servidores', 'nome'),
  obter: (id) => obterDoc('servidores', id),
  criar: (dados) => criarDoc('servidores', dados),
  salvar: (id, dados, merge) => salvarDoc('servidores', id, dados, merge),
  remover: (id) => removerDoc('servidores', id),
};

export const repoBackups = {
  listar: () => listarColecao('backups', 'nome'),
  obter: (id) => obterDoc('backups', id),
  criar: (dados) => criarDoc('backups', dados),
  salvar: (id, dados, merge) => salvarDoc('backups', id, dados, merge),
  remover: (id) => removerDoc('backups', id),
};

/** Uids marcados como administrador (system/admins). */
export async function listarAdmins() {
  const docRef = obterDoc('system', 'admins');
  const dados = await docRef;
  return Array.isArray(dados?.uids) ? dados.uids : [];
}

export async function definirAdminUid(uid, ativo) {
  const atual = await listarAdmins();
  const conjunto = new Set(atual);
  if (ativo) conjunto.add(uid);
  else conjunto.delete(uid);
  await salvarDoc('system', 'admins', { uids: Array.from(conjunto) });
  return Array.from(conjunto);
}
