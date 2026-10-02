// Modal genérico em DOM, para o painel administrativo.
//
// Por que não usar <dialog> nativo: o admin é uma camada HTML/CSS desenhada
// dentro do canvas do Phaser, e `showModal()` depende de o elemento estar no
// topo do documento. Aqui o overlay vive dentro de um `div` do jogo, então o
// topo do documento rejeitaria a chamada em navegadores diferentes.
//
// Por que não reutilizar o `painel()` de `ui/comuns.js`: aquele desenha no
// canvas via Phaser. O admin não usa mais canvas para interface (ver o
// comentário de topo do AdminScene).

const ESTILO = `
#modalCamada{position:fixed;inset:0;z-index:9000;background:rgba(10,12,15,.72);
  display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
#modalCaixa{background:#fff;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.4);
  display:flex;flex-direction:column;max-height:92vh;max-width:96vw;overflow:hidden}
#modalTopo{padding:12px 16px;border-bottom:1px solid #dde3ea;display:flex;align-items:center;gap:12px}
#modalTopo h3{margin:0;font-size:15px;color:#233240;flex:1}
#modalCorpo{overflow:auto;padding:16px}
#modalRodape{padding:12px 16px;border-top:1px solid #dde3ea;display:flex;gap:10px;justify-content:flex-end}
#modalCamada.escuro #modalCaixa{background:#1d2026}
#modalCamada.escuro #modalTopo,#modalCamada.escuro #modalRodape{border-color:#33373f}
#modalCamada.escuro #modalTopo h3{color:#e7eaee}
#modalCamada.escuro button{background:#262a31;border-color:#3a3f47;color:#e7eaee}
`;

let camadaAberta = null;

/** Garante que o CSS do modal exista uma única vez. */
function garantirEstilo() {
  if (document.getElementById('modalCss')) return;
  const style = document.createElement('style');
  style.id = 'modalCss';
  style.textContent = ESTILO;
  document.head.appendChild(style);
}

/**
 * Abre um modal e devolve uma referência para fechá-lo.
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {(corpo: HTMLElement, api: object) => void} opcoes.desenhar
 *   Recebe o corpo do modal e uma API com `fechar()`, `elemento` e `corpo`.
 * @param {Array<{texto: string, aoClicar?: Function, fechar?: boolean, classe?: string}>} [opcoes.botoes]
 * @param {boolean} [opcoes.escuro] _respeta o tema do painel
 * @param {string} [opcoes.largura]  ex.: '900px'
 * @returns {{fechar: Function, elemento: HTMLElement, corpo: HTMLElement}}
 */
export function abrirModal({ titulo, desenhar, botoes = [], escuro = false, largura = '' }) {
  // Só um modal por vez. NPC + mapa + editor podem ser abertos em sequência
  // rápida; empilhar camadas deixaria o clique ambíguo sobre qual fechar.
  if (camadaAberta) camadaAberta.fechar();

  garantirEstilo();

  const camada = document.createElement('div');
  camada.id = 'modalCamada';
  if (escuro) camada.classList.add('escuro');

  const caixa = document.createElement('div');
  caixa.id = 'modalCaixa';
  if (largura) caixa.style.width = largura;
  caixa.style.maxWidth = largura ? 'none' : '96vw';

  const topo = document.createElement('div');
  topo.id = 'modalTopo';
  const h3 = document.createElement('h3');
  h3.textContent = titulo ?? '';
  const btnX = document.createElement('button');
  btnX.textContent = '✕';
  btnX.style.cssText = 'border:1px solid #c9d2dc;border-radius:6px;padding:5px 11px;cursor:pointer';
  topo.append(h3, btnX);

  const corpo = document.createElement('div');
  corpo.id = 'modalCorpo';

  caixa.append(topo, corpo);

  if (botoes.length) {
    const rodape = document.createElement('div');
    rodape.id = 'modalRodape';
    for (const b of botoes) {
      const btn = document.createElement('button');
      btn.textContent = b.texto;
      btn.style.cssText = `border-radius:6px;padding:9px 16px;cursor:pointer;border:1px solid #c9d2dc;background:#fff;${b.classe === 'primario' ? 'background:#2bb3a3;border-color:#2bb3a3;color:#fff;font-weight:700;' : ''}${b.classe === 'perigo' ? 'background:#fdeae7;border-color:#f0c3bc;color:#b4453a;' : ''}`;
      btn.addEventListener('click', () => {
        const fecharDepois = b.fechar !== false;
        b.aoClicar?.({ fechar, corpo });
        if (fecharDepois) fechar();
      });
      rodape.appendChild(btn);
    }
    caixa.appendChild(rodape);
  }

  camada.appendChild(caixa);
  document.body.appendChild(camada);

  let fechado = false;
  function fechar() {
    if (fechado) return;
    fechado = true;
    camada.remove();
    if (camadaAberta === api) camadaAberta = null;
    window.removeEventListener('keydown', aoTeclar);
  }

  // Esc fecha. Só quando o topo é este modal — dois empilhados não podem
  // ambos reagirem ao mesmo Escape.
  function aoTeclar(ev) {
    if (ev.key === 'Escape' && camadaAberta === api) fechar();
  }
  window.addEventListener('keydown', aoTeclar);

  btnX.addEventListener('click', fechar);
  // Clique fora da caixa fecha. Sem isso, um modal grande que ocupa a tela
  // toda vira uma armadilha: o único botão de fechar é o "✕" miúdo no topo.
  camada.addEventListener('mousedown', (ev) => {
    if (ev.target === camada) fechar();
  });

  const api = { fechar, elemento: caixa, corpo };
  camadaAberta = api;

  desenhar?.(corpo, api);

  return api;
}

export function modalAberto() {
  return camadaAberta;
}
