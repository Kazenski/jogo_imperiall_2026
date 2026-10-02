import Phaser from 'phaser';
import { OURO, PERGAMINHO } from '../constants.js';
import { TERMOS, PRIVACIDADE, VERSAO_TERMOS, DATA_TERMOS } from '../dados/legal.js';
import { painel as uiPainel, botao, texto as uiTexto, titulo as uiTitulo, aoTeclar } from '../ui/comuns.js';

/**
 * Tela de aceite dos Termos de Uso e da Política de Privacidade.
 *
 * Aparece entre o login e o mundo sempre que `jogadores/{uid}.termos` não bate
 * com a `VERSAO_TERMOS` atual. Mudar a versão no `dados/legal.js` faz o jogo
 * pedir o aceite de novo — é assim que o aviso de alteração funciona sem
 * depender de servidor.
 *
 * Não é uma cena modal sobre o mundo porque ninguém deve entrar no mundo sem
 * passar por aqui, e a cena garante que isso aconteça: `World` só é iniciado
 * por `LoginScene` depois deste aceite.
 */
export class TermosScene extends Phaser.Scene {
  constructor() {
    super('Termos');
  }

  init(dados) {
    this.uid = dados?.uid ?? null;
    this.estado = dados?.estado ?? null;
    this.nome = dados?.nome ?? null;
    this.catalogo = dados?.catalogo ?? null;
    this.perfil = dados?.perfil ?? null;
    this.isAdmin = dados?.isAdmin ?? false;
    this.aoAceitar = dados?.aoAceitar ?? (() => {});
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0a07');

    this.abaAtual = 'termos';
    this.desloc = { termos: 0, privacidade: 0 };

    this.raiz = this.add.container(0, 0);

    this.montar();

    const aoRedimensionar = () => this.montar();
    this.scale.on(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, aoRedimensionar);
    });

    aoTeclar(this, 'ESC', () => this.voltarAoLogin());
  }

  get lista() {
    return this.abaAtual === 'termos' ? TERMOS : PRIVACIDADE;
  }

  montar() {
    const { width, height } = this.scale;
    this.raiz.removeAll(true);
    // `montar()` roda de novo a cada troca de aba e a cada resize; a mascara da
    // rodada anterior e destruida aqui, senao cada rolagem da tela deixaria um
    // Graphics solto na lista de display.
    this.mascaraAtual?.destroy();
    this.mascaraAtual = null;

    const margem = 24;
    const w = Math.max(560, Math.min(920, width - margem * 2));
    const h = Math.max(420, Math.min(760, height - margem * 2));
    const x0 = Math.round((width - w) / 2);
    const y0 = Math.round((height - h) / 2);

    this.raiz.add(
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9).setInteractive(),
    );
    this.raiz.add(uiPainel(this, x0, y0, w, h));

    this.raiz.add(uiTitulo(this, x0 + 28, y0 + 22, 'ANTES DE ENTRAR NO IMPÉRIO', '20px'));
    this.raiz.add(
      uiTexto(this, x0 + 28, y0 + 50, `Versão ${VERSAO_TERMOS} · ${DATA_TERMOS}`, {
        fontSize: '11px',
        color: OURO,
      }).setOrigin(0, 0),
    );

    // Abas
    const abas = [
      { id: 'termos', rotulo: 'Termos de Uso' },
      { id: 'privacidade', rotulo: 'Privacidade (LGPD)' },
    ];
    let ax = x0 + 28;
    for (const aba of abas) {
      const ativa = aba.id === this.abaAtual;
      const bw = aba.rotulo.length * 7 + 30;
      const b = botao(this, ax + bw / 2, y0 + 86, aba.rotulo, () => {
        this.abaAtual = aba.id;
        this.montar();
      }, {
        largura: bw,
        altura: 28,
        tamanho: '12px',
        cor: ativa ? 0xd4af6a : 0x241c14,
        corHover: ativa ? 0xd4af6a : 0x3a2c20,
        corBorda: 0x8a6a2f,
        corTexto: ativa ? '#14100c' : PERGAMINHO,
      });
      this.raiz.add(b.caixa);
      ax += bw + 8;
    }

    // Corpo rolável
    const corpoX = x0 + 28;
    const corpoY = y0 + 112;
    const corpoW = w - 56;
    const corpoH = h - 112 - 108;

    this.raiz.add(uiPainel(this, corpoX - 8, corpoY - 6, corpoW + 16, corpoH + 12, 0x0d0a07, 0.9));

    const conteudoAltura = this.alturaConteudo(corpoW - 40);
    const visivelAltura = corpoH - 20;
    const maxDesloc = Math.max(0, conteudoAltura - visivelAltura);
    const desloca = Math.min(this.desloc[this.abaAtual] ?? 0, maxDesloc);

    // `setMask` nao aceita Graphics e Rectangle devolve mascara que precisa ser
