// Import necessary THREE.js modules at the top if you're using modules
// import * as THREE from 'three';
// import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

let scene, camera, renderer;
let player; // Added 'player' group
let ground, ball, hole, flagPole, flag;
let isDragging = false;
let startPosition = new THREE.Vector2();
let currentPosition = new THREE.Vector2();
let shootingPower = 0;
let maxPower = 15;
let shootingLine;
let slingshot;
let slingshotBand1, slingshotBand2;
let originalBallPosition = new THREE.Vector3();
const SLINGSHOT_CONSTRAINT = 2; // Maximum pull distance

const BALL_START_HEIGHT = 0.2;
const CAMERA_HEIGHT = 2;
const CAMERA_DISTANCE = 5;
const BALL_OFFSET_Z = -3;  // How far in front of camera the ball should be
const BALL_OFFSET_Y = -1;  // How far below camera height the ball should be

const BALL_SLINGSHOT_HEIGHT = 1.5;  // Base height of ball in slingshot

const GREEN_RADIUS = 3;  // Size of the green around the hole
const PUTTER_POWER = 5;  // Maximum power for putting

let isOnGreen = false;
let green;  // The visual green mesh

let puttingLine;

let groundPlane;

let isVRMode = false;
let vrController1, vrController2;  // For left and right hands
let gripSpace1, gripSpace2;        // For hand positions

let slingshotHand = null;  // Controller holding the slingshot
let pinchHand = null;      // Controller doing the pinching
const PINCH_DISTANCE = 0.1; // Distance to grab ball

let controllerModelFactory;
let controllerGrip1, controllerGrip2;

const VR_BALL_HEIGHT = 0.3;  // Lower ball height for VR

function checkHoleCollision() {
    const ballPosition = new THREE.Vector2(ball.position.x, ball.position.z);
    const holePosition = new THREE.Vector2(hole.position.x, hole.position.z);
    const distance = ballPosition.distanceTo(holePosition);
    
    // If ball is close enough to hole and moving slowly enough
    if (distance < 0.3 && (!ball.velocity || ball.velocity.length() < 0.5)) {
        return true;
    }
    return false;
}

function init() {
    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Setup renderer with XR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.setAnimationLoop(animate); // Use setAnimationLoop instead of requestAnimationFrame
    document.body.appendChild(renderer.domElement);

    // Create 'player' group and add camera and controllers to it
    player = new THREE.Group();
    scene.add(player);

    // Setup camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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

    // Create infinite ground plane
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);  // Much bigger plane
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x90EE90,
        side: THREE.DoubleSide
    });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    scene.add(groundPlane);

    // Create golf ball with smaller size
    const ballGeometry = new THREE.SphereGeometry(0.02);  // Much smaller ball
    const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0.2, 5);
    scene.add(ball);

    // Create hole
    const holeGeometry = new THREE.CircleGeometry(0.3);
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(0, 0.01, -25);
    scene.add(hole);

    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    flagPole = new THREE.Mesh(poleGeometry, poleMaterial);
    flagPole.position.set(0, 0.5, -25);
    scene.add(flagPole);

    // Create flag with new color
    const flagGeometry = new THREE.PlaneGeometry(0.5, 0.3);
    const flagMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xDDA0DD,  // Changed to plum
        side: THREE.DoubleSide 
    });
    flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(0.25, 0.85, -25);
    scene.add(flag);

    createShootingLine();
    shootingLine.visible = false;

    createSlingshot();

    // Initial positioning
    positionBallAndCamera();

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    createGreen();
    createPuttingLine();

    // Setup VR
    renderer.xr.enabled = true;
    document.body.appendChild(VRButton.createButton(renderer));
}

function createShootingLine() {
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)  // Adding a third point for the trajectory
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    shootingLine = new THREE.Line(geometry, material);
    scene.add(shootingLine);
}

