// PixelQuest Run - Main Game Logic
// A retro-style platformer with 4 levels

// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const PLAYER_SPEED = 5;
const SPECIAL_COOLDOWN = 3000; // 3 seconds
const TILE_SIZE = 32;

// Game state
let canvas, ctx;
let gameRunning = false;
let currentLevel = 1;
let totalGems = 0;
let levelGems = 0;
let score = 0;
let scoreMultiplier = 1.0;
let specialAvailable = true;
let specialCooldownTimer = null;
let lastTime = 0;
let musicEnabled = true;
let sfxEnabled = true;

// Game assets
const assets = {
    player: {
        idle: null,
        run: null,
        jump: null,
        fall: null,
        special: null
    },
    tiles: {
        ground: null,
        platform: null,
        hazard: null
    },
    items: {
        gem: null,
        powerup: null,
        flag: null
    },
    enemies: {
        walker: null,
        flyer: null
    },
    backgrounds: {
        level1: null,
        level2: null,
        level3: null,
        level4: null
    },
    sounds: {
        jump: null,
        collect: null,
        hurt: null,
        levelComplete: null,
        gameOver: null,
        special: null,
        music: []
    }
};

// Player object
const player = {
    x: 100,
    y: 300,
    width: 32,
    height: 48,
    velocityX: 0,
    velocityY: 0,
    isJumping: false,
    facingRight: true,
    isAlive: true,
    health: 3,
    invulnerable: false,
    invulnerabilityTimer: null,
    animationFrame: 0,
    animationCounter: 0,
    currentAnimation: 'idle',
    specialActive: false,
    
    // Player update method
    update: function() {
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Handle collisions
        this.checkCollisions();
        
        // Animation handling
        this.animationCounter++;
        if (this.animationCounter >= 6) {
            this.animationCounter = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }
        
        // Update animation state
        if (this.velocityY < 0) {
            this.currentAnimation = 'jump';
        } else if (this.velocityY > 1) {
            this.currentAnimation = 'fall';
        } else if (Math.abs(this.velocityX) > 0.1) {
            this.currentAnimation = 'run';
        } else {
            this.currentAnimation = 'idle';
        }
        
        if (this.specialActive) {
            this.currentAnimation = 'special';
        }
        
        // Boundary checks
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
        
        // Check if player fell off the screen
        if (this.y > canvas.height + 100) {
            this.die();
        }
    },
    
    // Check collisions with level elements
    checkCollisions: function() {
        // Check platform collisions
        for (let i = 0; i < currentLevelData.platforms.length; i++) {
            const platform = currentLevelData.platforms[i];
            
            // Skip hazards for collision (they handle separately)
            if (platform.type === 'hazard') continue;
            
            if (this.isColliding(platform)) {
                // Check if landing on top of platform
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.isJumping = false;
                } 
                // Left/right collisions
                else if (this.velocityX > 0) {
                    this.x = platform.x - this.width;
                } else if (this.velocityX < 0) {
                    this.x = platform.x + platform.width;
                }
            }
        }
        
        // Check hazard collisions
        for (let i = 0; i < currentLevelData.hazards.length; i++) {
            const hazard = currentLevelData.hazards[i];
            if (this.isColliding(hazard) && !this.invulnerable) {
                this.takeDamage();
            }
        }
        
        // Check enemy collisions
        for (let i = 0; i < currentLevelData.enemies.length; i++) {
            const enemy = currentLevelData.enemies[i];
            if (!enemy.isDead && this.isColliding(enemy)) {
                // If using special ability, defeat the enemy
                if (this.specialActive) {
                    enemy.isDead = true;
                    score += 50 * scoreMultiplier;
                } else if (!this.invulnerable) {
                    this.takeDamage();
                }
            }
        }
        
        // Check gem collisions
        for (let i = 0; i < currentLevelData.gems.length; i++) {
            const gem = currentLevelData.gems[i];
            if (!gem.collected && this.isColliding(gem)) {
                gem.collected = true;
                levelGems++;
                totalGems++;
                score += 10 * scoreMultiplier;
                scoreMultiplier += 0.1;
                updateScoreDisplay();
                
                if (sfxEnabled) {
                    assets.sounds.collect.currentTime = 0;
                    assets.sounds.collect.play();
                }
            }
        }
        
        // Check powerup collisions
        for (let i = 0; i < currentLevelData.powerups.length; i++) {
            const powerup = currentLevelData.powerups[i];
            if (!powerup.collected && this.isColliding(powerup)) {
                powerup.collected = true;
                
                // Apply powerup effect
                if (powerup.type === 'health') {
                    this.health = Math.min(this.health + 1, 3);
                } else if (powerup.type === 'special') {
                    this.activateSpecial();
                }
                
                if (sfxEnabled) {
                    assets.sounds.collect.currentTime = 0;
                    assets.sounds.collect.play();
                }
            }
        }
        
        // Check flag (level completion)
        if (this.isColliding(currentLevelData.flag) && !currentLevelData.completed) {
            currentLevelData.completed = true;
            completeLevel();
        }
    },
    
    // Collision detection helper
    isColliding: function(object) {
        return (
            this.x < object.x + object.width &&
            this.x + this.width > object.x &&
            this.y < object.y + object.height &&
            this.y + this.height > object.y
        );
    },
    
    // Jump method
    jump: function() {
        if (!this.isJumping) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            
            if (sfxEnabled) {
                assets.sounds.jump.currentTime = 0;
                assets.sounds.jump.play();
            }
        }
    },
    
    // Move left method
    moveLeft: function() {
        this.velocityX = -PLAYER_SPEED;
        this.facingRight = false;
    },
    
    // Move right method
    moveRight: function() {
        this.velocityX = PLAYER_SPEED;
        this.facingRight = true;
    },
    
    // Stop movement method
    stop: function() {
        this.velocityX = 0;
    },
    
    // Take damage method
    takeDamage: function() {
        if (this.invulnerable) return;
        
        this.health--;
        this.invulnerable = true;
        
        if (sfxEnabled) {
            assets.sounds.hurt.currentTime = 0;
            assets.sounds.hurt.play();
        }
        
        // Reset multiplier on damage
        scoreMultiplier = 1.0;
        updateScoreDisplay();
        
        // Invulnerability period
        this.invulnerabilityTimer = setTimeout(() => {
            this.invulnerable = false;
        }, 1500);
        
        // Check if player died
        if (this.health <= 0) {
            this.die();
        }
    },
    
    // Die method
    die: function() {
        this.isAlive = false;
        gameRunning = false;
        
        if (sfxEnabled) {
            assets.sounds.gameOver.play();
        }
        
        // Stop music
        stopMusic();
        
        // Show game over screen
        document.getElementById('game-over-screen').style.display = 'flex';
    },
    
    // Activate special ability
    activateSpecial: function() {
        if (!specialAvailable) return;
        
        this.specialActive = true;
        specialAvailable = false;
        
        if (sfxEnabled) {
            assets.sounds.special.currentTime = 0;
            assets.sounds.special.play();
        }
        
        // Special effect duration
        setTimeout(() => {
            this.specialActive = false;
        }, 1500);
        
        // Special cooldown
        specialCooldownTimer = setTimeout(() => {
            specialAvailable = true;
        }, SPECIAL_COOLDOWN);
    },
    
    // Draw player on canvas
    draw: function() {
        ctx.save();
        
        // Flashing effect when invulnerable
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Draw player sprite based on animation state
        let sprite;
        switch (this.currentAnimation) {
            case 'idle':
                sprite = assets.player.idle;
                break;
            case 'run':
                sprite = assets.player.run;
                break;
            case 'jump':
                sprite = assets.player.jump;
                break;
            case 'fall':
                sprite = assets.player.fall;
                break;
            case 'special':
                sprite = assets.player.special;
                break;
        }
        
        // Draw player with proper facing direction
        if (this.facingRight) {
            ctx.drawImage(
                sprite, 
                this.animationFrame * 32, 0, 32, 48, 
                this.x, this.y, this.width, this.height
            );
        } else {
            ctx.scale(-1, 1);
            ctx.drawImage(
                sprite, 
                this.animationFrame * 32, 0, 32, 48, 
                -this.x - this.width, this.y, this.width, this.height
            );
        }
        
        ctx.restore();
        
        // Draw health indicators (debug mode)
        /*
        ctx.fillStyle = "#ff0000";
        for (let i = 0; i < this.health; i++) {
            ctx.fillRect(10 + (i * 30), 10, 20, 20);
        }
        */
    },
    
    // Reset player for new level
    reset: function(levelStartX, levelStartY) {
        this.x = levelStartX || 100;
        this.y = levelStartY || 300;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.facingRight = true;
        this.isAlive = true;
        this.currentAnimation = 'idle';
        this.specialActive = false;
        
        // Keep health between levels
        if (currentLevel === 1) {
            this.health = 3;
        }
        
        clearTimeout(this.invulnerabilityTimer);
        this.invulnerable = false;
    }
};

