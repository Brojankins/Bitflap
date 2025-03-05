const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let score = 0;
let gameOver = false;
const gravity = 0.5;
const flapStrength = -10;
const bitcoinSpeed = -2; // Speed at which bitcoins move left
const bitcoinSpawnInterval = 2000; // Milliseconds between bitcoin spawns

// Character (stock trader)
const character = {
    x: 100,
    y: canvas.height / 2,
    width: 50,
    height: 50,
    velocityY: 0,
    image: new Image()
};
character.image.src = 'stock_trader.png'; // Replace with your stock trader image

// Bitcoins
const bitcoins = [];
const bitcoinImage = new Image();
bitcoinImage.src = 'bitcoin.png'; // Replace with your bitcoin image

// Event listeners
document.addEventListener('click', flap);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') flap();
});

// Flap function
function flap() {
    if (!gameOver) {
        character.velocityY = flapStrength;
    }
}

// Spawn bitcoins
function spawnBitcoin() {
    const bitcoin = {
        x: canvas.width,
        y: Math.random() * (canvas.height - 50),
        width: 30,
        height: 30
    };
    bitcoins.push(bitcoin);
}

// Game loop
function gameLoop() {
    if (gameOver) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update character position
    character.velocityY += gravity;
    character.y += character.velocityY;

    // Draw character
    ctx.drawImage(character.image, character.x, character.y, character.width, character.height);

    // Check for ground collision
    if (character.y + character.height >= canvas.height) {
        gameOver = true;
        alert(`Game Over! Score: ${score}`);
    }

    // Update and draw bitcoins
    bitcoins.forEach((bitcoin, index) => {
        bitcoin.x += bitcoinSpeed;

        // Draw bitcoin
        ctx.drawImage(bitcoinImage, bitcoin.x, bitcoin.y, bitcoin.width, bitcoin.height);

        // Check for collection
        if (
            character.x < bitcoin.x + bitcoin.width &&
            character.x + character.width > bitcoin.x &&
            character.y < bitcoin.y + bitcoin.height &&
            character.y + character.height > bitcoin.y
        ) {
            score++;
            bitcoins.splice(index, 1);
        }

        // Remove bitcoin if off screen
        if (bitcoin.x + bitcoin.width < 0) {
            bitcoins.splice(index, 1);
        }
    });

    // Draw score
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    requestAnimationFrame(gameLoop);
}

// Start spawning bitcoins
setInterval(spawnBitcoin, bitcoinSpawnInterval);

// Start game loop
gameLoop();