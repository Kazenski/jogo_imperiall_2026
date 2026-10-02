import Phaser from 'phaser';
import {
  repoItens,
  repoClasses,
  repoSkills,
  repoRecipes,
  repoMonstros,
  repoWorldTemplates,
  repoAchievements,
  repoUsuarios,
  repoPortais,
  listarAdmins,
  definirAdminUid,
} from '../core/repos.js';
import { ehAdmin } from '../core/usuarios.js';
import { enviarImagem, pareceUrlDeImagem } from '../core/armazenamento.js';
import {
  CAMPOS_ITEM,
  CAMPOS_CLASSE,
  CAMPOS_MONSTRO,
  CAMPOS_RECEITA,
  CAMPOS_REINO,
  CAMPOS_CONQUISTA,
  CAMPOS_TALENTO,
  RESUMO,
  serializadores,
} from '../dados/schemaAdmin.js';

// =====================================================================
//  AdminScene — painel administrativo em DOM puro.
//
//  Antes tudo era desenhado em cima do canvas do Phaser e os campos de texto
//  eram <input> soltos posicionados "na mão" sobre o canvas. O resultado:
//  inputs desalinhados, texto sobreposto ao rótulo, seletores quebrados e um
//  leque de bugs de foco. Agora o admin é uma camada HTML/CSS organizada —
//  formulários nativos, seletores reais, preview ao lado — como um painel
//  web qualquer, mas embutido no jogo.
// =====================================================================

const ABAS = [
  { id: 'itens', label: 'Itens', icone: '🎒', repo: repoItens, cache: 'itens', campos: CAMPOS_ITEM, resumo: RESUMO.itens, buscar: true },
  { id: 'classes', label: 'Classes', icone: '🛡️', repo: repoClasses, cache: 'classes', campos: CAMPOS_CLASSE, resumo: RESUMO.classes, buscar: true },
  { id: 'talentos', label: 'Talentos', icone: '✨', repo: repoSkills, cache: 'talentos', campos: CAMPOS_TALENTO, resumo: RESUMO.talentos, buscar: true, filtroClasse: true },
  { id: 'monstros', label: 'Monstros', icone: '👹', repo: repoMonstros, cache: 'monstros', campos: CAMPOS_MONSTRO, resumo: RESUMO.monstros, buscar: true },
  { id: 'receitas', label: 'Receitas', icone: '📜', repo: repoRecipes, cache: 'receitas', campos: CAMPOS_RECEITA, resumo: RESUMO.receitas },
  { id: 'reinos', label: 'Reinos', icone: '🏰', repo: repoWorldTemplates, cache: 'reinos', campos: CAMPOS_REINO, resumo: RESUMO.reinos },
  { id: 'conquistas', label: 'Conquistas', icone: '🏆', repo: repoAchievements, cache: 'conquistas', campos: CAMPOS_CONQUISTA, resumo: RESUMO.conquistas },
  { id: 'portais', label: 'Portais', icone: '🌀', especial: 'portais' },
  { id: 'jogadores', label: 'Jogadores', icone: '👥', especial: 'jogadores' },
  { id: 'estatisticas', label: 'Estatísticas', icone: '📊', especial: 'estatisticas' },
];

