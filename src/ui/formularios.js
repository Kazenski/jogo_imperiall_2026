// Widgets de formulario para o painel administrativo.
//
// O Phaser nao tem input de texto, entao todo campo de digitacao aqui e um
// `<input>`/`<textarea>` do DOM posicionado sobre o canvas (mesma tecnica de
// `campoTexto` em `comuns.js`, porem com suporte a varias linhas, selecao em
// lista, chips multiplos e envio de imagem).
//
// Por que um arquivo so:
//  - o AdminScene antes desenhava um `Text` do Phaser como se fosse input e
//    abria `window.prompt` ao clicar. O prompt e bloqueado em alguns
//    navegadores, some o foco do jogo e — o principal — nao deixa o jogador
//    VER o que esta digitando;
//  - repetir esse desenho em 7 abas significaria 7 conjuntos de coordenadas
//    divergentes. Aqui a geometria e calculada uma vez.
//
// CONVENCAO DE COORDENADAS: os campos sao posicionados em coordenadas ABSOLUTAS
// da cena. O container do campo NAO pode ser adicionado a um container
// deslocado, porque `Container.add()` NAO converte a posicao do filho para
// local nesta versao do Phaser — ela SOMA a posicao do pai. Use um container de
// agrupamento em (0, 0), que e o que o AdminScene faz.

import { Math as PhaserMath, Scenes as PhaserCenas } from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { caixaArredondada, botao, FONTE_UI } from './comuns.js';
import { enviarImagem, pareceUrlDeImagem, armazenamentoDisponivel } from '../core/armazenamento.js';

const ALTURA_ROTULO = 16;
const ALTURA_ENTRADA = 30;
const ALTURA_DICA = 15;
const VAO = 5;

// ---------- carregamento de imagem por URL ----------

/**
 * Baixa uma imagem de `url` e registra no gerenciador de texturas do Phaser.
 *
 * Devolve a chave da textura. Se a imagem nao pode ser baixada (404, CORS,
 * link quebrado) devolve `null` em vez de lancar — quem chama ja tem um
 * desenho procedural para exibir, e um console vermelho nao ajuda ninguem.
 */
export function texturaDeUrl(scene, url, chave) {
  if (!url) return null;
  if (scene.textures.exists(chave)) return chave;

  return new Promise((resolve) => {
    let encerrado = false;
    const finalizar = (resultado) => {
      if (encerrado) return;
      encerrado = true;
      resolve(resultado);
    };

    scene.load.image(chave, url);
    scene.load.once(`filecomplete-image-${chave}`, () => finalizar(chave));
    scene.load.once(`filecomplete-${chave}`, () => finalizar(chave));
    scene.load.once('loaderror', (file) => {
      if (file?.key !== chave) return;
      console.warn('[imagens] falha ao baixar', url);
      finalizar(null);
    });
    scene.load.start();
  });
}

// ---------- DOM: input e textarea sobrepostos ----------

/**
 * Cria o `<input>` ou `<textarea>` do DOM e o posiciona sobre o canvas.
 *
 * `Scale.RESIZE` com width/height '100%' faz UMA unidade da cena equivaler a UM
 * pixel CSS. Ainda assim medimos o `getBoundingClientRect` do canvas, porque ele
 * pode estar deslocado dentro do elemento pai.
 */
function criarElementoDom(scene, { x, y, largura, altura, valor, placeholder, multilinha, container }) {
  const canvas = scene.game.canvas;
  const pai = canvas.parentElement;
  if (!pai) return null;

  const el = document.createElement(multilinha ? 'textarea' : 'input');
  if (!multilinha) el.type = 'text';
  el.value = valor ?? '';
  el.placeholder = placeholder ?? '';
  el.autocomplete = 'off';
  el.spellcheck = false;

  const posicionar = () => {
    if (!container || !container.scene) return;
    // Coordenadas absolutas do container na cena -> pixels CSS no canvas
    const absX = container.x;
    const absY = container.y;
    const c = canvas.getBoundingClientRect();
    const p = pai.getBoundingClientRect();
    // Uma unidade de cena = 1 pixel CSS (ScaleManager RESIZE com 100%)
    el.style.left = `${c.left - p.left + absX + 9}px`;
    el.style.top = `${c.top - p.top + absY + 5}px`;
    el.style.width = `${Math.max(0, largura - 18)}px`;
    el.style.height = `${Math.max(10, altura - 10)}px`;
  };

  Object.assign(el.style, {
    position: 'absolute',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    color: PERGAMINHO,
    font: '13px system-ui, sans-serif',
    textAlign: 'left',
    lineHeight: '1.25',
    padding: '0',
    margin: '0',
    zIndex: '30',
  });
  posicionar();
  pai.appendChild(el);

  scene.scale.on(Phaser.Scale.RESIZE, posicionar);
  container.once('destroy', () => {
    scene.scale.off(Phaser.Scale.RESIZE, posicionar);
    el.remove();
  });
  return { el, posicionar };
}

// ---------- campo principal ----------

/**
 * Cria um campo de formulario.
 *
 * @param {Phaser.Scene} scene
 * @param {object} opcoes
 * @param {string} opcoes.rotulo
 * @param {number} opcoes.x            coordenada ABSOLUTA na cena
 * @param {number} opcoes.y
 * @param {number} [opcoes.largura=320]
 * @param {'texto'|'numero'|'area'|'select'|'multiselec'|'imagem'|'cor'} [opcoes.tipo='texto']
 * @param {*} [opcoes.valor]
 * @param {Array} [opcoes.opcoes]      para select/multiselec: strings ou {valor, rotulo}
 * @param {string} [opcoes.dica]
 * @param {boolean} [opcoes.obrigatorio]
 * @param {string} [opcoes.placeholder]
 * @param {boolean} [opcoes.multilinha]
 * @param {number} [opcoes.altura]      altura da caixa de digitacao
 * @param {string} [opcoes.pastaUpload] prefixo no Storage
 * @returns {object} controlador do campo
 */