// Enemy class
class Enemy {
    constructor(x, y, width, height, type, patrolDistance) {
        this.x = x;
        this.y = y;
        this.startX = x; // For patrolling
        this.startY = y; // For flying patterns
        this.width = width;
        this.height = height;
        this.type = type;
        this.patrolDistance = patrolDistance || 100;
        this.direction = 1; // 1 for right, -1 for left
        this.speed = 2;
        this.isDead = false;
        this.animationFrame = 0;
        this.animationCounter = 0;
    }
    
    update() {
        if (this.isDead) return;
        
        if (this.type === 'walker') {
            // Patrol logic
            this.x += this.speed * this.direction;
            
            // Change direction at patrol limits
            if (this.x > this.startX + this.patrolDistance) {
                this.direction = -1;
            } else if (this.x < this.startX) {
                this.direction = 1;
            }
        } else if (this.type === 'flyer') {
            // Flying pattern (vertical)
            this.y = this.startY + Math.sin(Date.now() / 500) * 50;
            
            // Horizontal movement
            this.x += this.speed * this.direction;
            
            // Change direction at patrol limits
            if (this.x > this.startX + this.patrolDistance) {
                this.direction = -1;
            } else if (this.x < this.startX) {
                this.direction = 1;
            }
        }
        
        // Animation handling
        this.animationCounter++;
        if (this.animationCounter >= 8) {
            this.animationCounter = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }
    }
    
