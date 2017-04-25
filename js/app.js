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
    const raycaster = new THREE.Raycaster();

    // Geometry Cache
    const geometryCache = {};
    const persistantGeometries = [];
    const dataGeometries = [];

    const axesValueLabels = [];

    // Scanned Point Cloud
    const scannedParams = {};
    scannedParams.size = 1;

    // Adjustable variables
    let selectionRegion = 20.0;
    let selectedPoint;

    // Cache DOM
    const $container = $('#main-wrapper');
    const $toolsWrapper = $('#tools-wrapper');
    const $scannedColor = $toolsWrapper.find('#scanned-color').find('i');
    const $completedColor = $toolsWrapper.find('#completed-color').find('i');
    let $axesLabels;

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
            geometryCache[label] = {
                mesh: [],
                visible: true,
            };
        }
        geometryCache[label].mesh.push(geometry);

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
                opacity: 0.15,
            });
            const plane = new THREE.Mesh(geometry, material);
            scene.add(plane);
            plane.rotation = planes.rotation[i];
            plane.translateOnAxis(planes.translationVector[i], planes.translationDistance[i]);

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
    function addPointCloud(pointCloudData, label) {
        const geometry = new THREE.BufferGeometry();

        const n = pointCloudData.vertices.x.length;
        const alpha = new Float32Array(n);
        const positions = new Float32Array(n * 3);
        const sizes = new Float32Array(n);

        for (let i = 0; i < n; i += 1) {
            const vertex = new THREE.Vector3(
                pointCloudData.vertices.x[i] * 1000,
                pointCloudData.vertices.y[i] * 1000,
                pointCloudData.vertices.z[i] * 1000
            );
            vertex.toArray(positions, i * 3);

            alpha[i] = 0.8;
            sizes[i] = scannedParams.size;
        }
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
        geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const materials = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: pointCloudData.color },
            },
            vertexShader: document.getElementById('vertexshader').textContent,
            fragmentShader: document.getElementById('fragmentshader').textContent,
            transparent: true,
        });

        const pointCloud = new THREE.Points(geometry, materials);
        scene.add(pointCloud);

        saveGeometry(label, pointCloud);
    }

    // Clear the scene
    function clearScene() {
        while (dataGeometries[0]) {
            const category = dataGeometries.pop();
            geometryCache[category].mesh.forEach((geometry) => {
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

    // Show or hide point cloud
    function toggleObjectVisibility(objectLabel) {
        if (geometryCache[objectLabel].visible) {
            geometryCache[objectLabel].mesh.forEach(mesh => scene.remove(mesh));
        } else {
            geometryCache[objectLabel].mesh.forEach(mesh => scene.add(mesh));
        }
        geometryCache[objectLabel].visible = !geometryCache[objectLabel].visible;
        if (objectLabel === 'axes') {
            try {
                $axesLabels.toggle();
            } catch (err) {
                $axesLabels = $('.text-label');
                $axesLabels.toggle();
            }
        }

        render();
    }

    // Highlight area around a point
    function highlightArea(pointPosition) {
        // Highlight parameters
        const fadedAlpha = 0.2;
        const highlightedAlpha = 0.8;

        // Traverse all points - scanned, completed...
        const objects = geometryCache.scannedPoints.mesh.concat(geometryCache.completedPoints.mesh);
        objects.forEach((object) => {
            // Get all geometry Attributes and set new values
            const positions = object.geometry.attributes.position;
            const alphas = object.geometry.attributes.alpha;

            const n = alphas.count;
            for (let i = 0; i < n; i += 1) {
                const j = i * 3;
                const position = new THREE.Vector3(
                    positions.array[j],
                    positions.array[j + 1],
                    positions.array[j + 2]
                );

                // Highlight sphere around selected point
                if (pointPosition.distanceTo(position) > selectionRegion) {
                    alphas.array[i] = fadedAlpha;
                } else {
                    alphas.array[i] = highlightedAlpha;
                }
            }

            alphas.needsUpdate = true;
        });
    }

    // On mouse click event highlight the area around the selected point
    function selectionHandler(event) {
        event.preventDefault();

        // Get Mouse position
        const mouse = new THREE.Vector2(
            ((event.clientX / window.innerWidth) * 2) - 1,
            -((event.clientY / window.innerHeight) * 2) + 1
        );

        raycaster.setFromCamera(mouse, camera);

        // Points to check intersection with
        const points = geometryCache.scannedPoints.mesh.concat(geometryCache.completedPoints.mesh);
        const intersects = raycaster.intersectObjects(points);

        if (intersects.length > 0) {
            // Point user clicked on
            const pointPosition = intersects[0].point;
            selectedPoint = pointPosition;

            highlightArea(pointPosition);
            render();
        }
    }

    // Set the Highlight Region Size
    function updateSelectionRegionSize(size) {
        selectionRegion = size;
        if (selectedPoint !== undefined) {
            highlightArea(selectedPoint);
            render();
        }
    }

    // Reset the highlight
    function resetHighlight() {
        selectedPoint = undefined;
        const oldSelectionRegion = selectionRegion;
        selectionRegion = 1000;
        highlightArea(new THREE.Vector3(0, 0, 0));
        render();
        selectionRegion = oldSelectionRegion;
    }

    // --- Call one-time functions
    $container[0].appendChild(renderer.domElement);
    createAxes();
    render();

    // --- Bind events ---
    controls.addEventListener('change', render);
    $container.click(selectionHandler);

    // --- Reveal public methods ---
    return {
        addPointCloud,
        addSymmetryLines,
        addSymmetryPlanes,
        render,
        clearScene,
        setScannedColor,
        setCompletedColor,
        toggleObjectVisibility,
        updateSelectionRegionSize,
        resetHighlight,
    };
}());

// --- User Interactions Module ---
const userInteraction = (function initialize() {
    // --- DOM Cache ---
    const $toolsWrapper = $('#tools-wrapper').find('ul');
    const persistantSettings = ['axes', 'selection-size', 'refresh'];
    const $selectionAreaSlider = $toolsWrapper.find('#selection-size').find('input[type="range"]');
    const $selectionAreaValue = $toolsWrapper.find('#selection-size').find('span');
    const $resetButton = $toolsWrapper.find('#refresh');

    // --- Functions ---
    // Toggle point cloud visibility - called on click
    function toggleObject() {
        visualization.toggleObjectVisibility($(this).attr('id'));

        const $eye = $(this).find('i');
        if ($eye.hasClass('fa-eye')) {
            $eye.removeClass('fa-eye');
            $eye.addClass('fa-eye-slash');
        } else {
            $eye.removeClass('fa-eye-slash');
            $eye.addClass('fa-eye');
        }
    }

    // Adds interactive elements for a given object to the Tools panel
    function addInteraction(id, alias, color) {
        $toolsWrapper.append(`<li id="${id}" class="toggable"><i class="fa fa-eye fa-2x" aria-hidden="true"></i>${alias}</li>`);
        const $newElement = $toolsWrapper.find(`#${id}`);
        $newElement.find('i').css('color', `${color}`);
        $newElement.click(toggleObject);
    }

    // Clears the toolbox
    function clearToolbox() {
        $toolsWrapper.find('li').each((index, element) => {
            if (persistantSettings.indexOf($(element).prop('id')) === -1) {
                $(element).remove();
            }
        });
    }

    // Updates the value field when the slider changes
    function updateSelectionSizeValue() {
        const value = $(this).val();
        $selectionAreaValue.text(value);
        visualization.updateSelectionRegionSize(value);
    }

    // Reset the visualization to the default state
    function resetVisualization() {
        visualization.resetHighlight();
    }

    // --- Bindings ---
    // Bind toggle for present interactions at start
    $toolsWrapper.find('.toggable').click(toggleObject);
    $selectionAreaSlider.on('input', updateSelectionSizeValue);
    $resetButton.on('click', resetVisualization);

    return {
        addInteraction,
        clearToolbox,
    };
}());

// --- Viasual Mapping Module ---
const visualMapping = (function initialize() {
    // --- Attributes ---
    const pointCloud = {};
    pointCloud.completed = {};
    pointCloud.scanned = {};
    pointCloud.completed.vertices = {
        x: [],
        y: [],
        z: [],
    };
    pointCloud.scanned.vertices = {
        x: [],
        y: [],
        z: [],
    };
    pointCloud.completed.color = new THREE.Color(0.5, 0.5, 0);
    pointCloud.scanned.color = new THREE.Color(0.5, 0, 0.5);

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
    symmetryPlanes.width = [];
    symmetryPlanes.height = [];
    symmetryPlanes.color = [];
    symmetryPlanes.translationDistance = [];
    symmetryPlanes.translationVector = [];
    symmetryPlanes.rotation = [];

    // --- Functions ---
    // Randomly choose points which will be marked as "completed",
    // and generate symmetri axes and planes
    function genSyntheticData(vertexes) {
        const n = vertexes.x.length;
        const xTreshold = Math.floor(Math.random() * n);
        const yTreshold = Math.floor(Math.random() * n);
        const zTreshold = Math.floor(Math.random() * n);

        // Empty the previously loaded vertices
        pointCloud.completed.vertices = {
            x: [],
            y: [],
            z: [],
        };
        pointCloud.scanned.vertices = {
            x: [],
            y: [],
            z: [],
        };

        for (let i = 0; i < n; i += 1) {
            if (i < xTreshold && i < yTreshold && i < zTreshold) {
                pointCloud.completed.vertices.x.push(vertexes.x[i]);
                pointCloud.completed.vertices.y.push(vertexes.y[i]);
                pointCloud.completed.vertices.z.push(vertexes.z[i]);
            } else {
                pointCloud.scanned.vertices.x.push(vertexes.x[i]);
                pointCloud.scanned.vertices.y.push(vertexes.y[i]);
                pointCloud.scanned.vertices.z.push(vertexes.z[i]);
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

        symmetryPlanes.width = [200];
        symmetryPlanes.height = [200];
        symmetryPlanes.color = [new THREE.Color(200, 200, 200)];
        symmetryPlanes.translationDistance = [100];
        symmetryPlanes.translationVector = [new THREE.Vector3(0, 1, 0.1)];
        symmetryPlanes.rotation = [new THREE.Euler(0, 1, 1.57)];
    }

    // Fill the point cloud with data
    function fillPointCloud(vertexes) {
        pointCloud.x = vertexes.x;
        pointCloud.y = vertexes.y;
        pointCloud.z = vertexes.z;

        genSyntheticData(vertexes);
        visualization.clearScene();
        userInteraction.clearToolbox();

        visualization.addPointCloud(pointCloud.scanned, 'scannedPoints');
        const scannedColorString = `rgb(${Math.round(pointCloud.scanned.color.r * 255)}, ${Math.round(pointCloud.scanned.color.g * 255)}, ${Math.round(pointCloud.scanned.color.b * 255)})`;
        userInteraction.addInteraction('scannedPoints', 'Scanned Points', scannedColorString);

        visualization.addPointCloud(pointCloud.completed, 'completedPoints');
        const completedColorString = `rgb(${Math.round(pointCloud.completed.color.r * 255)}, ${Math.round(pointCloud.completed.color.g * 255)}, ${Math.round(pointCloud.completed.color.b * 255)})`;
        userInteraction.addInteraction('completedPoints', 'Completed Points', completedColorString);

        visualization.addSymmetryLines(symmetryLines, 'symmetryLines');
        userInteraction.addInteraction('symmetryLines', 'Symmetry Axes', '#444');

        visualization.addSymmetryPlanes(symmetryPlanes, 'symmetryPlanes');
        userInteraction.addInteraction('symmetryPlanes', 'Symmetry Planes', '#444');

        visualization.setScannedColor(scannedColorString);
        visualization.setCompletedColor();
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
    const $fileInput = $('input[type="file"]');

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
