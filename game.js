let scene, camera, renderer;
let ground, ball, hole, flagPole, flag;
let isDragging = false;
let startPosition = new THREE.Vector2();
let currentPosition = new THREE.Vector2();
let shootingPower = 0;
let maxPower = 15;
let shootingLine;

const BALL_START_HEIGHT = 0.2;
const CAMERA_HEIGHT = 2;
const CAMERA_DISTANCE = 5;
const BALL_OFFSET_Z = -3;  // How far in front of camera the ball should be
const BALL_OFFSET_Y = -1;  // How far below camera height the ball should be

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

    // Initial positioning
    positionBallAndCamera();

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
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

function positionBallAndCamera() {
    // Reset ball position
    ball.position.set(0, BALL_START_HEIGHT, 0);
    
    // Position camera behind ball
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
    camera.lookAt(new THREE.Vector3(0, 0, -100));
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
        currentPosition.x = event.clientX;
        currentPosition.y = event.clientY;
        
        // Calculate power based on drag distance
        const dragDistance = startPosition.clone().sub(currentPosition);
        shootingPower = Math.min(dragDistance.length() / 50, maxPower);

        // Get shot direction
        const shotDirection = getShotDirection();
        
        // Update shooting line to show trajectory
        const points = shootingLine.geometry.attributes.position;
        
        // Start point (ball position)
        points.array[0] = ball.position.x;
        points.array[1] = ball.position.y;
        points.array[2] = ball.position.z;
        
        // Pull back point (where you're dragging)
        points.array[3] = ball.position.x;
        points.array[4] = ball.position.y + (dragDistance.y / 100);
        points.array[5] = ball.position.z;
        
        // Projected landing point
        points.array[6] = ball.position.x + (shotDirection.x * shootingPower * 2);
        points.array[7] = ball.position.y;
        points.array[8] = ball.position.z + (shotDirection.z * shootingPower * 2);
        
        points.needsUpdate = true;
    }
}

function onMouseUp() {
    if (isDragging) {
        const dragDistance = startPosition.clone().sub(currentPosition);
        shootingPower = Math.min(dragDistance.length() / 50, maxPower);
        
        // Get shot direction
        const shotDirection = getShotDirection();
        
        // Calculate velocity based on drag distance and direction
        const velocity = new THREE.Vector3(
            shotDirection.x * shootingPower,        // X direction
            Math.abs(dragDistance.y) / 50,          // Up force based on drag
            shotDirection.z * shootingPower         // Z direction
        );
        
        ball.velocity = velocity;
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
            
            // Calculate direction from ball to hole
            const directionToHole = new THREE.Vector3(
                hole.position.x - ball.position.x,
                0,
                hole.position.z - ball.position.z
            ).normalize();

            // Position camera at a fixed distance behind ball
            camera.position.set(
                ball.position.x - (directionToHole.x * CAMERA_DISTANCE),  // Back from ball in direction of hole
                CAMERA_HEIGHT,                                            // Fixed height
                ball.position.z - (directionToHole.z * CAMERA_DISTANCE)   // Back from ball in direction of hole
            );
            
            // Look at a point slightly ahead of the ball
            camera.lookAt(new THREE.Vector3(
                ball.position.x + (directionToHole.x * 10),  // Look ahead of ball
                0,                                           // Ground level
                ball.position.z + (directionToHole.z * 10)   // Look ahead of ball
            ));
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

init();
animate(); 