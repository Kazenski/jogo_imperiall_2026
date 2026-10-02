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
  runTransaction,
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

// ---------- Progresso dos jogadores (admin) ----------

/**
 * Lista TODOS os jogadores com seus personagens.
 *
 * Lê `users` para o nome legível e `jogadores` para o array `personagens`.
 * São coleções diferentes: o perfil público fica em `users`, o progresso em
 * `jogadores`. Um jogador que jogou offline não tem documento em `users`, e
 * um personagem pode existir sem perfil — daí o `Map` em vez de joins.
 */
export async function listarPersonagens() {
  const db = pegarDb();
  if (!db) return [];

  const [snapJogadores, snapUsuarios] = await Promise.all([
    getDocs(collection(db, 'jogadores')),
    getDocs(collection(db, 'users')),
  ]);

  const nomes = new Map();
  for (const d of snapUsuarios.docs) {
    const dados = d.data();
    nomes.set(d.id, dados.nome ?? d.id);
  }

  const linhas = [];
  for (const docJ of snapJogadores.docs) {
    const dados = docJ.data() ?? {};
    const uid = docJ.id;
    const dono = nomes.get(uid) ?? 'sem perfil';
    const lista = Array.isArray(dados.personagens) ? dados.personagens : [];
    for (const p of lista) {
      linhas.push({
        uid,
        dono,
        personagemId: p?.id ?? null,
        dados: p ?? {},
        // Guarda o uid para as escritas: `setDoc` precisa do caminho completo,
        // e o id do personagem sozinho não identifica o dono.
        personagemAtivoId: dados.personagemAtivoId ?? null,
      });
    }
  }

  return linhas.sort(
    (a, b) =>
      a.dono.localeCompare(b.dono, 'pt-BR') ||
      String(a.dados.nome ?? '').localeCompare(String(b.dados.nome ?? ''), 'pt-BR'),
  );
}

/** Lê o progresso bruto de um jogador (para editar). */
export async function obterProgresso(uid) {
  return obterDoc('jogadores', uid);
}

/**
 * Grava um personagem de volta na lista do jogador.
 *
 * `setDoc` com merge:false porque `personagens` é um ARRAY. Editar um
 * elemento do array com update exigiria `arrayUnion`, que não substitui —
 * duplicaria o personagem em vez de atualizar.
 */
export async function salvarPersonagem(uid, personagem) {
  const atual = await obterProgresso(uid);
  if (!atual) throw new Error('Jogador não encontrado.');

  const lista = Array.isArray(atual.personagens) ? [...atual.personagens] : [];
  const idx = lista.findIndex((p) => p?.id === personagem.id);
  if (idx === -1) throw new Error('Personagem não encontrado na conta.');

  lista[idx] = personagem;
  await setDoc(doc(pegarDb(), 'jogadores', uid), { personagens: lista, atualizadoEm: serverTimestamp() }, { merge: true });
  return personagem;
}

/** Duplica um personagem, dando um id novo. */
export async function duplicarPersonagem(uid, personagem) {
  const atual = await obterProgresso(uid);
  if (!atual) throw new Error('Jogador não encontrado.');

  const lista = Array.isArray(atual.personagens) ? [...atual.personagens] : [];
  const base = lista.find((p) => p?.id === personagem.id);
  if (!base) throw new Error('Personagem não encontrado.');

  // Id próprio do personagem (o `id` interno dele), não o do documento. O
  // Firestore aceita qualquer string, então um carimbo temporal basta e evita
  // colisão mesmo que o jogador duplique o mesmo herói duas vezes seguidas.
  const copia = {
    ...structuredClone(base),
    id: `${base.id}_copia_${Date.now().toString(36)}`,
    nome: `${base.nome ?? 'Herói'} (cópia)`,
    // Zera o que não deve ser herdado: um clone com o mesmo XP do original
    // cria um personagem inflado de graça.
    xp: 0,
    nivel: 1,
    ouro: 0,
    criadoEm: Date.now(),
  };

  // Respeita o teto de personagens do jogo (`MAX_PERSONAGENS` em progresso.js).
  if (lista.length >= 10) {
    throw new Error('A conta já tem 10 personagens (teto do jogo).');
  }

  lista.push(copia);
  await setDoc(doc(pegarDb(), 'jogadores', uid), { personagens: lista, atualizadoEm: serverTimestamp() }, { merge: true });
  return copia;
}

/** Remove um personagem da conta. */
export async function removerPersonagem(uid, personagemId) {
  const atual = await obterProgresso(uid);
  if (!atual) throw new Error('Jogador não encontrado.');

  const lista = Array.isArray(atual.personagens) ? atual.personagens : [];
  const restantes = lista.filter((p) => p?.id !== personagemId);
  if (restantes.length === lista.length) throw new Error('Personagem não encontrado.');

  const patch = { personagens: restantes, atualizadoEm: serverTimestamp() };
  // Se o removido era o ativo, aponta para outro — senão o jogo fica sem
  // personagem jogável e o jogador entra numa tela vazia.
  if (atual.personagemAtivoId === personagemId) {
    patch.personagemAtivoId = restantes[0]?.id ?? null;
  }

  await setDoc(doc(pegarDb(), 'jogadores', uid), patch, { merge: true });
  return restantes.length;
}

/**
 * Move um personagem entre contas (ou entre posições no mundo).
 *
 * Usado pelo admin para realocar um herói. Mexe nos DOIS documentos numa
 * operação só lógica: sem transação, uma falha no meio deixaria o personagem
 * duplicado em duas contas — o pior tipo de bug num save.
 */
