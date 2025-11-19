import * as THREE from 'three';

export class Monster {
    constructor(scene, type, x, z, level) {
        this.scene = scene;
        this.type = type; // 'imp' or 'demon'
        this.level = level;
        
        this.position = new THREE.Vector3(x, 0, z);
        this.health = type === 'demon' ? 100 : 40;
        this.speed = type === 'demon' ? 6.0 : 3.0;
        this.state = 'idle'; // idle, chase, attack, hurt, dead
        
        this.mesh = this._createMesh();
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
        
        // Animation
        this.time = 0;
    }

    _createMesh() {
        const color = this.type === 'demon' ? '#ff5555' : '#55ff55';
        const size = this.type === 'demon' ? 2.5 : 2.0;
        
        // Procedural texture for monster
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = color;
        // Draw a simple shape
        ctx.beginPath();
        ctx.arc(32, 20, 15, 0, Math.PI*2); // Head
        ctx.fill();
        ctx.fillRect(16, 35, 32, 29); // Body
        
        // Eyes
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(24, 15, 5, 5);
        ctx.fillRect(35, 15, 5, 5);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;

        const mat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(size, size, 1);
        
        // Adjust Y so it stands on floor
        // Initial Y will be set in update
        return sprite;
    }

    update(delta, player) {
        if (this.state === 'dead') return;

        const playerPos = player.getObject().position;
        const dist = this.position.distanceTo(playerPos);
        
        // Simple AI
        if (dist < 20) {
            this.state = 'chase';
        }
        
        if (this.state === 'chase') {
            const direction = new THREE.Vector3()
                .subVectors(playerPos, this.position);
            direction.y = 0;
            direction.normalize();
            
            const moveDist = this.speed * delta;
            const nextX = this.position.x + direction.x * moveDist;
            const nextZ = this.position.z + direction.z * moveDist;
            
            // Collision with walls
            if (!this.level.isWall(nextX, this.position.z)) {
                this.position.x = nextX;
            }
            if (!this.level.isWall(this.position.x, nextZ)) {
                this.position.z = nextZ;
            }
        }

        // Update floor height
        const floorH = this.level.getFloorHeight(this.position.x, this.position.z);
        this.position.y = floorH + (this.type === 'demon' ? 1.25 : 1.0); // Center of sprite
        
        this.mesh.position.copy(this.position);
        
        // Face player (Sprites do this automatically, but if we had 3D model...)
    }
    
    takeDamage(amount) {
        this.health -= amount;
        this.mesh.material.color.setHex(0xffffff); // Flash white
        setTimeout(() => {
            if(this.health <= 0) {
                this.die();
            } else {
                 this.mesh.material.color.setHex(0xffffff); // Reset (actually sprite mat color tints the texture)
                 // Revert to default tint
                 this.mesh.material.color.setHex(0xffffff); 
            }
        }, 100);
    }
    
    die() {
        this.state = 'dead';
        this.mesh.scale.y = 0.5; // Squish
        this.mesh.position.y -= 0.5;
        // In full game, switch to dead sprite
    }
}

