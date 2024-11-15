// Import necessary THREE.js modules
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { Slingshot } from './Slingshot.js'; // Adjust the path if necessary

let scene, camera, renderer;
let player;
let groundPlane, ball, hole, flagPole, flag;
let shootingLine, puttingLine, green;

let isDragging = false;
let startPosition = new THREE.Vector2();
let currentPosition = new THREE.Vector2();
let originalBallPosition = new THREE.Vector3();
let maxPower = 15;

const SLINGSHOT_CONSTRAINT = 2;
const BALL_SLINGSHOT_HEIGHT = 1.5;
const GREEN_RADIUS = 3;
const PUTTER_POWER = 5;

let isOnGreen = false;
let isVRMode = false;
let vrController1, vrController2;
let slingshotHand = null;
let pinchHand = null;

const VR_BALL_HEIGHT = 0.3;

let slingshot; // Declare slingshot variable

let trajectoryPoints = [];
const NUM_TRAJECTORY_POINTS = 10;

const TARGET_DISTANCE = 15; // Distance to target
const TARGET_SIZE = 3; // Size of the target
const TARGET_RINGS = 5; // Number of concentric rings
const PAINTBALL_SIZE = 0.05; // Size of paintballs
let target, targetRings = [];
let paintSplats = []; // Array to store paint splats

function init() {
    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dark background

    // Setup renderer with XR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    // Create 'player' group and add camera and controllers to it
    player = new THREE.Group();
    scene.add(player);

    // Setup camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    player.add(camera); // Add camera to 'player' group

    // Setup controllers
    vrController1 = renderer.xr.getController(0);
    vrController2 = renderer.xr.getController(1);

    player.add(vrController1);
    player.add(vrController2);

    // Add visible meshes to controllers
    createControllerMeshes();

    // Add event listeners to controllers
    setupVRControls();

    // Replace ground plane with a smaller platform
    const platformGeometry = new THREE.BoxGeometry(4, 0.1, 4);
    const platformMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    groundPlane = new THREE.Mesh(platformGeometry, platformMaterial);
    groundPlane.position.y = -0.5;
    scene.add(groundPlane);

    // Create target
    createTarget();

    // Create paintball instead of golf ball
    const ballGeometry = new THREE.SphereGeometry(PAINTBALL_SIZE);
    const ballMaterial = new THREE.MeshBasicMaterial({ 
        color: getRandomColor() // We'll define this helper function
    });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
    ball.velocity = new THREE.Vector3();
    scene.add(ball);

    createShootingLine();
    
    // Create slingshot
    slingshot = new Slingshot();
    slingshot.position.set(0, 0, -0.5);
    scene.add(slingshot);

    // Initial positioning
    positionBallAndCamera();

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Setup VR
    document.body.appendChild(VRButton.createButton(renderer));
    renderer.xr.addEventListener('sessionstart', () => {
        isVRMode = true;
    });
    renderer.xr.addEventListener('sessionend', () => {
        isVRMode = false;
    });

    createTrajectoryPoints();
}

function createControllerMeshes() {
    // Create controller meshes with different colors for different states
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.2);
    const material1 = new THREE.MeshBasicMaterial({ color: 0x808080 });
    const material2 = new THREE.MeshBasicMaterial({ color: 0x808080 });

    // Add mesh to controller 1
    const controllerMesh1 = new THREE.Mesh(geometry, material1);
    vrController1.userData.mesh = controllerMesh1; // Store reference to mesh
    vrController1.add(controllerMesh1);

    // Add mesh to controller 2
    const controllerMesh2 = new THREE.Mesh(geometry, material2);
    vrController2.userData.mesh = controllerMesh2; // Store reference to mesh
    vrController2.add(controllerMesh2);
}

function createShootingLine() {
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    shootingLine = new THREE.Line(geometry, material);
    scene.add(shootingLine);
    shootingLine.visible = false;
}

function createGreen() {
    const greenGeometry = new THREE.CircleGeometry(GREEN_RADIUS, 32);
    const greenMaterial = new THREE.MeshBasicMaterial({
        color: 0x90FF90,
        transparent: true,
        opacity: 0.5,
    });
    green = new THREE.Mesh(greenGeometry, greenMaterial);
    green.rotation.x = -Math.PI / 2;
    green.position.set(
        hole.position.x,
        0.02,
        hole.position.z
    );
    scene.add(green);
}

function createPuttingLine() {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    puttingLine = new THREE.Line(geometry, material);
    puttingLine.visible = false;
    scene.add(puttingLine);
}

function positionBallAndCamera() {
    // Position ball in slingshot
    ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
    originalBallPosition.copy(ball.position);

    // Position camera (optional for non-VR mode)
    camera.position.set(0, 2, 5);
    camera.lookAt(new THREE.Vector3(0, ball.position.y, -100));

    // Update slingshot position
    updateSlingshotPosition();
}

