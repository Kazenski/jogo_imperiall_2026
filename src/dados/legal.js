// Textos legais do Jogo Imperiall 2026.
//
// AVISO IMPORTANTE: estes textos são um MODELO de trabalho, redigido para
// prender as obrigações que o marco do ECA Digital e a LGPD impõem a um jogo
// online. Eles NÃO substituem revisão de advogado. Antes de abrir ao público,
// os pontos abaixo precisam de passar por profissional habilitado:
//
//  1. Identificação do controlador, do servidor e do canal de contato.
//  2. Política de Privacidade completa (Lei 13.709/2018): base legal de cada
//     dado, compartilhamento com o Google (Firebase), retenção, direitos do
//     titular e prazo de resposta.
//  3. Canal de atendimento ao consumidor (CDC, Lei 8.078/1990), com prazo de
//     resposta e identificação do fornecedor.
//  4. Política de reembolso. O jogo é gratuito e não cobra, mas a política
//     precisa existir mesmo assim caso algum dia haja compra.
//  5. ECA Digital (Lei 15.263/2025): remover conteudo, encerrar conta e
//     registrar alterações.
//
// O que o CÓDIGO garante, e que o texto precisa refletir:
//
//  - Login pelo Google: só coletamos o que o Google devolve (uid, nome, e-mail,
//    foto) e apenas quando a pessoa clica em "Entrar com Google".
//  - Nada é vendido e nada é compartilhado com terceiros além do Google.
//  - O progresso fica em `jogadores/{uid}`, legível e gravável só pelo próprio
//    uid (ver firestore.rules).
//  - O progresso é espelhado em localStorage para o caso de a sessão cair.
//  - O jogador pode apagar tudo pelo botão "Apagar meu progresso", que remove
//    `users/{uid}`, `jogadores/{uid}` e `portais/{uid}`.
//  - Versão e data do aceite ficam em `jogadores/{uid}.termos`, e mudar a
//    VERSÃO_TERMOS força um novo aceite antes de entrar no mundo.
//  - Para menores: o jogo não pede data de nascimento nem usa dados que
//    identifiquem uma criança. Sem verificação de idade não é possível afirmar
//    "serviço infantil com consentimento específico do responsável" (art. 14 da
//    LGPD). Esse enquadramento está na lista do advogado.

export const VERSAO_TERMOS = '1.0.0';
export const DATA_TERMOS = '2026-10-01';

/**
 * Data de vigência: uma vez definida, ela NÃO volta.
 *
 * O objetivo é permitir mostrar a quem entrou "você aceitou esta versão em tal
 * data" sem ambiguity. Reverter uma data de vigência diria ao jogador que ele
 * aceitou um termo que ainda não existia.
 */
export const ACEITE_REQUERIDO = {
  versao: VERSAO_TERMOS,
  data: DATA_TERMOS,
};

