// --- Module for managing three.js ---
const visualization = (function initialize() {
    // --- Attributes ---
    // Setting up Scene, Camera and Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        1,
        10000
    );
    camera.position.z = 1000 / 4;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Geometry Cache
    const geometryCache = {};
    const persistantGeometries = [];
    const dataGeometries = [];

    const axesValueLabels = [];

    // Scanned Point Cloud
    const scannedParams = {};
    scannedParams.size = 1;

    // Cache DOM
    const $container = $('#main-wrapper');
    const $legendWrapper = $('#legend-wrapper');
    const $scannedColor = $legendWrapper.find('#scanned-color').find('i');
    const $completedColor = $legendWrapper.find('#completed-color').find('i');

    // --- Functions ---
    // Renders the scene
    function render() {
        camera.lookAt(scene.position);
        axesValueLabels.forEach(label => label.updatePosition());
        renderer.render(scene, camera);
    }

    // Saves geometry
    function saveGeometry(label, geometry) {
        if (!geometryCache[label]) {
            geometryCache[label] = [];
        }
        geometryCache[label].push(geometry);

        if (persistantGeometries.indexOf(label) === -1
        && dataGeometries.indexOf(label) === -1) {
            dataGeometries.push(label);
        }
    }

    // Draws the plane of symmetry
    // TODO: Add parameters for drawing the plane
    function addSymmetryPlanes(planes, label) {
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

            saveGeometry(label, plane);
        }
    }

    // Draws the line of symmetry
    // TODO: Add parameters for drawing the line
    function addSymmetryLines(lines, label) {
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

            saveGeometry(label, line);
        }
    }

    // Creates a div with text
    function createText() {
        const div = document.createElement('div');
        div.className = 'text-label';
        div.style.position = 'fixed';
        div.style.width = 100;
        div.style.height = 100;
        div.innerHTML = 'hi there!';
        div.style.top = -1000;
        div.style.left = -1000;

        return {
            element: div,
            parent: false,
            position: new THREE.Vector3(0, 0, 0),
            setHTML: function setHTML(html) {
                this.element.innerHTML = html;
            },
            setParent: function setParent(threejsobj) {
                this.parent = threejsobj;
            },
            updatePosition: function updatePosition() {
                if (this.parent) {
                    this.position.copy(this.parent.position);
                }

                const coords2d = this.get2DCoords(this.position);
                this.element.style.left = `${coords2d.x}px`;
                this.element.style.top = `${coords2d.y}px`;
            },
            get2DCoords: function get2DCoords(position) {
                const vector = position.project(camera);
                vector.x = Math.round(((vector.x + 1) * window.innerWidth) / 2);
                vector.y = Math.round(((-vector.y + 1) * window.innerHeight) / 2);
                return vector;
            },
        };
    }

    // Add a signle value to the axis
    function createAxisValue(i, axis) {
        const geometry = new THREE.SphereGeometry(1, 2, 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
        });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        if (axis === 'x') {
            sphere.translateX(i);
        } else if (axis === 'y') {
            sphere.translateY(i);
        } else {
            sphere.translateZ(i);
        }

        saveGeometry('axes', sphere);

        const text = createText();
        text.setHTML(i.toString());
        text.setParent(sphere);
        $container[0].appendChild(text.element);
        axesValueLabels.push(text);
    }

    // Adds axes to the scene
    function createAxes() {
        const axesLength = 200;
        const axesColor = new THREE.Color(1, 1, 1);

        const axesStart = [
            new THREE.Vector3(-axesLength, 0, 0),
            new THREE.Vector3(0, -axesLength, 0),
            new THREE.Vector3(0, 0, -axesLength),
        ];
        const axesEnd = [
            new THREE.Vector3(axesLength, 0, 0),
            new THREE.Vector3(0, axesLength, 0),
            new THREE.Vector3(0, 0, axesLength),
        ];

        const material = new THREE.LineBasicMaterial({
            color: axesColor,
            transparent: true,
            opacity: 0.5,
        });

        // Axes shouldn't be removed. Ever.
        persistantGeometries.push('axes');

        // Draw them all
        for (let i = 0; i < axesStart.length; i += 1) {
            const geometry = new THREE.Geometry();
            geometry.vertices.push(
                axesStart[i],
                axesEnd[i]
            );

            const line = new THREE.Line(geometry, material);
            scene.add(line);

            saveGeometry('axes', line);
        }

        // Draw axes values
        for (let i = -axesLength; i <= axesLength; i += 20) {
            createAxisValue(i, 'x');
            createAxisValue(i, 'y');
            createAxisValue(i, 'z');
        }
    }

    // Prints the point cloud data
    function addPointCloud(pointCloudData, pointColors, label) {
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

        saveGeometry(label, pointCloud);
    }

    // Clear the scene
    function clearScene() {
        while (dataGeometries[0]) {
            const category = dataGeometries.pop();
            geometryCache[category].forEach((geometry) => {
                scene.remove(geometry);
            });
            geometryCache[category] = undefined;
        }
    }

    // Set color for the scanned pixels
    function setScannedColor(color) {
        $scannedColor.css('color', color);
    }

    // Set color for the completed pixels
    function setCompletedColor(color) {
        $completedColor.css('color', color);
    }

    // --- Call one-time functions
    $container[0].appendChild(renderer.domElement);
    createAxes();
    render();

    // --- Bind events ---
    controls.addEventListener('change', render);

    // --- Reveal public methods ---
    return {
        addPointCloud,
        addSymmetryLines,
        addSymmetryPlanes,
        render,
        clearScene,
        setScannedColor,
        setCompletedColor,
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

        symmetryLines.color = [
            new THREE.Color(255, 255, 0),
            new THREE.Color(255, 0, 255),
            new THREE.Color(0, 255, 255),
        ];
        symmetryLines.start.x = [-200, -120, -90];
        symmetryLines.start.y = [80, 180, 110];
        symmetryLines.start.z = [8, 10, 80];
        symmetryLines.end.x = [200, 100, -40];
        symmetryLines.end.y = [80, 0, 180];
        symmetryLines.end.z = [8, 10, -60];
    }

    // Fill the point cloud with data
    function fillPointCloud(vertexes) {
        pointCloud.x = vertexes.x;
        pointCloud.y = vertexes.y;
        pointCloud.z = vertexes.z;

        genSyntheticData();
        visualization.clearScene();
        visualization.addPointCloud(pointCloud, pointColors, 'pointCloud');
        visualization.addSymmetryLines(symmetryLines, 'symmetryLines');
        visualization.setScannedColor(`rgb(${Math.round(scannedColor.r * 255)}, ${Math.round(scannedColor.g * 255)}, ${Math.round(scannedColor.b * 255)})`);
        visualization.setCompletedColor(`rgb(${Math.round(completedColor.r * 255)}, ${Math.round(completedColor.g * 255)}, ${Math.round(completedColor.b * 255)})`);
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