export function criarCampo(scene, opcoes) {
  const {
    rotulo = '',
    x = 0,
    y = 0,
    largura = 320,
    tipo = 'texto',
    valor = null,
    opcoes: listaOpcoes = [],
    dica = '',
    obrigatorio = false,
    placeholder = '',
    multilinha = false,
    altura = ALTURA_ENTRADA,
    pastaUpload = 'imagens',
    aoMudar = null,
    chave = null,
  } = opcoes;

  const container = scene.add.container(x, y);
  const alturaCaixa = tipo === 'area' ? Math.max(altura, 68) : altura;

  // --- rotulo ---
  if (rotulo) {
    const t = scene.add
      .text(0, 0, rotulo + (obrigatorio ? '  *' : ''), {
        ...FONTE_UI,
        fontSize: '12px',
        color: obrigatorio ? OURO : PERGAMINHO,
      })
      .setOrigin(0, 0);
    t.setAlpha(obrigatorio ? 1 : 0.85);
    container.add(t);
  }

  const yCaixa = ALTURA_ROTULO;

  // Cada widget sabe a altura que realmente ocupou (chips quebram em varias
  // linhas, imagem tem preview, area cresce). Medir aqui em vez de estimar e o
  // que evita o campo seguinte cair em cima do conteudo — o mesmo defeito que a
  // tela de fabricacao tinha com os botoes.
  const construir = () => {
    switch (tipo) {
      case 'select':
        return campoSelect(scene, container, { x: 0, y: yCaixa, largura, altura: alturaCaixa, valor, opcoes: listaOpcoes, aoMudar, chave });
      case 'multiselec':
        return campoMultiselec(scene, container, { x: 0, y: yCaixa, largura, valor, opcoes: listaOpcoes, aoMudar, chave });
      case 'imagem':
        return campoImagem(scene, container, { x: 0, y: yCaixa, largura, valor, pastaUpload, aoMudar, chave });
      case 'pixelart':
        return campoPixelArt(scene, container, { x: 0, y: yCaixa, largura, valor, aoMudar, chave, tamanho: opcoes.tamanho ?? 32 });
      default:
        return campoDigitacao(scene, container, { x: 0, y: yCaixa, largura, altura: alturaCaixa, valor, tipo, placeholder, multilinha, aoMudar, chave });
    }
  };

  const widget = construir();
  const alturaOcupada = widget.altura ?? alturaCaixa;

  // A dica vem DEPOIS do widget porque so entao sabemos a altura real ocupada —
  // com chips multiplos em varias linhas ela descia no lugar errado.
  if (dica) {
    container.add(
      scene.add
        .text(0, ALTURA_ROTULO + alturaOcupada + 2, dica, {
          ...FONTE_UI,
          fontSize: '10px',
          color: '#9a8b78',
          wordWrap: { width: largura },
        })
        .setOrigin(0, 0)
        .setAlpha(0.85),
    );
  }

  return {
    container,
    altura: ALTURA_ROTULO + alturaOcupada + (dica ? ALTURA_DICA : 0) + VAO,
    largura,
    tipo,
    chave: opcoes.chave ?? null,
    valor: widget.obter,
    definir: widget.definir,
    focar: widget.focar ?? (() => {}),
    destruir() {
      widget.destruir?.();
      container.destroy(true);
    },
  };
}

// ---------- digitacao ----------