function onMouseDown(event) {
    if (isVRMode) return; // Skip if in VR mode

    isDragging = true;
    startPosition.x = event.clientX;
    startPosition.y = event.clientY;
    currentPosition.copy(startPosition);
    shootingLine.visible = true;

    // Show slingshot bands
    slingshot.slingshotBand1.visible = true;
    slingshot.slingshotBand2.visible = true;
}

function onMouseMove(event) {
    if (isDragging && !isVRMode) {
        if (isOnGreen) {
            // Putting mechanic - show aim line
            const mouseX = event.clientX - startPosition.x;
            const mouseY = event.clientY - startPosition.y;

            // Calculate direction and power
            const power = Math.min(
                Math.sqrt(mouseX * mouseX + mouseY * mouseY) / window.innerHeight * PUTTER_POWER,
                PUTTER_POWER
            );

            // Calculate aim direction
            const aimDirection = new THREE.Vector2(mouseX, mouseY).normalize();

            // Update putting line
            const points = puttingLine.geometry.attributes.position;
            points.array[0] = ball.position.x;
            points.array[1] = 0.21; // Slightly above ground
            points.array[2] = ball.position.z;
            points.array[3] = ball.position.x - aimDirection.x * power;
            points.array[4] = 0.21;
            points.array[5] = ball.position.z - aimDirection.y * power;
            points.needsUpdate = true;

            puttingLine.visible = true;

        } else {
            // Slingshot mechanic for regular shots
            const mouseX = event.clientX - startPosition.x;
            const mouseY = event.clientY - startPosition.y;

            const pullBack =
                (mouseY / window.innerHeight) * SLINGSHOT_CONSTRAINT * 2;
            const pullSide =
                (mouseX / window.innerWidth) * SLINGSHOT_CONSTRAINT * 2;

            const newPosition = originalBallPosition
                .clone()
                .add(
                    new THREE.Vector3(
                        -pullSide,
                        -Math.max(pullBack * 0.2, 0),
                        Math.min(pullBack, SLINGSHOT_CONSTRAINT)
                    )
                );

            ball.position.copy(newPosition);
            slingshot.updateBands(ball);
            puttingLine.visible = false;
        }
    }
}

function onMouseUp() {
    if (isDragging && !isVRMode) {
        if (isOnGreen) {
            // Calculate putting direction and power from mouse movement
            const mouseX = event.clientX - startPosition.x;
            const mouseY = event.clientY - startPosition.y;

            const aimDirection = new THREE.Vector2(mouseX, mouseY).normalize();
            const power = Math.min(
                Math.sqrt(mouseX * mouseX + mouseY * mouseY) / window.innerHeight * PUTTER_POWER,
                PUTTER_POWER
            );

            // Set velocity based on aim line
            ball.velocity = new THREE.Vector3(
                -aimDirection.x * power,
                0, // No vertical velocity for putting
                -aimDirection.y * power
            );

            puttingLine.visible = false;
        } else {
            // Regular shot power calculation
            const pullDirection = originalBallPosition.clone().sub(ball.position);
            const power = Math.min(pullDirection.length() * 3, maxPower);
            ball.velocity = pullDirection.normalize().multiplyScalar(power);
        }

        isDragging = false;
        shootingLine.visible = false;

        // Hide slingshot bands
        slingshot.hideBands();
    }
}

