let scene, camera, renderer;
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

    // Setup camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Setup renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x90EE90 }); // Light green
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Create golf ball
    const ballGeometry = new THREE.SphereGeometry(0.2);
    const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0.2, 5);
    scene.add(ball);

    // Create hole
    const holeGeometry = new THREE.CircleGeometry(0.3);
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(0, 0.01, -5);
    scene.add(hole);

    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    flagPole = new THREE.Mesh(poleGeometry, poleMaterial);
    flagPole.position.set(0, 0.5, -5);
    scene.add(flagPole);

    // Create flag
    const flagGeometry = new THREE.PlaneGeometry(0.5, 0.3);
    const flagMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide });
    flag = new THREE.Mesh(flagGeometry, flagMaterial);
    flag.position.set(0.25, 0.85, -5);
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
    // Create the Y-shaped frame
    const stemGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2);
    const forkGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1);
    const slingshotMaterial = new THREE.MeshBasicMaterial({ color: 0x4b2626 });  // Dark brown

    // Create main stem
    const stem = new THREE.Mesh(stemGeometry, slingshotMaterial);
    stem.position.y = 1;

    // Create left fork
    const leftFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
    leftFork.position.set(-0.4, 1.8, 0);
    leftFork.rotation.z = Math.PI / 4;

    // Create right fork
    const rightFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
    rightFork.position.set(0.4, 1.8, 0);
    rightFork.rotation.z = -Math.PI / 4;

    // Group all parts
    slingshot = new THREE.Group();
    slingshot.add(stem);
    slingshot.add(leftFork);
    slingshot.add(rightFork);

    // Create elastic bands
    const bandMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    
    // Create two lines for the bands
    slingshotBand1 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.7, 2.2, 0),
            new THREE.Vector3(0, 1.5, 0)
        ]),
        bandMaterial
    );
    
    slingshotBand2 = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.7, 2.2, 0),
            new THREE.Vector3(0, 1.5, 0)
        ]),
        bandMaterial
    );

    slingshot.add(slingshotBand1);
    slingshot.add(slingshotBand2);
    
    // Position slingshot relative to ball's starting position
    slingshot.position.set(0, 0, 0);
    scene.add(slingshot);
}

function positionBallAndCamera() {
    // Position ball in slingshot
    ball.position.set(0, BALL_SLINGSHOT_HEIGHT, 0);
    originalBallPosition.copy(ball.position);
    
    // Position camera
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
    // Update band positions
    slingshotBand1.geometry.setFromPoints([
        new THREE.Vector3(-0.7, 2.2, 0),
        ball.position.clone().sub(slingshot.position)
    ]);
    slingshotBand2.geometry.setFromPoints([
        new THREE.Vector3(0.7, 2.2, 0),
        ball.position.clone().sub(slingshot.position)
    ]);
    
    slingshotBand1.geometry.verticesNeedUpdate = true;
    slingshotBand2.geometry.verticesNeedUpdate = true;
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
    requestAnimationFrame(animate);

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
            ball.velocity = null;
            
            // Check if ball is on green
            isOnGreen = checkIfOnGreen();
            
            // Update visibility
            slingshot.visible = !isOnGreen;
            puttingLine.visible = false;
            
            // Calculate direction from ball to hole
            const directionToHole = new THREE.Vector3(
                hole.position.x - ball.position.x,
                0,
                hole.position.z - ball.position.z
            ).normalize();

            // Position camera at a fixed distance behind ball
            camera.position.set(
                ball.position.x - (directionToHole.x * CAMERA_DISTANCE),
                CAMERA_HEIGHT,
                ball.position.z - (directionToHole.z * CAMERA_DISTANCE)
            );
            
            // Look at a point slightly ahead of the ball
            camera.lookAt(new THREE.Vector3(
                ball.position.x + (directionToHole.x * 10),
                0,
                ball.position.z + (directionToHole.z * 10)
            ));

            // Update slingshot position
            updateSlingshotPosition();
            
            // Reset ball height based on whether we're putting or not
            ball.position.y = isOnGreen ? 0.2 : BALL_SLINGSHOT_HEIGHT;
            originalBallPosition.copy(ball.position);
        }

        // Check if ball went in hole
        if (checkHoleCollision()) {
            if (ball.position.y > -0.2) {
                ball.position.y -= 0.02;
                ball.velocity = null;
            }
            
            setTimeout(() => {
                positionBallAndCamera();
            }, 1000);
        }
    }

    renderer.render(scene, camera);
}

// Replace the getShotDirection function with this new version
function getShotDirection() {
    // Get camera's forward direction
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    cameraDirection.y = 0; // Keep shot direction horizontal
    cameraDirection.normalize();
    
    // Reverse direction if we're facing the opposite way from the hole
    const toHole = new THREE.Vector3(
        hole.position.x - ball.position.x,
        0,
        hole.position.z - ball.position.z
    ).normalize();
    
    if (cameraDirection.dot(toHole) < 0) {
        cameraDirection.multiplyScalar(-1);
    }
    
    return cameraDirection;
}

// Simplify updateSlingshotPosition
function updateSlingshotPosition() {
    slingshot.position.set(
        ball.position.x,
        0,
        ball.position.z
    );
}

// Add this function to create the green
function createGreen() {
    const greenGeometry = new THREE.CircleGeometry(GREEN_RADIUS, 32);
    const greenMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x90FF90,  // Lighter green for the putting green
        transparent: true,
        opacity: 0.5
    });
    green = new THREE.Mesh(greenGeometry, greenMaterial);
    green.rotation.x = -Math.PI / 2;
    green.position.copy(hole.position);
    green.position.y = 0.02;  // Slightly above ground to prevent z-fighting
    scene.add(green);
}

// Add this function to check if ball is on green
function checkIfOnGreen() {
    const ballPosition = new THREE.Vector2(ball.position.x, ball.position.z);
    const holePosition = new THREE.Vector2(hole.position.x, hole.position.z);
    return ballPosition.distanceTo(holePosition) <= GREEN_RADIUS;
}

// Add this function to create the putting line
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

init();
animate(); 