import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, level) {
        this.camera = camera;
        this.level = level;
        
        // Controls
        this.controls = new PointerLockControls(camera, domElement);
        
        // Physics constants
        this.speed = 10.0;
        this.size = 0.6; // Collision radius
        this.height = 1.6; // Eye height
        this.gravity = 30.0;
        this.jumpStrength = 12.0; 
        this.stepHeight = 1.1; // Max height player can step up
        this.onGround = false;
        
        // State
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Weapon Bobbing
        this.bobTimer = 0;
        this.weapon = this.createWeapon();
        this.camera.add(this.weapon);

        // Setup inputs
        this._initInputs();
    }

    getObject() {
        return this.controls.getObject();
    }

    lock() {
        this.controls.lock();
    }

    _initInputs() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
                case 'Space': this.jump(); break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        
        // Shoot listener
        document.addEventListener('mousedown', (e) => {
            if (this.controls.isLocked) this.shoot();
        });
    }

    createWeapon() {
        // Create a simple Doom-style gun model (centered box)
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.6);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(0, -0.5, -0.8); // Bottom center
        mesh.castShadow = true;
        
        // Muzzle flash light (hidden by default)
        this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 5);
        this.muzzleLight.position.set(0, 0, -1);
        mesh.add(this.muzzleLight);
        
        return mesh;
    }

    jump() {
        if (this.onGround) {
            this.velocity.y = this.jumpStrength;
            this.onGround = false;
        }
    }

    shoot() {
        // Simple shooting effect
        this.muzzleLight.intensity = 5;
        
        // Recoil
        this.weapon.position.z += 0.2;
        
        setTimeout(() => {
            this.muzzleLight.intensity = 0;
        }, 50);
        
        if (this.onShoot) this.onShoot();
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // Apply friction/damping
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        // Gravity
        this.velocity.y -= this.gravity * delta;

        // Determine move direction - FIXED inverted controls
        this.direction.z = Number(this.moveBackward) - Number(this.moveForward);
        this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
        this.direction.normalize(); // Consistent speed in diagonals

        // Apply acceleration
        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * 400.0 * delta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * 400.0 * delta;
        }

        // Calculate next position
        const controlObj = this.controls.getObject();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(controlObj.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(controlObj.quaternion);
        
        // Flat movement (Doom didn't fly)
        forward.y = 0;
        forward.normalize();
        right.y = 0;
        right.normalize();

        const deltaX = (right.x * this.velocity.x + forward.x * this.velocity.z) * delta;
        const deltaZ = (right.z * this.velocity.x + forward.z * this.velocity.z) * delta;
        const deltaY = this.velocity.y * delta;

        // Collision Detection (Grid based)
        const currentPos = controlObj.position.clone();
        
        // Current Floor Height (to check if we are falling)
        const currentFloorY = this.level.getFloorHeight(currentPos.x, currentPos.z);
        
        // Check X movement
        if (this._canMoveTo(currentPos.x + deltaX, currentPos.z, currentFloorY)) {
            controlObj.position.x += deltaX;
        } else {
             this.velocity.x = 0;
        }

        // Check Z movement
        if (this._canMoveTo(controlObj.position.x, currentPos.z + deltaZ, currentFloorY)) {
            controlObj.position.z += deltaZ;
        } else {
            this.velocity.z = 0;
        }

        // Apply Gravity / Vertical Movement
        controlObj.position.y += deltaY;

        // Floor collision check (snap to floor)
        const newFloorY = this.level.getFloorHeight(controlObj.position.x, controlObj.position.z);
        if (controlObj.position.y < newFloorY + this.height) {
            controlObj.position.y = newFloorY + this.height;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Weapon bobbing & recoil return
        if (this.onGround && (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight)) {
            this.bobTimer += delta * 15;
            this.weapon.position.y = -0.5 + Math.sin(this.bobTimer) * 0.02;
            this.weapon.position.x = Math.cos(this.bobTimer * 0.5) * 0.02;
        } else {
            // Return to center
            this.weapon.position.y = THREE.MathUtils.lerp(this.weapon.position.y, -0.5, delta * 10);
            this.weapon.position.x = THREE.MathUtils.lerp(this.weapon.position.x, 0, delta * 10);
        }
        
        // Return recoil
        this.weapon.position.z = THREE.MathUtils.lerp(this.weapon.position.z, -0.8, delta * 10);
    }

    _canMoveTo(x, z, currentY) {
        if (this.level.isWall(x, z)) return false;
        
        const targetY = this.level.getFloorHeight(x, z);
        // If target floor is too high compared to current floor, block
        // Using currentY (passed in) which is the floor height we are standing on
        if (targetY > currentY + this.stepHeight) return false;
        
        return true;
    }
}