    draw() {
        if (this.isDead) return;
        
        let sprite = this.type === 'walker' ? assets.enemies.walker : assets.enemies.flyer;
        
        ctx.save();
        
        if (this.direction === -1) {
            ctx.scale(-1, 1);
            ctx.drawImage(
                sprite,
                this.animationFrame * 32, 0, 32, 32,
                -this.x - this.width, this.y, this.width, this.height
            );
        } else {
            ctx.drawImage(
                sprite,
                this.animationFrame * 32, 0, 32, 32,
                this.x, this.y, this.width, this.height
            );
        }
        
        ctx.restore();
    }
}

// Level data structure
let currentLevelData = null;

// Define all four level layouts
const levels = [
    // Level 1 - Forest
    {
        name: "Forest Entrance",
        background: 'level1',
        startPosition: { x: 100, y: 300 },
        platforms: [
            { x: 0, y: 500, width: 800, height: 100, type: 'ground' },
            { x: 300, y: 400, width: 100, height: 20, type: 'platform' },
            { x: 450, y: 350, width: 100, height: 20, type: 'platform' },
            { x: 600, y: 300, width: 100, height: 20, type: 'platform' }
        ],
        hazards: [
            { x: 200, y: 480, width: 60, height: 20, type: 'hazard' },
            { x: 400, y: 480, width: 60, height: 20, type: 'hazard' }
        ],
        enemies: [
            new Enemy(350, 368, 32, 32, 'walker', 80),
            new Enemy(550, 200, 32, 32, 'flyer', 150)
        ],
        gems: [
            { x: 320, y: 370, width: 20, height: 20, collected: false },
            { x: 480, y: 320, width: 20, height: 20, collected: false },
            { x: 640, y: 270, width: 20, height: 20, collected: false },
            { x: 150, y: 450, width: 20, height: 20, collected: false },
            { x: 500, y: 450, width: 20, height: 20, collected: false }
        ],
        powerups: [
            { x: 700, y: 450, width: 25, height: 25, type: 'special', collected: false }
        ],
        flag: { x: 750, y: 450, width: 32, height: 50 },
        completed: false
    },
    
    // Level 2 - Cave
    {
        name: "Crystal Cave",
        background: 'level2',
        startPosition: { x: 50, y: 300 },
        platforms: [
            { x: 0, y: 550, width: 200, height: 50, type: 'ground' },
            { x: 250, y: 550, width: 200, height: 50, type: 'ground' },
            { x: 500, y: 550, width: 300, height: 50, type: 'ground' },
            { x: 150, y: 450, width: 80, height: 20, type: 'platform' },
            { x: 300, y: 400, width: 80, height: 20, type: 'platform' },
            { x: 450, y: 350, width: 80, height: 20, type: 'platform' },
            { x: 600, y: 300, width: 80, height: 20, type: 'platform' },
            { x: 720, y: 250, width: 80, height: 20, type: 'platform' }
        ],
        hazards: [
            { x: 200, y: 530, width: 50, height: 20, type: 'hazard' },
            { x: 450, y: 530, width: 50, height: 20, type: 'hazard' },
            { x: 100, y: 520, width: 50, height: 30, type: 'hazard' }
        ],
        enemies: [
            new Enemy(150, 418, 32, 32, 'walker', 60),
            new Enemy(350, 368, 32, 32, 'walker', 60),
            new Enemy(500, 200, 32, 32, 'flyer', 180),
            new Enemy(300, 150, 32, 32, 'flyer', 250)
        ],
        gems: [
            { x: 180, y: 420, width: 20, height: 20, collected: false },
            { x: 330, y: 370, width: 20, height: 20, collected: false },
            { x: 480, y: 320, width: 20, height: 20, collected: false },
            { x: 630, y: 270, width: 20, height: 20, collected: false },
            { x: 750, y: 220, width: 20, height: 20, collected: false },
            { x: 100, y: 500, width: 20, height: 20, collected: false },
            { x: 400, y: 500, width: 20, height: 20, collected: false }
        ],
        powerups: [
            { x: 250, y: 450, width: 25, height: 25, type: 'health', collected: false },
            { x: 550, y: 500, width: 25, height: 25, type: 'special', collected: false }
        ],
        flag: { x: 730, y: 200, width: 32, height: 50 },
        completed: false
    },
    
    // Level 3 - Temple
    {
        name: "Ancient Temple",
        background: 'level3',
        startPosition: { x: 50, y: 250 },
        platforms: [
            { x: 0, y: 350, width: 150, height: 30, type: 'platform' },
            { x: 200, y: 400, width: 100, height: 30, type: 'platform' },
            { x: 350, y: 450, width: 100, height: 30, type: 'platform' },
            { x: 500, y: 400, width: 100, height: 30, type: 'platform' },
            { x: 650, y: 350, width: 150, height: 30, type: 'platform' },
            { x: 350, y: 250, width: 100, height: 30, type: 'platform' },
            { x: 200, y: 200, width: 80, height: 30, type: 'platform' },
            { x: 500, y: 200, width: 80, height: 30, type: 'platform' },
            { x: 350, y: 150, width: 100, height: 30, type: 'platform' },
            { x: 0, y: 550, width: 800, height: 50, type: 'ground' }
        ],
        hazards: [
            { x: 150, y: 330, width: 50, height: 20, type: 'hazard' },
            { x: 300, y: 430, width: 50, height: 20, type: 'hazard' },
            { x: 450, y: 380, width: 50, height: 20, type: 'hazard' },
            { x: 600, y: 330, width: 50, height: 20, type: 'hazard' },
            { x: 350, y: 530, width: 100, height: 20, type: 'hazard' }
        ],
        enemies: [
            new Enemy(220, 368, 32, 32, 'walker', 60),
            new Enemy(520, 368, 32, 32, 'walker', 60),
            new Enemy(350, 418, 32, 32, 'walker', 80),
            new Enemy(250, 100, 32, 32, 'flyer', 300),
            new Enemy(450, 100, 32, 32, 'flyer', 300)
        ],
        gems: [
            { x: 50, y: 320, width: 20, height: 20, collected: false },
            { x: 230, y: 370, width: 20, height: 20, collected: false },
            { x: 380, y: 420, width: 20, height: 20, collected: false },
            { x: 530, y: 370, width: 20, height: 20, collected: false },
            { x: 700, y: 320, width: 20, height: 20, collected: false },
            { x: 230, y: 170, width: 20, height: 20, collected: false },
            { x: 380, y: 120, width: 20, height: 20, collected: false },
            { x: 530, y: 170, width: 20, height: 20, collected: false },
            { x: 350, y: 500, width: 20, height: 20, collected: false },
            { x: 400, y: 500, width: 20, height: 20, collected: false }
        ],
        powerups: [
            { x: 380, y: 220, width: 25, height: 25, type: 'health', collected: false },
            { x: 100, y: 500, width: 25, height: 25, type: 'special', collected: false },
            { x: 700, y: 500, width: 25, height: 25, type: 'special', collected: false }
        ],
        flag: { x: 380, y: 100, width: 32, height: 50 },
        completed: false
    },
    
    // Level 4 - Sky Palace
    {
        name: "Sky Palace",
        background: 'level4',
        startPosition: { x: 50, y: 520 },
        platforms: [
            { x: 0, y: 550, width: 150, height: 50, type: 'ground' },
            { x: 200, y: 500, width: 80, height: 20, type: 'platform' },
            { x: 330, y: 450, width: 80, height: 20, type: 'platform' },
            { x: 460, y: 400, width: 80, height: 20, type: 'platform' },
            { x: 590, y: 350, width: 80, height: 20, type: 'platform' },
            { x: 720, y: 300, width: 80, height: 20, type: 'platform' },
            { x: 590, y: 250, width: 80, height: 20, type: 'platform' },
            { x: 460, y: 200, width: 80, height: 20, type: 'platform' },
            { x: 330, y: 150, width: 80, height: 20, type: 'platform' },
            { x: 200, y: 100, width: 80, height: 20, type: 'platform' },
            { x: 70, y: 150, width: 80, height: 20, type: 'platform' }
        ],
        hazards: [
            { x: 150, y: 550, width: 50, height: 50, type: 'hazard' },
            { x: 280, y: 500, width: 50, height: 20, type: 'hazard' },
            { x: 410, y: 450, width: 50, height: 20, type: 'hazard' },
            { x: 540, y: 400, width: 50, height: 20, type: 'hazard' },
            { x: 670, y: 350, width: 50, height: 20, type: 'hazard' },
            { x: 540, y: 250, width: 50, height: 20, type: 'hazard' },
            { x: 410, y: 200, width: 50, height: 20, type: 'hazard' },
            { x: 280, y: 150, width: 50, height: 20, type: 'hazard' },
            { x: 150, y: 100, width: 50, height: 20, type: 'hazard' }
        ],
        enemies: [
            new Enemy(200, 468, 32, 32, 'walker', 60),
            new Enemy(330, 418, 32, 32, 'walker', 60),
            new Enemy(460, 368, 32, 32, 'walker', 60),
            new Enemy(590, 318, 32, 32, 'walker', 60),
            new Enemy(590, 218, 32, 32, 'walker', 60),
            new Enemy(460, 168, 32, 32, 'walker', 60),
            new Enemy(330, 118, 32, 32, 'walker', 60),
            new Enemy(100, 450, 32, 32, 'flyer', 100),
            new Enemy(400, 300, 32, 32, 'flyer', 200),
            new Enemy(700, 180, 32, 32, 'flyer', 150)
        ],
        gems: [
            { x: 100, y: 520, width: 20, height: 20, collected: false },
            { x: 240, y: 470, width: 20, height: 20, collected: false },
            { x: 370, y: 420, width: 20, height: 20, collected: false },
            { x: 500, y: 370, width: 20, height: 20, collected: false },
            { x: 630, y: 320, width: 20, height: 20, collected: false },
            { x: 760, y: 270, width: 20, height: 20, collected: false },
            { x: 630, y: 220, width: 20, height: 20, collected: false },
            { x: 500, y: 170, width: 20, height: 20, collected: false },
            { x: 370, y: 120, width: 20, height: 20, collected: false },
            { x: 240, y: 70, width: 20, height: 20, collected: false },
            { x: 100, y: 120, width: 20, height: 20, collected: false }
        ],
        powerups: [
            { x: 150, y: 490, width: 25, height: 25, type: 'health', collected: false },
            { x: 400, y: 350, width: 25, height: 25, type: 'special', collected: false },
            { x: 650, y: 220, width: 25, height: 25, type: 'special', collected: false }
        ],
        flag: { x: 100, y: 100, width: 32, height: 50 },
        completed: false
    }
];

