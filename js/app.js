// --- Module for managing three.js ---
const visualization = (function initialize() {
    // --- Attributes ---
    // Setting up Scene, Camera and Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 1000 / 4;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;
    document.body.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Scanned Point Cloud
    const scannedParams = {};
    scannedParams.size = 1;
    // let geometry;
    // let materials;

    // --- Functions ---
    function render() {
        // requestAnimationFrame(render);
        camera.lookAt(scene.position);
        renderer.render(scene, camera);
    }

    // Draws the plane of symmetry
    // TODO: Add parameters for drawing the plane
    function addSymmetryPlanes(planes) {
        const n = planes.width.length;
        for (let i = 0; i < n; i += 1) {
            // PlaneBufferGeometry: Width, Height
            const geometry = new THREE.PlaneBufferGeometry(planes.width[i], planes.height[i]);
            const material = new THREE.MeshBasicMaterial({
                color: planes.color[i],
                transparent: true,
                opacity: 0.25,
            });
            const plane = new THREE.Mesh(geometry, material);
            scene.add(plane);
            plane.rotate(planes.rotation[i]);
            plane.translate(planes.translation[i]);
        }
    }

    // Draws the line of symmetry
    // TODO: Add parameters for drawing the line
    function addSymmetryLines(lines) {
        const n = lines.color.length;
        for (let i = 0; i < n; i += 1) {
            const material = new THREE.LineBasicMaterial({
                color: lines.color[i],
            });

            const geometry = new THREE.Geometry();
            geometry.vertices.push(
                new THREE.Vector3(lines.start.x[i], lines.start.y[i], lines.start.z[i]),
                new THREE.Vector3(lines.end.x[i], lines.end.y[i], lines.end.z[i])
            );

            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    }

    // Prints the point cloud data
    function addPointCloud(pointCloudData, pointColors) {
        const geometry = new THREE.Geometry();

        const n = pointCloudData.x.length;
        for (let i = 0; i < n; i += 1) {
            const vertex = new THREE.Vector3(
                pointCloudData.x[i] * 1000,
                pointCloudData.y[i] * 1000,
                pointCloudData.z[i] * 1000
            );
            geometry.vertices.push(vertex);
        }
        geometry.colors = pointColors;

        const materials = new THREE.PointsMaterial({
            size: scannedParams.size,
            transparent: true,
            opacity: 0.7,
            vertexColors: THREE.VertexColors,
        });

        const pointCloud = new THREE.Points(geometry, materials);
        scene.add(pointCloud);
    }

    // Clear the scene
    function clearScene() {
        while (scene.children.length) {
            scene.remove(scene.children[0]);
        }
    }

    // --- Bind events ---
    controls.addEventListener('change', render);

    // --- Reveal public methods ---
    return {
        addPointCloud,
        addSymmetryLines,
        addSymmetryPlanes,
        render,
        clearScene,
    };
}());

// --- Viasual Mapping Module ---
const visualMapping = (function initialize() {
    // --- Attributes ---
    const pointCloud = {};
    const symmetryLines = {};
    symmetryLines.start = {};
    symmetryLines.start.x = [];
    symmetryLines.start.y = [];
    symmetryLines.start.z = [];
    symmetryLines.end = {};
    symmetryLines.end.x = [];
    symmetryLines.end.y = [];
    symmetryLines.end.z = [];
    const symmetryPlanes = {};
    let pointColors = [];
    const scannedColor = new THREE.Color(0.5, 0.5, 0);
    const completedColor = new THREE.Color(0.5, 0, 0.5);

    // --- Functions ---
    // Randomly choose points which will be marked as "completed",
    // and generate symmetri axes and planes
    function genSyntheticData() {
        const n = pointCloud.x.length;
        const xTreshold = Math.floor(Math.random() * n);
        const yTreshold = Math.floor(Math.random() * n);
        const zTreshold = Math.floor(Math.random() * n);

        pointColors = [];
        for (let i = 0; i < n; i += 1) {
            if (i < xTreshold && i < yTreshold && i < zTreshold) {
                pointColors[i] = completedColor;
            } else {
                pointColors[i] = scannedColor;
            }
        }

        symmetryLines.color = [];
        symmetryLines.start.x = [];
        symmetryLines.start.y = [];
        symmetryLines.start.z = [];
        symmetryLines.end.x = [];
        symmetryLines.end.y = [];
        symmetryLines.end.z = [];
        for (let i = 0; i < 3; i += 1) {
            const red = Math.random();
            const green = Math.random();
            const blue = Math.random();
            symmetryLines.color.push(new THREE.Color(red, green, blue));

            let x = Math.floor(Math.random() * 1000);
            let y = Math.floor(Math.random() * 1000);
            let z = Math.floor(Math.random() * 1000);

            symmetryLines.start.x.push(-x);
            symmetryLines.start.y.push(-y);
            symmetryLines.start.z.push(-z);

            x = Math.floor(Math.random() * 1000);
            y = Math.floor(Math.random() * 1000);
            z = Math.floor(Math.random() * 1000);

            symmetryLines.end.x.push(x);
            symmetryLines.end.y.push(y);
            symmetryLines.end.z.push(z);
        }
    }

    // Fillt he point cloud with data
    function fillPointCloud(vertexes) {
        pointCloud.x = vertexes.x;
        pointCloud.y = vertexes.y;
        pointCloud.z = vertexes.z;

        genSyntheticData();
        visualization.clearScene();
        visualization.addPointCloud(pointCloud, pointColors);
        visualization.addSymmetryLines(symmetryLines);
        visualization.render();
    }

    // --- Reveal public methods ---
    return {
        fillPointCloud,
    };
}());

// --- Module for managing data ---
const dataManager = (function initialize() {
    // --- Attributes ---
    // Object containing all vertexes
    const vertexes = {};
    vertexes.x = [];
    vertexes.y = [];
    vertexes.z = [];

    // --- Cache DOM ---
    const $fileInput = $('input');

    // Parse loaded PLY file
    function parseData(content) {
        const lines = content.split('\n');
        let vertexCount;

        // --- Parse header ---
        // Check is the file is ply
        let lineIndex = 0;
        let line = lines[lineIndex];
        if (line !== 'ply') {
            alert('Unsupported file!');
            return;
        }

        // Check if ply file is in ascii format
        lineIndex += 1;
        line = lines[lineIndex];
        if (line.indexOf('ascii') < 0) {
            alert('Only ASCII PLY files are supported!');
            return;
        }

        // Parse rest of the header
        lineIndex += 1;
        line = lines[lineIndex];
        while (line !== 'end_header') {
            if (line.indexOf('element vertex') === 0) {
                vertexCount = parseInt(line.split(' ')[2], 10);
            }

            lineIndex += 1;
            line = lines[lineIndex];
        }
        lineIndex += 1;

        // Empty existing vertexes
        vertexes.x = [];
        vertexes.y = [];
        vertexes.z = [];
        vertexes.confidence = [];
        vertexes.intensity = [];

        // Parse vertexes
        for (let i = 0; i < vertexCount; i += 1) {
            const [x, y, z, confidence, intensity] = lines[lineIndex + i].split(' ');
            vertexes.x.push(x);
            vertexes.y.push(y);
            vertexes.z.push(z);
            vertexes.confidence.push(confidence);
            vertexes.intensity.push(intensity);
        }

        // Draw the data
        visualMapping.fillPointCloud(vertexes);
    }

    // Read file content
    function readContent() {
        const reader = new FileReader();

        // Process the read content
        reader.onload = (e) => {
            parseData(e.target.result);
        };

        // Read
        reader.readAsText(this.files[0]);
    }

    // --- Bindings ---
    $fileInput.change(readContent);
}());
