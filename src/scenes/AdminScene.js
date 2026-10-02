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
  repoEstacoes,
  repoBiomas,
  repoNPCs,
  repoServidores,
  repoBackups,
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
  CAMPOS_ESTACAO,
  CAMPOS_BIOMA,
  CAMPOS_NPC,
  CAMPOS_SERVIDOR,
  RESUMO,
  serializadores,
  CORES_PALETA,
  EFEITOS_DESCRICOES,
} from '../dados/schemaAdmin.js';
import { xpParaProximoNivel, xpTotalParaNivel } from '../core/progresso.js';

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
  { id: 'estacoes', label: 'Estações', icone: '🏭', repo: repoEstacoes, cache: 'estacoes', campos: CAMPOS_ESTACAO, resumo: RESUMO.estacoes, pastaUpload: 'estacoes' },
  { id: 'biomas', label: 'Biomas', icone: '🌿', repo: repoBiomas, cache: 'biomas', campos: CAMPOS_BIOMA, resumo: RESUMO.biomas, pastaUpload: 'biomas' },
  { id: 'npcs', label: 'NPCs do Mundo', icone: '👤', repo: repoNPCs, cache: 'npcs', campos: CAMPOS_NPC, resumo: RESUMO.npcs, pastaUpload: 'npcs' },
  { id: 'servidores', label: 'Servidores', icone: '🖥️', repo: repoServidores, cache: 'servidores', campos: CAMPOS_SERVIDOR, resumo: RESUMO.servidores },
  { id: 'backup', label: 'Backup', icone: '💾', especial: 'backup' },
  { id: 'balanceamento', label: 'Bal. Tabela', icone: '⚖️', especial: 'balanceamento' },
  { id: 'monetario', label: 'Bal. Monetário', icone: '💰', especial: 'monetario' },
  { id: 'mundosBlocos', label: 'Mundos & Blocos', icone: '🧱', especial: 'mundosBlocos' },
  { id: 'mundosMobs', label: 'Mundos & Mobs', icone: '🐲', especial: 'mundosMobs' },
  { id: 'portaisNativos', label: 'Portais Nativos', icone: '🚪', especial: 'portaisNativos' },
  { id: 'gestaoNiveis', label: 'Gestão de Níveis', icone: '📈', especial: 'gestaoNiveis' },
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
/* Tema escuro */
#adminOverlay.escuro{background:#141619;color:#e7eaee}
#adminOverlay.escuro .topo{background:#1d2026;border-color:#33373f}
#adminOverlay.escuro .topo h1{color:#e7eaee}
#adminOverlay.escuro .painel{background:#1d2026;border-color:#33373f}
#adminOverlay.escuro .status{color:#9aa4af}
#adminOverlay.escuro input[type=text],#adminOverlay.escuro input[type=number],#adminOverlay.escuro textarea,#adminOverlay.escuro select{background:#141619;color:#e7eaee;border-color:#33373f}
#adminOverlay.escuro .linha-item:hover{background:#262a31}
#adminOverlay.escuro .linha-item.sel{background:#1f3a35;border-color:#2bb3a3}
#adminOverlay.escuro .linha-item .nome{color:#e7eaee}
#adminOverlay.escuro .linha-item .detalhe{color:#9aa4af}
#adminOverlay.escuro .btn-secundario,#adminOverlay.escuro .btn-fechar{background:#262a31;border-color:#3a3f47;color:#e7eaee}
#adminOverlay.escuro th,#adminOverlay.escuro td{border-color:#33373f}
#adminOverlay.escuro th{color:#9aa4af}
#adminOverlay.escuro .card.escuro{background:#23272e}
#adminOverlay.escuro .bar-fundo{background:#33373f}
#adminOverlay.escuro .chip{background:#141619;border-color:#33373f;color:#e7eaee}
#adminOverlay.escuro .img-preview{background:#141619;border-color:#33373f}
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
#adminOverlay .dica{font-size:10px;color:#93a1ad;margin-top:3px;line-height:1.5}
/* Lista de processos: nome em destaque + descrição do que a máquina faz. */
#adminOverlay .lista-processos{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto;padding-right:4px}
#adminOverlay .proc-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid #dde3ea;border-radius:6px;cursor:pointer;background:#fff}
#adminOverlay .proc-item:hover{border-color:#a9b6c2}
#adminOverlay .proc-item.on{border-color:#2bb3a3;background:#e8f6f3}
#adminOverlay .proc-item input{margin-top:2px;flex-shrink:0}
#adminOverlay .proc-nome{font-size:13px;font-weight:600;color:#2b3440}
#adminOverlay .proc-desc{font-size:11px;color:#7b8794;line-height:1.45;margin-top:2px}
#adminOverlay.escuro .proc-item{background:#1d2026;border-color:#33373f}
#adminOverlay.escuro .proc-item.on{border-color:#2bb3a3;background:#1f3a35}
#adminOverlay.escuro .proc-nome{color:#e7eaee}
#adminOverlay.escuro .proc-desc{color:#9aa4af}
/* Grade do mapa de NPC */
#adminOverlay .mapa-npc{display:grid;gap:1px;background:#c3ccd6;padding:1px;border-radius:6px;overflow:auto;max-height:420px;width:max-content}
#adminOverlay .celula{width:22px;height:22px;background:#fff;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;font-size:10px}
#adminOverlay .celula:hover{outline:2px solid #2bb3a3;outline-offset:-1px;z-index:1}
#adminOverlay .celula.com-npc{background:#ffe9b8}
#adminOverlay .celula.alvo{outline:2px solid #c96a5a;outline-offset:-1px}
#adminOverlay.escuro .mapa-npc{background:#33373f}
#adminOverlay.escuro .celula{background:#1d2026;color:#9aa4af}
#adminOverlay .legenda-mapa{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#7b8794;margin-top:8px}
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
  if (op && typeof op === 'object') {
    return {
      valor: op.valor ?? op.id,
      rotulo: op.rotulo ?? op.nome ?? String(op.valor),
      descricao: op.descricao ?? '',
    };
  }
  return { valor: op, rotulo: String(op), descricao: '' };
}

function rotuloDe(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v ?? '');
}

/**
 * Escape para interpolação em innerHTML.
 *
 * Todo o painel monta HTML por template string com dados vindos do Firestore.
 * Um item chamado `<img onerror=...>` ou um nome com aspas quebrava o cartão
 * inteiro — e Worse, abria espaço para XSSStored por qualquer admin que
 * cadastrasse conteúdo malicioso.
 */
function escaparHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // As aspas entram como escape unicode em vez de caractere literal. Um `"`
    // cru dentro de um literal de regex engana ferramentas que varrem o
    // arquivo procurando strings — elas tratam o `"` como abertura de string
    // e engolem o resto da linha, fazendo parecer que a função seguinte não
    // foi declarada.
    .replace(new RegExp(String.fromCharCode(34), 'g'), 'quot')
    .replace(new RegExp(String.fromCharCode(39), 'g'), '#39');
}

