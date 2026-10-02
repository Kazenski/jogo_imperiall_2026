# Novidades do Império

Notas de atualização do **Jogo Imperiall 2026**, escritas para quem joga.
Para o registro de código, veja [`CHANGELOG_TECNICO.md`](CHANGELOG_TECNICO.md).

Este jogo está em desenvolvimento aberto. Se encontrar algo quebrado, o
caminho mais rápido é relatar com o que você estava fazendo na tela.

---

## Atualização — Refinamento de base, Wiki e Talentos

*Outubro de 2026*

Desta vez a atualização não é sobre número grande. É sobre **você conseguir
entender o que está acontecendo** — e sobre o jogo não te cobrar nada sem
explicar.

### Chegou: a Wiki do Império (tecla H)

Aperte **H** a qualquer momento. Isso abre a Wiki do Império, que é o livro de
referência do jogo inteiro:

- **Controles** — todas as teclas, o que cada uma faz
- **Itens** — o que cada item é, para que serve, o que ele rende quando você
  extrai e quais orbes aceita
- **Talentos** — todas as ramificações, o que cada uma faz e o que vem antes
- **Classes, Monstros, Reinos, Orbes e Conquistas**

Você pode **pesquisar** dentro da wiki. Escreve o nome do item ou do talento e
ele te leva direto.

Um detalhe importante: **tudo o que você lê na wiki foi escrito por quem
administra o jogo.** Item sem descrição aparece com os números em vez de
vazio — mas a explicação boa depende de alguém escrever. Quanto mais coisa
cadastrada, melhor a wiki fica.

### Chegou: tela de criação de personagem

Antes de entrar no mundo, você agora **cria o seu personagem**. Escolhe o nome,
a raça e a vocação.

Isso não é enfeite. O motivo é prático: o mundo genera criaturas ao redor de
quem entra, e antes você aparecia no meio delas sem ter decided nada. Agora
você decide primeiro.

São quatro raças: **Humano do Norte**, **Anão da Forja**, **Elfo do Véu** e
**Orc do Sul**. Cada uma com sua história.

Uma coisa importante sobre a raça: **nenhuma delas dá bônus de atributo.** A
raça é sobre identidade, não sobre qual número sai maior na ficha. Se você
quer força, isso vem da vocação e dos talentos — e a escolha fica sendo sua de
verdade.

Também dá para voltar nessa tela depois para ajustar seu personagem. Nome e
raça travam a partir do nível 3.

### Melhorou: Talentos

A árvore de talentos foi refeita do zero. Agora ela tem:

- **Ramificações coloridas** — os talentos se agrupam em caminhos que você
  consegue distinguir de longe
- **Ficha ao clicar** — clique uma vez e veja o que o talento faz, o que
  precisa vir antes, e por que está travado
- **Pré-requisitos reais** — além de exigir outros talentos, um talento pode
  exigir **atributo**. "Só se seu Físico chegar a 5." Isso significa que a
  ordem em que você distribui seus pontos importa
- **Respec gratuito** — errou a ordem? Redefinir a árvore não custa nada

Detalhe de uso: **clique uma vez para ler, clique duas vezes para liberar.** É
proposital — liberar um talento gasta ponto e não dá para desfazer com um
clique acidental, então o gesto é duplo.

### Melhorou: Fabricação

A oficina foi reorganizada. As estações agora quebram em linhas quando a tela
é estreita (antes saíam da borda), a lista tem rolagem, e o painel da direita
mostra **o que falta** — quanto de cada insumo você tem e quanto ainda
precisa.

### Corrigido: a tela estava torta

Se algum painel parecia desalinhado, ou se os campos do painel administrativo
não apareciam direito, a causa era uma conta errada de posição no desenho das
caixas. Não era estilo, era geometria — e agora está corrigida na origem.

### Corrigido: talento criado no painel sumia

Se você é administrador: **talentos novos que você cadastrava não apareciam em
nenhuma árvore.** O registro era salvo, o painel confirmava — e o jogo não
mudava. Corrigido.

### Melhorou: Painel administrativo (F2)

O painel de administração foi reconstruído para dar menos trabalho:

- **Formulários simples e em duas colunas**, com todos os campos visíveis
- **Upload de imagem com preview** — você vê a imagem antes de salvar
- **Nada de campo mágico**: cada tipo de cadastro tem exatamente os campos que
  precisa, com o texto explicando o que cada um faz
- **Aviso antes de apagar**: se um item é usado em várias receitas, ou se um
  talento é pré-requisito de outros, você é avisado na hora, com a contagem
- **Abas novas: Portais e Jogadores.** A aba Jogadores promove e rebaixa
  administradores. A aba Portais publica ou esconde a base de alguém sem
  apagar o progresso da pessoa

### Termos de uso e privacidade

Passamos a pedir aceite dos Termos de Uso e da Política de Privacidade na
primeira vez que você entra com conta. O aceite é versionado — quando o
documento mudar, você vai ser avisado de novo.

Você também pode **apagar tudo** que temos sobre você, direto no painel do
Personagem (**V**), no rodapé: **"Apagar meu progresso"**. Apaga a conta de
jogo, sua base e o seu portal. Não dá para desfazer, então há uma confirmação
com a lista do que vai sumir.

> Aviso honesto: estes textos são um rascunho de trabalho. Ainda precisam passar
> por um advogado habilitado antes de o jogo ser aberto ao público. Preferimos
> dizer isso agora a descobrir depois.

### Detalhes menores que importam

- **ESC não desloga mais.** Ele fecha o painel que está aberto.
- **Fechar painel** não confunde mais com sair do jogo.
- Ao desbloquear um talento, o mundo **atualiza na hora** — o bônus aparece no
  jogo, não só na ficha.

### Correções de conhecido

Estamos de olho em um caso em que o jogo às vezes pede login de novo
inesperadamente. Já corrigimos três causas possíveis, mas **não conseguimos
reproduzir ainda**. Se acontecer com você, por favor relate — esse tipo de
problema só aparece quando a gente tenta replicar, e o relato ajuda mais do que
a tentativa.

---

## Ainda está em construção

Para não ter surpresa, o que **não** está pronto:

- **Combate automático e missões** — desenhados, em construção
- **Painel administrativo testado de ponta a ponta** — foi reescrito, mas ainda
  estamos verificando campo por campo
- **Revisão visual dos menus restantes** — Reinos, Portais, Personagem
- **Textos legais finais** — dependem de parecer jurídico

Nada disso foi anunciado como pronto porque ainda não está.

---

## Como ajudar

1. **Jogue e conte o que quebrou.** Um relato com a tela e o que você estava
   fazendo vale mais que um relatório formal.
2. **Se tiver conta no Google**, entre sempre pela mesma conta — o progresso
   fica salvo e sincroniza entre os dispositivos.
3. **Cadastre conteúdo no painel.** A wiki fica boa na medida em que item,
   talento e monstro têm descrição e imagem escrita.

Obrigado por construir o Império com a gente.