// Input handling
const keys = {
    left: false,
    right: false,
    up: false,
    special: false
};

// Event listeners for keyboard
document.addEventListener('keydown', function(e) {
    switch(e.keyCode) {
        case 37: // Left arrow
        case 65: // A key
            keys.left = true;
            break;
        case 39: // Right arrow
        case 68: // D key
            keys.right = true;
            break;
        case 38: // Up arrow
        case 87: // W key
        case 32: // Space
            keys.up = true;
            if (gameRunning) player.jump();
            break;
        case 90: // Z key
            keys.special = true;
            if (gameRunning) player.activateSpecial();
            break;
    }
});

document.addEventListener('keyup', function(e) {
    switch(e.keyCode) {
        case 37: // Left arrow
        case 65: // A key
            keys.left = false;
            break;
        case 39: // Right arrow
        case 68: // D key
            keys.right = false;
            break;
        case 38: // Up arrow
        case 87: // W key
        case 32: // Space
            keys.up = false;
            break;
        case 90: // Z key
            keys.special = false;
            break;
    }
});

// Sound control
document.getElementById('music-toggle').addEventListener('click', function() {
    musicEnabled = !musicEnabled;
    this.textContent = musicEnabled ? 'Music: ON' : 'Music: OFF';
    this.classList.toggle('active');
    
    if (musicEnabled) {
        startMusic();
    } else {
        stopMusic();
    }
});

