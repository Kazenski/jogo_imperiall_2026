// Envio de imagens para o Firebase Storage.
//
// Usado pelo painel administrativo: o admin escolhe um arquivo (ou cola uma URL)
// e o endereco final fica gravado no campo `imagem` do documento.
//
// Por que uma camada propria e nao fazer no AdminScene direto:
//  - o AdminScene nao deve conhecer `firebase/storage` — assim o resto da UI
//    continua funcionando em modo local, sem Firebase configurado;
//  - o rebaixamento automatico de imagem (pixel art nao precisa de 4 MB) fica
//    em UM lugar, e nao espalhado por cada tipo de registro;
//  - `armazenamentoDisponivel()` permite a UI avisar o jogador em vez de
//    fingir que salvou.

import { getStorage, ref as refStorage, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { firebaseConfig, firebaseHabilitado } from '../config.js';

let storage = null;
let tentado = false;

function pegarStorage() {
  if (!firebaseHabilitado) return null;
  if (!tentado) {
    tentado = true;
    try {
      storage = getStorage(initializeApp(firebaseConfig));
    } catch (erro) {
      console.warn('[armazenamento] Firebase Storage indisponivel:', erro?.message ?? erro);
      storage = null;
    }
  }
  return storage;
}

export function armazenamentoDisponivel() {
  return Boolean(pegarStorage());
}

/** Extensao garantida a partir do nome do arquivo ou do MIME type. */
function extensaoDe(arquivo) {
  const peloNome = String(arquivo?.name ?? '')
    .split('.')
    .pop()
    ?.toLowerCase();
  if (peloNome && peloNome.length <= 5) return peloNome;
  const porTipo = String(arquivo?.type ?? '');
  if (porTipo.includes('png')) return 'png';
  if (porTipo.includes('jpeg') || porTipo.includes('jpg')) return 'jpg';
  if (porTipo.includes('webp')) return 'webp';
  if (porTipo.includes('gif')) return 'gif';
  return 'png';
}

/**
 * Reduz a imagem para caber em `ladoMaximo`.
 *
 * Pixel art e normalmente pequena, mas o admin arrasta qualquer arquivo do
 * desktop. Sem isto um PNG de 6 MB trava o download de todo mundo. O limite e
 * em pixels (e nao em bytes) porque e o que realmente pesa na GPU e no trafego
 * de quem abre o jogo num celular.
 */
async function reduzir(arquivo, ladoMaximo = 256) {
  const ehImagem = String(arquivo?.type ?? '').startsWith('image/');
  if (!ehImagem || typeof createImageBitmap !== 'function') return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    if (escala >= 1) {
      bitmap.close?.();
      return arquivo;
    }
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));

    const lona = document.createElement('canvas');
    lona.width = largura;
    lona.height = altura;
    const ctx = lona.getContext('2d');
    ctx.imageSmoothingEnabled = false; // pixel art nao deve ficar borrado
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close?.();

    const blob = await new Promise((resolve) => lona.toBlob(resolve, 'image/png'));
    if (!blob) return arquivo;

    return new File([blob], arquivo.name, { type: 'image/png' });
  } catch (erro) {
    console.warn('[armazenamento] falha ao reduzir a imagem, enviando original:', erro);
    return arquivo;
  }
}

/**
 * Envia um arquivo e devolve a URL publica de download.
 *
 * @param {File} arquivo
 * @param {string} pasta  prefixo no bucket (ex.: 'itens')
 * @param {object} [opcoes]
 * @param {number} [opcoes.ladoMaximo]
 * @param {(pct: number) => void} [opcoes.aoProgredir]
 * @returns {Promise<string>} URL que vai no campo `imagem`
 */
export async function enviarImagem(arquivo, pasta = 'imagens', opcoes = {}) {
  const st = pegarStorage();
  if (!st) throw new Error('Firebase Storage nao configurado neste ambiente.');
  if (!arquivo) throw new Error('Nenhum arquivo escolhido.');

  const preparado = await reduzir(arquivo, opcoes.ladoMaximo ?? 256);
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensaoDe(arquivo)}`;
  const destino = refStorage(st, `${pasta}/${nome}`);

  opcoes.aoProgredir?.(0);

  await uploadBytes(destino, preparado, {
    contentType: preparado.type || 'image/png',
    customMetadata: { origem: 'admin-jogo-imperiall' },
  });

  opcoes.aoProgredir?.(100);
  return getDownloadURL(destino);
}

/**
 * Verifica se uma URL parece ser uma imagem utilizavel.
 * Usado pela UI para avisar antes de gravar uma referencia quebrada.
 */
export function pareceUrlDeImagem(valor) {
  const v = String(valor ?? '').trim();
  if (!v) return false;
  if (/^data:image\//i.test(v)) return true;
  return /^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?\S*)?$/i.test(v);
}