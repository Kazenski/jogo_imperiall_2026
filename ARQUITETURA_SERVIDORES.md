# Arquitetura de Servidores — Decisão e Implementação Base

## Contexto

O jogo usa **Firebase (Auth + Firestore + Storage)** como backend. A questão é
se precisamos de **servidores dedicados** (Node.js/Go/etc.) além do Firebase,
considerando:

1. **Portais Arcanos** — qualquer personagem que chega num portal e clica "salvar"
   pode ir para a base de qualquer amigo (cross-world travel).
2. **Auto-combate / Auto-farm** futuro — o jogador não fica na frente da tela.
3. **Guildas / Grupos** — escolas, empresas, cidades jogando juntas.
4. **Anti-cheat** — validação server-side de ações críticas.
5. **Escala** — Firebase tem limites de custo/escrita; servidores próprios podem
   ser mais baratos em alta escala.

---

## Decisão: Arquitetura Híbrida (Firebase + Servidor de Jogo Leve)

**Não** vamos migrar tudo para servidores próprios agora. O Firebase continua
sendo o **banco de dados autoritativo** e **auth**. Adicionamos um **servidor
de jogo (Game Server)** leve para:

| Responsabilidade | Onde roda |
|---|---|
| Auth, perfil, progresso, itens, base, portais, catálogo | **Firestore** (já feito) |
| Upload de imagem | **Firebase Storage** (já feito) |
| Matchmaking de portais (quem está online na base X) | **Game Server** (novo) |
| Sincronização de estado em tempo real (combate, movimento) | **Game Server** (novo) |
| Auto-combate / Auto-farm (server-side tick) | **Game Server** (novo) |
| Validação anti-cheat (server-authoritative) | **Game Server** (novo) |
| Guildas / chat / convites / logs de auditoria | **Game Server** (novo) |
| Leaderboards / eventos globais | **Game Server** (novo) |

### Por que não mover tudo para servidor próprio?

1. **Firestore já funciona** — auth, regras de segurança, offline-first, sincronização
   entre dispositivos. Reescrever isso custa meses.
2. **Custo/benefício** — Firebase Spark/Blaze cobre o uso atual. Servidor próprio
   só compensa se tivermos >10k DAU com tick constante.
3. **Portais já funcionam** — `portais/{uid}` no Firestore já permite achar bases
   de amigos. Matchmaking server-side é otimização, não requisito.

---

## Implementação Base — Game Server (Node.js + Colyseus / Socket.io)

> **Stack recomendada**: **Node.js + Colyseus** (state synchronization, rooms,
> schema, presence) ou **Socket.io + Redis** (mais simples, mais controle).

### Estrutura mínima

```
game-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Config (port, Redis, Firebase Admin SDK)
│   ├── rooms/
│   │   ├── PortalRoom.ts        # Matchmaking de portais (quem está na base)
│   │   ├── WorldRoom.ts         # Sala do mundo (movimento, combate, tick)
│   │   ├── GuildRoom.ts         # Guildas / chat / convites
│   │   └── LobbyRoom.ts         # Lobby multi-char (presença, convites)
│   ├── systems/
│   │   ├── CombatSystem.ts      # Auto-combate server-side
│   │   ├── MovementSystem.ts    # Validação de movimento
│   │   ├── AntiCheat.ts         # Validação de ações (speedhack, godmode)
│   │   └── PortalSystem.ts      # Teleporte entre bases
│   ├── schemas/
│   │   ├── PlayerSchema.ts      # Colyseus Schema (position, stats, etc.)
│   │   ├── PortalSchema.ts
│   │   └── GuildSchema.ts
│   ├── firebase/
│   │   ├── admin.ts             # Firebase Admin SDK init
│   │   ├── sync.ts              # Sync Firestore ↔ Server state
│   │   └── auth.ts              # Verifica token Firebase do client
│   └── utils/
│       ├── logger.ts
│       └── metrics.ts
└── docker/
    ├── Dockerfile
    └── docker-compose.yml       # Server + Redis + Prometheus/Grafana
```

---

## Protocolo Cliente ↔ Servidor

O cliente (Phaser) mantém a **autoridade visual** (render, input, UI), mas
ações críticas passam pelo servidor:

| Ação | Cliente faz | Servidor valida |
|---|---|---|
| Movimento (WASD) | Predição local + envia input | Recalcula posição, checa colisão, devolve correção se > threshold |
| Ataque / Habilidade | Animação local + envia `useSkill(id)` | Checa cooldown, alcance, mana, aplica dano, replica para outros |
| Entrar em portal | Clique em portal → `enterPortal(targetUid)` | Checa se base está visível, online, não cheia; teleporta |
| Auto-combate ON | Botão "Auto" → `startAutoFarm()` | Server roda tick de combate, envia resultados (xp, loot) |
| Coleta / Mineração | Clique no nó → `collect(nodeId)` | Checa distância, ferramenta, stamina; dá loot/xp |
| Chat / Guilda | Digita mensagem → `send(msg)` | Valida spam, profanidade, replica para membros |

### Formato de mensagem (JSON sobre WebSocket)

```json
{ "type": "input", "seq": 123, "payload": { "move": { "x": 1, "y": 0 } } }
{ "type": "action", "seq": 124, "payload": { "skillId": "bola_de_fogo", "target": "monster_42" } }
{ "type": "portal", "seq": 125, "payload": { "targetUid": "abc123" } }
{ "type": "autoFarm", "seq": 126, "payload": { "enabled": true, "radius": 200 } }
```

Servidor responde com `ack` + estado corrigido se divergência > threshold.

---

## Integração com Firebase (Auth + Firestore)

### Firebase Admin SDK no servidor

```typescript
// src/firebase/admin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().length === 0
  ? initializeApp({ credential: cert(require('./service-account.json')) })
  : getApps()[0];

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
```

### Verificação de token do cliente

```typescript
// Middleware Colyseus / Socket.io
async function verifyFirebaseToken(token: string) {
  const decoded = await adminAuth.verifyIdToken(token, true); // checkRevoked
  return { uid: decoded.uid, email: decoded.email };
}
```

### Sincronização Firestore ↔ Server State

- **Escrita server → Firestore**: progresso, xp, loot, base, conquistas (batch a cada 5s ou no logout).
- **Leitura Firestore → Server**: carrega estado inicial do personagem ao entrar na sala.
- **Listeners Firestore → Server**: mudanças de catálogo (itens, talentos) recarregam schema em memória.

---

## Anti-Cheat (Server-Authoritative)

| Cheat | Detecção server-side |
|---|---|
| Speedhack | Distância percorrida / tick > velocidade máxima + margem |
| Godmode | Vida não diminui ao receber dano calculado pelo server |
| Teleport | Delta posição > alcance máximo por tick (sem portal/skill) |
| Auto-clicker / Macro | Padrão de input perfeitamente periódico (entropia baixa) |
| Wallhack / Maphack | Cliente não recebe entidades fora do FOV (server não envia) |
| Item duplication | Transações atômicas no Firestore (batch) + validação server |

**Ação**: kick + ban temporário + log de auditoria (uid, ação, timestamp, evidência).

---

## Auto-Combate / Auto-Farm (Server-Side Tick)

O jogador liga "Auto-Farm" no cliente → cliente envia `autoFarm: { enabled: true, radius: 200 }`.

Servidor roda **tick a 10Hz (100ms)** para aquele personagem:

```typescript
// systems/CombatSystem.ts
function autoFarmTick(player: Player, room: WorldRoom) {
  if (!player.autoFarm.enabled) return;

  // 1. Acha alvos no raio (monstros, nós de recurso)
  const targets = room.findTargetsInRadius(player.position, player.autoFarm.radius);

  // 2. Prioriza: monstro agressivo > nó de recurso necessário > monstro passivo
  const target = prioritize(targets, player);

  if (target) {
    // 3. Move até alcance (pathfinding simples ou move-to)
    const dist = distance(player.position, target.position);
    if (dist > player.attackRange) {
      moveTowards(player, target.position);
    } else {
      // 4. Ataca / coleta
      if (target.type === 'monster') attack(player, target);
      else if (target.type === 'node') collect(player, target);
    }
  }

  // 5. Regeneração, buffs, etc.
  regenTick(player);
}
```

**Resultado** (xp, ouro, loot, itens) é escrito no Firestore (batch) e notificado
ao cliente via `onLoot({ xp, gold, items })`.

---