export const TERMOS = [
  {
    titulo: '1. O que é este jogo',
    corpo:
      'Jogo Imperiall 2026 é um jogo de navegador, gratuito, de fantasia medieval. ' +
      'Você constrói uma base, extrai recursos, fabrica itens, enfrenta monstros e pode ' +
      'convidar amigos para visitar sua base por um Portal Arcano. O jogo funciona ' +
      'inteiramente no navegador e não exige download.',
  },
  {
    titulo: '2. Conta e quem joga',
    corpo:
      'Para salvar seu progresso entre dispositivos você entra com sua conta Google. ' +
      'Ao fazer isso, o jogo recebe o identificador da conta (uid), o nome, o e-mail e a ' +
      'foto que você autorizou no Google, nada além disso. Sem login dá para jogar, mas o ' +
      'progresso fica só neste navegador e se perde se você limpar os dados do site.\n\n' +
      'QUEM JOGA: este jogo é destinado a maiores de 14 anos ou a menores de 14 anos ' +
      'com autorização e supervisão do responsável. O responsável deve criar a conta e ' +
      'acompanhar o uso. Não coletamos data de nascimento, documento nem qualquer dado ' +
      'que permita identificar uma criança.',
  },
  {
    titulo: '3. Quais dados coletamos',
    corpo:
      'Nome, e-mail, identificador da conta e foto (vindos do Google, mediante sua autorização);\n' +
      'progresso de jogo (nível, itens, vocação, talentos, base, conquistas);\n' +
      'registro de que você aceitou estes termos, com versão e data;\n' +
      'nosso registro de suporte, caso você escreva para a gente.\n\n' +
      'Não coletamos número de telefone, endereço, documentos, geolocalização, contatos do ' +
      'seu aparelho nem dados de navegação para publicidade.',
  },
  {
    titulo: '4. Para que usamos seus dados',
    corpo:
      'Para o jogo funcionar: guardar seu progresso, exibir sua base para os amigos que você ' +
      'autorizar, manter conquistas e o ranking do Império. Não vendemos, não alugamos e não ' +
      'cedemos seus dados, e não os usamos para publicidade.',
  },
  {
    titulo: '5. Com quem compartilhamos',
    corpo:
      'A autenticação e o armazenamento são feitos pelo Google Firebase, que processa esses ' +
      'dados em nome do jogo. Fora isso, o jogo não compartilha dados com terceiros. Se uma ' +
      'obrigação legal ou uma decisão judicial exigir, os dados单品 necessários podem ser ' +
      'apresentados ao requerente, e você será avisado sempre que possível.',
  },
  {
    titulo: '6. Onde ficam e por quanto tempo',
    corpo:
      'Os dados ficam em servidores do Google Firebase. O progresso é espelhado também no ' +
      'armazenamento local do seu navegador, para o jogo continuar funcionando se a conexão ' +
      'cair. Os dados são mantidos enquanto sua conta existir ou enquanto você não pedir a ' +
      'eliminação.',
  },
  {
    titulo: '7. Seus direitos (Lei 13.709/2018, LGPD)',
    corpo:
      'A qualquer momento você pode: acessar seus dados; corrigi-los; pedir a exclusão ' +
      'definitiva; revogar o consentimento; pedir a portabilidade; saber com quem seus dados ' +
      'foram compartilhados.\n\n' +
      'No próprio jogo existe o botão "Apagar meu progresso", na aba do Personagem, que ' +
      'exclui tudo de uma vez. Para os demais pedidos, escreva no contato da seção 12. ' +
      'Respondemos em até 15 dias.',
  },
  {
    titulo: '8. Consentimento de menores',
    corpo:
      'Este jogo não é direcionado a menores de 14 anos. Se o usuário é menor, o ' +
      'consentimento precisa ser dado pelo responsável, que tem direito de acesso e de ' +
      'eliminação dos dados a qualquer momento. Se você acredita que uma conta de menor está ' +
      'usando o jogo sem autorização do responsável, avise no contato da seção 12 e a conta ' +
      'será removida.',
  },
  {
    titulo: '9. Mudanças no jogo e nos termos',
    corpo:
      'Podemos atualizar estes termos quando o jogo mudar. A versão e a data aparecem na tela ' +
      'de aceite. Quando a versão muda, o jogo pede o aceite de novo antes de você entrar no ' +
      'mundo. Se você não concordar com a nova versão, pode encerrar a conta e apagar seus ' +
      'dados.',
  },
  {
    titulo: '10. Responsabilidades do jogador',
    corpo:
      'O jogo é gratuito e não usa dinheiro real: não há compra, venda ou troca de itens, ' +
      'ouro, orbes ou contas. Você é responsável por manter sua conta segura e por respeitar ' +
      'os outros jogadores. Assédio, exploração de falhas e automação que prejudiquem a ' +
      'experiência alheia não são tolerados e podem levar ao bloqueio da conta.',
  },
  {
    titulo: '11. Disponibilidade e limites',
    corpo:
      'O jogo é oferecido como está, sem garantia de funcionamento ininterrupto. Pode haver ' +
      'manutenção, mudanças de conteúdo ou remoção de recursos sem aviso prévio. Não há ' +
      'qualquer obrigação de compensate por isso, já que não existe cobrança.',
  },
  {
    titulo: '12. Contato',
    corpo:
      'Dúvidas sobre estes termos, sobre seus dados ou sobre o jogo:\n' +
      'kazenski.developer@gmail.com\n\n' +
      'Pedidos de acesso, correção ou eliminação de dados são feitos por este canal e são ' +
      'respondidos em até 15 dias.',
  },
];

export const PRIVACIDADE = [
  {
    titulo: 'Controlador',
    corpo:
      'O controlador dos dados é o projeto Jogo Imperiall 2026. Contato: ' +
      'kazenski.developer@gmail.com.',
  },
  {
    titulo: 'Categorias de dados e base legal',
    corpo:
      'Dados de identificação (uid, nome, e-mail, foto): fornecidos por você ao entrar com a ' +
      'conta Google. Base legal: execução de contrato.\n' +
      'Dados de jogo (nível, itens, base, talentos, conquistas, portal publicado): ' +
      'necessários ao funcionamento. Base legal: execução de contrato.\n' +
      'Registro do aceite dos termos: obrigação legal.\n' +
      'Conta de menor supervisionada: consentimento do responsável.\n\n' +
      'Não há tratamento para publicidade, nem decisão automatizada que produza efeitos ' +
      'jurídicos sobre você.',
  },
  {
    titulo: 'Compartilhamento',
    corpo:
      'Google Firebase, para autenticação e banco de dados, como operador contratado pelo ' +
      'controlador. Nenhum outro terceiro.',
  },
  {
    titulo: 'Direitos do titular',
    corpo:
      'Acesso, correção, portabilidade, informação sobre compartilhamento, revogação do ' +
      'consentimento e eliminação, nos termos do art. 18 da LGPD. Use o botão "Apagar meu ' +
      'progresso" no jogo ou escreva para o contato. Prazo de resposta: até 15 dias.',
  },
  {
    titulo: 'Segurança',
    corpo:
      'As regras de segurança do banco de dados restringem a leitura de cada progresso ao ' +
      'dono da conta. Um portal publicado expõe apenas nome, nome da base e nível. As regras ' +
      'estão no arquivo firestore.rules, no repositório do projeto.',
  },
  {
    titulo: 'Menores',
    corpo:
      'O jogo não coleta data de nascimento nem dados que permitam identificar crianças. ' +
      'Usuários menores de 14 anos devem ter a conta criada e vigiada por um responsável, ' +
      'que assume o papel de titular dos dados.',
  },
];

export const ACEITE_PENDENTE = ACEITE_REQUERIDO;