export async function moverPersonagem(uidDestino, personagem, uidOrigem) {
  const origem = uidOrigem ?? uidDestino;
  const mesmoDono = origem === uidDestino;

  if (mesmoDono) {
    return salvarPersonagem(uidDestino, personagem);
  }

  const db = pegarDb();
  const docOrigem = doc(db, 'jogadores', origem);
  const docDestino = doc(db, 'jogadores', uidDestino);

  await runTransaction(db, async (tx) => {
    const snapOrigem = await tx.get(docOrigem);
    const snapDestino = await tx.get(docDestino);
    if (!snapOrigem.exists()) throw new Error('Conta de origem não encontrada.');

    const listaOrigem = snapOrigem.data()?.personagens ?? [];
    const restantes = listaOrigem.filter((p) => p?.id !== personagem.id);
    if (restantes.length === listaOrigem.length) throw new Error('Personagem não está na conta de origem.');

    const listaDestino = snapDestino.exists()
      ? (snapDestino.data()?.personagens ?? [])
      : [];
    if (listaDestino.length >= 10) throw new Error('A conta de destino já tem 10 personagens.');

    tx.update(docOrigem, {
      personagens: restantes,
      personagemAtivoId: snapOrigem.data()?.personagemAtivoId === personagem.id
        ? restantes[0]?.id ?? null
        : snapOrigem.data()?.personagemAtivoId,
    });
    tx.set(docDestino, {
      personagens: [...listaDestino, personagem],
      atualizadoEm: serverTimestamp(),
    }, { merge: true });
  });

  return personagem;
}

/**
 * Lista TODOS os jogadores, juntando as DUAS coleções.
 *
 * `users/{uid}` e `jogadores/{uid}` são coisas diferentes, e o painel precisa
 * das duas:
 *
 *  - `users`      = perfil (nome do Google, email, role)
 *  - `jogadores`  = progresso (personagens, inventário)
 *
 * Jogadores que entraram antes do perfil ser gravado no primeiro login
 * existem SÓ em `jogadores`. Ler só `users` os torna invisíveis no painel —
 * foi o que aconteceu com os três amigos do dono do projeto. Por isso a
 * union: quem está em qualquer uma das duas aparece.
 */
export async function listarJogadoresCompletos() {
  const db = pegarDb();
  if (!db) return [];

  const [snapUsers, snapJogadores] = await Promise.all([
    getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'jogadores')).catch(() => ({ docs: [] })),
  ]);

  const mapa = new Map();

  for (const d of snapUsers.docs) {
    mapa.set(d.id, {
      uid: d.id,
      perfil: d.data() ?? {},
      progresso: null,
    });
  }
  for (const d of snapJogadores.docs) {
    const existente = mapa.get(d.id);
    if (existente) existente.progresso = d.data() ?? {};
    else {
      // Jogou, mas nunca gravou perfil: monta um provisório para o painel
      // mostrar. NÃO é persistido aqui — só aparece na listagem.
      mapa.set(d.id, { uid: d.id, perfil: {}, progresso: d.data() ?? {} });
    }
  }

  const linhas = [...mapa.values()].map((linha) => {
    const p = linha.perfil ?? {};
    const prog = linha.progresso ?? {};
    const personagens = Array.isArray(prog.personagens) ? prog.personagens : [];
    const ativo = personagens.find((c) => c?.id === prog.personagemAtivoId) ?? personagens[0];

    return {
      uid: linha.uid,
      nome: p.nome ?? prog.nome ?? 'Sem perfil',
      email: p.email ?? prog.email ?? null,
      role: p.role ?? 'jogador',
      nivel: ativo?.nivel ?? p.nivel ?? 1,
      ouro: ativo?.ouro ?? p.ouro ?? 0,
      vocacaoId: ativo?.vocacaoId ?? p.vocacaoId ?? null,
      totalPersonagens: personagens.length,
      temPerfil: Boolean(p.nome),
      temProgresso: personagens.length > 0,
      ultimoLogin: prog.ultimoLogin ?? null,
    };
  });

  return linhas.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

/**
 * Cria (ou completa) o documento `users/{uid}` de quem já joga.
 *
 * Chamado pelo painel para consertar contas faltantes. O nome vem do documento
 * de progresso quando existir; caso contrário, um nome derivado do `uid`, que
 * é melhor do que deixar a conta invisível.
 */
export async function garantirPerfilAdmin(uid) {
  const db = pegarDb();
  if (!db || !uid) return null;

  const refPerfil = doc(db, 'users', uid);
  const snapPerfil = await getDoc(refPerfil);
  if (snapPerfil.exists()) return { uid, ...snapPerfil.data(), jaExistia: true };

  const snapProg = await getDoc(doc(db, 'jogadores', uid));
  const prog = snapProg.exists() ? snapProg.data() : {};
  const personagens = Array.isArray(prog.personagens) ? prog.personagens : [];
  const ativo = personagens.find((c) => c?.id === prog.personagemAtivoId) ?? personagens[0];

  const novo = {
    uid,
    nome: prog.nome ?? `Viajante ${String(uid).slice(0, 6)}`,
    email: prog.email ?? null,
    role: 'jogador',
    // Derivado do personagem ativo, para a listagem ter o que mostrar.
    nivel: ativo?.nivel ?? 1,
    ouro: ativo?.ouro ?? 0,
    vocacaoId: ativo?.vocacaoId ?? null,
    // Marca que o perfil foi criado pelo admin, e não no primeiro login.
    perfilCriadoPeloAdmin: true,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  };

  await setDoc(refPerfil, novo, { merge: false });
  return { ...novo, jaExistia: false };
}

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
