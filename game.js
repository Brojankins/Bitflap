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

let player, bitcoins, score = 0, scoreText, background, trail;

function preload() {
  // Load the new images (replace with your uploaded file names and paths)
  this.load.image('player', 'player.png');
  this.load.image('bitcoin', 'bitcoin.png');
  this.load.image('background', 'background.png');
}

function create() {
  // Add and move the background to create a side-scrolling effect
  background = this.add.image(0, 0, 'background');
  background.setOrigin(0, 0);
  background.displayWidth = this.sys.game.config.width;
  background.displayHeight = this.sys.game.config.height;
  background.setVelocityX(-200); // Move left at 200 pixels/second

  // Add the player (Wall Street bets character) at starting position
  player = this.physics.add.sprite(100, 300, 'player');
  player.setCollideWorldBounds(true);
  player.setScale(0.5); // Adjust scale for zoomed-out view and logo size

  // Initialize Bitcoin group
  bitcoins = this.physics.add.group();

  // Add score text
  scoreText = this.add.text(16, 16, 'Bitcoins: 0', { fontSize: '20px', fill: '#fff' });

  // Add trailing stock chart line
  trail = this.add.graphics();
  player.path = [];

  // Tap to go up
  this.input.on('pointerdown', () => player.setVelocityY(-200));
}

function update() {
  // Move background to maintain side-scrolling
  if (background.x < -background.displayWidth) {
    background.x = 0;
  }

  // Update and draw the stock chart trail
  player.path.push({ x: player.x, y: player.y });
  if (player.path.length > 100) player.path.shift(); // Limit trail length
  trail.clear();
  trail.lineStyle(2, 0xffffff); // White line for stock chart
  trail.beginPath();
  trail.moveTo(player.x, player.y);
  for (let point of player.path) trail.lineTo(point.x, point.y);
  trail.closePath();
  trail.strokePath();

  // Spawn Bitcoins at the right edge, moving left with the background
  if (Math.random() < 0.02) {
    let bitcoin = bitcoins.create(800, Math.random() * 550 + 50, 'bitcoin');
    bitcoin.setVelocityX(-200); // Sync with background speed
  }

  // Check for collisions with Bitcoins
  this.physics.overlap(player, bitcoins, collectBitcoin, null, this);

  // Reset if player falls off bottom
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