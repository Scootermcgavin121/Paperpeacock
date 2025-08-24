// Game state and configuration
const GAME_STATES = {
    START: 'start',
    PLAYING: 'playing',
    GAME_OVER: 'gameOver'
};

const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 4,
    WORLD_SPEED: 2,
    PACKAGE_SPEED: 8,
    OBSTACLE_SPEED: 3
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GAME_STATES.START;
        
        // Set up canvas for mobile compatibility
        this.setupCanvas();
        
        this.score = 0;
        this.lives = 3;
        this.packages = 10;
        this.worldOffset = 0;
        
        this.keys = {};
        this.player = new Player(100, 300);
        this.houses = [];
        this.mailboxes = [];
        this.obstacles = [];
        this.thrownPackages = [];
        this.particles = [];
        this.invulnerabilityTimer = 0;
        this.finishLine = null;
        
        this.setupEventListeners();
        this.generateHouses();
        this.gameLoop();
    }
    
    setupCanvas() {
        // Ensure canvas has the right dimensions
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;
        
        // Set CSS size for mobile
        const isMobile = window.innerWidth <= 850;
        if (isMobile) {
            const containerWidth = Math.min(window.innerWidth * 0.95, 800);
            const containerHeight = (containerWidth * CONFIG.CANVAS_HEIGHT) / CONFIG.CANVAS_WIDTH;
            
            this.canvas.style.width = containerWidth + 'px';
            this.canvas.style.height = containerHeight + 'px';
        }
        
        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
                this.throwPackage();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Touch controls for mobile
        this.setupTouchControls();
        
        // Handle window resize for mobile orientation changes
        window.addEventListener('resize', () => {
            setTimeout(() => this.setupCanvas(), 100);
        });
        
        // UI buttons
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('restartButton').addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });
    }
    
    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isTouching = false;
        let hasMoved = false;
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isTouching = true;
            hasMoved = false;
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            touchStartX = touch.clientX - rect.left;
            touchStartY = touch.clientY - rect.top;
            touchStartTime = Date.now();
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isTouching) return;
            
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const currentX = touch.clientX - rect.left;
            const currentY = touch.clientY - rect.top;
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;
            
            // If movement is significant, mark as moved
            if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
                hasMoved = true;
            }
            
            // Reset movement keys
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
            this.keys['ArrowUp'] = false;
            this.keys['ArrowDown'] = false;
            
            // Set movement based on touch direction
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 15) {
                if (deltaX > 15) this.keys['ArrowRight'] = true;
                if (deltaX < -15) this.keys['ArrowLeft'] = true;
            } else if (Math.abs(deltaY) > 15) {
                if (deltaY > 15) this.keys['ArrowDown'] = true;
                if (deltaY < -15) this.keys['ArrowUp'] = true;
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            
            // Reset all movement keys
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
            this.keys['ArrowUp'] = false;
            this.keys['ArrowDown'] = false;
            
            // Only throw on tap (short touch without much movement)
            if (!hasMoved && touchDuration < 300) {
                this.throwPackage();
            }
            
            isTouching = false;
        });
        
        // Prevent default touch behaviors on the canvas
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            isTouching = false;
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
            this.keys['ArrowUp'] = false;
            this.keys['ArrowDown'] = false;
        });
    }
    
    startGame() {
        this.state = GAME_STATES.PLAYING;
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        document.getElementById('gameOverScreen').style.display = 'none';
        this.canvas.focus();
    }
    
    resetGame() {
        this.score = 0;
        this.lives = 3;
        this.packages = 10;
        this.worldOffset = 0;
        this.player = new Player(100, 300);
        this.houses = [];
        this.mailboxes = [];
        this.obstacles = [];
        this.thrownPackages = [];
        this.particles = [];
        this.invulnerabilityTimer = 0;
        this.finishLine = null;
        this.generateHouses();
    }
    
    generateHouses() {
        for (let i = 0; i < 20; i++) {
            const x = 200 + i * 150;
            const side = Math.random() < 0.5 ? 'top' : 'bottom';
            const needsDelivery = Math.random() < 0.7;
            this.houses.push(new House(x, side, needsDelivery));
            
            // Add mailbox for each house that needs delivery
            if (needsDelivery) {
                this.mailboxes.push(new Mailbox(x + 70, side));
            }
        }
        
        // Generate obstacles
        for (let i = 0; i < 15; i++) {
            const x = 300 + i * 200 + Math.random() * 100;
            const type = Math.random() < 0.5 ? 'car' : 'dog';
            this.obstacles.push(new Obstacle(x, type));
        }
        
        // Create finish line at the end of the route
        const lastHouseX = this.houses[this.houses.length - 1].x;
        this.finishLine = new FinishLine(lastHouseX + 150);
    }
    
    throwPackage() {
        if (this.state === GAME_STATES.PLAYING && this.packages > 0) {
            this.packages--;
            const pkg = new Package(
                this.player.x + 20,
                this.player.y + 10,
                this.player.facing
            );
            this.thrownPackages.push(pkg);
            this.updateUI();
        }
    }
    
    update() {
        if (this.state !== GAME_STATES.PLAYING) return;
        
        this.handleInput();
        this.updateWorld();
        this.updatePackages();
        this.updateObstacles();
        this.updateParticles();
        this.checkCollisions();
        this.checkDeliveries();
        
        // Update invulnerability timer
        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer--;
        }
        
        // Check game over conditions
        if (this.lives <= 0) {
            this.gameOver();
        }
        
        // Check if route is complete (player crosses finish line)
        if (this.finishLine && this.player.x + this.worldOffset >= this.finishLine.x) {
            this.routeComplete();
        }
    }
    
    handleInput() {
        // Movement controls
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.moveLeft();
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.moveRight();
        }
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.player.moveUp();
        }
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.player.moveDown();
        }
    }
    
    updateWorld() {
        this.worldOffset += CONFIG.WORLD_SPEED;
    }
    
    updatePackages() {
        this.thrownPackages = this.thrownPackages.filter(pkg => {
            pkg.update();
            return pkg.x < CONFIG.CANVAS_WIDTH + 50;
        });
    }
    
    updateObstacles() {
        this.obstacles.forEach(obstacle => {
            obstacle.update(this.worldOffset);
        });
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });
    }
    
    checkCollisions() {
        // Player vs obstacles (only if not invulnerable)
        if (this.invulnerabilityTimer <= 0) {
            this.obstacles.forEach(obstacle => {
                const obstacleScreenX = obstacle.x - this.worldOffset;
                if (obstacleScreenX > -obstacle.width && obstacleScreenX < CONFIG.CANVAS_WIDTH + obstacle.width) {
                    if (this.player.collidesWith({
                        x: obstacleScreenX,
                        y: obstacle.y,
                        width: obstacle.width,
                        height: obstacle.height
                    })) {
                        this.lives--;
                        this.addParticles(this.player.x, this.player.y, '#ff0000');
                        this.invulnerabilityTimer = 120; // 2 seconds at 60fps
                        this.updateUI();
                    }
                }
            });
        }
    }
    
    checkDeliveries() {
        this.thrownPackages.forEach((pkg, pkgIndex) => {
            this.mailboxes.forEach((mailbox, mailboxIndex) => {
                const mailboxScreenX = mailbox.x - this.worldOffset;
                if (mailboxScreenX > -mailbox.width && mailboxScreenX < CONFIG.CANVAS_WIDTH + mailbox.width) {
                    if (pkg.collidesWith({
                        x: mailboxScreenX,
                        y: mailbox.y,
                        width: mailbox.width,
                        height: mailbox.height
                    }) && !mailbox.hasNewspaper) {
                        this.score += 100;
                        mailbox.hasNewspaper = true;
                        this.thrownPackages.splice(pkgIndex, 1);
                        this.addParticles(mailboxScreenX + mailbox.width/2, mailbox.y, '#00ff00');
                        this.updateUI();
                        
                        // Mark corresponding house as delivered
                        this.houses.forEach(house => {
                            if (Math.abs(house.x - (mailbox.x - 70)) < 10) {
                                house.needsDelivery = false;
                                house.delivered = true;
                            }
                        });
                    }
                }
            });
        });
    }
    
    addParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
        document.getElementById('packages').textContent = `Newspapers: ${this.packages}`;
        document.getElementById('lives').textContent = `Lives: ${this.lives}`;
    }
    
    gameOver() {
        this.state = GAME_STATES.GAME_OVER;
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'block';
        document.getElementById('finalScore').textContent = `Final Score: ${this.score}`;
    }
    
    routeComplete() {
        this.state = GAME_STATES.GAME_OVER;
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'block';
        
        // Calculate bonus for successful deliveries
        const successfulDeliveries = this.houses.filter(house => house.delivered).length;
        const deliveryBonus = successfulDeliveries * 50;
        const finalScore = this.score + deliveryBonus;
        
        document.getElementById('finalScore').innerHTML = `
            Route Complete!<br/>
            Base Score: ${this.score}<br/>
            Delivery Bonus: ${deliveryBonus} (${successfulDeliveries} deliveries)<br/>
            <strong>Final Score: ${finalScore}</strong>
        `;
    }
    
    render() {
        this.ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        
        if (this.state === GAME_STATES.PLAYING) {
            this.renderBackground();
            this.renderHouses();
            this.renderMailboxes();
            this.renderFinishLine();
            this.renderObstacles();
            this.renderPlayer();
            this.renderPackages();
            this.renderParticles();
        }
    }
    
    renderBackground() {
        // Draw grass/background areas
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT/2 - 80);
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT/2 + 80, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT/2 - 80);
        
        // Draw sidewalks
        this.ctx.fillStyle = '#999';
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT/2 - 80, CONFIG.CANVAS_WIDTH, 30);
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT/2 + 50, CONFIG.CANVAS_WIDTH, 30);
        
        // Draw sidewalk lines/cracks
        this.ctx.fillStyle = '#777';
        for (let x = -(this.worldOffset % 60); x < CONFIG.CANVAS_WIDTH; x += 60) {
            this.ctx.fillRect(x, CONFIG.CANVAS_HEIGHT/2 - 80, 2, 30);
            this.ctx.fillRect(x, CONFIG.CANVAS_HEIGHT/2 + 50, 2, 30);
        }
        
        // Draw road
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT/2 - 50, CONFIG.CANVAS_WIDTH, 100);
        
        // Draw road center line
        this.ctx.fillStyle = '#ffeb3b';
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT/2 - 2, CONFIG.CANVAS_WIDTH, 4);
        
        // Draw road lane lines
        this.ctx.fillStyle = '#fff';
        for (let x = -(this.worldOffset % 40); x < CONFIG.CANVAS_WIDTH; x += 40) {
            this.ctx.fillRect(x, CONFIG.CANVAS_HEIGHT/2 - 2, 20, 2);
        }
    }
    
    renderHouses() {
        this.houses.forEach(house => {
            house.render(this.ctx, this.worldOffset);
        });
    }
    
    renderMailboxes() {
        this.mailboxes.forEach(mailbox => {
            mailbox.render(this.ctx, this.worldOffset);
        });
    }
    
    renderFinishLine() {
        if (this.finishLine) {
            this.finishLine.render(this.ctx, this.worldOffset);
        }
    }
    
    renderObstacles() {
        this.obstacles.forEach(obstacle => {
            obstacle.render(this.ctx, this.worldOffset);
        });
    }
    
    renderPlayer() {
        this.player.render(this.ctx, this.invulnerabilityTimer > 0);
    }
    
    renderPackages() {
        this.thrownPackages.forEach(pkg => {
            pkg.render(this.ctx);
        });
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            particle.render(this.ctx);
        });
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 40;
        this.facing = 1; // 1 for right, -1 for left
    }
    
    moveLeft() {
        this.x = Math.max(10, this.x - CONFIG.PLAYER_SPEED);
        this.facing = -1;
    }
    
    moveRight() {
        this.x = Math.min(CONFIG.CANVAS_WIDTH - this.width - 10, this.x + CONFIG.PLAYER_SPEED);
        this.facing = 1;
    }
    
    moveUp() {
        this.y = Math.max(10, this.y - CONFIG.PLAYER_SPEED);
    }
    
    moveDown() {
        this.y = Math.min(CONFIG.CANVAS_HEIGHT - this.height - 10, this.y + CONFIG.PLAYER_SPEED);
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
    
    render(ctx, invulnerable = false) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        // Flash when invulnerable
        if (invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Draw peacock body (green shirt)
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(this.x + 5, this.y + 15, this.width - 10, this.height - 20);
        
        // Draw peacock neck (elegant blue)
        ctx.fillStyle = '#1976D2';
        ctx.fillRect(centerX - 3, this.y + 5, 6, 15);
        
        // Draw peacock head (beautiful blue)
        ctx.fillStyle = '#1976D2';
        ctx.beginPath();
        ctx.arc(centerX, this.y + 8, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw peacock beak (small and pointed, orange)
        ctx.fillStyle = '#FF9800';
        ctx.beginPath();
        if (this.facing === 1) {
            ctx.moveTo(centerX + 8, this.y + 8);
            ctx.lineTo(centerX + 12, this.y + 6);
            ctx.lineTo(centerX + 12, this.y + 10);
        } else {
            ctx.moveTo(centerX - 8, this.y + 8);
            ctx.lineTo(centerX - 12, this.y + 6);
            ctx.lineTo(centerX - 12, this.y + 10);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw peacock eyes (larger and more expressive)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(centerX - 3, this.y + 6, 2, 0, Math.PI * 2);
        ctx.arc(centerX + 3, this.y + 6, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye highlights
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(centerX - 2, this.y + 5, 1, 0, Math.PI * 2);
        ctx.arc(centerX + 4, this.y + 5, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Statue of Liberty crown (green with copper patina)
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(centerX - 10, this.y - 4, 20, 5);
        
        // Crown spikes (more detailed)
        for (let i = 0; i < 7; i++) {
            const spikeX = centerX - 9 + i * 3;
            ctx.beginPath();
            ctx.moveTo(spikeX, this.y - 4);
            ctx.lineTo(spikeX + 1.5, this.y - 10 - (i % 3) * 2);
            ctx.lineTo(spikeX + 3, this.y - 4);
            ctx.fill();
        }
        
        // Crown band details
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(centerX - 10, this.y - 2, 20, 1);
        
        // Draw peacock crest feathers
        ctx.fillStyle = '#0D47A1';
        for (let i = 0; i < 3; i++) {
            const featherX = centerX - 3 + i * 3;
            ctx.beginPath();
            ctx.ellipse(featherX, this.y - 6, 2, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw wings (blue with iridescent hints)
        ctx.fillStyle = '#1976D2';
        if (this.facing === 1) {
            // Right wing
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 3, this.y + 22, 10, 6, -0.2, 0, Math.PI * 2);
            ctx.fill();
            // Wing detail
            ctx.fillStyle = '#0D47A1';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 5, this.y + 20, 6, 3, -0.2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Left wing
            ctx.beginPath();
            ctx.ellipse(this.x + 3, this.y + 22, 10, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Wing detail
            ctx.fillStyle = '#0D47A1';
            ctx.beginPath();
            ctx.ellipse(this.x + 5, this.y + 20, 6, 3, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw briefcase (brown leather)
        ctx.fillStyle = '#8D6E63';
        const briefcaseX = this.facing === 1 ? this.x + this.width - 8 : this.x - 4;
        ctx.fillRect(briefcaseX, this.y + 26, 12, 8);
        
        // Briefcase handle and clasp
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(briefcaseX + 4, this.y + 23, 4, 3);
        ctx.fillRect(briefcaseX + 5, this.y + 28, 2, 1);
        
        // Draw peacock legs (longer and more elegant)
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(this.x + 10, this.y + this.height - 8, 3, 8);
        ctx.fillRect(this.x + 17, this.y + this.height - 8, 3, 8);
        
        // Peacock feet (three-toed)
        ctx.fillStyle = '#FF9800';
        // Left foot
        ctx.fillRect(this.x + 8, this.y + this.height - 2, 7, 2);
        // Right foot  
        ctx.fillRect(this.x + 15, this.y + this.height - 2, 7, 2);
        
        // Toe details
        ctx.strokeStyle = '#E65100';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Left foot toes
        ctx.moveTo(this.x + 8, this.y + this.height);
        ctx.lineTo(this.x + 6, this.y + this.height + 2);
        ctx.moveTo(this.x + 11, this.y + this.height);
        ctx.lineTo(this.x + 11, this.y + this.height + 3);
        ctx.moveTo(this.x + 14, this.y + this.height);
        ctx.lineTo(this.x + 16, this.y + this.height + 2);
        // Right foot toes
        ctx.moveTo(this.x + 15, this.y + this.height);
        ctx.lineTo(this.x + 13, this.y + this.height + 2);
        ctx.moveTo(this.x + 18, this.y + this.height);
        ctx.lineTo(this.x + 18, this.y + this.height + 3);
        ctx.moveTo(this.x + 21, this.y + this.height);
        ctx.lineTo(this.x + 23, this.y + this.height + 2);
        ctx.stroke();
        
        // Add a small tail feather hint
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillStyle = '#0D47A1';
            ctx.beginPath();
            ctx.ellipse(this.x - 5, this.y + 25, 4, 2, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Reset alpha
        ctx.globalAlpha = 1;
    }
}

class House {
    constructor(x, side, needsDelivery = false) {
        this.x = x;
        this.side = side; // 'top' or 'bottom'
        this.y = side === 'top' ? 80 : 420;
        this.width = 60;
        this.height = 80;
        this.needsDelivery = needsDelivery;
        this.delivered = false;
        
        // House variety
        this.style = Math.floor(Math.random() * 4); // 0-3 different styles
        this.roofColor = ['#F44336', '#E91E63', '#9C27B0', '#673AB7'][Math.floor(Math.random() * 4)];
        this.bodyColor = ['#795548', '#607D8B', '#8BC34A', '#FF9800'][Math.floor(Math.random() * 4)];
        this.doorColor = ['#4CAF50', '#2196F3', '#FF5722', '#9E9E9E'][Math.floor(Math.random() * 4)];
        this.hasChimney = Math.random() < 0.6;
        this.hasGarage = Math.random() < 0.4;
        this.windowLights = Math.random() < 0.7;
        this.treeType = Math.floor(Math.random() * 3); // 0 = no tree, 1 = oak, 2 = pine
    }
    
    render(ctx, worldOffset) {
        const renderX = this.x - worldOffset;
        
        if (renderX > -this.width && renderX < CONFIG.CANVAS_WIDTH + this.width) {
            // Draw tree if present
            if (this.treeType > 0) {
                const treeX = renderX + (this.side === 'top' ? -20 : this.width + 10);
                const treeY = this.y + (this.side === 'top' ? 60 : -40);
                
                if (this.treeType === 1) { // Oak tree
                    ctx.fillStyle = '#8D6E63';
                    ctx.fillRect(treeX + 8, treeY, 4, 20);
                    ctx.fillStyle = '#4CAF50';
                    ctx.beginPath();
                    ctx.arc(treeX + 10, treeY - 5, 12, 0, Math.PI * 2);
                    ctx.fill();
                } else { // Pine tree
                    ctx.fillStyle = '#8D6E63';
                    ctx.fillRect(treeX + 8, treeY, 4, 20);
                    ctx.fillStyle = '#2E7D32';
                    ctx.beginPath();
                    ctx.moveTo(treeX + 10, treeY - 15);
                    ctx.lineTo(treeX + 4, treeY + 5);
                    ctx.lineTo(treeX + 16, treeY + 5);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            
            // Garage if present
            if (this.hasGarage) {
                const garageX = renderX + this.width + 5;
                ctx.fillStyle = '#9E9E9E';
                ctx.fillRect(garageX, this.y + 20, 35, 60);
                
                // Garage door
                ctx.fillStyle = '#616161';
                ctx.fillRect(garageX + 5, this.y + 35, 25, 45);
                
                // Garage door lines
                ctx.strokeStyle = '#424242';
                ctx.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(garageX + 5, this.y + 45 + i * 10);
                    ctx.lineTo(garageX + 30, this.y + 45 + i * 10);
                    ctx.stroke();
                }
            }
            
            // House foundation
            ctx.fillStyle = '#424242';
            ctx.fillRect(renderX - 2, this.y + this.height - 5, this.width + 4, 8);
            
            // House body with texture
            ctx.fillStyle = this.bodyColor;
            ctx.fillRect(renderX, this.y, this.width, this.height);
            
            // House siding lines
            ctx.strokeStyle = this.bodyColor === '#795548' ? '#5D4037' : '#424242';
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.moveTo(renderX, this.y + i * 10);
                ctx.lineTo(renderX + this.width, this.y + i * 10);
                ctx.stroke();
            }
            
            // Roof with shingles
            ctx.fillStyle = this.roofColor;
            ctx.beginPath();
            ctx.moveTo(renderX - 5, this.y);
            ctx.lineTo(renderX + this.width/2, this.y - 20);
            ctx.lineTo(renderX + this.width + 5, this.y);
            ctx.closePath();
            ctx.fill();
            
            // Roof shingles
            ctx.strokeStyle = this.roofColor === '#F44336' ? '#D32F2F' : '#424242';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(renderX - 3 + i * 6, this.y - 15 + i * 5);
                ctx.lineTo(renderX + this.width + 3 - i * 6, this.y - 15 + i * 5);
                ctx.stroke();
            }
            
            // Chimney
            if (this.hasChimney) {
                ctx.fillStyle = '#795548';
                ctx.fillRect(renderX + 15, this.y - 25, 8, 20);
                ctx.fillStyle = '#424242';
                ctx.fillRect(renderX + 14, this.y - 27, 10, 3);
            }
            
            // Windows (multiple)
            const windowColor = this.windowLights ? '#FFEB3B' : '#2196F3';
            ctx.fillStyle = windowColor;
            
            // Left window
            ctx.fillRect(renderX + 8, this.y + 15, 15, 15);
            ctx.fillRect(renderX + 8, this.y + 35, 15, 15);
            
            // Right window  
            ctx.fillRect(renderX + 37, this.y + 15, 15, 15);
            ctx.fillRect(renderX + 37, this.y + 35, 15, 15);
            
            // Window frames
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 2;
            ctx.strokeRect(renderX + 8, this.y + 15, 15, 15);
            ctx.strokeRect(renderX + 8, this.y + 35, 15, 15);
            ctx.strokeRect(renderX + 37, this.y + 15, 15, 15);
            ctx.strokeRect(renderX + 37, this.y + 35, 15, 15);
            
            // Window crosses
            ctx.lineWidth = 1;
            // Left windows
            ctx.beginPath();
            ctx.moveTo(renderX + 15.5, this.y + 15);
            ctx.lineTo(renderX + 15.5, this.y + 30);
            ctx.moveTo(renderX + 8, this.y + 22.5);
            ctx.lineTo(renderX + 23, this.y + 22.5);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(renderX + 15.5, this.y + 35);
            ctx.lineTo(renderX + 15.5, this.y + 50);
            ctx.moveTo(renderX + 8, this.y + 42.5);
            ctx.lineTo(renderX + 23, this.y + 42.5);
            ctx.stroke();
            
            // Right windows  
            ctx.beginPath();
            ctx.moveTo(renderX + 44.5, this.y + 15);
            ctx.lineTo(renderX + 44.5, this.y + 30);
            ctx.moveTo(renderX + 37, this.y + 22.5);
            ctx.lineTo(renderX + 52, this.y + 22.5);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(renderX + 44.5, this.y + 35);
            ctx.lineTo(renderX + 44.5, this.y + 50);
            ctx.moveTo(renderX + 37, this.y + 42.5);
            ctx.lineTo(renderX + 52, this.y + 42.5);
            ctx.stroke();
            
            // Door
            ctx.fillStyle = this.doorColor;
            ctx.fillRect(renderX + this.width/2 - 8, this.y + 40, 16, 40);
            
            // Door frame
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 2;
            ctx.strokeRect(renderX + this.width/2 - 8, this.y + 40, 16, 40);
            
            // Door handle
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(renderX + this.width/2 + 4, this.y + 60, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Door panels
            ctx.strokeStyle = '#424242';
            ctx.lineWidth = 1;
            ctx.strokeRect(renderX + this.width/2 - 6, this.y + 42, 12, 15);
            ctx.strokeRect(renderX + this.width/2 - 6, this.y + 60, 12, 18);
            
            // Porch light
            if (this.windowLights) {
                ctx.fillStyle = '#FFEB3B';
                ctx.beginPath();
                ctx.arc(renderX + this.width/2 - 12, this.y + 35, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#424242';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            // Delivery indicator
            if (this.needsDelivery) {
                ctx.fillStyle = '#ffeb3b';
                ctx.fillRect(renderX + this.width/2 - 5, this.y - 30, 10, 10);
                ctx.fillStyle = '#000';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('!', renderX + this.width/2, this.y - 22);
            } else if (this.delivered) {
                ctx.fillStyle = '#4CAF50';
                ctx.fillRect(renderX + this.width/2 - 5, this.y - 30, 10, 10);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('✓', renderX + this.width/2, this.y - 22);
            }
        }
    }
}

class Obstacle {
    constructor(x, type) {
        this.x = x;
        this.type = type;
        this.width = type === 'car' ? 60 : 25;
        this.height = type === 'car' ? 30 : 20;
        
        if (type === 'car') {
            // Stagger cars across different lanes
            const lanes = [
                CONFIG.CANVAS_HEIGHT/2 - 35, // Top lane
                CONFIG.CANVAS_HEIGHT/2 - 15, // Center lane  
                CONFIG.CANVAS_HEIGHT/2 + 5    // Bottom lane
            ];
            this.y = lanes[Math.floor(Math.random() * lanes.length)];
            this.speed = 0; // Cars don't move
            this.direction = 1;
        } else {
            // Dogs start on sidewalks and cross the street
            this.startSide = Math.random() < 0.5 ? 'top' : 'bottom';
            this.y = this.startSide === 'top' ? CONFIG.CANVAS_HEIGHT/2 - 65 : CONFIG.CANVAS_HEIGHT/2 + 65;
            this.targetY = this.startSide === 'top' ? CONFIG.CANVAS_HEIGHT/2 + 65 : CONFIG.CANVAS_HEIGHT/2 - 65;
            this.speed = 1 + Math.random() * 2;
            this.direction = this.startSide === 'top' ? 1 : -1;
            this.crossingStreet = false;
            this.waitTime = Math.random() * 180; // Random wait before crossing
        }
    }
    
    update(worldOffset) {
        if (this.type === 'dog') {
            if (this.waitTime > 0) {
                this.waitTime--;
                return;
            }
            
            if (!this.crossingStreet) {
                // Start crossing the street
                this.crossingStreet = true;
            }
            
            if (this.crossingStreet) {
                // Move toward target sidewalk
                const distanceToTarget = Math.abs(this.y - this.targetY);
                if (distanceToTarget > 2) {
                    this.y += this.direction * this.speed;
                } else {
                    // Reached the other side, now move along sidewalk
                    this.crossingStreet = false;
                    this.x += (Math.random() < 0.5 ? 1 : -1) * this.speed;
                }
            }
        }
    }
    
    render(ctx, worldOffset) {
        const renderX = this.x - worldOffset;
        
        if (renderX > -this.width && renderX < CONFIG.CANVAS_WIDTH + this.width) {
            if (this.type === 'car') {
                // Car body
                ctx.fillStyle = '#FF5722';
                ctx.fillRect(renderX, this.y, this.width, this.height);
                
                // Wheels
                ctx.fillStyle = '#000';
                ctx.fillRect(renderX + 10, this.y + 25, 8, 8);
                ctx.fillRect(renderX + this.width - 18, this.y + 25, 8, 8);
                
                // Windows
                ctx.fillStyle = '#87CEEB';
                ctx.fillRect(renderX + 5, this.y + 5, this.width - 10, 15);
            } else {
                // Dog
                ctx.fillStyle = '#8D6E63';
                ctx.fillRect(renderX, this.y, this.width, this.height);
                
                // Head
                ctx.fillRect(renderX + 20, this.y - 10, 15, 15);
                
                // Tail
                ctx.fillRect(renderX - 8, this.y + 5, 10, 3);
                
                // Legs
                ctx.fillRect(renderX + 5, this.y + 15, 4, 8);
                ctx.fillRect(renderX + 15, this.y + 15, 4, 8);
            }
        }
    }
}

class Package {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 12;
        this.height = 12;
        this.velocityX = CONFIG.PACKAGE_SPEED * direction;
        this.velocityY = -2;
        this.gravity = 0.3;
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += this.gravity;
    }
    
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
    
    render(ctx) {
        // Draw newspaper (white with black text lines)
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Newspaper border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Newspaper headline and text lines
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 1, this.y + 1, this.width - 2, 2);
        ctx.fillRect(this.x + 1, this.y + 4, this.width - 3, 1);
        ctx.fillRect(this.x + 1, this.y + 6, this.width - 4, 1);
        ctx.fillRect(this.x + 1, this.y + 8, this.width - 2, 1);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 6;
        this.velocityY = (Math.random() - 0.5) * 6;
        this.life = 30;
        this.color = color;
    }
    
    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life--;
    }
    
    render(ctx) {
        const alpha = this.life / 30;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

class Mailbox {
    constructor(x, side) {
        this.x = x;
        this.side = side; // 'top' or 'bottom'
        this.y = side === 'top' ? CONFIG.CANVAS_HEIGHT/2 - 75 : CONFIG.CANVAS_HEIGHT/2 + 55;
        this.width = 20;
        this.height = 30;
        this.hasNewspaper = false;
    }
    
    render(ctx, worldOffset) {
        const renderX = this.x - worldOffset;
        
        if (renderX > -this.width && renderX < CONFIG.CANVAS_WIDTH + this.width) {
            // Mailbox post
            ctx.fillStyle = '#8D6E63';
            ctx.fillRect(renderX + this.width/2 - 2, this.y + 15, 4, 15);
            
            // Mailbox body
            ctx.fillStyle = this.hasNewspaper ? '#4CAF50' : '#2196F3';
            ctx.fillRect(renderX, this.y, this.width, 15);
            
            // Mailbox door
            ctx.fillStyle = '#1976D2';
            ctx.fillRect(renderX + 2, this.y + 2, this.width - 4, 11);
            
            // Mailbox flag (up if has newspaper)
            if (this.hasNewspaper) {
                ctx.fillStyle = '#F44336';
                ctx.fillRect(renderX + this.width, this.y + 2, 6, 4);
            }
            
            // Handle
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(renderX + this.width - 3, this.y + 6, 2, 2);
            
            // Show newspaper sticking out if delivered
            if (this.hasNewspaper) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(renderX + 2, this.y - 2, 8, 4);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(renderX + 2, this.y - 2, 8, 4);
            }
        }
    }
}

class FinishLine {
    constructor(x) {
        this.x = x;
        this.width = 20;
        this.height = CONFIG.CANVAS_HEIGHT;
        this.animationOffset = 0;
    }
    
    render(ctx, worldOffset) {
        const renderX = this.x - worldOffset;
        
        if (renderX > -this.width && renderX < CONFIG.CANVAS_WIDTH + this.width) {
            // Animate the finish line
            this.animationOffset += 2;
            if (this.animationOffset > 40) this.animationOffset = 0;
            
            // Draw checkered pattern
            const squareSize = 20;
            for (let y = 0; y < CONFIG.CANVAS_HEIGHT; y += squareSize) {
                for (let x = 0; x < this.width; x += squareSize) {
                    const squareX = Math.floor((x + this.animationOffset) / squareSize);
                    const squareY = Math.floor(y / squareSize);
                    const isBlack = (squareX + squareY) % 2 === 0;
                    
                    ctx.fillStyle = isBlack ? '#000' : '#fff';
                    ctx.fillRect(renderX + x, y, Math.min(squareSize, this.width - x), Math.min(squareSize, CONFIG.CANVAS_HEIGHT - y));
                }
            }
            
            // Draw "FINISH" text vertically
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.save();
            ctx.translate(renderX + this.width/2, CONFIG.CANVAS_HEIGHT/2);
            ctx.rotate(-Math.PI/2);
            ctx.fillText('FINISH', 0, 0);
            ctx.restore();
            
            // Draw checkered flag poles
            ctx.fillStyle = '#8D6E63';
            ctx.fillRect(renderX - 5, 0, 5, CONFIG.CANVAS_HEIGHT);
            ctx.fillRect(renderX + this.width, 0, 5, CONFIG.CANVAS_HEIGHT);
            
            // Draw banner at top
            ctx.fillStyle = '#F44336';
            ctx.fillRect(renderX - 10, 20, this.width + 20, 30);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('FINISH LINE', renderX + this.width/2, 40);
        }
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