const escaparAttr = escaparHtml;

export class AdminScene extends Phaser.Scene {
  constructor() {
    super('Admin');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.meuNome = dados?.nome ?? null;
  }

  async create() {
    this.caches = {};
    this.selecionado = null;
    this.abaAtual = 'itens';
    this.filtroClasse = '';
    this.busca = '';

    this.cameras.main.setBackgroundColor('#0a0705');

    // Verifica se o usuário é admin antes de mostrar o painel
    const admin = await ehAdmin(this.uid);
    if (!admin) {
      this.status('Acesso restrito: você precisa ser administrador para usar este painel.', '#c96a5a');
      return;
    }

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
          <button class="btn-fechar" id="adminTema" title="Alternar claro/escuro">🌙 Escuro</button>
          <button class="btn-fechar" id="adminFechar">Fechar [F2]</button>
        </div>
        <div class="conteudo" id="adminConteudo"></div>
      </div>`;

    pai.appendChild(overlay);
    this.overlay = overlay;

    overlay.querySelector('#adminFechar').addEventListener('click', () => this.fechar());
    const temaSalvo = localStorage.getItem('adminTema');
    if (temaSalvo === 'escuro') {
      overlay.classList.add('escuro');
      overlay.querySelector('#adminTema').textContent = '☀️ Claro';
    }
    overlay.querySelector('#adminTema').addEventListener('click', () => {
      overlay.classList.toggle('escuro');
      const escuro = overlay.classList.contains('escuro');
      overlay.querySelector('#adminTema').textContent = escuro ? '☀️ Claro' : '🌙 Escuro';
      localStorage.setItem('adminTema', escuro ? 'escuro' : 'claro');
    });
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
    // `|| []` e não truthiness: uma coleção legitimamente vazia é `[]`, que é
    // truthy, mas um resultado `null` de um fallback precisa re-tentar.
    if (this.caches[chave] !== undefined) return this.caches[chave];
    this.status('Carregando…');
    try {
      const dados = await fn();
      this.caches[chave] = dados;
      this.status('');
      return dados;
    } catch (erro) {
      console.error(`[admin] falha ao carregar "${chave}":`, erro);
      this.status(this.explicarErroFirebase(erro, 'carregar'), '#c96a5a');
      // Não cacheia a falha: se for uma indisponibilidade passageira, a
      // próxima aba deve tentar de novo em vez de ficar vazia para sempre.
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
    if (aba.especial === 'balanceamento') return this.renderizarBalanceamento(conteudo);
    if (aba.especial === 'monetario') return this.renderizarMonetario(conteudo);
    if (aba.especial === 'mundosBlocos') return this.renderizarMundos(conteudo, 'blocos');
    if (aba.especial === 'mundosMobs') return this.renderizarMundos(conteudo, 'mobs');
    if (aba.especial === 'portaisNativos') return this.renderizarPortaisNativos(conteudo);
    if (aba.especial === 'gestaoNiveis') return this.renderizarGestaoNiveis(conteudo);
    if (aba.especial === 'backup') return this.renderizarBackup(conteudo);
    return this.renderizarCatalogo(conteudo, aba);
  }

  /**
   * Coleções de apoio usadas para preencher seletores que dependem de outros
   * cadastros. Sem isto, `classesPermitidas` numa estação, `biomas` num mundo ou
   * `npcsPermitidos` num servidor apareceriam vazios — o campo existiria na tela
   * mas não haveria o que marcar.
   */
  async carregarContexto() {
    if (this._contexto) return this._contexto;
    const [classes, itens, monstros, reinos, biomas, npcs, estacoes] = await Promise.all([
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
      this.carregar('reinos', () => repoWorldTemplates.listar()),
      this.carregar('biomas', () => repoBiomas.listar()),
      this.carregar('npcs', () => repoNPCs.listar()),
      this.carregar('estacoes', () => repoEstacoes.listar()),
    ]);

    const opcoesDe = (lista) =>
      lista.map((r) => ({ valor: r.id, rotulo: r.nome ?? r.id }));

    // Só BLOCOS entram onde o campo fala em blocos. Uma lista com potions
    // habilitaria "potion" como bloco nativo, que é erro de cadastro.
    const blocoDe = (r) => {
      const ehBloco = r.tipo === 'bloco' || (Array.isArray(r.uso) && r.uso.includes('estrutura'));
      return ehBloco ? { valor: r.id, rotulo: r.nome ?? r.id } : null;
    };

    this._contexto = {
      classes, itens, monstros, reinos, biomas, npcs, estacoes,
      classesOpcoes: opcoesDe(classes),
      itensOpcoes: opcoesDe(itens),
      blocosOpcoes: itens.map(blocoDe).filter(Boolean),
      monstrosOpcoes: opcoesDe(monstros),
      reinosOpcoes: opcoesDe(reinos),
      biomasOpcoes: opcoesDe(biomas),
      npcsOpcoes: opcoesDe(npcs),
      estacoesOpcoes: opcoesDe(estacoes),
    };
    return this._contexto;
  }

  async renderizarCatalogo(conteudo, aba) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const itens = await this.carregar(aba.cache, () => aba.repo.listar());
    if (!this.overlay) return;

    const ctx = await this.carregarContexto();
    const classesOpcoes = ctx.classesOpcoes;

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
      const inicial = escaparHtml(String(item.nome ?? item.id).slice(0, 1).toUpperCase());
      // Thumbnails de Storage quebrado somem em vez de virar moldura cinza.
      const thumb = item.imagem
        ? `<img src="${escaparAttr(item.imagem)}" alt="" loading="lazy" onerror="this.remove()">`
        : `<div style="width:30px;height:30px;border-radius:6px;background:#e8edf2;display:flex;align-items:center;justify-content:center;font-weight:700;color:#7b8794">${inicial}</div>`;
      linha.innerHTML = `
        ${thumb}
        <div><div class="nome">${escaparHtml(item.nome ?? item.id)}</div><div class="detalhe">${escaparHtml(aba.resumo?.(item) ?? '')}</div></div>
        <div class="x" title="Apagar">✕</div>`;
      linha.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('x')) return;
        this.selecionado = { aba, item };
        this.renderizarConteudo();
      });
      linha.querySelector('.x').addEventListener('click', async () => {
        if (!window.confirm(`Apagar "${item.nome ?? item.id}"?`)) return;
        try {
          await aba.repo.remover(item.id);
          delete this.caches[aba.cache];
          this._contexto = null;
          if (this.selecionado?.item?.id === item.id) this.selecionado = null;
          this.status('Apagado.');
          this.renderizarConteudo();
        } catch (erro) {
          this.status('Erro ao apagar: ' + (erro?.message ?? erro), '#c96a5a');
        }
      });
      listaEl.appendChild(linha);
    }
    if (!itensDaAba.length) {
      listaEl.innerHTML = '<div class="detalhe" style="padding:8px">Nenhum registro encontrado.</div>';
    }

    const formEl = conteudo.querySelector('#adminForm');
    const previewEl = conteudo.querySelector('#adminPreview');
    if (this.selecionado?.aba?.id === aba.id) {
      // A aba de NPC recebe o mapa quadriculado para posicionar o personagem.
      const comMapa = aba.id === 'npcs';
      if (comMapa) {
        conteudo.querySelector('.grid-catalogo').style.gridTemplateColumns = '260px minmax(0,1fr) 300px';
      }
      this.desenharFormularioDom(formEl, aba, this.selecionado.item, classesOpcoes, ctx);
      this.desenharPreviewDom(previewEl, aba, this.selecionado.item);
      if (comMapa) {
        const painelMapa = document.createElement('div');
        painelMapa.className = 'painel';
        painelMapa.id = 'adminMapaNpc';
        conteudo.querySelector('.grid-catalogo').insertBefore(painelMapa, previewEl);
        this.desenharMapaNpc(painelMapa, aba, this.selecionado.item, ctx);
      }
    } else {
      formEl.innerHTML = '<h3>Formulário</h3><p style="color:#7b8794;font-size:13px">Escolha um registro na lista ou clique em <b>+ Novo registro</b>.</p>';
      previewEl.innerHTML = '<h3>Prévia</h3><p style="color:#7b8794;font-size:13px">A ficha do registro aparece aqui.</p>';
    }
  }

  /**
   * Mapa quadriculado para escolher onde o NPC fica.
   *
   * O tamanho da grade vem do mundo escolhido: um mundo de 32 blocos não pode
   * mostrar uma grade de 128, ou o admin posiciona o NPC em coordenada que não
   * existe. Sem mundo selecionado, usamos a grade padrão de 32.
   *
   * Clicar numa célula escreve direto em posX/posY e reflete no formulário —
   * os dois caminhos editao o mesmo objeto, então não há como divergirem.
   */
  desenharMapaNpc(el, aba, item, ctx) {
    const mundo = ctx.reinos.find((r) => r.id === item?.mundoId);
    const TAMANHO_PADRAO = 32;
    let lado = TAMANHO_PADRAO;
    if (mundo?.largura) lado = Math.max(8, Math.min(128, Number(mundo.largura) || TAMANHO_PADRAO));
    else if (mundo?.tamanho) {
      lado = { pequeno: 32, medio: 64, grande: 128, enorme: 256 }[mundo.tamanho] ?? TAMANHO_PADRAO;
      lado = Math.min(lado, 96); // acima disso a grade fica inutilizável na tela
    }
    lado = Math.round(lado);

    const npcsDoMundo = ctx.npcs.filter(
      (n) => n.id !== item?.id && (!item?.mundoId || n.mundoId === item.mundoId),
    );

    el.innerHTML = `
      <h3>Posição no mapa</h3>
      <p style="font-size:11px;color:#7b8794;margin-bottom:8px">
        ${mundo ? `Mundo: <b>${mundo.nome}</b> · grade ${lado}×${lado}` : 'Selecione um mundo para ver a grade dele'}
      </p>
      <div class="mapa-npc" id="gradeNpc"></div>
      <div class="legenda-mapa">
        <span>🟨 quadrado com NPC</span><span>🟥 ponto fixo selecionado</span>
        <span>clique para posicionar</span>
      </div>`;

    const grade = el.querySelector('#gradeNpc');
    grade.style.gridTemplateColumns = `repeat(${lado}, 22px)`;

    // Índice de NPCs por célula para não repetir a busca a cada clique.
    const porCelula = new Map();
    for (const n of npcsDoMundo) {
      const x = Number(n.posX);
      const y = Number(n.posY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        porCelula.set(`${x},${y}`, (porCelula.get(`${x},${y}`) ?? 0) + 1);
      }
    }

    const alvo = { x: Number(item?.posX) || 0, y: Number(item?.posY) || 0 };

    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado; x += 1) {
        const celula = document.createElement('div');
        celula.className = 'celula';
        const qtd = porCelula.get(`${x},${y}`) ?? 0;
        if (qtd) {
          celula.classList.add('com-npc');
          celula.textContent = qtd > 1 ? String(qtd) : '•';
          celula.title = `${qtd} NPC(s) aqui`;
        }
        if (x === alvo.x && y === alvo.y) celula.classList.add('alvo');
        celula.addEventListener('click', () => {
          alvo.x = x;
          alvo.y = y;
          grade.querySelectorAll('.celula.alvo').forEach((c) => c.classList.remove('alvo'));
          celula.classList.add('alvo');
          // Reflete nos inputs do formulário, se já desenhados.
          for (const chave of ['posX', 'posY']) {
            const input = el.parentElement?.querySelector?.(`input[data-campo="${chave}"]`);
            if (input) input.value = String(chave === 'posX' ? x : y);
          }
          this._refsForm.posX.obter = () => String(alvo.x);
          this._refsForm.posY.obter = () => String(alvo.y);
          this.status(`Posição: ${x}, ${y}`);
          this.atualizarPreviewDom(aba);
        });
        grade.appendChild(celula);
      }
    }
  }

  // ---------- editores estruturados ----------

  /** Linhas "item + quantidade" (Rende / Insumos / Saída / Orbes). */
  criarEditorListaQtd(valorTexto, itensCat) {
    const el = document.createElement('div');
    el.className = 'editor-lista';
    const itensMap = new Map(itensCat.map((i) => [i.id, i]));
    const linhas = String(valorTexto ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [id, qtd] = p.split(':');
        return { id: (id ?? '').trim(), qtd: Number(qtd) || 1 };
      });

    const render = () => {
      el.innerHTML = '';
      for (const linha of linhas) {
        const item = itensMap.get(linha.id);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
        row.innerHTML = `
          <img src="${item?.imagem ?? ''}" style="width:26px;height:26px;border-radius:5px;object-fit:cover;background:#e8edf2" onerror="this.style.visibility='hidden'">
          <select style="flex:1">${itensCat.map((i) => `<option value="${i.id}" ${i.id === linha.id ? 'selected' : ''}>${i.nome ?? i.id}</option>`).join('')}${linha.id && !itensMap.has(linha.id) ? `<option value="${linha.id}" selected>${linha.id}</option>` : ''}</select>
          <input type="number" min="1" value="${linha.qtd}" style="width:70px">
          <button type="button" class="btn-perigo" style="padding:4px 8px">✕</button>`;
        const [sel, num] = row.querySelectorAll('select,input');
        sel.addEventListener('change', () => { linha.id = sel.value; render(); });
        num.addEventListener('input', () => { linha.qtd = Number(num.value) || 1; });
        row.querySelector('button').addEventListener('click', () => { linhas.splice(linhas.indexOf(linha), 1); render(); });
        el.appendChild(row);
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn-secundario';
      add.style.cssText = 'padding:5px 10px;font-size:12px';
      add.textContent = '+ adicionar item';
      add.addEventListener('click', () => { linhas.push({ id: itensCat[0]?.id ?? '', qtd: 1 }); render(); });
      el.appendChild(add);
    };
    render();

    return {
      el,
      obter: () => linhas.map((l) => `${l.id}:${l.qtd}`).filter((s) => s.split(':')[0]).join(', '),
    };
  }

  /** Linhas "item + chance + quantidade" (Loot / Loot do mundo). */
  criarEditorLoot(valorTexto, itensCat) {
    const el = document.createElement('div');
    const itensMap = new Map(itensCat.map((i) => [i.id, i]));
    const linhas = String(valorTexto ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [id, chance, qtd] = p.split(':');
        return { id: (id ?? '').trim(), chance: Number(chance) || 0, qtd: Number(qtd) || 1 };
      });

    const render = () => {
      el.innerHTML = '';
      for (const linha of linhas) {
        const item = itensMap.get(linha.id);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
        row.innerHTML = `
          <img src="${item?.imagem ?? ''}" style="width:26px;height:26px;border-radius:5px;object-fit:cover;background:#e8edf2" onerror="this.style.visibility='hidden'">
          <select style="flex:1">${itensCat.map((i) => `<option value="${i.id}" ${i.id === linha.id ? 'selected' : ''}>${i.nome ?? i.id}</option>`).join('')}${linha.id && !itensMap.has(linha.id) ? `<option value="${linha.id}" selected>${linha.id}</option>` : ''}</select>
          <input type="number" min="0" max="100" placeholder="chance" value="${linha.chance}" style="width:70px">
          <input type="number" min="1" placeholder="qtd" value="${linha.qtd}" style="width:60px">
          <button type="button" class="btn-perigo" style="padding:4px 8px">✕</button>`;
        const [sel, chance, qtd] = row.querySelectorAll('select,input');
        sel.addEventListener('change', () => { linha.id = sel.value; render(); });
        chance.addEventListener('input', () => { linha.chance = Number(chance.value) || 0; });
        qtd.addEventListener('input', () => { linha.qtd = Number(qtd.value) || 1; });
        row.querySelector('button').addEventListener('click', () => { linhas.splice(linhas.indexOf(linha), 1); render(); });
        el.appendChild(row);
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn-secundario';
      add.style.cssText = 'padding:5px 10px;font-size:12px';
      add.textContent = '+ adicionar drop';
      add.addEventListener('click', () => { linhas.push({ id: itensCat[0]?.id ?? '', chance: 50, qtd: 1 }); render(); });
      el.appendChild(add);
    };
    render();

    return {
      el,
      obter: () => linhas.map((l) => `${l.id}:${l.chance}:${l.qtd}`).filter((s) => s.split(':')[0]).join(', '),
    };
  }

  /** Linhas "atributo + valor" (Bônus por nível / Efeitos / Níveis requeridos). */
  criarEditorEfeitos(valorTexto) {
    const ATRIBUTOS = ['fis', 'men', 'soc', 'vidaMax', 'poderMax', 'defesa', 'regenVida', 'regenPoder', 'carga', 'poderMineracao', 'poderPct', 'xpPct', 'ouroBonus', 'vendaPct', 'reducaoDanoPct', 'alcanceConstrucao', 'velocidadeMaquinaPct', 'escudoPct', 'reparo'];
    const el = document.createElement('div');
    const linhas = String(valorTexto ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [k, v] = p.split(':');
        return { k: (k ?? '').trim(), v: String(v ?? '').trim() };
      });

    const render = () => {
      el.innerHTML = '';
      for (const linha of linhas) {
        const info = EFEITOS_DESCRICOES[linha.k] ?? { nome: linha.k, descricao: '' };
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;align-items:center';
        row.innerHTML = `
          <select style="flex:1" title="${info.descricao}">${ATRIBUTOS.map((a) => {
            const desc = EFEITOS_DESCRICOES[a]?.nome ?? a;
            return `<option value="${a}" ${a === linha.k ? 'selected' : ''}>${desc}</option>`;
          }).join('')}</select>
          <input type="text" value="${linha.v}" placeholder="+4 ou 10" style="width:90px">
          <button type="button" class="btn-perigo" style="padding:4px 8px">✕</button>`;
        const [sel, val] = row.querySelectorAll('select,input');
        sel.addEventListener('change', () => { linha.k = sel.value; render(); });
        val.addEventListener('input', () => { linha.v = val.value; });
        row.querySelector('button').addEventListener('click', () => { linhas.splice(linhas.indexOf(linha), 1); render(); });
        el.appendChild(row);
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn-secundario';
      add.style.cssText = 'padding:5px 10px;font-size:12px';
      add.textContent = '+ adicionar efeito';
      add.addEventListener('click', () => { linhas.push({ k: ATRIBUTOS[0], v: '+1' }); render(); });
      el.appendChild(add);
    };
    render();

    return {
      el,
      obter: () => linhas.map((l) => `${l.k}:${l.v}`).filter((s) => s.split(':')[0] && s.split(':')[1]).join(', '),
    };
  }

  // ---------- formulário (DOM nativo) ----------

  valorInicial(campo, bruto) {
    if (bruto === null || bruto === undefined || bruto === '') {
      switch (campo.chave) {
        case 'tipo': return campo.opcoes?.[0]?.valor ?? '';
        case 'raridade': return 'comum';
        case 'uso': return [];
        case 'cor': return CORES_PALETA[0];
        default: return '';
      }
    }
    // Receitas: o banco grava ms, o admin edita em SEGUNDOS.
    if (campo.chave === 'tempoMs') {
      const n = Number(bruto);
      return Number.isFinite(n) ? n / 1000 : '';
    }
    const ser = serializadores[campo.chave];
    if (ser) return ser(bruto);
    if (campo.tipo === 'multiselec') return Array.isArray(bruto) ? bruto : [bruto];
    if (campo.tipo === 'select' && typeof bruto === 'string') return bruto;
    if (campo.tipo === 'cor') return bruto;
    return bruto;
  }

  /**
   * Resolve as opções de um campo.
   *
   * Dois caminhos: `campo.fonte` aponta para uma coleção de apoio carregada
   * ("classes", "biomas", "monstros"...), ou o próprio schema já traz `opcoes`.
   * Sem isso, todo multiselec que depende de outro cadastro viria vazio.
   */
  opcoesDoCampo(campo, ctx) {
    if (campo.fonte && ctx) {
      const mapa = {
        classes: ctx.classesOpcoes,
        itens: ctx.itensOpcoes,
        blocos: ctx.blocosOpcoes,
        monstros: ctx.monstrosOpcoes,
        reinos: ctx.reinosOpcoes,
        mundos: ctx.reinosOpcoes,
        biomas: ctx.biomasOpcoes,
        npcs: ctx.npcsOpcoes,
        estacoes: ctx.estacoesOpcoes,
      };
      if (mapa[campo.fonte]) return mapa[campo.fonte];
    }
    return campo.opcoes ?? [];
  }

  desenharFormularioDom(el, aba, item, classesOpcoes, ctx) {
    const campos = aba.campos.map((c) => {
      const copia = { ...c };
      copia.opcoes = this.opcoesDoCampo(c, ctx);
      // `classeId` é o caso comum de `fonte: 'classes'` já declarado no schema.
      if (c.chave === 'classeId' && !copia.opcoes.length) copia.opcoes = classesOpcoes;
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

      // Editores estruturados para listas (Loot / Rende / Insumos / Saída / Bônus)
      if (['loot', 'lootGlobal'].includes(campo.chave)) {
        const editorLoot = this.criarEditorLoot(valor, ctx.itensCat ?? []);
        refs[campo.chave] = { campo, obter: editorLoot.obter };
        label.appendChild(editorLoot.el);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      }
      if (['rende', 'insumos', 'saida', 'recompensaOrbes'].includes(campo.chave)) {
        const editorLista = this.criarEditorListaQtd(valor, ctx.itensCat ?? []);
        refs[campo.chave] = { campo, obter: editorLista.obter };
        label.appendChild(editorLista.el);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      }
      if (['bonusPorNivel', 'efeitos', 'preRequisitoNiveis'].includes(campo.chave)) {
        const editorEfeitos = this.criarEditorEfeitos(valor);
        refs[campo.chave] = { campo, obter: editorEfeitos.obter };
        label.appendChild(editorEfeitos.el);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      }

      // Seletor de processos: cada opção mostra nome + descrição do que a
      // máquina faz. É o mash Mabinogi/Starbound em forma de lista, e o admin
      // precisa ler o que está marcando.
      if (campo.tipo === 'listaProcessos') {
        const marcados = new Set(Array.isArray(valor) ? valor : [valor].filter(Boolean));
        const editor = document.createElement('div');
        editor.className = 'lista-processos';
        for (const op of campo.opcoes.map(normalizarOpcao)) {
          const linha = document.createElement('label');
          linha.className = 'proc-item' + (marcados.has(op.valor) ? ' on' : '');
          const descricao = op.descricao ?? '';
          linha.innerHTML = `
            <input type="checkbox" ${marcados.has(op.valor) ? 'checked' : ''}>
            <div>
              <div class="proc-nome">${op.rotulo}</div>
              ${descricao ? `<div class="proc-desc">${descricao}</div>` : ''}
            </div>`;
          linha.querySelector('input').addEventListener('change', (ev) => {
            if (ev.target.checked) marcados.add(op.valor);
            else marcados.delete(op.valor);
            linha.classList.toggle('on', ev.target.checked);
            this.atualizarPreviewDom(aba);
          });
          editor.appendChild(linha);
        }
        refs[campo.chave] = { campo, obter: () => [...marcados] };
        label.appendChild(editor);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      }

      // Campo que o jogo decide sozinho e o admin só lê (ex.: NPC inviolável).
      if (campo.tipo === 'fixo') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#eef1f5;border-radius:6px;font-size:12px;color:#5a6a78';
        box.innerHTML = '<input type="checkbox" checked disabled><span>Ativo por regra do jogo</span>';
        refs[campo.chave] = { campo, obter: () => true };
        label.appendChild(box);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      }

      if (campo.tipo === 'cor') {
        controle = document.createElement('div');
        controle.className = 'seletor-cores';
        controle.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:4px';
        for (const cor of CORES_PALETA) {
          const quad = document.createElement('div');
          quad.style.cssText = `width:100%;aspect-ratio:1/1;border-radius:6px;cursor:pointer;border:2px solid transparent;background:${cor}`;
          quad.title = cor;
          if (valor === cor) quad.style.borderColor = '#2bb3a3';
          quad.addEventListener('click', () => {
            controle.querySelectorAll('div').forEach((d) => { d.style.borderColor = 'transparent'; });
            quad.style.borderColor = '#2bb3a3';
            refs[campo.chave].valorAtual = cor;
            this.atualizarPreviewDom(aba);
          });
          controle.appendChild(quad);
        }
        refs[campo.chave] = {
          campo,
          obter: () => refs[campo.chave].valorAtual ?? valor ?? '',
          valorAtual: valor ?? '',
        };
        label.appendChild(controle);
        if (campo.dica) label.insertAdjacentHTML('beforeend', `<div class="dica">${campo.dica}</div>`);
        form.appendChild(label);
        continue;
      } else if (campo.tipo === 'area') {
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
            // Atualiza o preview com a nova imagem
            if (this._refsForm && this._refsForm.imagem) {
              this._refsForm.imagem.valorAtual = url;
            }
            this.atualizarPreviewDom(aba);
          } catch (e) {
            this.status('Erro no envio: ' + (e?.message ?? e), '#c96a5a');
          }
        });
        urlEl.addEventListener('input', () => {
          if (this._refsForm && this._refsForm.imagem) {
            this._refsForm.imagem.valorAtual = urlEl.value;
          }
          this.atualizarPreviewDom(aba);
        });
        refs[campo.chave] = { campo, obter: () => refs[campo.chave].valorAtual ?? urlEl.value.trim(), valorAtual: valor ?? '' };
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

      // `data-campo` permite ao mapa de NPC achar este input pelo nome do campo.
      controle.dataset.campo = campo.chave;

      refs[campo.chave] = {
        campo,
        obter: () => {
          if (campo.tipo === 'multiselec') {
            return [...controle.querySelectorAll('.chip.on')].map((c) => {
              const op = campo.opcoes.map(normalizarOpcao).find((o) => o.rotulo === c.textContent);
              return op?.valor;
            }).filter(Boolean);
          }
          return controle.value;
        },
      };
      if (campo.tipo === 'multiselec') {
        // Chips são toggled por clique; o preview precisa acompanhar.
        controle.addEventListener('click', (ev) => {
          if (ev.target.closest('.chip')) this.atualizarPreviewDom(aba);
        });
      }
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
      if (ref.campo.chave === 'tempoMs') {
        const n = Number(v);
        v = Number.isFinite(n) ? Math.round(n * 1000) : 0;
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

    // Multiselec vazio é SIGNIFICADO em vários campos ("todas as classes",
    // "sem restrição"). Converter para string sóEmitteria um tipo inesperado
    // no Firestore, então limpamos explicitamente.
    const limparVazios = (d) => {
      for (const [k, v] of Object.entries(d)) {
        if (Array.isArray(v) && !v.length) delete d[k];
      }
      return d;
    };
    const objeto = limparVazios(dados);

    try {
      if (item) {
        // `merge: false` aqui é intencional? NÃO — merge:true preserva campos
        // que o painel ainda não conhece. Usamos merge (padrão do repo).
        await aba.repo.salvar(item.id, objeto);
        this.status('Salvo.');
      } else {
        const criado = await aba.repo.criar(objeto);
        this.status('Criado.');
        this.selecionado = criado?.id ? { aba, item: { id: criado.id, ...objeto } } : null;
      }
      delete this.caches[aba.cache];
      this._contexto = null;
      this.renderizarConteudo();
    } catch (erro) {
      this.status(this.explicarErroFirebase(erro, 'salvar'), '#c96a5a');
    }
  }

  /**
   * Traduz erro do Firebase para algo acionável.
   *
   * "Missing or insufficient permissions" não ajuda ninguém a decidir entre:
   *我不是 admin? regras não publicadas? app connectou em outro projeto?
   */
  explicarErroFirebase(erro, acao) {
    const msg = String(erro?.message ?? erro ?? '');
    const code = String(erro?.code ?? '');

    if (code === 'permission-denied' || /permission|insufficient permissions/i.test(msg)) {
      return `Permissão negada ao ${acao}. Verifique: (1) sua conta está em system/admins, ` +
        `(2) as regras do Firestore foram publicadas (firebase deploy --only firestore:rules).`;
    }
    if (/cors|failed to fetch|networkerror/i.test(msg)) {
      return `Falha de rede ao ${acao}. Se for Firebase Storage, o CORS do bucket precisa incluir ` +
        `https://kazenski.github.io (veja cors.json e README).`;
    }
    if (code === 'not-found' || /not found/i.test(msg)) {
      return `Registro não encontrado ao ${acao}. Ele pode ter sido apagado em outra aba.`;
    }
    if (code === 'unavailable' || /deadline|timeout/i.test(msg)) {
      return `Firebase indisponível ao ${acao}. Tente de novo em instantes.`;
    }
    if (code === 'unauthenticated') {
      return `Sessão expirada. Saia e entre novamente no painel.`;
    }
    return `Erro ao ${acao}: ${msg || 'falha desconhecida'}`;
  }

  desenharPreviewDom(el, aba, item) {
    if (!el) return;
    if (!item) {
      el.innerHTML = '<h3>Prévia</h3><p style="color:#7b8794;font-size:13px">Novo registro — a ficha aparece conforme você preenche.</p>';
      return;
    }

    const img = String(item.imagem ?? '').trim();
    // `onerror` esconde a imagem quebrada em vez de deixar o ícone de erro.
    // Sem isso, uma URL de Storage que falhou no CORS aparecia como moldura
    // cinza com "quebra" no meio da ficha, e parecia bug da prévia.
    const blocoImagem = img
      ? `<div class="img-preview"><img src="${escaparAttr(img)}" alt="" onerror="this.parentElement.innerHTML='<span style=\\'font-size:11px;color:#93a1ad;text-align:center;padding:8px\\'>imagem não carregou<br>(verifique URL ou CORS)</span>'"></div>`
      : '<div class="img-preview"><span style="font-size:11px;color:#93a1ad">sem imagem</span></div>';

    const linhas = [`<b>${escaparHtml(item.nome ?? '—')}</b>`];
    if (item.id) linhas.push(`id: ${escaparHtml(item.id)}`);

    // Todos os campos, não só os 8 primeiros: o preview existe para conferir a
    // ficha inteira antes de salvar, e truncar em 8 escondia justamente o que
    // se cadastrou por último.
    for (const c of aba.campos) {
      if (c.chave === 'nome' || c.tipo === 'imagem') continue;
      const v = this.valorInicial(c, item?.[c.chave]);
      if (v === '' || v == null || (Array.isArray(v) && !v.length)) continue;
      linhas.push(`${escaparHtml(c.rotulo)}: ${escaparHtml(rotuloDe(v).slice(0, 60))}`);
    }

    el.innerHTML = `<h3>Prévia</h3>${blocoImagem}
      <div style="font-size:12px;line-height:1.7;margin-top:8px">${linhas.join('<br>')}</div>`;
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
    // Garante que a imagem atual do item selecionado aparece no preview
    if (this.selecionado?.item?.imagem && !parcial.imagem) {
      parcial.imagem = this.selecionado.item.imagem;
    }
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

  // ---------- novas abas especiais ----------

  /** Aba de Backup: seleciona coleções e salva em coleção separada. */
  async renderizarBackup(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const colecoes = [
      { id: 'items', label: 'Itens', repo: repoItens },
      { id: 'classes', label: 'Classes', repo: repoClasses },
      { id: 'skills', label: 'Talentos', repo: repoSkills },
      { id: 'recipes', label: 'Receitas', repo: repoRecipes },
      { id: 'monsters', label: 'Monstros', repo: repoMonstros },
      { id: 'worldTemplates', label: 'Mundos', repo: repoWorldTemplates },
      { id: 'achievements', label: 'Conquistas', repo: repoAchievements },
      { id: 'estacoes', label: 'Estações', repo: repoEstacoes },
      { id: 'biomas', label: 'Biomas', repo: repoBiomas },
      { id: 'npcs', label: 'NPCs', repo: repoNPCs },
      { id: 'servidores', label: 'Servidores', repo: repoServidores },
    ];
    if (!this.overlay) return;

    conteudo.innerHTML = `
      <div class="painel">
        <h3>Backup do jogo</h3>
        <p style="font-size:12px;color:#7b8794">Selecione as coleções para incluir no backup. O backup é salvo em uma coleção separada e segura.</p>
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <button class="btn-secundario" id="backupSelectAll">Selecionar tudo</button>
          <button class="btn-secundario" id="backupDeselectAll">Desmarcar tudo</button>
        </div>
        <div id="backupLista" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:14px"></div>
        <button class="btn-primario" id="backupSalvar">Criar backup</button>
        <div id="backupStatus" style="margin-top:10px;font-size:12px;color:#5a6a78"></div>
      </div>
      <div class="painel" style="margin-top:16px">
        <h3>Backups anteriores</h3>
        <div id="backupAnteriores"></div>
      </div>`;

    const listaEl = conteudo.querySelector('#backupLista');
    const checkboxes = [];
    for (const col of colecoes) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #dde3ea;border-radius:6px;cursor:pointer';
      label.innerHTML = `<input type="checkbox" checked> <span>${col.label}</span>`;
      listaEl.appendChild(label);
      checkboxes.push({ col, input: label.querySelector('input') });
    }

    conteudo.querySelector('#backupSelectAll').addEventListener('click', () => {
      checkboxes.forEach((c) => { c.input.checked = true; });
    });
    conteudo.querySelector('#backupDeselectAll').addEventListener('click', () => {
      checkboxes.forEach((c) => { c.input.checked = false; });
    });

    conteudo.querySelector('#backupSalvar').addEventListener('click', async () => {
      const selecionadas = checkboxes.filter((c) => c.input.checked).map((c) => c.col);
      if (!selecionadas.length) {
        conteudo.querySelector('#backupStatus').textContent = 'Selecione ao menos uma coleção.';
        return;
      }
      conteudo.querySelector('#backupStatus').textContent = 'Criando backup…';
      try {
        const dados = {};
        for (const col of selecionadas) {
          dados[col.id] = await col.repo.listar();
        }
        const backup = {
          nome: `backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}`,
          criadoEm: new Date().toISOString(),
          colecoes: selecionadas.map((c) => c.id),
          dados,
        };
        await repoBackups.criar(backup);
        conteudo.querySelector('#backupStatus').textContent = 'Backup criado com sucesso!';
        this.renderizarBackup(conteudo);
      } catch (erro) {
        conteudo.querySelector('#backupStatus').textContent = 'Erro: ' + (erro?.message ?? erro);
      }
    });

    // Listar backups anteriores
    try {
      const backups = await this.carregar('backups', () => repoBackups.listar());
      const anterioresEl = conteudo.querySelector('#backupAnteriores');
      if (backups.length) {
        anterioresEl.innerHTML = '<table><thead><tr><th>Data</th><th>Coleções</th><th>Registros</th></tr></thead><tbody>' +
          backups.map((b) => {
            const total = Object.values(b.dados ?? {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
            return `<tr><td>${b.criadoEm ?? '—'}</td><td>${(b.colecoes ?? []).join(', ')}</td><td>${total}</td></tr>`;
          }).join('') + '</tbody></table>';
      } else {
        anterioresEl.innerHTML = '<p style="color:#7b8794">Nenhum backup anterior.</p>';
      }
    } catch (erro) {
      conteudo.querySelector('#backupAnteriores').innerHTML = '<p style="color:#c96a5a">Erro ao listar backups: ' + (erro?.message ?? erro) + '</p>';
    }
  }

  // ---------- novas visões de balanceamento ----------

  /** Tabela dinâmica de balanceamento: todos os registros × atributos numéricos, ordenável por coluna. */
  async renderizarBalanceamento(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const [itens, classes, talentos, monstros, receitas, reinos, conquistas, estacoes] = await Promise.all([
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('talentos', () => repoSkills.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
      this.carregar('receitas', () => repoRecipes.listar()),
      this.carregar('reinos', () => repoWorldTemplates.listar()),
      this.carregar('conquistas', () => repoAchievements.listar()),
      this.carregar('estacoes', () => repoEstacoes.listar()),
    ]);
    if (!this.overlay) return;

    const grupos = [
      ['Item', itens], ['Classe', classes], ['Talento', talentos], ['Monstro', monstros],
      ['Receita', receitas], ['Reino', reinos], ['Conquista', conquistas], ['Estação', estacoes],
    ];
    const linhas = [];
    const chavesNumericas = new Set();
    for (const [grupo, lista] of grupos) {
      for (const r of lista) {
        const nums = {};
        for (const [k, v] of Object.entries(r)) {
          if (typeof v === 'number' && Number.isFinite(v)) { nums[k] = v; chavesNumericas.add(k); }
        }
        linhas.push({ grupo, nome: r.nome ?? r.id, nums });
      }
    }
    const colunas = [...chavesNumericas].sort();
    const ordenar = this._ordemBal ?? { chave: 'nome', dir: 1 };
    const linhasOrdenadas = [...linhas].sort((a, b) => {
      const va = ordenar.chave === 'nome' ? a.nome : (a.nums[ordenar.chave] ?? -Infinity);
      const vb = ordenar.chave === 'nome' ? b.nome : (b.nums[ordenar.chave] ?? -Infinity);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * ordenar.dir;
    });

    conteudo.innerHTML = `
      <div class="painel">
        <h3>Tabela de balanceamento</h3>
        <p style="font-size:12px;color:#7b8794">Clique no cabeçalho para ordenar. Cada célula mostra o valor do atributo numérico do registro.</p>
        <div style="overflow:auto"><table id="balTable">
          <thead><tr>
            <th data-k="grupo" style="cursor:pointer">Cadastro</th>
            <th data-k="nome" style="cursor:pointer">Nome</th>
            ${colunas.map((c) => `<th data-k="${c}" style="cursor:pointer">${c}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${linhasOrdenadas.map((l) => `<tr>
              <td>${l.grupo}</td><td>${l.nome}</td>
              ${colunas.map((c) => `<td>${l.nums[c] ?? '—'}</td>`).join('')}
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
    conteudo.querySelectorAll('#balTable th').forEach((th) => {
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        this._ordemBal = { chave: k, dir: this._ordemBal?.chave === k ? -this._ordemBal.dir : 1 };
        this.renderizarBalanceamento(conteudo);
      });
    });
  }

  /** Balanceamento monetário: itens pelo valor em ouro. */
  async renderizarMonetario(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const itens = await this.carregar('itens', () => repoItens.listar());
    if (!this.overlay) return;
    const ordenar = this._ordemMon ?? { chave: 'valor', dir: -1 };
    const linhas = [...itens].sort((a, b) => {
      const va = a[ordenar.chave] ?? '';
      const vb = b[ordenar.chave] ?? '';
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * ordenar.dir;
    });
    conteudo.innerHTML = `
      <div class="painel">
        <h3>Balanceamento monetário</h3>
        <div style="overflow:auto"><table>
          <thead><tr>
            <th data-k="nome" style="cursor:pointer">Item</th>
            <th data-k="tipo" style="cursor:pointer">Tipo</th>
            <th data-k="raridade" style="cursor:pointer">Raridade</th>
            <th data-k="valor" style="cursor:pointer">Valor (ouro)</th>
            <th data-k="stackMax" style="cursor:pointer">Pilha máx</th>
          </tr></thead>
          <tbody>${linhas.map((i) => `<tr>
            <td><img src="${i.imagem ?? ''}" style="width:22px;height:22px;border-radius:4px;vertical-align:middle;margin-right:6px" onerror="this.style.visibility='hidden'">${i.nome ?? i.id}</td>
            <td>${i.tipo ?? '—'}</td><td>${i.raridade ?? '—'}</td><td>${i.valor ?? 0}</td><td>${i.stackMax ?? '—'}</td>
          </tr>`).join('') || '<tr><td colspan="5">Sem itens.</td></tr>'}</tbody>
        </table></div>
      </div>`;
    conteudo.querySelectorAll('th').forEach((th) => {
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        this._ordemMon = { chave: k, dir: this._ordemMon?.chave === k ? -this._ordemMon.dir : 1 };
        this.renderizarMonetario(conteudo);
      });
    });
  }

  /** Mundos e seus blocos/mobs nativos. */
  async renderizarMundos(conteudo, modo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const [reinos, monstros] = await Promise.all([
      this.carregar('reinos', () => repoWorldTemplates.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
    ]);
    if (!this.overlay) return;
    const monstrosMap = new Map(monstros.map((m) => [m.id, m]));
    conteudo.innerHTML = `
      <div class="painel">
        <h3>${modo === 'mobs' ? 'Mundos & mobs que spawnam' : 'Mundos & seus blocos nativos'}</h3>
        <table>
          <thead><tr><th>Reino</th><th>Bioma</th><th>Níveis</th><th>Dificuldade</th><th>${modo === 'mobs' ? 'Mobs' : 'Loot do mundo'}</th></tr></thead>
          <tbody>${reinos.map((r) => `<tr>
            <td>${r.nome ?? r.id}</td>
            <td>${r.bioma ?? '—'}</td>
            <td>${r.faixaMin ?? 1}–${r.faixaMax ?? 9}</td>
            <td>${'★'.repeat(Math.min(5, r.dificuldade ?? 1))}</td>
            <td>${modo === 'mobs'
              ? (r.monstrosPossiveis ?? []).map((id) => monstrosMap.get(id)?.nome ?? id).join(', ') || '—'
              : (Array.isArray(r.lootGlobal) ? `${r.lootGlobal.length} drop(s)` : (r.lootGlobal ? String(r.lootGlobal).slice(0, 40) : '—'))}</td>
          </tr>`).join('') || '<tr><td colspan="5">Sem reinos.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  /** Portais nativos cadastrados. */
  async renderizarPortaisNativos(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const portais = await this.carregar('portais', () => repoPortais.listar());
    if (!this.overlay) return;
    conteudo.innerHTML = `
      <div class="painel">
        <h3>Portais nativos</h3>
        <p style="font-size:12px;color:#7b8794">Portais que levam a mapas extras (publicados pelos jogadores ou fixos).</p>
        <table>
          <thead><tr><th>Jogador</th><th>Base</th><th>Nível</th><th>Estado</th></tr></thead>
          <tbody>${portais.map((p) => `<tr><td>${p.nome ?? '—'}</td><td>${p.nomeBase ?? '—'}</td><td>${p.nivel ?? 1}</td><td>${p.ativo ? '🟢 ativo' : '⚫ oculto'}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum portal.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  /** Gestão de níveis: curva de XP por nível. */
  renderizarGestaoNiveis(conteudo) {
    const linhas = [];
    for (let n = 1; n <= 60; n += 1) {
      linhas.push(`<tr><td>${n}</td><td>${xpParaProximoNivel(n)}</td><td>${xpTotalParaNivel(n)}</td></tr>`);
    }
    conteudo.innerHTML = `
      <div class="painel">
        <h3>Gestão de níveis — curva de XP</h3>
        <p style="font-size:12px;color:#7b8794">XP necessário para subir de cada nível e XP total acumulado. Ajuste a curva em <code>src/core/progresso.js</code>.</p>
        <div style="max-height:60vh;overflow:auto"><table>
          <thead><tr><th>Nível</th><th>XP para próximo</th><th>XP total</th></tr></thead>
          <tbody>${linhas.join('')}</tbody>
        </table></div>
      </div>`;
  }

  async renderizarEstatisticas(conteudo) {
    conteudo.innerHTML = '<div class="painel">Carregando…</div>';
    const [usuarios, portais, itens, classes, talentos, monstros, receitas, reinos, conquistas, biomas, npcs, estacoes, servidores] = await Promise.all([
      this.carregar('usuarios', () => repoUsuarios.listar()),
      this.carregar('portais', () => repoPortais.listar()),
      this.carregar('itens', () => repoItens.listar()),
      this.carregar('classes', () => repoClasses.listar()),
      this.carregar('talentos', () => repoSkills.listar()),
      this.carregar('monstros', () => repoMonstros.listar()),
      this.carregar('receitas', () => repoRecipes.listar()),
      this.carregar('reinos', () => repoWorldTemplates.listar()),
      this.carregar('conquistas', () => repoAchievements.listar()),
      this.carregar('biomas', () => repoBiomas.listar()),
      this.carregar('npcs', () => repoNPCs.listar()),
      this.carregar('estacoes', () => repoEstacoes.listar()),
      this.carregar('servidores', () => repoServidores.listar()),
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
        <div class="card teal"><h2>${reinos.length}</h2><p>Mundos</p></div>
        <div class="card teal"><h2>${conquistas.length}</h2><p>Conquistas</p></div>
        <div class="card teal"><h2>${biomas.length}</h2><p>Biomas</p></div>
        <div class="card teal"><h2>${npcs.length}</h2><p>NPCs</p></div>
        <div class="card teal"><h2>${estacoes.length}</h2><p>Estações</p></div>
        <div class="card teal"><h2>${servidores.length}</h2><p>Servidores</p></div>
      </div>
      <div class="painel">
        <h3>Uso de vocações</h3>
        ${Object.entries(porVocacao).sort((a, b) => b[1] - a[1]).map(([v, n]) => `
          <div class="bar-linha"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${v}</span><span>${n}</span></div>
          <div class="bar-fundo"><div class="bar-cheio" style="width:${Math.round((n / maxVoc) * 100)}%"></div></div></div>`).join('') || '<p style="color:#7b8794">Sem dados.</p>'}
      </div>
      <div class="painel" style="margin-top:16px">
        <h3>Quadradinhos cadastrados (itens)</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${itens.map((i) => i.imagem
            ? `<img src="${i.imagem}" title="${i.nome ?? i.id}" style="width:38px;height:38px;border-radius:6px;object-fit:cover;background:#eef1f5">`
            : `<div title="${i.nome ?? i.id}" style="width:38px;height:38px;border-radius:6px;background:#eef1f5;display:flex;align-items:center;justify-content:center;font-size:11px;color:#7b8794">${String(i.nome ?? '?').slice(0, 2)}</div>`).join('') || '<p style="color:#7b8794">Sem itens.</p>'}
        </div>
      </div>`;
  }
}