function createSlingshot() {
    // Create the Y-shaped frame with smaller dimensions
    const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);  // Smaller dimensions
    const forkGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2);  // Smaller dimensions
    const slingshotMaterial = new THREE.MeshBasicMaterial({ color: 0x4b2626 });

    // Create main stem
    const stem = new THREE.Mesh(stemGeometry, slingshotMaterial);
    stem.position.y = 0.2;  // Lower position

    // Create left fork
    const leftFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
    leftFork.position.set(-0.08, 0.36, 0);  // Adjusted positions
    leftFork.rotation.z = Math.PI / 4;

    // Create right fork
    const rightFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
    rightFork.position.set(0.08, 0.36, 0);  // Adjusted positions
    rightFork.rotation.z = -Math.PI / 4;

    // Group all parts
    slingshot = new THREE.Group();
    slingshot.add(stem);
    slingshot.add(leftFork);
    slingshot.add(rightFork);

    // Create elastic bands with adjusted positions
    const bandMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    slingshotBand1 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.14, 0.44, 0),  // Adjusted positions
            new THREE.Vector3(0, 0.3, 0)
        ]),
        bandMaterial
    );

    slingshotBand2 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.14, 0.44, 0),   // Adjusted positions
            new THREE.Vector3(0, 0.3, 0)
        ]),
        bandMaterial
    );

    slingshot.add(slingshotBand1);
    slingshot.add(slingshotBand2);

    // Initial position
    slingshot.position.set(0, 0, -0.5);  // Position it in front of the player
    scene.add(slingshot);
}

function positionBallAndCamera() {
    // Position ball in slingshot
    ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
    originalBallPosition.copy(ball.position);

    // Position camera (optional for non-VR mode)
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(new THREE.Vector3(0, ball.position.y, -100));

    // Update slingshot position
    updateSlingshotPosition();
}

function onMouseDown(event) {
    isDragging = true;
    startPosition.x = event.clientX;
    startPosition.y = event.clientY;
    currentPosition.copy(startPosition);
    shootingLine.visible = true;
}

function onMouseMove(event) {
    if (isDragging) {
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
            points.array[1] = 0.21;  // Slightly above ground
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

            const pullBack = mouseY / window.innerHeight * SLINGSHOT_CONSTRAINT * 2;
            const pullSide = mouseX / window.innerWidth * SLINGSHOT_CONSTRAINT * 2;

            const newPosition = originalBallPosition.clone().add(new THREE.Vector3(
                -pullSide,
                -Math.max(pullBack * 0.2, 0),
                Math.min(pullBack, SLINGSHOT_CONSTRAINT)
            ));

            ball.position.copy(newPosition);
            updateSlingshotBands();
            puttingLine.visible = false;
        }
    }
}

function updateSlingshotBands() {
    const slingshotWorldPos = new THREE.Vector3();
    const ballWorldPos = new THREE.Vector3();
    slingshot.getWorldPosition(slingshotWorldPos);
    ball.getWorldPosition(ballWorldPos);
    
    // Calculate relative position
    const relativePos = ballWorldPos.clone().sub(slingshotWorldPos);
    
    // Update band positions
    slingshotBand1.geometry.setFromPoints([
        new THREE.Vector3(-0.14, 0.44, 0),
        relativePos
    ]);
    
    slingshotBand2.geometry.setFromPoints([
        new THREE.Vector3(0.14, 0.44, 0),
        relativePos
    ]);
}

function onMouseUp() {
    if (isDragging) {
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
                0,  // No vertical velocity for putting
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
    }
}