const CSS = `
#adminOverlay{position:absolute;inset:0;z-index:200;background:#eef1f5;display:flex;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b3440}
#adminOverlay *{box-sizing:border-box}
#adminOverlay .sidebar{width:212px;min-width:212px;background:linear-gradient(180deg,#7ba23f,#6b9136);color:#fff;display:flex;flex-direction:column;padding:14px 0}
#adminOverlay .logo{padding:0 18px 14px;font-weight:800;font-size:15px;letter-spacing:.5px}
#adminOverlay .logo small{display:block;font-weight:400;font-size:10px;opacity:.85}
#adminOverlay nav{flex:1;overflow-y:auto}
#adminOverlay .nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;font-size:13px;opacity:.95}
#adminOverlay .nav-item:hover{background:rgba(255,255,255,.14)}
#adminOverlay .nav-item.ativo{background:rgba(0,0,0,.18);font-weight:700;border-left:4px solid #fff}
#adminOverlay .main{flex:1;display:flex;flex-direction:column;min-width:0}
#adminOverlay .topo{background:#fff;border-bottom:1px solid #dde3ea;padding:12px 20px;display:flex;align-items:center;gap:14px}
#adminOverlay .topo h1{margin:0;font-size:17px;color:#233240}
#adminOverlay .topo .status{flex:1;font-size:12px;color:#5a6a78}
#adminOverlay .btn-fechar{border:1px solid #c9d2dc;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px}
#adminOverlay .btn-fechar:hover{background:#f2f5f8}
#adminOverlay .conteudo{flex:1;overflow:auto;padding:16px 20px}
#adminOverlay .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:18px}
#adminOverlay .card{border-radius:8px;padding:16px;color:#fff;position:relative;overflow:hidden;min-height:86px}
#adminOverlay .card h2{margin:0;font-size:26px}
#adminOverlay .card p{margin:4px 0 0;font-size:12px;opacity:.9}
#adminOverlay .card.escuro{background:#344052}
#adminOverlay .card.teal{background:#2bb3a3}
#adminOverlay .card.azul{background:#4a90d9}
#adminOverlay .bar-linha{margin:6px 0}
#adminOverlay .bar-fundo{background:#dfe5ec;border-radius:4px;height:10px;overflow:hidden}
#adminOverlay .bar-cheio{background:#2bb3a3;height:100%}
#adminOverlay .grid-catalogo{display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:16px}
#adminOverlay .painel{background:#fff;border:1px solid #dde3ea;border-radius:8px;padding:12px}
#adminOverlay .painel h3{margin:0 0 10px;font-size:13px;color:#33404d;text-transform:uppercase;letter-spacing:.4px}
#adminOverlay .busca input,#adminOverlay .busca select{width:100%;padding:7px 9px;border:1px solid #ccd5de;border-radius:6px;font-size:12px;margin-bottom:8px}
#adminOverlay .linha-item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;cursor:pointer;border:1px solid transparent}
#adminOverlay .linha-item:hover{background:#f4f7fa}
#adminOverlay .linha-item.sel{background:#e8f6f3;border-color:#2bb3a3}
#adminOverlay .linha-item img{width:30px;height:30px;border-radius:6px;object-fit:cover;background:#e8edf2}
#adminOverlay .linha-item .nome{font-size:13px;font-weight:600;color:#2b3440}
#adminOverlay .linha-item .detalhe{font-size:11px;color:#7b8794}
#adminOverlay .linha-item .x{margin-left:auto;color:#c96a5a;cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px}
#adminOverlay .linha-item .x:hover{background:#fbe9e6}
#adminOverlay .btn-novo{width:100%;margin-top:10px;padding:9px;border:none;border-radius:6px;background:#2bb3a3;color:#fff;font-weight:700;cursor:pointer}
#adminOverlay .btn-novo:hover{background:#25a291}
#adminOverlay label.campo{display:block;margin-bottom:12px}
#adminOverlay label.campo span{display:block;font-size:11px;color:#5a6a78;margin-bottom:4px;font-weight:600}
#adminOverlay input[type=text],#adminOverlay input[type=number],#adminOverlay textarea,#adminOverlay select{width:100%;padding:8px 10px;border:1px solid #ccd5de;border-radius:6px;font-size:13px;background:#fff;color:#2b3440}
#adminOverlay input:focus,#adminOverlay textarea:focus,#adminOverlay select:focus{outline:none;border-color:#2bb3a3;box-shadow:0 0 0 2px rgba(43,179,163,.15)}
#adminOverlay textarea{min-height:80px;resize:vertical}
#adminOverlay .dica{font-size:10px;color:#93a1ad;margin-top:3px}
#adminOverlay .chips{display:flex;flex-wrap:wrap;gap:6px}
#adminOverlay .chip{border:1px solid #ccd5de;border-radius:14px;padding:4px 10px;font-size:12px;cursor:pointer;background:#fff}
#adminOverlay .chip.on{background:#2bb3a3;border-color:#2bb3a3;color:#fff}
#adminOverlay .img-preview{width:100%;aspect-ratio:1/1;background:#f2f5f8;border:1px dashed #ccd5de;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px}
#adminOverlay .img-preview img{width:100%;height:100%;object-fit:cover}
#adminOverlay .acoes{display:flex;gap:10px;margin-top:6px}
#adminOverlay .btn-primario{background:#2bb3a3;color:#fff;border:none;border-radius:6px;padding:9px 16px;font-weight:700;cursor:pointer}
#adminOverlay .btn-primario:hover{background:#25a291}
#adminOverlay .btn-secundario{background:#fff;border:1px solid #c9d2dc;border-radius:6px;padding:9px 16px;cursor:pointer}
#adminOverlay .btn-perigo{background:#fdeae7;border:1px solid #f0c3bc;color:#b4453a;border-radius:6px;padding:9px 16px;cursor:pointer}
#adminOverlay table{width:100%;border-collapse:collapse;font-size:12px}
#adminOverlay th,#adminOverlay td{padding:8px 10px;border-bottom:1px solid #e4e9f0;text-align:left}
#adminOverlay th{color:#5a6a78;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
`;

