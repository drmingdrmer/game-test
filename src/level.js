import * as THREE from 'three';

export class Level {
    constructor(scene, mapData) {
        this.scene = scene;
        this.cellSize = 4; // Size of one grid block

        // Textures
        this.floorTexture = this._createTexture('#665544', 'floor'); // Slightly lighter floor
        this.wallTexture = this._createTexture('#aaaaaa', 'wall');   // Much lighter wall
        this.ceilTexture = this._createTexture('#444444', 'ceil');   // Lighter ceiling
        this.itemTexture = this._createTexture('#0000ff', 'item');
        this.stepTexture = this._createTexture('#665544', 'step'); // Texture for vertical steps

        // Parse map data if it's simple array or new format
        // We'll normalize it to an object structure internally: grid[z][x] = { type, height, ... }
        this.grid = [];
        this.rows = 0;
        this.cols = 0;
        this.monsterSpawns = []; // { type, x, z }
        this._parseMap(mapData);

        this.levelGroup = new THREE.Group();
        this.scene.add(this.levelGroup);

        this.generate();
    }

    _parseMap(mapData) {
        this.rows = mapData.length;
        this.cols = mapData[0].length;
        this.grid = new Array(this.rows).fill(0).map(() => new Array(this.cols).fill(null));

        for (let z = 0; z < this.rows; z++) {
            for (let x = 0; x < this.cols; x++) {
                const val = mapData[z][x];
                let cell = { type: 'floor', height: 0, ceilHeight: 4, isWall: false };

                // Define codes
                switch (val) {
                    case 1: // Wall
                        cell.isWall = true;
                        cell.height = 0;
                        break;
                    case 0: // Floor H0
                        cell.height = 0;
                        break;
                    case 2: // Item on H0
                        cell.height = 0;
                        cell.hasItem = true;
                        break;
                    case 3: // Floor H1 (Step up)
                        cell.height = 1.5;
                        break;
                    case 4: // Floor H2 (High platform)
                        cell.height = 3.0;
                        break;
                    case 5: // Pit
                        cell.height = -2.0;
                        break;
                    case 6: // Monster Imp (H0)
                        cell.height = 0;
                        this.monsterSpawns.push({ type: 'imp', x: x * this.cellSize, z: z * this.cellSize });
                        break;
                    case 7: // Monster Demon (H0)
                        cell.height = 0;
                        this.monsterSpawns.push({ type: 'demon', x: x * this.cellSize, z: z * this.cellSize });
                        break;
                    default:
                        cell.height = 0;
                }
                this.grid[z][x] = cell;
            }
        }
    }

    _createTexture(colorStr, type) {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base color
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, size, size);

        // Add noise
        for (let i = 0; i < 100; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            const w = Math.floor(Math.random() * 4) + 1;
            const h = Math.floor(Math.random() * 4) + 1;
            ctx.fillRect(x, y, w, h);
        }