document.getElementById('sfx-toggle').addEventListener('click', function() {
    sfxEnabled = !sfxEnabled;
    this.textContent = sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
    this.classList.toggle('active');
});

// Button listeners
document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('next-level-button').addEventListener('click', startNextLevel);
document.getElementById('restart-button').addEventListener('click', restartGame);
document.getElementById('play-again-button').addEventListener('click', restartGame);

// Game initialization
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Load game assets
    loadAssets(function() {
        // Hide loading screen
        document.getElementById('loading-screen').style.display = 'none';
        
        // Show start screen
        document.getElementById('start-screen').style.display = 'flex';
    });
}

// Asset loading
function loadAssets(callback) {
    let assetsToLoad = 26; // Total number of assets to load
    let loadedAssets = 0;
    
    // Update loading bar
    function assetLoaded() {
        loadedAssets++;
        const progress = (loadedAssets / assetsToLoad) * 100;
        document.getElementById('loading-bar').style.width = progress + '%';
        
        if (loadedAssets >= assetsToLoad) {
            setTimeout(callback, 500); // Small delay to show full loading bar
        }
    }
    
    // Player sprites
    assets.player.idle = loadImage('player_idle.png', assetLoaded);
    assets.player.run = loadImage('player_run.png', assetLoaded);
    assets.player.jump = loadImage('player_jump.png', assetLoaded);
    assets.player.fall = loadImage('player_fall.png', assetLoaded);
    assets.player.special = loadImage('player_special.png', assetLoaded);
    
    // Tile sprites
    assets.tiles.ground = loadImage('ground_tile.png', assetLoaded);
    assets.tiles.platform = loadImage('platform_tile.png', assetLoaded);
    assets.tiles.hazard = loadImage('hazard_tile.png', assetLoaded);
    
    // Item sprites
    assets.items.gem = loadImage('gem.png', assetLoaded);
    assets.items.powerup = loadImage('powerup.png', assetLoaded);
    assets.items.flag = loadImage('flag.png', assetLoaded);
    
    // Enemy sprites
    assets.enemies.walker = loadImage('enemy_walker.png', assetLoaded);
    assets.enemies.flyer = loadImage('enemy_flyer.png', assetLoaded);
    
    // Background images
    assets.backgrounds.level1 = loadImage('bg_forest.png', assetLoaded);
    assets.backgrounds.level2 = loadImage('bg_cave.png', assetLoaded);
    assets.backgrounds.level3 = loadImage('bg_temple.png', assetLoaded);
    assets.backgrounds.level4 = loadImage('bg_sky.png', assetLoaded);
    
    // Sound effects
    assets.sounds.jump = loadSound('jump.mp3', assetLoaded);
    assets.sounds.collect = loadSound('collect.mp3', assetLoaded);
    assets.sounds.hurt = loadSound('hurt.mp3', assetLoaded);
    assets.sounds.levelComplete = loadSound('level_complete.mp3', assetLoaded);
    assets.sounds.gameOver = loadSound('game_over.mp3', assetLoaded);
    assets.sounds.special = loadSound('special.mp3', assetLoaded);
    
    // Music tracks
    for (let i = 1; i <= 4; i++) {
        assets.sounds.music.push(loadSound(`level${i}_music.mp3`, assetLoaded));
    }
}