// destruida junto com a cena. O objeto de mascara e criado aqui e guardado para
// nao vazar um Rectangle a cada `montar()` (o botao de aba chama `montar()`).
const mascara = this.make.graphics({ x: 0, y: 0 }, false);
    mascara.fillStyle(0xffffff, 1);
    mascara.fillRect(corpoX, corpoY, corpoW, corpoH);

    const area = this.add.container(corpoX + 6, corpoY).setMask(mascara.createGeometryMask());
    this.mascaraAtual = mascara;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mascara.destroy());

    let y = 0;
    for (const secao of this.lista) {
      area.add(
        uiTitulo(this, 0, y, secao.titulo, '14px')
          .setOrigin(0, 0)
          .setColor(OURO),
      );
      y += 24;

      const texto = uiTexto(this, 0, y, secao.corpo, {
        fontSize: '12px',
        color: PERGAMINHO,
        wordWrap: { width: corpoW - 30 },
        lineSpacing: 4,
      }).setOrigin(0, 0);
      texto.setAlpha(0.9);
      area.add(texto);
      y += texto.height + 20;
    }

    area.setY(corpoY - desloca);
    this.raiz.add(area);

    // Barra de rolagem
    if (maxDesloc > 0) {
      const trilhoX = corpoX + corpoW - 8;
      const alturaTrilho = visivelAltura;
      const proporcao = visivelAltura / conteudoAltura;
      const alturaDedal = Math.max(28, alturaTrilho * proporcao);
      const posDedal = ((alturaTrilho - alturaDedal) * desloca) / maxDesloc;

      this.raiz.add(
        caixaSimples(this, trilhoX, corpoY + 4, 4, alturaTrilho - 8, 0x2a2018, 2),
      );
      this.raiz.add(
        caixaSimples(this, trilhoX, corpoY + 4 + posDedal, 4, alturaDedal, 0xd4af6a, 2),
      );

      // Roda do mouse: Phaser 3.90 usa `this.input.on('wheel', callback)` onde o
      // callback recebe (pointer, currentlyOver, dx, dy, dz). O `dy` e o delta
      // vertical. `this.input` e o InputPlugin da cena, nao o manager.
      const onRoda = (pointer, _over, _dx, _dy, dy) => {
        this.desloc[this.abaAtual] = Math.max(
          0,
          Math.min(maxDesloc, (this.desloc[this.abaAtual] ?? 0) + dy * 0.6),
        );
        this.montar();
      };
      this.input.on('wheel', onRoda);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.input.off('wheel', onRoda),
      );
    }

    // Ações
    const yAcao = y0 + h - 40;
    const cbx = x0 + w / 2;

    const btnAceitar = botao(this, cbx + 110, yAcao, 'Aceito, entrar no Império', () => this.aceitar(), {
      largura: 250,
      altura: 36,
      tamanho: '13px',
    });
    this.raiz.add(btnAceitar.caixa);

    const btnSair = botao(this, cbx - 110, yAcao, 'Não aceitar', () => this.voltarAoLogin(), {
      largura: 200,
      altura: 36,
      tamanho: '13px',
      cor: 0x3a2c20,
      corHover: 0x4a3828,
      corBorda: 0x8a6a2f,
      corTexto: PERGAMINHO,
    });
    this.raiz.add(btnSair.caixa);

    // Texto "Ao aceitar..." - fica ACIMA dos botoes, com padding do painel.
    // Antes estava em yAcao + 30 = y0 + h - 10, ou seja, COLADO na borda
    // inferior do painel (que termina em y0 + h). Agora fica com 16px de
    // margem do fundo do painel.
    const yAceitar = y0 + h - 16 - 36; // 16px margem + ~20px altura do texto (duas linhas)
    this.raiz.add(
      uiTexto(
        this,
        cbx,
        yAceitar,
        'Ao aceitar você concorda com o tratamento de dados descrito na aba de Privacidade. O botão "Apagar meu progresso" está no Personagem (V).',
        { fontSize: '10px', color: PERGAMINHO, align: 'center', wordWrap: { width: w - 60 } },
      )
        .setOrigin(0.5, 1) // ancorado no bottom-center
        .setAlpha(0.6),
    );
  }

  alturaConteudo(larguraUtil) {
    // Soma das alturas reais: sem isto a barra de rolagem anda errado.
    let total = 0;
    for (const s of this.lista) {
      const t = uiTexto(this, 0, 0, s.corpo, {
        fontSize: '12px',
        wordWrap: { width: larguraUtil },
        lineSpacing: 4,
      });
      total += 24 + t.height + 20;
      t.destroy();
    }
    return total;
  }

  /** Grava a versão aceita no estado; a persistência é do LoginScene. */
  aceitar() {
    this.aoAceitar?.({ versao: VERSAO_TERMOS, data: DATA_TERMOS });
  }

  voltarAoLogin() {
    this.scene.stop('Termos');
    this.scene.start('Login');
  }
}

function caixaSimples(scene, x, y, w, h, cor, raio) {
  const g = scene.add.graphics();
  g.fillStyle(cor, 1);
  g.fillRoundedRect(x, y, w, h, raio);
  return g;
}