function campoDigitacao(scene, container, cfg) {
  const { x, y, largura, altura, valor, tipo, placeholder, multilinha, aoMudar, chave = null } = cfg;

  const caixa = caixaArredondada(scene, x, y, largura, altura, {
    raio: 7,
    preenchimento: 0x1a1410,
    borda: 0x4a3a28,
    larguraBorda: 1,
    origem: [0, 0],
  });
  container.add(caixa);

  const dom = criarElementoDom(scene, {
    x: x,
    y: y,
    largura,
    altura,
    valor: valor ?? '',
    placeholder,
    multilinha: multilinha || tipo === 'area',
    container,
  });

  const zone = scene.add
    .rectangle(x, y, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  const focar = () => dom?.el?.focus();

  // A moldura acende quando o campo esta em foco: sem isso nao ha como saber
  // "qual campo eu to digitando", porque o texto do DOM e o unico sinal.
  const piscar = () => {
    caixa.caixa.clear();
    caixa.caixa.fillStyle(0x241c14, 1);
    caixa.caixa.fillRoundedRect(0, 0, largura, altura, 7);
    caixa.caixa.lineStyle(2, OURO, 1);
    caixa.caixa.strokeRoundedRect(0, 0, largura, altura, 7);
  };
  const apagar = () => {
    caixa.caixa.clear();
    caixa.caixa.fillStyle(0x1a1410, 1);
    caixa.caixa.fillRoundedRect(0, 0, largura, altura, 7);
    caixa.caixa.lineStyle(1, 0x4a3a28, 1);
    caixa.caixa.strokeRoundedRect(0, 0, largura, altura, 7);
  };
  apagar();

  zone.on('pointerdown', focar);
  dom?.el?.addEventListener('focus', piscar);
  dom?.el?.addEventListener('blur', () => {
    apagar();
    aoMudar?.(ler());
  });
  dom?.el?.addEventListener('keydown', (ev) => {
    ev.stopPropagation(); // digitar "i" nao pode abrir a Mochila
    if (ev.key === 'Escape') dom.el.blur();
  });

  const ler = () => dom?.el?.value ?? '';

  // Foco persistente igual ao campoTexto.
  const marcarFoco = () => {
    scene._foco = { chave, inicio: dom?.el?.selectionStart ?? 0, fim: dom?.el?.selectionEnd ?? 0 };
  };
  dom?.el?.addEventListener('focus', marcarFoco);
  dom?.el?.addEventListener('keyup', () => { if (scene._foco?.chave === chave) marcarFoco(); });
  dom?.el?.addEventListener('click', () => { if (scene._foco?.chave === chave) marcarFoco(); });
  dom?.el?.addEventListener('blur', () => { if (scene._foco?.chave === chave) scene._foco = null; });

  return {
    obter: ler,
    definir(v) {
      if (dom?.el) dom.el.value = v ?? '';
    },
    chave,
    focar,
    /** Devolve o foco e o cursor a este campo. */
    restaurarFoco(inicio = 0, fim = inicio) {
      if (!dom?.el || dom.el.readOnly || dom.el.disabled) return false;
      if (!dom.el.isConnected) return false;
      dom.el.focus();
      const i = Math.min(inicio ?? 0, dom.el.value.length);
      const f = Math.min(fim ?? i, dom.el.value.length);
      try { dom.el.setSelectionRange(i, f); } catch {}
      return true;
    },
    destruir() {
      scene.scale.off(Phaser.Scale.Events.RESIZE, dom?.posicionar ?? (() => {}));
      dom?.el?.remove();
    },
  };
}

// ---------- selecao simples (lista suspensa) ----------

function normalizarOpcao(op) {
  if (op && typeof op === 'object') return { valor: op.valor ?? op.id, rotulo: op.rotulo ?? op.nome ?? String(op.valor) };
  return { valor: op, rotulo: String(op) };
}

function campoSelect(scene, container, cfg) {
  const { x, y, largura, altura, valor, opcoes = [], aoMudar } = cfg;

  let lista = (opcoes ?? []).map(normalizarOpcao);
  let selecionado = lista.find((o) => o.valor === valor)?.valor ?? lista[0]?.valor ?? null;

  const caixa = caixaArredondada(scene, x, y, largura, altura, {
    raio: 7,
    preenchimento: 0x1a1410,
    borda: 0x4a3a28,
    larguraBorda: 1,
    origem: [0, 0],
  });
  container.add(caixa);

  const rotulo = scene.add
    .text(x + 12, y + altura / 2, selecionado === null ? '—' : String(selecionado), {
      ...FONTE_UI,
      fontSize: '13px',
      color: PERGAMINHO,
    })
    .setOrigin(0, 0.5);
  container.add(rotulo);

  const seta = scene.add
    .text(x + largura - 18, y + altura / 2, '▾', { ...FONTE_UI, fontSize: '11px', color: OURO })
    .setOrigin(0.5);
  container.add(seta);

  const zone = scene.add
    .rectangle(x, y, largura, altura, 0xffffff, 0)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  container.add(zone);

  // A lista vive na RAIZ da cena: se ficasse dentro do container do campo (ou
  // de qualquer container deslocado) a posicao seria somada ao pai e a lista
  // apareceria deslocada — o mesmo bug do `Container.add()`.
  let popup = null;
  let desloca = 0;

  function fecharPopup() {
    if (!popup) return;
    popup.destroy(true);
    popup = null;
    scene.input.off('pointerdown', foraDoPopup);
  }

  function foraDoPopup(p) {
    if (popup?.hitAreaChildren) return; // clicou em algo nosso? deixa o item tratar
    const dentro = p.x >= x && p.x <= x + largura && p.y >= y && p.y <= y + altura;
    if (!dentro) fecharPopup();
  }

  function abrirPopup() {
    if (popup) {
      fecharPopup();
      return;
    }
    if (!lista.length) return;

    const alturaItem = 26;
    const maxVisiveis = 9;
    const alturaLista = Math.min(lista.length, maxVisiveis) * alturaItem + 8;

    // Abre para baixo; se nao couber, sobe.
    let yLista = y + altura + 4;
    if (yLista + alturaLista > scene.scale.height - 8) {
      yLista = Math.max(8, y - alturaLista - 4);
    }

    popup = scene.add.container(0, 0).setDepth(90000);

    popup.add(
      caixaArredondada(scene, x, yLista, largura, alturaLista, {
        raio: 8,
        preenchimento: 0x120e0a,
        borda: OURO,
        larguraBorda: 1,
        origem: [0, 0],
      }),
    );

    const clip = scene.add.container(0, 0);
    popup.add(clip);

    let ly = yLista + 4;
    const verTodos = lista.length > maxVisiveis;

    for (const op of lista) {
      const ativo = op.valor === selecionado;
      const item = scene.add
        .text(x + 12, ly + 6, `${ativo ? '▸ ' : '  '}${op.rotulo}`, {
          ...FONTE_UI,
          fontSize: '12px',
          color: ativo ? OURO : PERGAMINHO,
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      const fundo = scene.add
        .rectangle(x + 2, ly, largura - 4, alturaItem, 0xffffff, ativo ? 0.12 : 0)
        .setOrigin(0, 0);

      item.on('pointerover', () => fundo.setAlpha(1));
      fundo.on('pointerover', () => fundo.setAlpha(1));

      const escolher = () => {
        selecionado = op.valor;
        rotulo.setText(String(op.valor));
        fecharPopup();
        aoMudar?.(selecionado);
      };
      item.on('pointerdown', escolher);
      fundo.on('pointerdown', escolher);

      clip.add([fundo, item]);
      ly += alturaItem;
    }

    // Rolagem por roda do mouse quando a lista e maior que o espaco.
    if (verTodos) {
      const conteudo = lista.length * alturaItem + 8;
      const roda = scene.input.on('wheel', (_pointer, _objetos, _dx, _dy, deltaY) => {
        if (!popup) return;
        desloca = PhaserMath.Clamp(desloca - deltaY * 0.6, 0, conteudo - alturaLista);
        clip.setY(-desloca);
      });
      scene.events.once(PhaserCenas.Events.SHUTDOWN, () => roda.off?.('wheel', roda));
    }

    scene.input.once('pointerdown', foraDoPopup);
  }

  zone.on('pointerdown', abrirPopup);

  return {
    obter: () => selecionado,
    definir(v) {
      selecionado = lista.find((o) => o.valor === v)?.valor ?? selecionado;
      rotulo.setText(selecionado === null ? '—' : String(selecionado));
    },
    destruir() {
      fecharPopup();
    },
  };
}

// ---------- selecao multipla (chips) ----------

function campoMultiselec(scene, container, cfg) {
  const { x, y, largura, valor, opcoes = [], aoMudar } = cfg;

  let lista = (opcoes ?? []).map(normalizarOpcao);
  const selecionados = new Set(Array.isArray(valor) ? valor : valor ? [valor] : []);

  const area = scene.add.container(x, y);
  container.add(area);

  const ALTO_CHIP = 22;
  const VAO_CHIP = 5;

  const refazer = () => {
    area.removeAll(true);
    let cx = 0;
    let cy = 0;
    linhasUsadas = 1;

    for (const op of lista) {
      const medidor = scene.add.text(0, 0, op.rotulo, { ...FONTE_UI, fontSize: '11px' });
      const w = medidor.width + 20;
      medidor.destroy();

      if (cx > 0 && cx + w > largura) {
        cx = 0;
        cy += ALTO_CHIP + VAO_CHIP;
      }

      const ativo = selecionados.has(op.valor);
      const chipFundo = caixaArredondada(scene, cx, cy, w, ALTO_CHIP, {
        raio: 11,
        preenchimento: ativo ? 0xd4af6a : 0x241c14,
        borda: ativo ? 0xd4af6a : 0x4a3a28,
        larguraBorda: 1,
        origem: [0, 0],
      });
      const chipTexto = scene.add
        .text(cx + w / 2, cy + ALTO_CHIP / 2, op.rotulo, {
          ...FONTE_UI,
          fontSize: '11px',
          color: ativo ? '#14100c' : PERGAMINHO,
        })
        .setOrigin(0.5);
      const chipZone = scene.add
        .rectangle(cx, cy, w, ALTO_CHIP, 0xffffff, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });

      const alternar = () => {
        if (selecionados.has(op.valor)) selecionados.delete(op.valor);
        else selecionados.add(op.valor);
        refazer();
        aoMudar?.(Array.from(selecionados));
      };
      chipZone.on('pointerdown', alternar);

      area.add([chipFundo, chipTexto, chipZone]);
      linhasUsadas = Math.max(linhasUsadas, Math.round(cy / (ALTO_CHIP + VAO_CHIP)) + 1);
      cx += w + VAO_CHIP;
    }

    if (!lista.length) {
      area.add(
        scene.add
          .text(0, 0, '(sem opções cadastradas)', { ...FONTE_UI, fontSize: '11px', color: '#7a6b58' })
          .setOrigin(0, 0),
      );
    }

    // Altura = quantas linhas de chip realmente foram usadas. Estimar pela
    // largura total dava numero errado sempre que os rotulos quebravam.
    totalAlturaChip = (linhasUsadas - 1) * (ALTO_CHIP + VAO_CHIP) + ALTO_CHIP;
  };

  let totalAlturaChip = ALTURA_CHIP;
  let linhasUsadas = 1;
  refazer();

  return {
    obter: () => Array.from(selecionados),
    definir(v) {
      selecionados.clear();
      for (const o of Array.isArray(v) ? v : []) selecionados.add(o);
      refazer();
    },
    altura: totalAlturaChip,
    destruir() {
      area.destroy(true);
    },
  };
}

// ---------- imagem (upload / URL) ----------

function campoImagem(scene, container, cfg) {
  const { x, y, largura, valor, pastaUpload, aoMudar, chave = null } = cfg;

  let atual = String(valor ?? '');
  let chaveTextura = null;

  const PREVIEW = 74;
  const alturaTotal = PREVIEW + 26 + ALTURA_ENTRADA;

  // moldura do preview
  container.add(
    caixaArredondada(scene, x, y, largura, alturaTotal, {
      raio: 8,
      preenchimento: 0x1a1410,
      borda: 0x4a3a28,
      larguraBorda: 1,
      origem: [0, 0],
    }),
  );

  container.add(
    caixaArredondada(scene, x + 6, y + 6, PREVIEW, PREVIEW, {
      raio: 6,
      preenchimento: 0x0f0b07,
      borda: 0x3a2c20,
      larguraBorda: 1,
      origem: [0, 0],
    }),
  );

  const img = scene.add.image(x + 6 + PREVIEW / 2, y + 6 + PREVIEW / 2, 'painel').setDisplaySize(PREVIEW - 12, PREVIEW - 12);
  container.add(img);

  const rotSemImagem = scene.add
    .text(x + 6 + PREVIEW / 2, y + 6 + PREVIEW / 2, 'sem imagem', {
      ...FONTE_UI,
      fontSize: '10px',
      color: '#6a5a48',
    })
    .setOrigin(0.5);
  container.add(rotSemImagem);

  // --- botoes ---
  const bx = x + PREVIEW + 16;
  const bLarg = largura - PREVIEW - 22;
  const bAltura = 24;

  const inputArquivo = document.createElement('input');
  inputArquivo.type = 'file';
  inputArquivo.accept = 'image/*';
  inputArquivo.style.display = 'none';
  scene.game.canvas.parentElement?.appendChild(inputArquivo);

  const aviso = scene.add
    .text(bx, y + 2, armazenamentoDisponivel() ? '' : 'Storage não configurado — use colar URL', {
      ...FONTE_UI,
      fontSize: '10px',
      color: '#c9a05a',
    })
    .setOrigin(0, 0);
  container.add(aviso);

  const btnEnviar = botao(scene, bx + bLarg / 2, y + 16 + bAltura / 2, 'Enviar arquivo…', () => inputArquivo.click(), {
    largura: bLarg,
    altura: bAltura,
    tamanho: '12px',
  });
  container.add(btnEnviar.container);

  const btnLimpar = botao(scene, bx + bLarg / 2, y + 16 + bAltura + 6 + bAltura / 2, 'Remover imagem', () => {
    atual = '';
    chaveTextura = null;
    dom.el.value = '';
    img.setTexture('painel').clearTint();
    rotSemImagem.setVisible(true);
    aviso.setText('');
    aoMudar?.(atual);
  }, {
    largura: bLarg,
    altura: bAltura,
    tamanho: '12px',
    cor: 0x3a2c20,
    corHover: 0x4a3828,
    corTexto: '#c9a05a',
  });
  container.add(btnLimpar.container);

  // --- campo de URL ---
  const dom = criarElementoDom(scene, {
    x: bx,
    y: y + 16 + bAltura * 2 + 12,
    largura: bLarg,
    altura: ALTURA_ENTRADA,
    valor: atual,
    placeholder: 'ou cole a URL da imagem',
    container,
  });

  const aplicarUrl = (url) => {
    atual = String(url ?? '').trim();
    rotSemImagem.setVisible(!atual);
    aviso.setText('');
    if (dom.el.value !== atual) dom.el.value = atual;

    if (!atual || !pareceUrlDeImagem(atual)) {
      img.setTexture('painel').clearTint();
      chaveTextura = null;
      if (atual) aviso.setText('Não parece uma URL de imagem válida.');
      aoMudar?.(atual);
      return;
    }

    chaveTextura = `upload_preview_${Math.abs(hash(atual))}`;
    texturaDeUrl(scene, atual, chaveTextura).then((chave) => {
      if (!chave || dom.el.value !== atual) return;
      chaveTextura = chave;
      img.setTexture(chave).clearTint();
      rotSemImagem.setVisible(false);
      aviso.setText('');
    });
    aoMudar?.(atual);
  };

  dom?.el?.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      aplicarUrl(dom.el.value);
      dom.el.blur();
    }
  });
  dom?.el?.addEventListener('change', () => aplicarUrl(dom.el.value));
  dom?.el?.addEventListener('blur', () => aplicarUrl(dom.el.value));

  inputArquivo.addEventListener('change', async () => {
    const arquivo = inputArquivo.files?.[0];
    inputArquivo.value = '';
    if (!arquivo) return;

    // Preview instantaneo: mostra na hora o que o admin escolheu, sem esperar
    // upload. O Phaser carrega via data URL, entao funciona mesmo sem Storage.
    const leitura = new FileReader();
    leitura.onload = () => {
      const dataUrl = String(leitura.result ?? '');
      if (!dataUrl) return;
      const chaveLocal = `upload_local_${Date.now()}`;
      texturaDeUrl(scene, dataUrl, chaveLocal).then((chave) => {
        if (!chave) return;
        chaveTextura = chave;
        img.setTexture(chave).clearTint();
        rotSemImagem.setVisible(false);
      });
    };
    leitura.readAsDataURL(arquivo);

    if (!armazenamentoDisponivel()) {
      aviso.setText('Storage não configurado — guarde a imagem fora e cole a URL.');
      return;
    }

    aviso.setText('Enviando…');
    btnEnviar.definirVisual(0x8a6a2f);
    try {
      const url = await enviarImagem(arquivo, pastaUpload);
      aplicarUrl(url);
      aviso.setText('Enviada. Salve o registro para gravar a URL.');
    } catch (erro) {
      aviso.setText('Falha no envio: ' + (erro?.message ?? erro));
      btnEnviar.definirVisual(0xd4af6a);
    }
  });

  aplicarUrl(atual);

  // Foco persistente igual ao campoTexto.
  const marcarFoco = () => {
    scene._foco = { chave, inicio: dom?.el?.selectionStart ?? 0, fim: dom?.el?.selectionEnd ?? 0 };
  };
  dom?.el?.addEventListener('focus', marcarFoco);
  dom?.el?.addEventListener('keyup', () => { if (scene._foco?.chave === chave) marcarFoco(); });
  dom?.el?.addEventListener('click', () => { if (scene._foco?.chave === chave) marcarFoco(); });
  dom?.el?.addEventListener('blur', () => { if (scene._foco?.chave === chave) scene._foco = null; });

  return {
    obter: () => atual,
    definir(v) {
      aplicarUrl(v);
    },
    chave,
    focar: () => dom?.el?.focus(),
    /** Devolve o foco e o cursor a este campo. */
    restaurarFoco(inicio = 0, fim = inicio) {
      if (!dom?.el || dom.el.readOnly || dom.el.disabled) return false;
      if (!dom.el.isConnected) return false;
      dom.el.focus();
      const i = Math.min(inicio ?? 0, dom.el.value.length);
      const f = Math.min(fim ?? i, dom.el.value.length);
      try { dom.el.setSelectionRange(i, f); } catch {}
      return true;
    },
    destruir() {
      inputArquivo.remove();
      dom?.el?.remove();
    },
  };
}