        // Pattern specific
        if (type === 'wall') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, size - 4, size, 4);
            ctx.fillRect(0, 0, size, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(size / 2, 0, 2, size); // Vertical seam
        }
        if (type === 'step') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            for (let i = 0; i < size; i += 8) {
                ctx.fillRect(0, i, size, 2);
            }
        }
        if (type === 'item') {
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(16, 16, 32, 32);
            ctx.fillStyle = '#ccccff';
            ctx.fillRect(20, 20, 10, 10);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        return texture;
    }

    generate() {
        // Geometries reused
        const floorGeo = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
        const wallGeo = new THREE.BoxGeometry(this.cellSize, 4, this.cellSize); // Standard wall block

        const floorMat = new THREE.MeshLambertMaterial({ map: this.floorTexture });
        const ceilMat = new THREE.MeshLambertMaterial({ map: this.ceilTexture, side: THREE.BackSide });
        const wallMat = new THREE.MeshLambertMaterial({ map: this.wallTexture });
        const stepMat = new THREE.MeshLambertMaterial({ map: this.stepTexture });

        for (let z = 0; z < this.rows; z++) {
            for (let x = 0; x < this.cols; x++) {
                const cell = this.grid[z][x];
                const posX = x * this.cellSize;
                const posZ = z * this.cellSize;

                if (cell.isWall) {
                    // Just a big block for now
                    const wall = new THREE.Mesh(new THREE.BoxGeometry(this.cellSize, 8, this.cellSize), wallMat);
                    wall.position.set(posX, 2, posZ);
                    this.levelGroup.add(wall);
                    continue;
                }

                // Floor
                const floor = new THREE.Mesh(floorGeo, floorMat);
                floor.rotation.x = -Math.PI / 2;
                floor.position.set(posX, cell.height, posZ);
                this.levelGroup.add(floor);

                // Ceiling (fixed height for now, or relative)
                const ceil = new THREE.Mesh(floorGeo, ceilMat);
                ceil.rotation.x = Math.PI / 2;
                ceil.position.set(posX, cell.ceilHeight, posZ);
                this.levelGroup.add(ceil);

                // Item
                if (cell.hasItem) {
                    const spriteMat = new THREE.SpriteMaterial({ map: this.itemTexture });
                    const sprite = new THREE.Sprite(spriteMat);
                    sprite.scale.set(2, 2, 1);
                    sprite.position.set(posX, cell.height + 1, posZ);
                    this.levelGroup.add(sprite);
                }

                // Check neighbors to build "sides" (walls between height diffs)
                this._buildSides(x, z, cell.height, this.levelGroup, stepMat);
            }
        }
    }

    _buildSides(x, z, currentH, group, mat) {
        // Check 4 neighbors. If neighbor is lower, build a wall going down from currentH to neighborH
        const neighbors = [
            { dx: 0, dz: -1, rot: 0 }, // North
            { dx: 0, dz: 1, rot: Math.PI }, // South
            { dx: -1, dz: 0, rot: -Math.PI / 2 }, // West
            { dx: 1, dz: 0, rot: Math.PI / 2 } // East
        ];

        const halfSize = this.cellSize / 2;

        for (const n of neighbors) {
            const nx = x + n.dx;
            const nz = z + n.dz;

            let neighborH = -100; // Void
            if (nx >= 0 && nx < this.cols && nz >= 0 && nz < this.rows) {
                if (this.grid[nz][nx].isWall) {
                    // Wall neighbors don't need sides typically, but maybe they do if wall starts low? 
                    // Assuming walls go infinitely down for now.
                    continue;
                }
                neighborH = this.grid[nz][nx].height;
            }

            if (currentH > neighborH) {
                // Build wall
                const heightDiff = currentH - neighborH;
                // Plane centered at midpoint vertically
                const sideGeo = new THREE.PlaneGeometry(this.cellSize, heightDiff);
                const side = new THREE.Mesh(sideGeo, mat);

                // Position: Edge of cell
                side.position.x = x * this.cellSize + n.dx * halfSize;
                side.position.z = z * this.cellSize + n.dz * halfSize;
                side.position.y = neighborH + heightDiff / 2;

                side.rotation.y = n.rot;
                group.add(side);
            }
        }
    }

    isWall(x, z) {
        const gridX = Math.round(x / this.cellSize);
        const gridZ = Math.round(z / this.cellSize);

        if (gridZ >= 0 && gridZ < this.rows && gridX >= 0 && gridX < this.cols) {
            return this.grid[gridZ][gridX].isWall;
        }
        return true;
    }

    getFloorHeight(x, z) {
        const gridX = Math.round(x / this.cellSize);
        const gridZ = Math.round(z / this.cellSize);

        if (gridZ >= 0 && gridZ < this.rows && gridX >= 0 && gridX < this.cols) {
            return this.grid[gridZ][gridX].height;
        }
        return -100; // Void
    }

    getStartPosition() {
        for (let z = 0; z < this.rows; z++) {
            for (let x = 0; x < this.cols; x++) {
                if (!this.grid[z][x].isWall && this.grid[z][x].height === 0) {
                    return { x: x * this.cellSize, z: z * this.cellSize };
                }
            }
        }
        return { x: 0, z: 0 };
    }
}