function normalizarOpcao(op) {
  if (op && typeof op === 'object') return { valor: op.valor ?? op.id, rotulo: op.rotulo ?? op.nome ?? String(op.valor) };
  return { valor: op, rotulo: String(op) };
}

function rotuloDe(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v ?? '');
}

export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.meuNome = dados?.nome ?? null;
  }

  create() {
    this.caches = {};
    this.selecionado = null;
    this.abaAtual = 'itens';
    this.filtroClasse = '';
    this.busca = '';

    this.cameras.main.setBackgroundColor('#0a0705');

    this.montarOverlay();

    this.keyF2 = (ev) => {
      if (ev.key === 'F2') this.fechar();
    };
    this.keyEsc = (ev) => {
      if (ev.key === 'Escape') {
        if (this.selecionado) {
          this.selecionado = null;
          this.renderizarConteudo();
        } else {
          this.fechar();
        }
      }
    };
    window.addEventListener('keydown', this.keyF2);
    window.addEventListener('keydown', this.keyEsc);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.keyF2);
      window.removeEventListener('keydown', this.keyEsc);
      this.overlay?.remove();
      this.overlay = null;
    });
  }

  fechar() {
    this.scene.stop('Admin');
  }

  montarOverlay() {
    const pai = this.game.canvas.parentElement;
    if (!pai) return;

    if (!document.getElementById('adminCss')) {
      const style = document.createElement('style');
      style.id = 'adminCss';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'adminOverlay';

    overlay.innerHTML = `
      <aside class="sidebar">
        <div class="logo">IMPÉRIUM<small>painel admin</small></div>
        <nav id="adminNav"></nav>
      </aside>
      <div class="main">
        <div class="topo">
          <h1 id="adminTitulo">Itens</h1>
          <div class="status" id="adminStatus"></div>
          <button class="btn-fechar" id="adminFechar">Fechar [F2]</button>
        </div>
        <div class="conteudo" id="adminConteudo"></div>
      </div>`;

    pai.appendChild(overlay);
    this.overlay = overlay;

    overlay.querySelector('#adminFechar').addEventListener('click', () => this.fechar());
    this.renderizarNav();
    this.renderizarConteudo();
  }

  status(msg, cor) {
    const el = this.overlay?.querySelector('#adminStatus');
    if (el) {
      el.textContent = msg ?? '';
      el.style.color = cor ?? '#5a6a78';
    }
  }

  renderizarNav() {
    const nav = this.overlay?.querySelector('#adminNav');
    if (!nav) return;
    nav.innerHTML = '';
    for (const aba of ABAS) {
      const item = document.createElement('div');
      item.className = 'nav-item' + (aba.id === this.abaAtual ? ' ativo' : '');
      item.innerHTML = `<span>${aba.icone}</span><span>${aba.label}</span>`;
      item.addEventListener('click', () => {
        this.abaAtual = aba.id;
        this.selecionado = null;
        this.busca = '';
        this.filtroClasse = '';
        this.renderizarNav();
        this.renderizarConteudo();
      });
      nav.appendChild(item);
    }
  }

  // ---------- carga com cache ----------

  async carregar(chave, fn) {
    if (this.caches[chave]) return this.caches[chave];
    this.status('Carregando…');
    try {
      const dados = await fn();
      this.caches[chave] = dados;
      this.status('');
      return dados;
    } catch (erro) {
      console.error(erro);
      this.status('Erro ao carregar: ' + (erro?.message ?? erro), '#c96a5a');
      return [];
    }
  }

  // ---------- conteúdo ----------

  async renderizarConteudo() {
    const aba = ABAS.find((a) => a.id === this.abaAtual) ?? ABAS[0];
    const titulo = this.overlay?.querySelector('#adminTitulo');
    if (titulo) titulo.textContent = aba.label;
    const conteudo = this.overlay?.querySelector('#adminConteudo');
    if (!conteudo) return;

    if (aba.especial === 'portais') return this.renderizarPortais(conteudo);
    if (aba.especial === 'jogadores') return this.renderizarJogadores(conteudo);
    if (aba.especial === 'estatisticas') return this.renderizarEstatisticas(conteudo);
    return this.renderizarCatalogo(conteudo, aba);
  }

  async renderizarCatalogo(conteudo, aba) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const itens = await this.carregar(aba.cache, () => aba.repo.listar());
    if (!this.overlay) return;

    // Contexto de opções dependentes (talentos precisam da lista de classes…)
    const [classesCat, itensCat, monstrosCat] = await Promise.all([
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
    ]);
    const classesOpcoes = classesCat.map((c) => ({ valor: c.id, rotulo: c.nome ?? c.id }));

    let itensDaAba = itens;
    if (aba.filtroClasse && this.filtroClasse) {
      itensDaAba = itens.filter((t) => t.classeId === this.filtroClasse);
    }
    const termo = this.busca.trim().toLowerCase();
    if (termo) {
      itensDaAba = itensDaAba.filter((i) =>
        [i.nome, i.id, i.descricao, i.tipo, i.raridade].some((v) => String(v ?? '').toLowerCase().includes(termo)),
      );
    }

    conteudo.innerHTML = `
      <div class="grid-catalogo">
        <div class="painel">
          <h3>${aba.label}</h3>
          <div class="busca">${aba.buscar ? '<input id="adminBusca" type="text" placeholder="Buscar…">' : ''}
          ${aba.filtroClasse ? `<select id="adminFiltroClasse"><option value="">Todas as classes</option>${classesOpcoes.map((c) => `<option value="${c.valor}" ${c.valor === this.filtroClasse ? 'selected' : ''}>${c.rotulo}</option>`).join('')}</select>` : ''}
          </div>
          <div id="adminLista"></div>
          <button class="btn-novo" id="adminNovo">+ Novo registro</button>
        </div>
        <div class="painel" id="adminForm"></div>
        <div class="painel" id="adminPreview"></div>
      </div>`;

    const buscaEl = conteudo.querySelector('#adminBusca');
    if (buscaEl) {
      buscaEl.value = this.busca;
      buscaEl.addEventListener('input', () => {
        this.busca = buscaEl.value;
        clearTimeout(this._tBusca);
        this._tBusca = setTimeout(() => this.renderizarConteudo(), 180);
      });
    }
    const filtroEl = conteudo.querySelector('#adminFiltroClasse');
    if (filtroEl) {
      filtroEl.addEventListener('change', () => {
        this.filtroClasse = filtroEl.value;
        this.renderizarConteudo();
      });
    }
    conteudo.querySelector('#adminNovo').addEventListener('click', () => {
      this.selecionado = { aba, item: null };
      this.renderizarConteudo();
    });

    const listaEl = conteudo.querySelector('#adminLista');
    for (const item of itensDaAba.slice(0, 100)) {
      const linha = document.createElement('div');
      linha.className = 'linha-item' + (this.selecionado?.item?.id === item.id ? ' sel' : '');
      linha.innerHTML = `
        <img src="${item.imagem ?? ''}" alt="" onerror="this.style.visibility='hidden'">
        <div><div class="nome">${item.nome ?? item.id}</div><div class="detalhe">${aba.resumo?.(item) ?? ''}</div></div>
        <div class="x" title="Apagar">✕</div>`;
      linha.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('x')) return;
        this.selecionado = { aba, item };
        this.renderizarConteudo();
      });
      linha.querySelector('.x').addEventListener('click', async () => {
        if (!window.confirm(`Apagar "${item.nome ?? item.id}"?`)) return;
        await aba.repo.remover(item.id);
        delete this.caches[aba.cache];
        if (this.selecionado?.item?.id === item.id) this.selecionado = null;
        this.status('Apagado.');
        this.renderizarConteudo();
      });
      listaEl.appendChild(linha);
    }
    if (!itensDaAba.length) {
      listaEl.innerHTML = '<div class="detalhe" style="padding:8px">Nenhum registro encontrado.</div>';
    }

    const formEl = conteudo.querySelector('#adminForm');
    const previewEl = conteudo.querySelector('#adminPreview');
    if (this.selecionado?.aba?.id === aba.id) {
      this.desenharFormularioDom(formEl, aba, this.selecionado.item, classesOpcoes, { itensCat, monstrosCat, classesCat });
      this.desenharPreviewDom(previewEl, aba, this.selecionado.item);
    } else {
      formEl.innerHTML = '<h3>Formulário</h3><p style="color:#7b8794;font-size:13px">Escolha um registro na lista ou clique em <b>+ Novo registro</b>.</p>';
      previewEl.innerHTML = '<h3>Prévia</h3><p style="color:#7b8794;font-size:13px">A ficha do registro aparece aqui.</p>';
    }
  }

  // ---------- formulário (DOM nativo) ----------

  valorInicial(campo, bruto) {
    if (bruto === null || bruto === undefined || bruto === '') {
      switch (campo.chave) {
        case 'tipo': return campo.opcoes?.[0]?.valor ?? '';
        case 'raridade': return 'comum';
        case 'uso': return [];
        default: return '';
      }
    }
    const ser = serializadores[campo.chave];
    if (ser) return ser(bruto);
    if (campo.tipo === 'multiselec') return Array.isArray(bruto) ? bruto : [bruto];
    if (campo.tipo === 'select' && typeof bruto === 'string') return bruto;
    return bruto;
  }

  desenharFormularioDom(el, aba, item, classesOpcoes, ctx) {
    const campos = aba.campos.map((c) => {
      const copia = { ...c };
      if (c.chave === 'classeId') copia.opcoes = classesOpcoes;
      if (c.chave === 'preRequisitos') copia.opcoes = [];
      return copia;
    });

    el.innerHTML = `<h3>${item ? `Editar: ${item.nome ?? item.id}` : `Novo em ${aba.label}`}</h3><div class="detalhe" style="font-size:11px;color:#93a1ad;margin-bottom:10px">${item?.id ? 'id: ' + item.id : 'id gerado ao salvar'}</div>`;

    const form = document.createElement('div');
    el.appendChild(form);

    const refs = {};
    for (const campo of campos) {
      const valor = this.valorInicial(campo, item?.[campo.chave]);
      const label = document.createElement('label');
      label.className = 'campo';
      label.innerHTML = `<span>${campo.rotulo}${campo.obrigatorio ? ' *' : ''}</span>`;

      let controle;
      if (campo.tipo === 'area') {
        controle = document.createElement('textarea');
        controle.value = valor ?? '';
        controle.placeholder = campo.placeholder ?? '';
      } else if (campo.tipo === 'numero') {
        controle = document.createElement('input');
        controle.type = 'number';
        controle.value = valor ?? '';
      } else if (campo.tipo === 'select') {
        controle = document.createElement('select');
        for (const op of (campo.opcoes ?? []).map(normalizarOpcao)) {
          const o = document.createElement('option');
          o.value = op.valor;
          o.textContent = op.rotulo;
          if (op.valor === valor) o.selected = true;
          controle.appendChild(o);
        }
      } else if (campo.tipo === 'multiselec') {
        controle = document.createElement('div');
        controle.className = 'chips';
        for (const op of (campo.opcoes ?? []).map(normalizarOpcao)) {
          const chip = document.createElement('div');
          chip.className = 'chip' + (Array.isArray(valor) && valor.includes(op.valor) ? ' on' : '');
          chip.textContent = op.rotulo;
          chip.addEventListener('click', () => chip.classList.toggle('on'));
          controle.appendChild(chip);
        }
      } else if (campo.tipo === 'imagem') {
        controle = document.createElement('div');
        controle.innerHTML = `
          <input type="file" accept="image/*" style="margin-bottom:6px">
          <input type="text" placeholder="ou cole a URL da imagem" value="${valor ?? ''}">`;
        const [fileEl, urlEl] = controle.querySelectorAll('input');
        fileEl.addEventListener('change', async () => {
          const arq = fileEl.files?.[0];
          if (!arq) return;
          this.status('Enviando imagem…');
          try {
            const url = await enviarImagem(arq, aba.id ?? 'imagens');
            urlEl.value = url;
            this.status('Imagem enviada.');
            this.atualizarPreviewDom(aba);
          } catch (e) {
            this.status('Erro no envio: ' + (e?.message ?? e), '#c96a5a');
          }
        });
        urlEl.addEventListener('input', () => this.atualizarPreviewDom(aba));
        refs[campo.chave] = { campo, obter: () => urlEl.value.trim() };
        valor && (refs[campo.chave].valorInicial = valor);
        label.appendChild(controle);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      } else {
        controle = document.createElement('input');
        controle.type = 'text';
        controle.value = valor ?? '';
        controle.placeholder = campo.placeholder ?? '';
      }

      refs[campo.chave] = {
        campo,
        obter: () => {
          if (campo.tipo === 'multiselec') {
            return [...controle.querySelectorAll('.chip.on')].map((c) => {
              const op = (campo.opcoes ?? []).map(normalizarOpcao).find((o) => o.rotulo === c.textContent);
              return op?.valor;
            }).filter(Boolean);
          }
          return controle.value;
        },
      };
      controle.addEventListener('input', () => this.atualizarPreviewDom(aba));
      controle.addEventListener('change', () => this.atualizarPreviewDom(aba));
      label.appendChild(controle);
      if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
      form.appendChild(label);
    }

    this._refsForm = refs;
    this._abaForm = aba;

    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    const btnSalvar = document.createElement('button');
    btnSalvar.className = 'btn-primario';
    btnSalvar.textContent = item ? 'Salvar alterações' : 'Criar registro';
    btnSalvar.addEventListener('click', () => this.salvarDom(aba, item));
    const btnCancelar = document.createElement('button');
    btnCancelar.className = 'btn-secundario';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', () => {
      this.selecionado = null;
      this.renderizarConteudo();
    });
    acoes.appendChild(btnSalvar);
    acoes.appendChild(btnCancelar);
    if (item) {
      const btnApagar = document.createElement('button');
      btnApagar.className = 'btn-perigo';
      btnApagar.textContent = 'Apagar';
      btnApagar.addEventListener('click', async () => {
        if (!window.confirm(`Apagar "${item.nome ?? item.id}"?`)) return;
        await aba.repo.remover(item.id);
        delete this.caches[aba.cache];
        this.selecionado = null;
        this.status('Apagado.');
        this.renderizarConteudo();
      });
      acoes.appendChild(btnApagar);
    }
    el.appendChild(acoes);
  }

  async salvarDom(aba, item) {
    const refs = this._refsForm ?? {};
    const dados = {};
    for (const [chave, ref] of Object.entries(refs)) {
      let v = ref.obter();
      if (ref.campo.tipo === 'numero') {
        const limpo = String(v ?? '').trim().replace(',', '.');
        v = limpo === '' ? 0 : Number(limpo);
        if (!Number.isFinite(v)) v = 0;
      }
      if (ref.campo.parse) v = ref.campo.parse(v);
      const vazio =
        v === '' || v === null || v === undefined ||
        (Array.isArray(v) && v.length === 0) ||
        (ref.campo.tipo === 'area' && v === '{}');
      if (vazio) continue;
      dados[chave] = v;
    }

    if (!dados.nome && !item) {
      this.status('Preencha ao menos o nome.', '#c96a5a');
      return;
    }

    try {
      if (item) {
        await aba.repo.salvar(item.id, dados);
        this.status('Salvo.');
      } else {
        const criado = await aba.repo.criar(dados);
        this.status('Criado.');
        this.selecionado = criado?.id ? { aba, item: { id: criado.id, ...dados } } : null;
      }
      delete this.caches[aba.cache];
      this.renderizarConteudo();
    } catch (erro) {
      this.status('Erro ao salvar: ' + (erro?.message ?? erro), '#c96a5a');
    }
  }

  desenharPreviewDom(el, aba, item) {
    if (!el) return;
    if (!item) {
      el.innerHTML = '<h3>Prévia</h3><p style="color:#7b8794;font-size:13px">Novo registro — a ficha aparece conforme você preenche.</p>';
      return;
    }
    const linhas = [`<b>${item.nome ?? '—'}</b>`, `id: ${item.id}`];
    for (const c of aba.campos.slice(0, 8)) {
      if (c.chave === 'nome' || c.tipo === 'imagem') continue;
      const v = this.valorInicial(c, item?.[c.chave]);
      if (v === '' || v == null) continue;
      linhas.push(`${c.rotulo}: ${rotuloDe(v).slice(0, 40)}`);
    }
    el.innerHTML = `<h3>Prévia</h3>
      <div class="img-preview">${item.imagem ? `<img src="${item.imagem}">` : 'sem imagem'}</div>
      <div style="font-size:12px;line-height:1.7">${linhas.join('<br>')}</div>`;
  }

  atualizarPreviewDom(aba) {
    // Preview ao vivo: relê o formulário atual
    const el = this.overlay?.querySelector('#adminPreview');
    if (!el || !this._refsForm) return;
    const parcial = {};
    for (const [chave, ref] of Object.entries(this._refsForm)) {
      let v = ref.obter();
      if (ref.campo.tipo === 'numero') v = Number(String(v).replace(',', '.')) || 0;
      if (v !== '' && v != null && !(Array.isArray(v) && !v.length)) parcial[chave] = v;
    }
    if (this.selecionado?.item) Object.assign(parcial, { id: this.selecionado.item.id });
    parcial.nome = parcial.nome ?? this.selecionado?.item?.nome ?? 'Novo registro';
    this.desenharPreviewDom(el, aba, parcial);
  }

  // ---------- abas especiais ----------

  async renderizarPortais(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const portais = await this.carregar('portais', () => repoPortais.listar());
    if (!this.overlay) return;
    conteudo.innerHTML = `
      <div class="painel">
        <h3>Portões publicados</h3>
        <p style="font-size:12px;color:#7b8794">Desmarque para esconder uma base sem apagar o progresso dela.</p>
        <table><thead><tr><th>Jogador</th><th>Base</th><th>Nível</th><th>Estado</th><th></th></tr></thead>
        <tbody id="portaisBody">${portais.map((p) => `
          <tr><td>${p.nome ?? 'Viajante'}</td><td>${p.nomeBase ?? 'Acampamento'}</td><td>${p.nivel ?? 1}</td>
          <td>${p.ativo ? '🟢 ativo' : '⚫ oculto'}</td>
          <td><button class="btn-secundario" data-id="${p.id}" data-ativo="${p.ativo ? 1 : 0}">${p.ativo ? 'Ocultar' : 'Publicar'}</button></td></tr>`).join('') || '<tr><td colspan="5">Nenhum portal.</td></tr>'}</tbody></table>
      </div>`;
    conteudo.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ativo = btn.dataset.ativo === '1';
        await repoPortais.salvar(btn.dataset.id, { ativo: !ativo });
        delete this.caches.portais;
        this.status(ativo ? 'Portal ocultado.' : 'Portal publicado.');
        this.renderizarConteudo();
      });
    });
  }

  async renderizarJogadores(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const [usuarios, admins] = await Promise.all([
      this.carregar('usuarios', () => repoUsuarios.listar()),
      this.carregar('admins', () => listarAdmins()),
    ]);
    if (!this.overlay) return;
    conteudo.innerHTML = `
      <div class="painel">
        <h3>Jogadores</h3>
        <p style="font-size:12px;color:#7b8794">Promova a conta que gerencia o painel. A lista vem de users/{uid}.</p>
        <table><thead><tr><th>Nome</th><th>Email</th><th>Nível</th><th>Role</th><th></th></tr></thead>
        <tbody>${usuarios.map((u) => {
          const ehAdm = admins.includes(u.id);
          return `<tr><td>${u.nome ?? '—'}</td><td>${u.email ?? '—'}</td><td>${u.nivel ?? 1}</td>
          <td>${ehAdm ? '👑 admin' : 'jogador'}</td>
          <td><button class="btn-secundario" data-id="${u.id}" data-adm="${ehAdm ? 1 : 0}">${ehAdm ? 'Rebaixar' : 'Tornar admin'}</button></td></tr>`;
        }).join('') || '<tr><td colspan="5">Nenhum usuário.</td></tr>'}</tbody></table>
      </div>`;
    conteudo.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ehAdm = btn.dataset.adm === '1';
        await definirAdminUid(btn.dataset.id, !ehAdm);
        delete this.caches.admins;
        this.status(ehAdm ? 'Rebaixado.' : 'Promovido a admin.');
        this.renderizarConteudo();
      });
    });
  }

  async renderizarEstatisticas(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const [usuarios, portais, itens, classes, talentos, monstros, receitas, reinos, conquistas] = await Promise.all([
      this.carregar('usuarios', () => repoUsuarios.listar()),
      this.carregar('portais', () => repoPortais.listar()),
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('talentos', () => repoSkills.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
      this.carregar('receitas', () => repoRecipes.listar()),
      this.carregar('reinos', () => repoWorldTemplates.listar()),
      this.carregar('conquistas', () => repoAchievements.listar()),
    ]);
    if (!this.overlay) return;

    const porVocacao = {};
    let nivelSoma = 0;
    for (const u of usuarios) {
      const v = u.vocacaoId ?? 'sem classe';
      porVocacao[v] = (porVocacao[v] ?? 0) + 1;
      nivelSoma += Number(u.nivel ?? 1);
    }
    const nivelMedio = usuarios.length ? (nivelSoma / usuarios.length).toFixed(1) : '0';
    const maxVoc = Math.max(1, ...Object.values(porVocacao));

    conteudo.innerHTML = `
      <div class="cards">
        <div class="card escuro"><h2>${usuarios.length}</h2><p>Jogadores</p></div>
        <div class="card escuro"><h2>${portais.length}</h2><p>Portais publicados</p></div>
        <div class="card azul"><h2>${nivelMedio}</h2><p>Nível médio</p></div>
        <div class="card teal"><h2>${itens.length}</h2><p>Itens cadastrados</p></div>
        <div class="card teal"><h2>${classes.length}</h2><p>Classes</p></div>
        <div class="card teal"><h2>${talentos.length}</h2><p>Talentos</p></div>
        <div class="card teal"><h2>${monstros.length}</h2><p>Monstros</p></div>
        <div class="card teal"><h2>${receitas.length}</h2><p>Receitas</p></div>
        <div class="card teal"><h2>${reinos.length}</h2><p>Reinos</p></div>
        <div class="card teal"><h2>${conquistas.length}</h2><p>Conquistas</p></div>
      </div>
      <div class="painel">
        <h3>Uso de vocações</h3>
        ${Object.entries(porVocacao).sort((a, b) => b[1] - a[1]).map(([v, n]) => `
          <div class="bar-linha"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${v}</span><span>${n}</span></div>
          <div class="bar-fundo"><div class="bar-cheio" style="width:${Math.round((n / maxVoc) * 100)}%"></div></div></div>`).join('') || '<p style="color:#7b8794">Sem dados.</p>'}
      </div>`;
  }
}