function hash(texto) {
  let h = 0;
  const s = String(texto);
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// =====================================================================
// Editor de Pixel Art (admin) — canvas 32x32 com zoom, paleta, ferramentas
// =====================================================================

/**
 * Editor de pixel art embutido no formulário do admin.
 * - Canvas 32x32 (ou 16x16) com zoom (1x a 16x)
 * - Paleta de 16 cores + color picker customizado
 * - Ferramentas: pincel, balde (flood fill), conta-gotas, borracha, limpar
 * - Camada única, fundo transparente opcional
 * - Exporta data URL (PNG base64) → sobe pro Storage
 * - Preview em tempo real (imagem 1:1 ao lado)
 *
 * O valor armazenado é a data URL (base64 PNG). Se vazio, string vazia.
 */
function campoPixelArt(scene, container, cfg) {
  const { x, y, largura, valor, aoMudar, chave = null, tamanho = 32 } = cfg;
  const TAM = Math.max(16, Math.min(64, tamanho)); // 16, 32 ou 64
  const ZOOM_MIN = 1, ZOOM_MAX = 16;
  let zoom = 8;
  let corAtual = '#000000';
  let ferramenta = 'pincel'; // 'pincel' | 'balde' | 'conta-gotas' | 'borracha'
  let mousePressionado = false;

  // Paleta padrão (16 cores estilo pixel art)
  const PALETA_PADRAO = [
    '#000000', '#1d2b53', '#7e2553', '#008751',
    '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436',
    '#29adff', '#83769c', '#ff77a8', '#ffccaa',
  ];

  // Estado do canvas (array 1D: RGBA por pixel)
  const totalPixels = TAM * TAM;
  const pixels = new Uint8ClampedArray(totalPixels * 4); // RGBA

  // Carrega valor inicial se for data URL
  if (valor && typeof valor === 'string' && valor.startsWith('data:image')) {
    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = TAM; tempCanvas.height = TAM;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, TAM, TAM);
      const data = ctx.getImageData(0, 0, TAM, TAM);
      pixels.set(data.data);
      redesenharCanvas();
    };
    img.src = valor;
  }

  // Container Phaser para o editor
  const editorContainer = scene.add.container(x, y);

  // Canvas do editor (offscreen para lógica, onscreen para display)
  const canvasEditor = document.createElement('canvas');
  canvasEditor.width = TAM; canvasEditor.height = TAM;
  canvasEditor.style.imageRendering = 'pixelated';
  const ctxEditor = canvasEditor.getContext('2d');

  // Canvas de preview 1:1 (mostra tamanho real)
  const canvasPreview = document.createElement('canvas');
  canvasPreview.width = TAM; canvasPreview.height = TAM;
  canvasPreview.style.imageRendering = 'pixelated';
  canvasPreview.style.border = '1px solid #4a3a28';
  const ctxPreview = canvasPreview.getContext('2d');

  // Canvas zoomado (o que o usuário vê e clica)
  const canvasZoom = document.createElement('canvas');
  canvasZoom.width = TAM * zoom; canvasZoom.height = TAM * zoom;
  canvasZoom.style.imageRendering = 'pixelated';
  canvasZoom.style.border = '2px solid #4a3a28';
  canvasZoom.style.background = '#0f0b07';
  canvasZoom.style.cursor = 'crosshair';
  const ctxZoom = canvasZoom.getContext('2d');

  // DOM elements para UI
  const uiDiv = document.createElement('div');
  uiDiv.style.cssText = 'position: absolute; display: flex; flex-direction: column; gap: 8px; font-family: system-ui, sans-serif; font-size: 11px; color: #e8dcc8;';

  // Paleta de cores
  const paletaDiv = document.createElement('div');
  paletaDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
  PALETA_PADRAO.forEach(cor => {
    const btn = document.createElement('button');
    btn.style.cssText = 'width: 20px; height: 20px; border: 2px solid #3a2c20; background: ' + cor + '; cursor: pointer; border-radius: 2px;';
    if (cor === corAtual) btn.style.boxShadow = '0 0 0 2px #d4af6a';
    btn.onclick = () => { corAtual = cor; ferramenta = 'pincel'; atualizarPaletaUI(); };
    paletaDiv.appendChild(btn);
  });

  // Color picker customizado
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color'; colorPicker.value = corAtual;
  colorPicker.style.cssText = 'width: 44px; height: 24px; border: none; cursor: pointer;';
  colorPicker.onchange = (e) => { corAtual = e.target.value; ferramenta = 'pincel'; atualizarPaletaUI(); };

  // Seletor de ferramenta
  const ferramentasDiv = document.createElement('div');
  ferramentasDiv.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';
  const ferramentas = [
    { id: 'pincel', label: 'Pincel', titulo: 'Desenha pixel a pixel (B)' },
    { id: 'balde', label: 'Balde', titulo: 'Preenche área contígua (G)' },
    { id: 'conta-gotas', label: 'Conta-gotas', titulo: 'Copiar cor do pixel (Alt+clique)' },
    { id: 'borracha', label: 'Borracha', titulo: 'Apaga para transparente (E)' },
    { id: 'limpar', label: 'Limpar', titulo: 'Limpa todo o canvas (Ctrl+L)' },
  ];
  const botoesFerramenta = {};
  ferramentas.forEach(f => {
    const btn = document.createElement('button');
    btn.textContent = f.label; btn.title = f.titulo;
    btn.style.cssText = 'padding: 4px 8px; border: 2px solid #3a2c20; background: #1a1410; color: #e8dcc8; cursor: pointer; border-radius: 4px; font-size: 10px;';
    if (f.id === ferramenta) btn.style.boxShadow = '0 0 0 2px #d4af6a';
    btn.onclick = () => { if (f.id === 'limpar') { limparCanvas(); } else { ferramenta = f.id; atualizarFerramentasUI(); } };
    botoesFerramenta[f.id] = btn; ferramentasDiv.appendChild(btn);
  });

  // Controles de zoom
  const zoomDiv = document.createElement('div'); zoomDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const zoomLabel = document.createElement('span'); zoomLabel.textContent = 'Zoom: ' + zoom + 'x';
  const zoomIn = document.createElement('button'); zoomIn.textContent = '+'; zoomIn.onclick = () => { if (zoom < ZOOM_MAX) { zoom++; atualizarZoom(); } };
  const zoomOut = document.createElement('button'); zoomOut.textContent = '-'; zoomOut.onclick = () => { if (zoom > ZOOM_MIN) { zoom--; atualizarZoom(); } };
  zoomDiv.append(zoomLabel, zoomOut, zoomIn);

  // Checkbox fundo transparente
  const transparenteDiv = document.createElement('label');
  transparenteDiv.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';
  const chkTransparente = document.createElement('input'); chkTransparente.type = 'checkbox'; chkTransparente.checked = true;
  chkTransparente.onchange = () => { redesenharCanvas(); };
  transparenteDiv.append(chkTransparente, document.createTextNode('Fundo transparente'));

  // Botão exportar/limpar
  const acoesDiv = document.createElement('div'); acoesDiv.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';
  const btnExportar = document.createElement('button'); btnExportar.textContent = 'Exportar PNG'; btnExportar.style.cssText = 'padding: 4px 10px; background: #8a6a2f; color: #14100c; border: none; border-radius: 4px; cursor: pointer;'; btnExportar.onclick = exportarPNG;
  const btnLimpar = document.createElement('button'); btnLimpar.textContent = 'Limpar Tudo'; btnLimpar.style.cssText = 'padding: 4px 10px; background: #7a2f2a; color: #ffe6e0; border: none; border-radius: 4px; cursor: pointer;'; btnLimpar.onclick = limparCanvas;
  acoesDiv.append(btnExportar, btnLimpar);

  // Monta UI
  uiDiv.append(document.createTextNode('Paleta:'), paletaDiv, document.createTextNode('Cor customizada:'), colorPicker, document.createTextNode('Ferramentas:'), ferramentasDiv, zoomDiv, transparenteDiv, acoesDiv, document.createTextNode('Preview 1:1:'), canvasPreview);

  // Posiciona UI no DOM
  const canvas = scene.game.canvas; const pai = canvas.parentElement;
  const posicionarUI = () => { if (!pai) return; const c = canvas.getBoundingClientRect(); const p = pai.getBoundingClientRect(); uiDiv.style.left = (c.left - p.left + x + largura + 16) + 'px'; uiDiv.style.top = (c.top - p.top + y) + 'px'; uiDiv.style.zIndex = '30'; };
  posicionarUI(); scene.scale.on(Phaser.Scale.RESIZE, posicionarUI); pai.appendChild(uiDiv);

  // Adiciona canvas zoomado ao Phaser como texture dinâmica
  const chaveTextura = 'pixelart_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  scene.textures.addCanvas(chaveTextura, canvasZoom);
  const spriteZoom = scene.add.image(x, y, chaveTextura).setOrigin(0, 0);
  container.add(spriteZoom);

  function atualizarTexturaPhaser() { if (scene.textures.exists(chaveTextura)) { scene.textures.remove(chaveTextura); } scene.textures.addCanvas(chaveTextura, canvasZoom); spriteZoom.setTexture(chaveTextura); }
  function atualizarZoom() { canvasZoom.width = TAM * zoom; canvasZoom.height = TAM * zoom; canvasZoom.style.width = (TAM * zoom) + 'px'; canvasZoom.style.height = (TAM * zoom) + 'px'; zoomLabel.textContent = 'Zoom: ' + zoom + 'x'; redesenharZoom(); atualizarTexturaPhaser(); }
  function atualizarPaletaUI() { paletaDiv.querySelectorAll('button').forEach(btn => { const cor = btn.style.backgroundColor; btn.style.boxShadow = cor === corAtual ? '0 0 0 2px #d4af6a' : 'none'; }); Object.values(botoesFerramenta).forEach(btn => btn.style.boxShadow = 'none'); const btnFerramenta = botoesFerramenta[ferramenta]; if (btnFerramenta) btnFerramenta.style.boxShadow = '0 0 0 2px #d4af6a'; }
  function atualizarFerramentasUI() { atualizarPaletaUI(); }
  function hexParaRgba(hex) { const h = hex.replace('#', ''); const r = parseInt(h.slice(0,2),16); const g = parseInt(h.slice(2,4),16); const b = parseInt(h.slice(4,6),16); return [r,g,b,255]; }
  function pegarCorPixel(px, py) { const idx = (py * TAM + px) * 4; const a = pixels[idx+3]; if (a === 0) return null; const r = pixels[idx], g = pixels[idx+1], b = pixels[idx+2]; return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join(''); }
  function setPixel(px, py, rgba) { if (px < 0 || px >= TAM || py < 0 || py >= TAM) return; const idx = (py * TAM + px) * 4; pixels[idx]=rgba[0]; pixels[idx+1]=rgba[1]; pixels[idx+2]=rgba[2]; pixels[idx+3]=rgba[3]; }
  function floodFill(startX, startY, corNova) { const corAlvo = pegarCorPixel(startX, startY); const novaRgba = hexParaRgba(corNova); if (corAlvo === corNova) return; const visitados = new Set(); const fila = [[startX, startY]]; const alvoHex = corAlvo; while (fila.length) { const [x,y] = fila.pop(); const key = x + ',' + y; if (visitados.has(key)) continue; visitados.add(key); const atual = pegarCorPixel(x,y); if (atual !== alvoHex) continue; setPixel(x,y,novaRgba); if (x>0) fila.push([x-1,y]); if (x<TAM-1) fila.push([x+1,y]); if (y>0) fila.push([x,y-1]); if (y<TAM-1) fila.push([x,y+1]); } redesenharTudo(); }
  function limparCanvas() { pixels.fill(0); redesenharTudo(); aoMudar?.(''); }
  function exportarPNG() { const exportCanvas = document.createElement('canvas'); exportCanvas.width = TAM; exportCanvas.height = TAM; const ctx = exportCanvas.getContext('2d'); const imgData = new ImageData(pixels, TAM, TAM); ctx.putImageData(imgData, 0, 0); const dataUrl = exportCanvas.toDataURL('image/png'); ctxPreview.putImageData(imgData, 0, 0); aoMudar?.(dataUrl); }
  function redesenharCanvas() { ctxEditor.clearRect(0,0,TAM,TAM); if (!chkTransparente.checked) { ctxEditor.fillStyle = '#1a1410'; ctxEditor.fillRect(0,0,TAM,TAM); } ctxEditor.putImageData(new ImageData(pixels.slice(), TAM, TAM), 0, 0); redesenharZoom(); redesenharPreview(); }
  function redesenharZoom() { ctxZoom.clearRect(0,0,canvasZoom.width,canvasZoom.height); ctxZoom.fillStyle = '#0f0b07'; ctxZoom.fillRect(0,0,canvasZoom.width,canvasZoom.height); ctxZoom.strokeStyle = '#2a2018'; ctxZoom.lineWidth = 1; for (let i=0;i<=TAM;i++) { const pos = i * zoom; ctxZoom.beginPath(); ctxZoom.moveTo(pos,0); ctxZoom.lineTo(pos,TAM*zoom); ctxZoom.moveTo(0,pos); ctxZoom.lineTo(TAM*zoom,pos); ctxZoom.stroke(); } ctxZoom.drawImage(canvasEditor, 0, 0, TAM*zoom, TAM*zoom); atualizarTexturaPhaser(); }
  function redesenharPreview() { ctxPreview.clearRect(0,0,TAM,TAM); if (!chkTransparente.checked) { ctxPreview.fillStyle = '#1a1410'; ctxPreview.fillRect(0,0,TAM,TAM); } ctxPreview.putImageData(new ImageData(pixels.slice(), TAM, TAM), 0, 0); }
  function redesenharTudo() { redesenharCanvas(); atualizarTexturaPhaser(); }
  function getCanvasPos(e) { const rect = canvasZoom.getBoundingClientRect(); const scaleX = canvasZoom.width / rect.width; const scaleY = canvasZoom.height / rect.height; const x = Math.floor((e.clientX - rect.left) * scaleX / zoom); const y = Math.floor((e.clientY - rect.top) * scaleY / zoom); return { x: Math.max(0, Math.min(TAM-1, x)), y: Math.max(0, Math.min(TAM-1, y)) }; }
  canvasZoom.addEventListener('mousedown', (e) => { e.preventDefault(); const {x,y} = getCanvasPos(e); if (e.altKey || e.button === 2) { const cor = pegarCorPixel(x,y); if (cor) { corAtual = cor; colorPicker.value = corAtual; ferramenta = 'pincel'; atualizarPaletaUI(); } return; } mousePressionado = true; aplicarFerramenta(x,y); });
  canvasZoom.addEventListener('mousemove', (e) => { if (!mousePressionado) return; const {x,y} = getCanvasPos(e); aplicarFerramenta(x,y); });
  window.addEventListener('mouseup', () => { mousePressionado = false; });
  canvasZoom.addEventListener('contextmenu', (e) => e.preventDefault());
  function aplicarFerramenta(px, py) { const rgba = hexParaRgba(corAtual); switch (ferramenta) { case 'pincel': setPixel(px,py,rgba); break; case 'borracha': setPixel(px,py,[0,0,0,0]); break; case 'balde': floodFill(px,py,corAtual); return; } redesenharTudo(); }
  const atalhos = { b: () => { ferramenta = 'pincel'; atualizarFerramentasUI(); }, g: () => { ferramenta = 'balde'; atualizarFerramentasUI(); }, e: () => { ferramenta = 'borracha'; atualizarFerramentasUI(); } };
  const keydownHandler = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return; if (atalhos[e.key.toLowerCase()]) atalhos[e.key.toLowerCase()](); if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); limparCanvas(); } };
  window.addEventListener('keydown', keydownHandler);
  redesenharCanvas();
  const cleanup = () => { window.removeEventListener('keydown', keydownHandler); scene.scale.off(Phaser.Scale.RESIZE, posicionarUI); uiDiv.remove(); if (scene.textures.exists(chaveTextura)) scene.textures.remove(chaveTextura); };
  const marcarFoco = () => { scene._foco = { chave, inicio: 0, fim: 0 }; };
  canvasZoom.addEventListener('click', marcarFoco);
  return { container: editorContainer, altura: Math.max(TAM * zoom + 20, 400), largura: largura, tipo: 'pixelart', chave, obter: () => { const exportCanvas = document.createElement('canvas'); exportCanvas.width = TAM; exportCanvas.height = TAM; const ctx = exportCanvas.getContext('2d'); if (!chkTransparente.checked) { ctx.fillStyle = '#1a1410'; ctx.fillRect(0,0,TAM,TAM); } ctx.putImageData(new ImageData(pixels.slice(), TAM, TAM), 0, 0); return exportCanvas.toDataURL('image/png'); }, definir(v) { if (!v || !v.startsWith('data:image')) return; const img = new Image(); img.onload = () => { const tempCanvas = document.createElement('canvas'); tempCanvas.width = TAM; tempCanvas.height = TAM; const ctx = tempCanvas.getContext('2d'); ctx.drawImage(img, 0, 0, TAM, TAM); const data = ctx.getImageData(0, 0, TAM, TAM); pixels.set(data.data); redesenharTudo(); }; img.src = v; }, chave, focar: () => { marcarFoco(); }, restaurarFoco() { marcarFoco(); return true; }, destruir: cleanup };
}