function animate() {
    // Update ground position to follow player
    groundPlane.position.x = player.position.x;
    groundPlane.position.z = player.position.z;

    if (ball.velocity) {
        // Apply gravity
        ball.velocity.y -= 0.1;

        // Update position
        ball.position.x += ball.velocity.x * 0.1;
        ball.position.y += ball.velocity.y * 0.1;
        ball.position.z += ball.velocity.z * 0.1;

        // Ground collision
        if (ball.position.y < 0.2) {
            ball.position.y = 0.2;
            ball.velocity.y = -ball.velocity.y * 0.5;

            ball.velocity.x *= 0.8;
            ball.velocity.z *= 0.8;
        }

        // Apply friction
        ball.velocity.x *= 0.99;
        ball.velocity.z *= 0.99;

        // Stop the ball if it's moving very slowly
        if (ball.velocity.length() < 0.1 && ball.position.y <= 0.2) {
            handleBallStop();
        }

        // Check if ball went in hole
        if (checkHoleCollision()) {
            if (ball.position.y > -0.2) {
                ball.position.y -= 0.02;
                ball.velocity = null;
            }

            setTimeout(() => {
                isOnGreen = false;  // Reset putting mode
                slingshot.visible = true;  // Show slingshot again
                
                // Reset ball and slingshot to starting position
                ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
                slingshot.position.set(0, 0, -0.5);
                
                // Reset player position
                player.position.set(0, 0, 0);
                
                // Update positions
                updateBallPosition();
            }, 1000);
        }
    }

    // Update ball position if not being dragged or in motion
    if (!isDragging && !ball.velocity) {
        updateBallPosition();
    }

    renderer.render(scene, camera);
}

