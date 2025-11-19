import * as THREE from 'three';

export class Projectile {
    constructor(scene, position, direction) {
        this.scene = scene;
        this.speed = 40.0; // Fast but visible
        this.direction = direction.normalize();
        this.position = position.clone();
        this.lastPosition = position.clone();
        this.alive = true;
        
        // Visual mesh (glowing orb)
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
        
        // Trail/Glow light
        this.light = new THREE.PointLight(0xffff00, 1, 3);
        this.mesh.add(this.light);

        this.raycaster = new THREE.Raycaster();
    }

    update(delta, level, monsters, camera) {
        if (!this.alive) return;

        this.lastPosition.copy(this.position);
        
        // Move
        const displacement = this.direction.clone().multiplyScalar(this.speed * delta);
        this.position.add(displacement);
        this.mesh.position.copy(this.position);

        // Check collision (Continuous from lastPos to currentPos)
        const dist = displacement.length();
        if (dist > 0) {
            this.raycaster.set(this.lastPosition, this.direction);
            this.raycaster.camera = camera; // Required for Sprite intersection
            this.raycaster.far = dist;

            // 1. Check Walls/Level
            // Only check meshes, filter out non-Mesh objects if any
            const levelMeshes = level.levelGroup.children.filter(c => c.isMesh);
            const levelHits = this.raycaster.intersectObjects(levelMeshes);
            
            // 2. Check Monsters
            const monsterMeshes = monsters
                .filter(m => m.state !== 'dead')
                .map(m => m.mesh);
            const monsterHits = this.raycaster.intersectObjects(monsterMeshes);

            // Find closest hit
            let hit = null;
            let hitType = null; // 'wall' or 'monster'

            if (levelHits.length > 0) {
                hit = levelHits[0];
                hitType = 'wall';
            }

            if (monsterHits.length > 0) {
                if (!hit || monsterHits[0].distance < hit.distance) {
                    hit = monsterHits[0];
                    hitType = 'monster';
                }
            }

            if (hit) {
                this.onHit(hit, hitType, monsters);
            }
        }
        
        // Cleanup if too far
        if (this.position.length() > 1000) {
            this.destroy();
        }
    }

    onHit(hit, type, monsters) {
        // Spawn effect at hit.point
        this.createImpactEffect(hit.point);

        if (type === 'monster') {
            // Find which monster (brute force for now, or map mesh to monster)
            // In small game simpler is fine: find monster with this mesh
            const monster = monsters.find(m => m.mesh === hit.object);
            if (monster) {
                monster.takeDamage(20);
                console.log("Projectile hit monster!");
            }
        }

        this.destroy();
    }

    createImpactEffect(pos) {
        // Simple particle burst
        const particleCount = 5;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        
        for (let i = 0; i < particleCount; i++) {
            positions.push(pos.x, pos.y, pos.z);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ 
            color: 0xffaa00, 
            size: 0.2,
            transparent: true 
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // Animate particles (simple hack: storing velocity in user data or just remove after time)
        // For simplicity in this scope, just remove after short time
        setTimeout(() => {
            this.scene.remove(particles);
            geometry.dispose();
            material.dispose();
        }, 200);
    }

    destroy() {
        this.alive = false;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

