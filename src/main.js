import * as THREE from 'three';
import { Player } from './player.js';
import { Level } from './level.js';
import { Monster } from './monster.js';

// Global variables
let camera, scene, renderer;
let player, level;
let monsters = [];
let lastTime = performance.now();

// Doom-style map 
// 0=Floor, 1=Wall, 2=Item, 3=Step(H1), 4=High(H2), 5=Pit, 6=Imp, 7=Demon
const mapData = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 6, 0, 1, 3, 3, 3, 1, 4, 4, 4, 1], // Imp here
    [1, 0, 0, 0, 0, 0, 1, 3, 0, 3, 1, 4, 0, 4, 1],
    [1, 0, 0, 1, 1, 0, 1, 3, 0, 3, 0, 0, 0, 0, 1],
    [1, 0, 0, 1, 7, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1], // Demon here
    [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 5, 5, 5, 0, 0, 1], // Pit
    [1, 0, 1, 1, 0, 0, 1, 0, 0, 5, 5, 5, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 1, 0, 1], // Another Imp
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

init();
animate();

function init() {
    const container = document.body;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 0, 20); // Distance fog for atmosphere

    // Camera setup (FOV 80 for that retro wide feel)
    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: false }); // False for pixelated look
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Level generation
    level = new Level(scene, mapData);
    
    // Player setup
    player = new Player(camera, document.body, level);
    const startPos = level.getStartPosition();
    player.getObject().position.set(startPos.x, player.height, startPos.z);
    scene.add(player.getObject());

    // Handle shooting
    player.onShoot = () => {
        // Check hits
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        
        // Intersect monsters
        // Actually simpler: check distance and angle to monsters
        const playerPos = player.getObject().position;
        const playerDir = new THREE.Vector3();
        camera.getWorldDirection(playerDir);
        
        for (const monster of monsters) {
            if (monster.state === 'dead') continue;
            
            // Check if close enough and in front
            const toMonster = new THREE.Vector3().subVectors(monster.position, playerPos);
            const dist = toMonster.length();
            toMonster.normalize();
            
            const angle = playerDir.angleTo(toMonster);
            
            if (dist < 50 && angle < 0.2) { // 0.2 rad is narrow cone
                // Hit!
                monster.takeDamage(20); // 2 shots to kill Imp, 5 for Demon
                console.log("Hit monster!");
                
                // Add blood particle? (Skipped for brevity)
                break; // Hit one at a time
            }
        }
    };

    // Monsters setup
    level.monsterSpawns.forEach(spawn => {
        const m = new Monster(scene, spawn.type, spawn.x, spawn.z, level);
        monsters.push(m);
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 10, 0);
    scene.add(dirLight);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    
    const startScreen = document.getElementById('start-screen');
    startScreen.addEventListener('click', () => {
        player.lock();
        startScreen.style.display = 'none';
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    
    player.update(delta);
    
    // Update Monsters
    monsters.forEach(m => m.update(delta, player));

    renderer.render(scene, camera);
    
    lastTime = time;
}