// Modify handleBallStop to keep slingshot with ball
function handleBallStop() {
    try {
        const finalPosition = ball.position.clone();
        ball.velocity = null;

        if (renderer.xr.isPresenting) {
            // Move player group to new position
            const offset = new THREE.Vector3(0, 0, 1);
            player.position.copy(finalPosition.clone().add(offset));

            // Always move slingshot to ball position, regardless of being held
            if (!slingshotHand) {
                slingshot.position.set(
                    finalPosition.x,
                    0,
                    finalPosition.z
                );
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

// Create the green
function createGreen() {
    const greenGeometry = new THREE.CircleGeometry(GREEN_RADIUS, 32);
    const greenMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x90FF90,  // Lighter green for the putting green
        transparent: true,
        opacity: 0.5
    });
    green = new THREE.Mesh(greenGeometry, greenMaterial);
    green.rotation.x = -Math.PI / 2;

    // Set position but keep Y near ground level
    green.position.set(
        hole.position.x,
        0.02,  // Just slightly above ground to prevent z-fighting
        hole.position.z
    );

    scene.add(green);
}

// Create the putting line
function createPuttingLine() {
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue line for putting
    puttingLine = new THREE.Line(geometry, material);
    puttingLine.visible = false;
    scene.add(puttingLine);
}

// VR specific event listeners
function setupVRControls() {
    // Left Controller
    vrController1.addEventListener('squeezestart', () => {
        const controllerPos = new THREE.Vector3();
        vrController1.getWorldPosition(controllerPos);

        if (!slingshotHand) {
            const distance = controllerPos.distanceTo(slingshot.getWorldPosition(new THREE.Vector3()));
            if (distance < 1) {
                slingshotHand = vrController1;
                vrController1.add(slingshot);
                slingshot.position.set(0, -0.1, -0.2);
                updateBallPosition();
            }
        } else if (slingshotHand !== vrController1) {
            const distance = controllerPos.distanceTo(ball.position);
            if (distance < 0.5) {
                pinchHand = vrController1;
                isDragging = true;
                originalBallPosition.copy(ball.position);
                const ballOffset = ball.position.clone().sub(controllerPos);
                vrController1.userData.ballOffset = ballOffset;
            }
        }
    });

    vrController1.addEventListener('squeezeend', () => {
        if (slingshotHand === vrController1) {
            slingshotHand.remove(slingshot);
            scene.add(slingshot);
            // Position slingshot under the ball
            slingshot.position.set(
                ball.position.x,
                0,
                ball.position.z
            );
            slingshotHand = null;
        } else if (pinchHand === vrController1) {
            // Release ball and apply velocity
            const controllerPos = new THREE.Vector3();
            vrController1.getWorldPosition(controllerPos);
            const finalBallPos = controllerPos.clone().add(vrController1.userData.ballOffset);

            const pullDirection = originalBallPosition.clone().sub(finalBallPos);
            const power = Math.min(pullDirection.length() * 3, maxPower);
            ball.velocity = pullDirection.normalize().multiplyScalar(power);

            isDragging = false;
            pinchHand = null;
            vrController1.userData.ballOffset = null;
        }
    });

    // Right Controller (mirror of left)
    vrController2.addEventListener('squeezestart', () => {
        const controllerPos = new THREE.Vector3();
        vrController2.getWorldPosition(controllerPos);

        if (!slingshotHand) {
            const distance = controllerPos.distanceTo(slingshot.getWorldPosition(new THREE.Vector3()));
            if (distance < 1) {
                slingshotHand = vrController2;
                vrController2.add(slingshot);
                slingshot.position.set(0, -0.1, -0.2);
                updateBallPosition();
            }
        } else if (slingshotHand !== vrController2) {
            const distance = controllerPos.distanceTo(ball.position);
            if (distance < 0.5) {
                pinchHand = vrController2;
                isDragging = true;
                originalBallPosition.copy(ball.position);
                // Parent ball to controller
                vrController2.add(ball);
                // Position ball at controller tip
                ball.position.set(0, 0, -0.1);
                // Update slingshot bands
                updateSlingshotBands();
            }
        }
    });

    vrController2.addEventListener('squeezeend', () => {
        if (slingshotHand === vrController2) {
            slingshotHand.remove(slingshot);
            scene.add(slingshot);
            slingshot.position.set(
                ball.position.x,
                0,
                ball.position.z
            );
            slingshotHand = null;
        } else if (pinchHand === vrController2) {
            // Get world position before removing from controller
            const worldPos = new THREE.Vector3();
            ball.getWorldPosition(worldPos);
            
            // Remove ball from controller and add back to scene
            vrController2.remove(ball);
            scene.add(ball);
            ball.position.copy(worldPos);
            
            // Calculate velocity
            const pullDirection = originalBallPosition.clone().sub(ball.position);
            const power = Math.min(pullDirection.length() * 3, maxPower);
            ball.velocity = pullDirection.normalize().multiplyScalar(power);
            
            isDragging = false;
            pinchHand = null;
        }
    });
}

// Create visible controller meshes
function createControllerMeshes() {
    // Create controller meshes with different colors for different states
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.2);
    const material1 = new THREE.MeshBasicMaterial({ color: 0x808080 });
    const material2 = new THREE.MeshBasicMaterial({ color: 0x808080 });

    // Add mesh to controller 1
    const controllerMesh1 = new THREE.Mesh(geometry, material1);
    vrController1.userData.mesh = controllerMesh1;  // Store reference to mesh
    vrController1.add(controllerMesh1);

    // Add mesh to controller 2
    const controllerMesh2 = new THREE.Mesh(geometry, material2);
    vrController2.userData.mesh = controllerMesh2;  // Store reference to mesh
    vrController2.add(controllerMesh2);
}

// Modify updateBallPosition for correct positioning
function updateBallPosition() {
    if (!isDragging && !ball.velocity) {
        if (slingshotHand) {
            // If slingshot is being held, position ball in the fork relative to slingshot
            const slingshotWorldPos = new THREE.Vector3();
            const slingshotWorldQuat = new THREE.Quaternion();
            slingshot.getWorldPosition(slingshotWorldPos);
            slingshot.getWorldQuaternion(slingshotWorldQuat);

            // Position for the fork (slightly above and behind the slingshot center)
            const forkOffset = new THREE.Vector3(0, 0.3, 0.1);  // Changed to positive Z for behind
            forkOffset.applyQuaternion(slingshotWorldQuat);

            ball.position.copy(slingshotWorldPos).add(forkOffset);
            originalBallPosition.copy(ball.position);
        } else {
            // If slingshot is not being held, keep ball above and behind slingshot
            ball.position.set(
                slingshot.position.x,
                slingshot.position.y + 0.3,
                slingshot.position.z + 0.1  // Moved behind slingshot
            );
            originalBallPosition.copy(ball.position);
        }
    }
}

function updateSlingshotPosition() {
    // Update slingshot position to match ball's position
    slingshot.position.set(
        ball.position.x,
        0,
        ball.position.z
    );
}

// Start the initialization
init();
