const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 500 } }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

const game = new Phaser.Game(config);

let player, bitcoins, score = 0, scoreText;

function preload() {
  this.load.svg('player', 'https://via.placeholder.com/20x20?text=📈');
  this.load.svg('bitcoin', 'https://via.placeholder.com/30x30?text=₿');
}

function create() {
  player = this.physics.add.sprite(100, 300, 'player');
  player.setCollideWorldBounds(true);

  bitcoins = this.physics.add.group();

  scoreText = this.add.text(16, 16, 'Bitcoins: 0', { fontSize: '20px', fill: '#fff' });

  this.input.on('pointerdown', () => player.setVelocityY(-200));
}

function update() {
  if (Math.random() < 0.02) {
    let bitcoin = bitcoins.create(800, Math.random() * 550 + 50, 'bitcoin');
    bitcoin.setVelocityX(-200);
  }

  this.physics.overlap(player, bitcoins, collectBitcoin, null, this);

  if (player.y > 600) {
    this.scene.restart();
    score = 0;
  }
}

function collectBitcoin(player, bitcoin) {
  bitcoin.destroy();
  score += 1;
  scoreText.setText('Bitcoins: ' + score);
}
