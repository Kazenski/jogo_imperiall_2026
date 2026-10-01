import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LoginScene } from './scenes/LoginScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { AdminScene } from './scenes/AdminScene.js';
import { InventarioScene } from './scenes/InventarioScene.js';
import { TalentosScene } from './scenes/TalentosScene.js';
import { FabricacaoScene } from './scenes/FabricacaoScene.js';
import { ReinosScene } from './scenes/ReinosScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14100c',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  render: {
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    LoginScene,
    WorldScene,
    InventarioScene,
    TalentosScene,
    FabricacaoScene,
    ReinosScene,
    AdminScene,
  ],
};

const game = new Phaser.Game(config);

// Em desenvolvimento expoe o jogo no console para facilitar o debug:
// window.__game.scene.getScene('World') etc.
if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_GAME) {
  window.__game = game;
}

// Esconde a tela de carregamento do HTML assim que o Phaser assume.
game.events.once(Phaser.Core.Events.READY, () => {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('oculto');
  setTimeout(() => boot.remove(), 450);
});

// Debeixa a celula de Vite recarregar em Whenever possible (default), apenas
// garantindo que o jogo registre hot reload de forma explicita para o dev.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}

export default game;