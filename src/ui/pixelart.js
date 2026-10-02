// Editor de pixel art em DOM puro, para o painel administrativo.
//
// Existe outro editor em `ui/formularios.js` (campo `pixelart`), mas aquele
// desenha no canvas via Phaser e serve às cenas do jogo. O admin não usa mais
// canvas para interface, então este é o caminho dele.
//
// FORMATO: 32×32, quadrado.
//
// Não é escolha estética. `TAMANHO_BLOCO = 32` em `core/mundo.js` é o tamanho
// do bloco no mapa, e o sprite é desenhado nessa mesma proporção. Um canvas
// 16×24 (proporção de personagem) entraria esticado no mundo. Então:
// quadrado, 32×32, igual ao quadradinho que o jogador vê.

import { CORES_PALETA } from '../dados/schemaAdmin.js';

const TAM = 32;

/** Paleta do editor: as 36 cores do painel + as que o jogador já usou. */
function coresIniciais(recentes) {
  const base = [...CORES_PALETA];
  for (const c of recentes ?? []) {
    if (!base.includes(c)) base.push(c);
  }
  return base;
}

/**
 * Cria um editor de pixel art 32×32.
 *
 * @param {object} opcoes
 * @param {number} [opcoes.zoom]        pixels na tela por quadradinho (8–20)
 * @param {string} [opcoes.valor]       data URL inicial (reaproveita a arte atual)
 * @param {string[]} [opcoes.recentes]  cores usadas recentemente
 * @param {(dataUrl: string) => void} [opcoes.aoMudar]
 * @returns {{elemento: HTMLElement, obter: () => string, limpar: () => void,
 *            definir: (dataUrl: string) => void}}
 */
