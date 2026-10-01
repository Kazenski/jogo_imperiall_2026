// Roles e utilidades de permissao
export const ROLES = {
  JOGADOR: 'jogador',
  ADMIN: 'admin',
};

export function isAdmin(user) {
  if (!user) return false;
  return user.role === ROLES.ADMIN;
}

export function isJogador(user) {
  if (!user) return false;
  const r = user.role;
  return r === ROLES.JOGADOR || r === ROLES.ADMIN;
}