function animate() {
    // Update ground position to follow player
    groundPlane.position.x = player.position.x;
    groundPlane.position.z = player.position.z;

    if (isDragging && isVRMode && pinchHand) {
        try {
            // Get controller's world position
            const controllerPos = new THREE.Vector3();
            pinchHand.getWorldPosition(controllerPos);

            // Apply offset if any
            if (pinchHand.userData.ballOffset) {
                controllerPos.add(pinchHand.userData.ballOffset);
            }

            // Limit pull distance
            const pullVector = controllerPos.clone().sub(originalBallPosition);
            const pullDistance = Math.min(pullVector.length(), SLINGSHOT_CONSTRAINT);
            pullVector.setLength(pullDistance);

            // Update ball position
            ball.position.copy(originalBallPosition.clone().add(pullVector));

            // Update slingshot bands
            if (slingshot) {
                slingshot.updateBands(ball);
            }

            // Calculate predicted velocity
            const ballWorldPos = new THREE.Vector3();
            ball.getWorldPosition(ballWorldPos);
            const forkCenter = getSlingshotForkCenter();
            
            if (forkCenter) {
                const shotDirection = forkCenter.clone().sub(ballWorldPos).normalize();
                const distance = ballWorldPos.distanceTo(forkCenter);
                const power = Math.min(distance * 15, maxPower);
                
                shotDirection.y = Math.min(distance * 0.5, 1.0);
                shotDirection.normalize();
                
                const predictedVelocity = shotDirection.multiplyScalar(power);
                updateTrajectoryPreview(ballWorldPos, predictedVelocity);
            }
        } catch (error) {
            console.error('Error in ball dragging:', error);
            isDragging = false;
            pinchHand = null;
        }
    }

    if (ball.velocity && ball.velocity.lengthSq() > 0) {
        // Apply gravity
        ball.velocity.y -= 0.1;

        // Update position
        ball.position.add(ball.velocity.clone().multiplyScalar(0.1));

        // Check for target collision
        const targetDistance = ball.position.distanceTo(target.position);
        if (Math.abs(ball.position.z - target.position.z) < 0.1 && 
            targetDistance < TARGET_SIZE) {
            // Create paint splat at collision point
            createPaintSplat(ball.position.clone(), ball.material.color);
            
            // Reset ball
            ball.velocity.set(0, 0, 0);
            ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
            ball.material.color.setHex(getRandomColor());
        }

        // Reset ball if it goes too far
        if (ball.position.z < -TARGET_DISTANCE - 10 || 
            ball.position.y < -10) {
            ball.velocity.set(0, 0, 0);
            ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
            ball.material.color.setHex(getRandomColor());
        }
    }

    // Update ball position if not being dragged or in motion
    if (!isDragging && (!ball.velocity || ball.velocity.lengthSq() === 0)) {
        updateBallPosition();
    }

    renderer.render(scene, camera);
}

function handleBallStop() {
    try {
        const finalPosition = ball.position.clone();
        ball.velocity.set(0, 0, 0);

        if (renderer.xr.isPresenting) {
            // Move player group to new position
            const offset = new THREE.Vector3(0, 0, 1);
            player.position.copy(finalPosition.clone().add(offset));

            // Move slingshot to ball position if not held
            if (!slingshotHand) {
                slingshot.position.set(finalPosition.x, 0, finalPosition.z);
                scene.add(slingshot);
            }

            // Update ball position after a short delay
            setTimeout(() => {
                updateBallPosition();
            }, 100);
        }
    } catch (e) {
        console.error('handleBallStop error:', e);
    }
}

function updateBallPosition() {
    if (!isDragging && (!ball.velocity || ball.velocity.lengthSq() === 0)) {
        if (slingshotHand) {
            // If slingshot is being held, position ball in the fork relative to slingshot
            const forkCenter = getSlingshotForkCenter();
            ball.position.copy(forkCenter);
            originalBallPosition.copy(ball.position);
        } else {
            // If slingshot is not being held, keep ball above slingshot
            ball.position.set(
                slingshot.position.x,
                slingshot.position.y + BALL_SLINGSHOT_HEIGHT,
                slingshot.position.z
            );
            originalBallPosition.copy(ball.position);
        }
    }
}

function updateSlingshotPosition() {
    // Update slingshot position to match ball's position
    slingshot.position.set(ball.position.x, 0, ball.position.z);
}

function setupVRControls() {
    function onSqueezeStart(event) {
        const controller = event.target;
        const controllerPos = new THREE.Vector3();
        controller.getWorldPosition(controllerPos);

        if (!slingshotHand) {
            const distance = controllerPos.distanceTo(
                slingshot.getWorldPosition(new THREE.Vector3())
            );
            if (distance < 1) {
                slingshotHand = controller;
                controller.add(slingshot);
                slingshot.position.set(0, -0.1, -0.2);
                updateBallPosition();
            }
        } else if (slingshotHand !== controller && !isDragging) {
            const distance = controllerPos.distanceTo(ball.position);
            if (distance < 0.5) {
                pinchHand = controller;
                isDragging = true;
                originalBallPosition.copy(ball.position);

                // Calculate offset between controller and ball
                const ballOffset = ball.position.clone().sub(controllerPos);
                controller.userData.ballOffset = ballOffset;

                // Show slingshot bands
                slingshot.slingshotBand1.visible = true;
                slingshot.slingshotBand2.visible = true;
            }
        }
    }

    function onSqueezeEnd(event) {
        const controller = event.target;

        if (slingshotHand === controller) {
            slingshotHand.remove(slingshot);
            scene.add(slingshot);
            slingshot.position.set(ball.position.x, 0, ball.position.z);
            slingshotHand = null;
            updateBallPosition();
        } else if (pinchHand === controller && isDragging) {
            const ballWorldPos = new THREE.Vector3();
            ball.getWorldPosition(ballWorldPos);
            
            const forkCenter = getSlingshotForkCenter();
            const shotDirection = forkCenter.clone().sub(ballWorldPos).normalize();
            
            const distance = ballWorldPos.distanceTo(forkCenter);
            const power = Math.min(distance * 15, maxPower);
            
            shotDirection.y = Math.min(distance * 0.5, 1.0);
            shotDirection.normalize();
            
            ball.velocity = shotDirection.multiplyScalar(power);
            
            isDragging = false;
            pinchHand = null;
            controller.userData.ballOffset = null;
            slingshot.hideBands();
            hideTrajectoryPreview();
        }
    }

    vrController1.addEventListener('squeezestart', onSqueezeStart);
    vrController1.addEventListener('squeezeend', onSqueezeEnd);

    vrController2.addEventListener('squeezestart', onSqueezeStart);
    vrController2.addEventListener('squeezeend', onSqueezeEnd);
}