// Helper function to load images
function loadImage(src, callback) {
    const img = new Image();
    img.onload = callback;
    img.onerror = function() {
        console.error(`Failed to load image: ${src}`);
        // Create a placeholder colored rectangle instead
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set size based on typical asset type
        if (src.includes('player')) {
            canvas.width = 128; // 4 frames of 32px
            canvas.height = 48;
        } else if (src.includes('enemy')) {
            canvas.width = 128; // 4 frames of 32px
            canvas.height = 32;
        } else if (src.includes('bg_')) {
            canvas.width = 800;
            canvas.height = 600;
        } else {
            canvas.width = 32;
            canvas.height = 32;
        }
        
        // Fill with a color based on the asset type
        if (src.includes('player')) {
            ctx.fillStyle = '#7b68ee'; // Purple for player
        } else if (src.includes('enemy')) {
            ctx.fillStyle = '#ff5555'; // Red for enemies
        } else if (src.includes('gem')) {
            ctx.fillStyle = '#66cdaa'; // Green for gems
        } else if (src.includes('hazard')) {
            ctx.fillStyle = '#ff0000'; // Red for hazards
        } else if (src.includes('ground') || src.includes('platform')) {
            ctx.fillStyle = '#8b4513'; // Brown for platforms
        } else if (src.includes('powerup')) {
            ctx.fillStyle = '#ffff00'; // Yellow for powerups
        } else if (src.includes('flag')) {
            ctx.fillStyle = '#ffa500'; // Orange for flag
        } else if (src.includes('bg_')) {
            // Create a gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#191133');
            gradient.addColorStop(1, '#34255a');
            ctx.fillStyle = gradient;
        }
        
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some visual distinction for animated sprites
        if (src.includes('player') || src.includes('enemy')) {
            const frameWidth = canvas.width / 4;
            for (let i = 0; i < 4; i++) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(i * frameWidth + 4, 4, frameWidth - 8, canvas.height - 8);
            }
        }
        
        callback();
        return canvas;
    };
    
    // Attempt to load from a "assets" folder (common convention)
    // If this fails, the onerror handler will create a placeholder
    img.src = 'assets/' + src;
    return img;
}