## Guildas / Grupos / Servidores Dedicados

### Modelo

- **Guilda** = documento em `guilds/{guildId}` no Firestore (nome, tag, dono, membros[]).
- **Sala de Guilda** (Colyseus Room) = chat em tempo real, convites, logs, eventos.
- **Servidor Dedicado por Guilda/Escola/Empresa** = instância isolada do Game Server
  com seu próprio Redis, config, domínio.

### Multi-tenancy (Escolas/Empresas/Cidades)

```
game-server/
├── config.prod.json          # Config global
├── tenants/
│   ├── escola-sp.json        # { serverName, domain, maxPlayers, features }
│   ├── empresa-xyz.json
│   └── cidade-abc.json
└── docker-compose.yml        # Sobe 1 container por tenant (ou 1 container com multi-tenancy)
```

**Vantagem**: isolamento total (dados, regras, mods, eventos). Cada tenant tem
seu próprio banco Firestore (projeto Firebase separado) ou collection prefixada.

---

## Deploy e Operação

### Docker Compose (Produção)

```yaml
# docker-compose.yml
version: '3.8'
services:
  game-server:
    build: .
    ports: ["2567:2567"]
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - FIREBASE_SERVICE_ACCOUNT=/secrets/service-account.json
    volumes:
      - ./secrets:/secrets:ro
    deploy:
      replicas: 2
      resources:
        limits: { cpus: '2', memory: '2G' }

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis-data:/data]

  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
    volumes: [./prometheus.yml:/etc/prometheus/prometheus.yml]

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

volumes:
  redis-data:
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy-server.yml
name: Deploy Game Server
on:
  push:
    branches: [main]
    paths: ['game-server/**']
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd game-server && npm ci && npm run build
      - uses: docker/build-push-action@v5
        with:
          context: ./game-server
          push: true
          tags: ghcr.io/${{ github.repository }}/game-server:${{ github.sha }}
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/game-server
            docker compose pull
            docker compose up -d
```

---

## Roadmap de Implementação

| Fase | Entregável | Esforço | Prioridade |
|---|---|---|---|
| **0** | Servidor vazio (Colyseus + Redis + Firebase Admin) rodando em VPS | 2 dias | **Agora** |
| **1** | `PortalRoom` — matchmaking de bases online (quem está na base do amigo) | 3 dias | **Agora** |
| **2** | `WorldRoom` — movimento validado + combate server-authoritative | 1 semana | **Próximo** |
| **3** | Auto-combate tick (10Hz) + anti-cheat básico (speedhack, godmode) | 1 semana | **Próximo** |
| **4** | `GuildRoom` — chat, convites, logs, ranks | 1 semana | **Depois** |
| **5** | Multi-tenancy (escolas/empresas/cidades) + deploy automatizado | 1 semana | **Depois** |
| **6** | Leaderboards globais, eventos sazonais, replay system | Contínuo | **Contínuo** |

---

## Custos Estimados (Mensal)

| Recurso | Custo (USD) | Notas |
|---|---|---|
| VPS (2 vCPU, 4GB RAM) | $24–40 | DigitalOcean / Hetzner / Vultr |
| Redis (managed) | $15–30 | Upstash / Railway / próprio no VPS |
| Firebase (Blaze) | $0–50 | Já pago; writes lidos do server contam |
| Domínio + SSL | $12/ano | Let's Encrypt grátis |
| Monitoramento (Prometheus/Grafana) | $0 | Self-hosted no VPS |
| **Total** | **~$50–100/mês** | Escala linear com jogadores |

---

## Conclusão

**Não precisamos de servidores dedicados AGORA** para o jogo funcionar — o
Firebase já cobre auth, banco, storage, portais. Mas **precisamos de um Game
Server leve** para:

1. **Matchmaking de portais** (ver quem está online na base do amigo).
2. **Auto-combate server-side** (o jogador não precisa ficar na tela).
3. **Anti-cheat** (validação autoritativa de movimento/combate).
4. **Guildas/Chat/Convites** (tempo real).
5. **Futuro multi-tenancy** (escolas/empresas/cidades).

**Próximo passo**: subir o **Fase 0** (servidor vazio + Colyseus + Redis + Firebase Admin) no VPS, conectar o cliente Phaser via WebSocket, e testar `PortalRoom`.