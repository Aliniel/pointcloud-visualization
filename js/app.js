// --- Module for managing three.js ---
const visualiation = (function initialize() {
    // --- Attributes ---
    // Setting up Scene, Camera and Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
    );
    camera.position.z = 1000 / 4;
    const renderer = new THREE.WebGLRenderer();

    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Scanned Point Cloud
    const scannedParams = {};
    scannedParams.size = 1;
    scannedParams.colors = [];
    let scannedGeometry;
    let scannedMaterials;
    let scannedPointCloud;

    // --- Functions ---
    function render() {
        requestAnimationFrame(render);
        camera.lookAt(scene.position);
        renderer.render(scene, camera);
    }

    // Prints the point cloud data
    function printPointCloud(pointCloudData) {
        scannedGeometry = new THREE.Geometry();
        const xTreshold = Math.floor(Math.random() * pointCloudData.x.length);

        const vertexCount = pointCloudData.x.length;
        for (let i = 0; i < vertexCount; i += 1) {
            const vertex = new THREE.Vector3();
            vertex.x = pointCloudData.x[i] * 1000;
            vertex.y = pointCloudData.y[i] * 1000;
            vertex.z = pointCloudData.z[i] * 1000;
            
            scannedGeometry.vertices.push(vertex);

            // Set vertex color
            scannedParams.colors[i] = new THREE.Color();
            if (i < xTreshold) {
                scannedParams.colors[i].setRGB(0.5, 0.5, 0);
            } else {
                scannedParams.colors[i].setRGB(0.5, 0, 0.5);
            }
        }
        scannedGeometry.colors = scannedParams.colors;

        scannedMaterials = new THREE.PointsMaterial({
            size: scannedParams.size,
            transparent: true,
            opacity: 0.7,
            vertexColors: THREE.VertexColors,
        });

        scannedPointCloud = new THREE.Points(scannedGeometry, scannedMaterials);
        scene.add(scannedPointCloud);

        drawSymmetryPlane();
        drawSymmetryLine();

        render();
    }

    // Draws the plane of symmetry
    // TODO: Add parameters for drawing the plane
    function drawSymmetryPlane() {
        // PlaneBufferGeometry: Width, Height
        const geometry = new THREE.PlaneBufferGeometry(300, 300);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
        });
        const plane = new THREE.Mesh(geometry, material);
        scene.add(plane);
        plane.rotateY(45);
        plane.translateY(100);
    }

    // Draws the line of symmetry
    // TODO: Add parameters for drawing the line
    function drawSymmetryLine() {
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
        });

        const geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3(-100, 100, 0),
            new THREE.Vector3(100, 100, 0),
        );

        const line = new THREE.Line(geometry, material);
        scene.add(line);
    }

    // --- Reveal ---
    return {
        printPointCloud,
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
        visualiation.printPointCloud(vertexes);
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
