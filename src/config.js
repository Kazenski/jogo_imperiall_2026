// Le a configuracao do Firebase a partir das variaveis de ambiente do Vite.
// Ver .env.example para o formato esperado.

// `import.meta.env` so existe sob o Vite. Fora dele (ex.: testes em Node puro)
// o objeto nao existe, e acessar `.VITE_...` diretamente quebraria o import.
const env = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

// Sem isso configurado o jogo roda em "modo local": salva no localStorage
// e da para jogar normalmente, so que sem sincronizar entre dispositivos.
export const firebaseHabilitado = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const NOME_COLECAO_JOGADORES = 'jogadores';
export const NOME_COLECAO_BASES = 'bases';

// Colecao PUBLICA (leitura por qualquer jogador autenticado).
// Guarda apenas o minimo necessario para o portal aparecer na lista de amigos:
// quem e, o nome da base e o nivel. O progresso privado fica em `jogadores/{uid}`.
export const NOME_COLECAO_PORTAIS = 'portais';

export const CHAVE_PROGRESSO_LOCAL = 'jogo-imperiall:progresso';
export const CHAVE_PERFIL_LOCAL = 'jogo-imperiall:perfil';