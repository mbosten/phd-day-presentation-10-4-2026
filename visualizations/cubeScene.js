import * as THREE from "https://esm.sh/three@0.161.0";
import {OrbitControls} from "https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js";

export function createCubeScene(container, options = {}) {
    const {numPoints = 100} = options;
    const el = container;

    const BOX = 3.0; // Keep to bound point distribution
    const POINT_RADIUS = 0.03;

    el.style.position = "relative";

    // Renderer
    const getDPR = () => Math.min(window.devicePixelRatio || 1, 2);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(getDPR());
    renderer.setSize(el.clientWidth, el.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    // -----------------------------
    // Overlay controls (NEW)
    // -----------------------------
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.top = "12px";
    overlay.style.left = "12px";
    overlay.style.zIndex = "10";
    overlay.style.padding = "16px 30px";
    overlay.style.borderRadius = "8px";
    overlay.style.background = "rgba(255,255,255,0.85)";
    overlay.style.backdropFilter = "blur(4px)";
    overlay.style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.gap = "18px";
    overlay.style.fontFamily = "system-ui, -apple-system, sans-serif";
    overlay.style.fontSize = "2.0rem";

    // Regenerate button
    const regenBtn = document.createElement("button");
    regenBtn.textContent = "Regenerate";
    regenBtn.style.border = "none";
    regenBtn.style.padding = "12px 18px";
    regenBtn.style.borderRadius = "10px";
    regenBtn.style.fontSize = "1.4rem";
    regenBtn.style.fontWeight = "400";
    regenBtn.style.cursor = "pointer";

    // Slider wrapper
    const sliderWrap = document.createElement("div");
    sliderWrap.style.display = "flex";
    sliderWrap.style.flexDirection = "column";
    sliderWrap.style.gap = "6px";
    sliderWrap.style.minWidth = "220px";

    // Label row with value
    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    labelRow.style.fontSize = "1.2rem";
    labelRow.style.fontWeight = "500";
    labelRow.innerHTML = `<span>r</span><span id="rValue">0.00</span>`;

    // Simple HTML range slider (no input box)
    const slider = document.createElement("input");
    slider.style.height = "8px";
    slider.style.transform = "scale(1.05)";
    slider.style.transformOrigin = "left center";
    slider.type = "range";
    slider.min = "0.00";
    slider.max = "0.75";
    slider.step = "0.01";
    slider.value = "0.00";
    slider.style.width = "100%";

    // Assemble overlay
    sliderWrap.appendChild(labelRow);
    sliderWrap.appendChild(slider);
    overlay.appendChild(regenBtn);
    overlay.appendChild(sliderWrap);
    el.appendChild(overlay);

    // Hook up interactions
    regenBtn.addEventListener("click", () => {
        regenerate();
    });

    const rValueSpan = labelRow.querySelector("#rValue");

    slider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        rValueSpan.textContent = v.toFixed(2);
        gotoR(v);
    });

    if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene / camera / controls
    const scn = new THREE.Scene();
    scn.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.01, 200);
    camera.position.set(3.2, 2.2, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights + helpers
    scn.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(4, 6, 3); scn.add(dir);
    // const axes = new THREE.AxesHelper(1.5); axes.material.transparent = true; axes.material.opacity = 0.35; scn.add(axes);
    // const box = new THREE.Box3(new THREE.Vector3(-BOX / 2, -BOX / 2, -BOX / 2), new THREE.Vector3(BOX / 2, BOX / 2, BOX / 2));
    // const boxHelper = new THREE.Box3Helper(box, 0xcccccc); boxHelper.material.transparent = true; boxHelper.material.opacity = 0.35; scn.add(boxHelper);

    // Geometries & materials
    const pointMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.0 });
    const pointGeom = new THREE.SphereGeometry(POINT_RADIUS, 16, 12);

    // Storage
    let points = [];          // array of {id, p: Vector3}
    let pointMeshes = [];     // array of Mesh
    let edgeLines = null;     // LineSegments
    let edgeCount = 0;

    // Utility: random point
    function randPointInBox() {
        const h = BOX / 2;
        return new THREE.Vector3((Math.random() * 2 - 1) * h, (Math.random() * 2 - 1) * h, (Math.random() * 2 - 1) * h);
    }

    // Create / clear points
    function clearPoints() {
        for (const m of pointMeshes) {
            scn.remove(m);
            try { m.geometry.dispose(); m.material.dispose(); } catch (e) {/*ignore*/ }
        }
        pointMeshes = [];
        points = [];
        if (edgeLines) {
            scn.remove(edgeLines);
            try { edgeLines.geometry.dispose(); edgeLines.material.dispose(); } catch (e) {/*ignore*/ }
            edgeLines = null;
        }
    }

    function createPoints(n = numPoints) {
        clearPoints();
        for (let i = 0; i < n; i++) {
            const p = randPointInBox();
            points.push({ id: i, p });
            const pm = new THREE.Mesh(pointGeom, pointMat.clone());
            pm.position.copy(p); scn.add(pm); pointMeshes.push(pm);
        }
    }

    // Compute VR edges (d ≤ 2r)
    function computeEdges(r) {
        const edges = [];
        const thr = 2 * r;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const d = points[i].p.distanceTo(points[j].p);
                if (d <= thr) edges.push([i, j]);
            }
        }

        return edges;
    }

    // Draw edges (we recreate the LineSegments for simplicity)
    function drawEdgesFor(r) {
        if (edgeLines) {
            scn.remove(edgeLines);
            try { edgeLines.geometry.dispose(); edgeLines.material.dispose(); } catch (e) {/*ignore*/ }
            edgeLines = null;
        }
        const edges = computeEdges(r);
        edgeCount = edges.length;
        if (!edges.length) return;

        const pos = new Float32Array(edges.length * 2 * 3);
        let idx = 0;
        for (const [i, j] of edges) {
            const a = points[i].p, b = points[j].p;
            pos[idx++] = a.x; pos[idx++] = a.y; pos[idx++] = a.z;
            pos[idx++] = b.x; pos[idx++] = b.y; pos[idx++] = b.z;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.85 });
        edgeLines = new THREE.LineSegments(geom, mat);
        scn.add(edgeLines);
    }

    // Public API functions
    function regenerate(n = numPoints) {
        createPoints(n);
        drawEdgesFor(currentR);
    }

    function getPoints() { return points.map(o => [o.p.x, o.p.y, o.p.z]); }
    function setPoints(coords) {
        clearPoints();
        for (let i = 0; i < coords.length; i++) {
            const [x, y, z] = coords[i];
            const vec = new THREE.Vector3(x, y, z);
            points.push({ id: i, p: vec });
            const pm = new THREE.Mesh(pointGeom, pointMat.clone());
            pm.position.copy(vec); scn.add(pm); pointMeshes.push(pm);
        }
        drawEdgesFor(currentR);
    }

    // Keep track of current R
    let currentR = 0.0;

    function gotoR(val) { // this is not the reason why we start with r > 0.
        currentR = val;
        drawEdgesFor(val);
    }

    // Responsive
    function resize() {
        const w = el.clientWidth, h = el.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const dpr = getDPR();
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
    }
    new ResizeObserver(resize).observe(el);

    // Animation loop
    let running = true;
    function tick() { controls.update(); renderer.render(scn, camera); if (running) requestAnimationFrame(tick); }
    tick();

    // Start with initial points
    createPoints(numPoints);
    drawEdgesFor(currentR); // This is the culprit. This evaluates to r=0.15 without moving the slider.

    window.sceneAPI = {
        node: el,
        getPoints,
        setPoints,
        regenerate,
        drawForR: gotoR,
        gotoR,
        getEdgeCount: () => edgeCount,
        pause() { running = false; },
        resume() { if (!running) { running = true; tick(); } }
    };

    return {
        regenerate,
        gotoR
    };
}