// Helper function to load sounds
function loadSound(src, callback) {
    const sound = new Audio();
    sound.addEventListener('canplaythrough', callback, {once: true});
    sound.addEventListener('error', function() {
        console.error(`Failed to load sound: ${src}`);
        callback(); // Continue loading process even if sound fails
    });
    
    // Attempt to load from a "sounds" folder
    sound.src = 'sounds/' + src;
    return sound;
}

// Start background music
function startMusic() {
    if (!musicEnabled) return;
    
    // Stop any currently playing music
    stopMusic();
    
    // Play the appropriate track for the current level
    const currentMusic = assets.sounds.music[currentLevel - 1];
    if (currentMusic) {
        currentMusic.loop = true;
        currentMusic.volume = 0.5; // Lower volume a bit
        currentMusic.play().catch(err => {
            console.log('Audio playback failed:', err);
        });
    }
}

// Stop all music
function stopMusic() {
    assets.sounds.music.forEach(track => {
        track.pause();
        track.currentTime = 0;
    });
}

// Start the game
function startGame() {
    // Hide start screen
    document.getElementById('start-screen').style.display = 'none';
    
    // Reset game variables
    currentLevel = 1;
    totalGems = 0;
    levelGems = 0;
    score = 0;
    scoreMultiplier = 1.0;
    updateScoreDisplay();
    
    // Start the first level
    loadLevel(currentLevel);
    
    // Start music
    startMusic();
    
    // Start game loop
    gameRunning = true;
    lastTime = 0;
    requestAnimationFrame(gameLoop);
}

// Load a specific level
function loadLevel(levelNumber) {
    // Make sure level number is valid
    levelNumber = Math.max(1, Math.min(levelNumber, levels.length));
    currentLevel = levelNumber;
    
    // Reset level-specific variables
    currentLevelData = JSON.parse(JSON.stringify(levels[levelNumber - 1])); // Deep clone level data
    
    // Recreate enemy objects (they were simplified in JSON stringify/parse)
    currentLevelData.enemies = [];
    levels[levelNumber - 1].enemies.forEach(enemy => {
        currentLevelData.enemies.push(new Enemy(
            enemy.x, enemy.y, enemy.width, enemy.height, enemy.type, enemy.patrolDistance
        ));
    });
    
    // Reset player position
    player.reset(currentLevelData.startPosition.x, currentLevelData.startPosition.y);
    
    // Reset level gems counter
    levelGems = 0;
    
    // Update level indicator
    document.getElementById('level-indicator').textContent = `Level ${currentLevel}: ${currentLevelData.name}`;
}

