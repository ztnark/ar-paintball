// Slingshot.js

import * as THREE from 'three';

export class Slingshot extends THREE.Group {
    constructor() {
        super();

        // Slingshot properties
        this.slingshotBand1 = null;
        this.slingshotBand2 = null;

        this.createSlingshot();
    }

    createSlingshot() {
        // Create the Y-shaped frame with smaller dimensions
        const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
        const forkGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2);
        const slingshotMaterial = new THREE.MeshBasicMaterial({ color: 0x4b2626 });

        // Create main stem
        const stem = new THREE.Mesh(stemGeometry, slingshotMaterial);
        stem.position.y = 0.2;

        // Create left fork
        const leftFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
        leftFork.position.set(-0.08, 0.36, 0);
        leftFork.rotation.z = Math.PI / 4;

        // Create right fork
        const rightFork = new THREE.Mesh(forkGeometry, slingshotMaterial);
        rightFork.position.set(0.08, 0.36, 0);
        rightFork.rotation.z = -Math.PI / 4;

        // Add parts to the slingshot group (this)
        this.add(stem);
        this.add(leftFork);
        this.add(rightFork);

        // Create elastic bands
        const bandMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

        // Initialize band geometries
        const bandGeometry1 = new THREE.BufferGeometry();
        const bandGeometry2 = new THREE.BufferGeometry();

        // Create lines
        this.slingshotBand1 = new THREE.Line(bandGeometry1, bandMaterial);
        this.slingshotBand2 = new THREE.Line(bandGeometry2, bandMaterial);

        this.add(this.slingshotBand1);
        this.add(this.slingshotBand2);

        // Initially hide the bands
        this.slingshotBand1.visible = false;
        this.slingshotBand2.visible = false;
    }

    updateBands(ball) {
        // Get world positions of the slingshot forks
        const leftForkPos = new THREE.Vector3();
        const rightForkPos = new THREE.Vector3();

        // Left fork position relative to slingshot
        this.localToWorld(leftForkPos.set(-0.14, 0.44, 0));
        // Right fork position relative to slingshot
        this.localToWorld(rightForkPos.set(0.14, 0.44, 0));

        // Get the ball's world position
        const ballWorldPos = new THREE.Vector3();
        ball.getWorldPosition(ballWorldPos);

        // Update slingshot band geometries
        this.slingshotBand1.geometry.setFromPoints([
            this.worldToLocal(leftForkPos.clone()),
            this.worldToLocal(ballWorldPos.clone()),
        ]);
        this.slingshotBand2.geometry.setFromPoints([
            this.worldToLocal(rightForkPos.clone()),
            this.worldToLocal(ballWorldPos.clone()),
        ]);

        // Mark geometries as needing update
        this.slingshotBand1.geometry.attributes.position.needsUpdate = true;
        this.slingshotBand2.geometry.attributes.position.needsUpdate = true;

        // Ensure bands are visible
        this.slingshotBand1.visible = true;
        this.slingshotBand2.visible = true;
    }

    hideBands() {
        this.slingshotBand1.visible = false;
        this.slingshotBand2.visible = false;
    }
}