function checkHoleCollision() {
    const ballPosition = new THREE.Vector2(ball.position.x, ball.position.z);
    const holePosition = new THREE.Vector2(hole.position.x, hole.position.z);
    const distance = ballPosition.distanceTo(holePosition);

    if (distance < 0.3 && (!ball.velocity || ball.velocity.length() < 0.5)) {
        return true;
    }
    return false;
}

// Add this helper function to calculate slingshot fork center
function getSlingshotForkCenter() {
    const leftForkPos = new THREE.Vector3(-0.14, 0.44, 0);
    const rightForkPos = new THREE.Vector3(0.14, 0.44, 0);
    const forkCenter = new THREE.Vector3();
    
    // Get world position of fork center
    slingshot.localToWorld(forkCenter.copy(leftForkPos.add(rightForkPos).multiplyScalar(0.5)));
    return forkCenter;
}

// Add this function to create trajectory preview points
function createTrajectoryPoints() {
    const sphereGeometry = new THREE.SphereGeometry(0.01); // Small spheres
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true
    });

    for (let i = 0; i < NUM_TRAJECTORY_POINTS; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone());
        sphere.visible = false;
        scene.add(sphere);
        trajectoryPoints.push(sphere);
    }
}

// Add this function to update trajectory preview
function updateTrajectoryPreview(startPos, velocity) {
    const tempVelocity = velocity.clone();
    const tempPos = startPos.clone();
    const timeStep = 0.1;
    
    for (let i = 0; i < NUM_TRAJECTORY_POINTS; i++) {
        // Update position
        tempPos.x += tempVelocity.x * timeStep;
        tempPos.y += tempVelocity.y * timeStep;
        tempPos.z += tempVelocity.z * timeStep;
        
        // Apply gravity
        tempVelocity.y -= 0.1 * timeStep;
        
        // Update sphere position and opacity
        trajectoryPoints[i].position.copy(tempPos);
        trajectoryPoints[i].material.opacity = 1 - (i / NUM_TRAJECTORY_POINTS);
        trajectoryPoints[i].visible = true;
        
        // If trajectory hits ground, stop
        if (tempPos.y < 0.2) break;
    }
}

// Add this function to hide trajectory preview
function hideTrajectoryPreview() {
    trajectoryPoints.forEach(point => point.visible = false);
}

// Add new function to create target
function createTarget() {
    const targetGroup = new THREE.Group();
    
    // Create a backing plane for the target (black border)
    const backingGeometry = new THREE.CircleGeometry(TARGET_SIZE + 0.1, 32);
    const backingMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide
    });
    const backing = new THREE.Mesh(backingGeometry, backingMaterial);
    targetGroup.add(backing);

    // Create concentric rings from outside to inside
    // black and white
    const colors = [0x000000, 0xffffff, 0x000000, 0xffffff, 0x000000];
    
    for (let i = 0; i < TARGET_RINGS; i++) {
        const ringSize = ((TARGET_RINGS - i) / TARGET_RINGS) * TARGET_SIZE;
        const ringGeometry = new THREE.CircleGeometry(ringSize, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: colors[i],
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Move each ring slightly forward to prevent z-fighting
        ring.position.z = 0.001 * (i + 1);
        
        targetRings.push(ring);
        targetGroup.add(ring);
    }

    // Position the target
    targetGroup.position.set(0, 2, -TARGET_DISTANCE);
    scene.add(targetGroup);
    target = targetGroup;
}

// Add function to create paint splats
function createPaintSplat(position, color) {
    const splatGeometry = new THREE.CircleGeometry(0.1, 8);
    const splatMaterial = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const splat = new THREE.Mesh(splatGeometry, splatMaterial);
    
    // Position slightly in front of target to avoid z-fighting
    splat.position.copy(position);
    splat.position.z += 0.01;
    
    // Random rotation for variety
    splat.rotation.z = Math.random() * Math.PI * 2;
    
    scene.add(splat);
    paintSplats.push(splat);
    
    // Limit number of splats for performance
    if (paintSplats.length > 50) {
        const oldestSplat = paintSplats.shift();
        scene.remove(oldestSplat);
    }
}

// Add helper function for random colors
function getRandomColor() {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Start the initialization
init();