export function criarEditorPixelArt({
  zoom = 12,
  valor = '',
  recentes = [],
  aoMudar,
} = {}) {
  // RGBA plano. 32*32*4 = 4096 bytes — cabem folgados, e `ImageData` exige
  // exatamente `Uint8ClampedArray`.
  const pixels = new Uint8ClampedArray(TAM * TAM * 4);
  const pilha = []; // histórico para desfazer
  let corAtual = CORES_PALETA[0];
  let ferramenta = 'pincel';
  let nivelZoom = Math.max(6, Math.min(20, zoom));
  let desenhando = false;

  const elemento = document.createElement('div');
  elemento.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  // ---------- Canvas ----------
  const lona = document.createElement('canvas');
  lona.width = TAM;
  lona.height = TAM;
  lona.style.cssText = 'image-rendering:pixelated;border:2px solid #2b3440;border-radius:6px;cursor:crosshair;touch-action:none';

  const tela = document.createElement('canvas');
  tela.style.cssText = 'image-rendering:pixelated;border:2px solid #2b3440;border-radius:6px';

  const ctxTela = tela.getContext('2d');
  ctxTela.imageSmoothingEnabled = false;

  // Os previews do rodapé existem antes de qualquer desenho, porque
  // `desenharTela` os atualiza e é chamada durante a montagem.
  const preview = document.createElement('canvas');
  preview.width = TAM;
  preview.height = TAM;
  preview.style.cssText = 'image-rendering:pixelated;border:1px solid #ccd5de;border-radius:4px;width:32px;height:32px';
  const previewGrande = document.createElement('canvas');
  previewGrande.width = TAM;
  previewGrande.height = TAM;
  previewGrande.style.cssText = 'image-rendering:pixelated;border:1px solid #ccd5de;border-radius:6px;width:96px;height:96px;background:#f2f5f8';

  function atualizarPreviews() {
    for (const alvo of [preview, previewGrande]) {
      const c = alvo.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, TAM, TAM);
      c.drawImage(lona, 0, 0);
    }
  }

  function aplicarZoom() {
    tela.width = TAM * nivelZoom;
    tela.height = TAM * nivelZoom;
    tela.style.width = `${TAM * nivelZoom}px`;
    tela.style.height = `${TAM * nivelZoom}px`;
    ctxTela.imageSmoothingEnabled = false;
    desenharTela();
    atualizarPreviews();
  }

  /**
   * Redesenha a tela de trabalho e os previews do rodapé juntos.
   *
   * Os dois precisam ir junto: o preview em tamanho real é onde o admin
   * confere se o detalhe ficou legível a 1 quadradinho. Se só a tela
   * grande atualizasse, o preview congelaria na arte anterior e daria a
   * impressão de que o pincel não funcionou.
   */
  function desenharTela() {
    // Fundo xadrez: distingue "pixel vazio" de "pixel preto". Sem isso, um
    // sprite com detalhe escuro nas bordas parece cortado.
    const cx = nivelZoom;
    for (let y = 0; y < TAM; y += 1) {
      for (let x = 0; x < TAM; x += 1) {
        ctxTela.fillStyle = (x + y) % 2 === 0 ? '#f4f6f8' : '#e4e8ec';
        ctxTela.fillRect(x * cx, y * cx, cx, cx);
      }
    }
    ctxTela.drawImage(lona, 0, 0, TAM * nivelZoom, TAM * nivelZoom);

    // Grade só em zoom alto. Em zoom baixo ela vira ruído visual sobre o
    // desenho e atrapalha mais do que ajuda a alinhar.
    if (nivelZoom >= 10) {
      ctxTela.strokeStyle = 'rgba(43,52,64,.18)';
      ctxTela.lineWidth = 1;
      for (let i = 1; i < TAM; i += 1) {
        const p = i * cx + 0.5;
        ctxTela.beginPath();
        ctxTela.moveTo(p, 0);
        ctxTela.lineTo(p, TAM * cx);
        ctxTela.moveTo(0, p);
        ctxTela.lineTo(TAM * cx, p);
        ctxTela.stroke();
      }
    }

    atualizarPreviews();
  }

  function pintar(ctx, x, y) {
    ctx.fillStyle = corAtual;
    ctx.fillRect(x, y, 1, 1);
  }

  /** Preenche por região contígua da mesma cor (balde de tinta). */
  function preencherIgual(ctx, x, y) {
    const [r, g, b] = hexParaRgb(corAtual);
    const alvo = ctx.getImageData(0, 0, TAM, TAM);
    const d = alvo.data;
    const i = (y * TAM + x) * 4;

    // A cor de quem foi clicado. Os 4 canais entram na comparação porque
    // "transparente" e "preto" precisam ser regiões distintas — senão o balde
    // vaza de uma para a outra.
    const origem = [d[i], d[i + 1], d[i + 2], d[i + 3]];

    const igual = (k) =>
      d[k] === origem[0] && d[k + 1] === origem[1] &&
      d[k + 2] === origem[2] && d[k + 3] === origem[3];

    // Se o pixel clicado JÁ é a cor escolhida, o balde não tem por onde
    // começar: a região alvo e a origem coincidem, e pintar seria no-op.
    //
    // A comparação é com a cor nova, NÃO com `origem`. Testar contra `origem`
    // faria a condição ser verdadeira no primeiro pixel sempre — que é
    // exatamente o que impedia o balde de pintar qualquer coisa.
    const jaPreenchido =
      d[i] === r && d[i + 1] === g && d[i + 2] === b && d[i + 3] === 255;
    if (jaPreenchido) return;

    const fila = [[x, y]];
    while (fila.length) {
      const [px, py] = fila.pop();
      if (px < 0 || py < 0 || px >= TAM || py >= TAM) continue;
      const k = (py * TAM + px) * 4;
      if (!igual(k)) continue;
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = b;
      d[k + 3] = 255;
      fila.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(alvo, 0, 0);
  }

  function aplicar(x, y, ctx) {
    const alvo = ctx ?? lona.getContext('2d');
    if (ferramenta === 'borracha') {
      alvo.clearRect(x, y, 1, 1);
      return;
    }
    if (ferramenta === 'balde') {
      preencherIgual(alvo, x, y);
      return;
    }
    pintar(alvo, x, y);
  }

  function hexParaRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function posicaoDoPonteiro(ev) {
    const r = tela.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * TAM);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * TAM);
    return {
      x: Math.max(0, Math.min(TAM - 1, x)),
      y: Math.max(0, Math.min(TAM - 1, y)),
      dentro: x >= 0 && y >= 0 && x < TAM && y < TAM,
    };
  }

  function snapshot() {
    pilha.push(new Uint8ClampedArray(lona.getContext('2d').getImageData(0, 0, TAM, TAM).data));
    if (pilha.length > 40) pilha.shift();
  }

  tela.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    snapshot();
    desenhando = true;
    tela.setPointerCapture?.(ev.pointerId);
    const { x, y, dentro } = posicaoDoPonteiro(ev);
    if (dentro) aplicar(x, y);
  });
  tela.addEventListener('pointermove', (ev) => {
    if (!desenhando) return;
    ev.preventDefault();
    const { x, y, dentro } = posicaoDoPonteiro(ev);
    if (dentro) aplicar(x, y);
  });
  const fimDesenho = () => {
    if (!desenhando) return;
    desenhando = false;
    desenharTela();
    aoMudar?.(obter());
  };
  tela.addEventListener('pointerup', fimDesenho);
  tela.addEventListener('pointercancel', fimDesenho);
  tela.addEventListener('pointerleave', () => { desenhando = false; });

  // ---------- Controles ----------
  const barra = document.createElement('div');
  barra.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:12px';

  const grupoFerramentas = document.createElement('div');
  grupoFerramentas.style.cssText = 'display:flex;gap:4px';
  const FERRAMENTAS = [
    ['pincel', '🖌 Pincel'],
    ['borracha', '⌫ Borracha'],
    ['balde', '🪣 Balde'],
  ];
  const botoesFerramenta = [];
  for (const [id, rotulo] of FERRAMENTAS) {
    const b = document.createElement('button');
    b.textContent = rotulo;
    b.dataset.ferramenta = id;
    b.style.cssText = 'border:1px solid #c9d2dc;border-radius:6px;padding:5px 10px;cursor:pointer;background:#fff;font-size:12px';
    b.addEventListener('click', () => {
      ferramenta = id;
      for (const outro of botoesFerramenta) {
        outro.style.background = outro.dataset.ferramenta === id ? '#2bb3a3' : '#fff';
        outro.style.color = outro.dataset.ferramenta === id ? '#fff' : '#2b3440';
      }
    });
    botoesFerramenta.push(b);
    grupoFerramentas.appendChild(b);
  }
  botoesFerramenta[0].click();

  const grupoPaleta = document.createElement('div');
  grupoPaleta.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;max-width:330px';
  for (const cor of coresIniciais(recentes)) {
    const b = document.createElement('button');
    b.style.cssText = `width:20px;height:20px;border-radius:4px;background:${cor};cursor:pointer;border:2px solid ${cor === corAtual ? '#2b3440' : 'transparent'}`;
    b.title = cor;
    b.addEventListener('click', () => {
      corAtual = cor;
      ferramenta = 'pincel';
      for (const outro of grupoPaleta.children) {
        const c = outro.title;
        outro.style.borderColor = c === cor ? '#2b3440' : 'transparent';
      }
    });
    grupoPaleta.appendChild(b);
  }

  const campoCor = document.createElement('input');
  campoCor.type = 'color';
  campoCor.value = corAtual;
  campoCor.style.cssText = 'width:34px;height:26px;padding:0;border:1px solid #c9d2dc;border-radius:5px;cursor:pointer';
  campoCor.title = 'Cor personalizada';
  campoCor.addEventListener('input', () => {
    corAtual = campoCor.value;
    for (const outro of grupoPaleta.children) {
      outro.style.borderColor = outro.title === corAtual ? '#2b3440' : 'transparent';
    }
  });

  const grupoZoom = document.createElement('div');
  grupoZoom.style.cssText = 'display:flex;gap:4px;align-items:center';
  const menosZoom = document.createElement('button');
  menosZoom.textContent = '−';
  const maisZoom = document.createElement('button');
  maisZoom.textContent = '+';
  const rotuloZoom = document.createElement('span');
  rotuloZoom.style.cssText = 'min-width:38px;text-align:center;color:#5a6a78';
  function atualizarRotuloZoom() {
    rotuloZoom.textContent = `${nivelZoom}×`;
  }
  menosZoom.style.cssText = maisZoom.style.cssText = 'border:1px solid #c9d2dc;border-radius:6px;padding:3px 10px;cursor:pointer;background:#fff';
  menosZoom.addEventListener('click', () => {
    nivelZoom = Math.max(6, nivelZoom - 2);
    aplicarZoom();
    atualizarRotuloZoom();
  });
  maisZoom.addEventListener('click', () => {
    nivelZoom = Math.min(20, nivelZoom + 2);
    aplicarZoom();
    atualizarRotuloZoom();
  });
  grupoZoom.append(rotuloZoom, menosZoom, maisZoom);
  atualizarRotuloZoom();

  const btnDesfazer = document.createElement('button');
  btnDesfazer.textContent = '↶ Desfazer';
  btnDesfazer.style.cssText = 'border:1px solid #c9d2dc;border-radius:6px;padding:5px 10px;cursor:pointer;background:#fff';
  btnDesfazer.addEventListener('click', () => {
    const anterior = pilha.pop();
    if (!anterior) return;
    lona.getContext('2d').putImageData(new ImageData(anterior, TAM, TAM), 0, 0);
    desenharTela();
    aoMudar?.(obter());
  });

  const btnLimpar = document.createElement('button');
  btnLimpar.textContent = '🗑 Limpar';
  btnLimpar.style.cssText = 'border:1px solid #f0c3bc;border-radius:6px;padding:5px 10px;cursor:pointer;background:#fdeae7;color:#b4453a';
  btnLimpar.addEventListener('click', () => {
    snapshot();
    lona.getContext('2d').clearRect(0, 0, TAM, TAM);
    desenharTela();
    aoMudar?.(obter());
  });

  const btnImportar = document.createElement('label');
  btnImportar.textContent = '📂 Importar';
  btnImportar.style.cssText = 'border:1px solid #c9d2dc;border-radius:6px;padding:5px 10px;cursor:pointer;background:#fff';
  const entradaArquivo = document.createElement('input');
  entradaArquivo.type = 'file';
  entradaArquivo.accept = 'image/*';
  entradaArquivo.style.display = 'none';
  entradaArquivo.addEventListener('change', () => {
    const arq = entradaArquivo.files?.[0];
    if (!arq) return;
    snapshot();
    const img = new Image();
    img.onload = () => {
      // `smoothing off` ao reduzir: sem isso o navegador faz média dos pixels
      // e o sprite 32×32 fica com as bordas borradas.
      const ctx = lona.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, TAM, TAM);
      ctx.drawImage(img, 0, 0, TAM, TAM);
      desenharTela();
      aoMudar?.(obter());
    };
    img.src = URL.createObjectURL(arq);
  });
  btnImportar.appendChild(entradaArquivo);

  const grupoAcoes = document.createElement('div');
  grupoAcoes.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  grupoAcoes.append(btnImportar, btnDesfazer, btnLimpar);

  barra.append(grupoFerramentas, campoCor, grupoPaleta, grupoZoom, grupoAcoes);

  // ---------- Preview em tamanho real ----------
  const rodape = document.createElement('div');
  rodape.style.cssText = 'display:flex;align-items:center;gap:14px;font-size:11px;color:#7b8794;flex-wrap:wrap';

  const infoFormato = document.createElement('span');
  infoFormato.textContent = '32×32 px (1 quadradinho = 1 bloco do mundo) · PNG';
  rodape.append(preview, previewGrande, document.createElement('span'), infoFormato);

  elemento.append(barra, tela, rodape);

  // ---------- API ----------
  function obter() {
    // PNG com transparência. O fundo xadrez é só da TELA; o arquivo sai limpo,
    // senão o sprite carregaria o xadrez junto e apareceria no jogo.
    const saida = document.createElement('canvas');
    saida.width = TAM;
    saida.height = TAM;
    saida.getContext('2d').putImageData(lona.getContext('2d').getImageData(0, 0, TAM, TAM), 0, 0);
    return saida.toDataURL('image/png');
  }

  function definir(dataUrl) {
    if (!dataUrl || !String(dataUrl).startsWith('data:image')) return;
    const img = new Image();
    img.onload = () => {
      const ctx = lona.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, TAM, TAM);
      ctx.drawImage(img, 0, 0, TAM, TAM);
      desenharTela();
    };
    img.src = dataUrl;
  }

  function limpar() {
    lona.getContext('2d').clearRect(0, 0, TAM, TAM);
    desenharTela();
  }

  aplicarZoom();

  // Carrega a arte existente por último: os controles já existem, então
  // `desenharTela` e os previews não acessam algo ainda indefinido.
  if (valor) definir(valor);
  else { desenharTela(); atualizarPreviews(); }

  return { elemento, obter, definir, limpar };
}

export { TAM as TAMANHO_PIXEL_ART };