// Start the next level
function startNextLevel() {
    // Hide level complete screen
    document.getElementById('level-complete-screen').style.display = 'none';
    
    // Increase level number
    currentLevel++;
    
    // Check if there are more levels
    if (currentLevel > levels.length) {
        // Show game complete screen
        document.getElementById('game-complete-screen').style.display = 'flex';
        document.getElementById('total-gems').textContent = totalGems;
        
        // Stop the game
        gameRunning = false;
        stopMusic();
        return;
    }
    
    // Load the next level
    loadLevel(currentLevel);
    
    // Change the music
    startMusic();
    
    // Resume game
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

// Restart the game
function restartGame() {
    // Hide game over and game complete screens
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('game-complete-screen').style.display = 'none';
    
    // Reset game variables and start again
    startGame();
}

// Handle level completion
function completeLevel() {
    // Stop game running
    gameRunning = false;
    
    // Play level complete sound
    if (sfxEnabled) {
        assets.sounds.levelComplete.play();
    }
    
    // Stop music
    stopMusic();
    
    // Show level complete screen
    document.getElementById('level-complete-screen').style.display = 'flex';
    document.getElementById('level-gems').textContent = levelGems;
}

// Update the score display
function updateScoreDisplay() {
    document.getElementById('gem-count').textContent = totalGems;
    document.getElementById('multiplier').textContent = 'x' + scoreMultiplier.toFixed(1);
}

// Main game loop
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    const background = assets.backgrounds[currentLevelData.background];
    if (background) {
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    }
    
    // Handle player input
    if (keys.left) {
        player.moveLeft();
    } else if (keys.right) {
        player.moveRight();
    } else {
        player.stop();
    }
    
    // Update entities
    if (gameRunning) {
        player.update();
        
        // Update enemies
        currentLevelData.enemies.forEach(enemy => {
            enemy.update();
        });
    }
    
    // Draw level elements
    
    // Draw platforms
    currentLevelData.platforms.forEach(platform => {
        let tileSprite;
        if (platform.type === 'ground') {
            tileSprite = assets.tiles.ground;
        } else if (platform.type === 'platform') {
            tileSprite = assets.tiles.platform;
        } else if (platform.type === 'hazard') {
            tileSprite = assets.tiles.hazard;
        }
        
        if (tileSprite) {
            // Draw using tiling if the platform is wider than the tile
            const tileWidth = 32;
            for (let x = platform.x; x < platform.x + platform.width; x += tileWidth) {
                const width = Math.min(tileWidth, platform.x + platform.width - x);
                ctx.drawImage(tileSprite, 0, 0, width, platform.height, x, platform.y, width, platform.height);
            }
        } else {
            // Fallback solid color if sprite not loaded
            ctx.fillStyle = platform.type === 'hazard' ? '#ff0000' : '#8b4513';
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        }
    });
    
    // Draw hazards
    currentLevelData.hazards.forEach(hazard => {
        if (assets.tiles.hazard) {
            // Draw using tiling if the hazard is wider than the tile
            const tileWidth = 32;
            for (let x = hazard.x; x < hazard.x + hazard.width; x += tileWidth) {
                const width = Math.min(tileWidth, hazard.x + hazard.width - x);
                ctx.drawImage(assets.tiles.hazard, 0, 0, width, hazard.height, x, hazard.y, width, hazard.height);
            }
        } else {
            // Fallback solid color if sprite not loaded
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);
        }
    });
    
    // Draw gems
    currentLevelData.gems.forEach(gem => {
        if (!gem.collected && assets.items.gem) {
            ctx.drawImage(assets.items.gem, gem.x, gem.y, gem.width, gem.height);
        }
    });
    
    // Draw powerups
    currentLevelData.powerups.forEach(powerup => {
        if (!powerup.collected && assets.items.powerup) {
            ctx.drawImage(assets.items.powerup, powerup.x, powerup.y, powerup.width, powerup.height);
        }
    });
    
    // Draw enemies
    currentLevelData.enemies.forEach(enemy => {
        enemy.draw();
    });
    
    // Draw flag
    if (assets.items.flag) {
        ctx.drawImage(assets.items.flag, currentLevelData.flag.x, currentLevelData.flag.y, 
                     currentLevelData.flag.width, currentLevelData.flag.height);
    } else {
        // Fallback if sprite not loaded
        ctx.fillStyle = '#ffa500';
        ctx.fillRect(currentLevelData.flag.x, currentLevelData.flag.y, 
                   currentLevelData.flag.width, currentLevelData.flag.height);
    }
    
    // Draw player
    player.draw();
    
    // Draw special ability cooldown indicator
    if (!specialAvailable) {
        ctx.fillStyle = 'rgba(123, 104, 238, 0.3)';
        ctx.fillRect(10, canvas.height - 30, 100, 20);
        
        ctx.fillStyle = 'rgba(102, 205, 170, 0.7)';
        const cooldownProgress = Math.min(1, (Date.now() - (Date.now() - (SPECIAL_COOLDOWN - (specialCooldownTimer ? SPECIAL_COOLDOWN - 
                            (specialCooldownTimer._idleStart + specialCooldownTimer._idleTimeout - Date.now()) : 0)))) / SPECIAL_COOLDOWN);
        ctx.fillRect(10, canvas.height - 30, 100 * cooldownProgress, 20);
        
        ctx.strokeStyle = '#66cdaa';
        ctx.strokeRect(10, canvas.height - 30, 100, 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('SPECIAL', 35, canvas.height - 17);
    } else {
        ctx.fillStyle = 'rgba(102, 205, 170, 0.7)';
        ctx.fillRect(10, canvas.height - 30, 100, 20);
        
        ctx.strokeStyle = '#66cdaa';
        ctx.strokeRect(10, canvas.height - 30, 100, 20);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('SPECIAL READY', 20, canvas.height - 17);
    }
    
    // Draw health hearts
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < player.health ? '#ff5555' : 'rgba(255, 85, 85, 0.3)';
        ctx.fillRect(10 + i * 25, 40, 20, 20);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(10 + i * 25, 40, 20, 20);
    }
    
    // Continue the game loop if the game is running
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// Start the initialization process when the page loads
window.addEventListener('load', init);
