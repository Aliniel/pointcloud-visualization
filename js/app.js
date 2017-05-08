// --- Module for managing three.js ---
const visualization = (function initialize() {
    // --- Attributes ---
    // Setting up Scene, Camera and Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        1,
        10000);
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
    const $detailsWrapper = $('#details-wrapper');
    let $axesLabels;

    // --- Functions ---
    // Renders the scene
    function render() {
        camera.lookAt(scene.position);
        axesValueLabels.forEach(label => label.updatePosition());
        renderer.render(scene, camera);
    }

    // Add information to the details section in form of <label, value>
    function addDetailsCategory(label) {
        const formattedLabel = `<p class="details-category-label">${label}</p>`;
        $detailsWrapper.append(formattedLabel);
    }

    // Add information to the details section in form of <label, value>
    function addDetails(label, value, id = '', hexColor) {
        const formattedLabel = `<p><span id="${id}" class="details-label">${label}:</span> ${value}</p>`;
        $detailsWrapper.append(formattedLabel);
        $detailsWrapper.find(`#${id}`).css('color', hexColor);
    }

    // Clear the details section
    function clearDetails() {
        $detailsWrapper.find('p:not(.info-title)').remove();
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
    function addSymmetryPlanes(planes, label, hexColor) {
        const color = `#${hexColor}`;
        const n = planes.width.length;
        for (let i = 0; i < n; i += 1) {
            // PlaneBufferGeometry: Width, Height
            const geometry = new THREE.PlaneBufferGeometry(planes.width[i], planes.height[i]);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color),
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
    function addSymmetryLines(lines, label, hexColor) {
        const color = `#${hexColor}`;
        const n = lines.start.x.length;
        for (let i = 0; i < n; i += 1) {
            const material = new THREE.LineBasicMaterial({
                color: new THREE.Color(color),
            });

            const geometry = new THREE.Geometry();
            geometry.vertices.push(
                new THREE.Vector3(lines.start.x[i], lines.start.y[i], lines.start.z[i]),
                new THREE.Vector3(lines.end.x[i], lines.end.y[i], lines.end.z[i]));

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
                axesEnd[i]);

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
    function addPointCloud(pointCloudData, label, alphaVal = 0.8) {
        const geometry = new THREE.BufferGeometry();

        const n = pointCloudData.vertices.x.length;
        const alpha = new Float32Array(n);
        const positions = new Float32Array(n * 3);
        const sizes = new Float32Array(n);

        for (let i = 0; i < n; i += 1) {
            const vertex = new THREE.Vector3(
                pointCloudData.vertices.x[i] * 1000,
                pointCloudData.vertices.y[i] * 1000,
                pointCloudData.vertices.z[i] * 1000);
            vertex.toArray(positions, i * 3);

            alpha[i] = alphaVal;
            sizes[i] = scannedParams.size;
        }
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
        geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));

        let materials;
        if (pointCloudData.colors !== undefined) {
            // Set per point colors
            const colors = new Float32Array(n * 3);
            for (let i = 0; i < n; i += 1) {
                new THREE.Color(pointCloudData.colors[i]).toArray(colors, i * 3);
            }
            geometry.addAttribute('colors', new THREE.BufferAttribute(colors, 3));

            materials = new THREE.ShaderMaterial({
                defines: {
                    USE_COLOR: '',
                },
                vertexShader: document.getElementById('vertexshader').textContent,
                fragmentShader: document.getElementById('fragmentshader').textContent,
                transparent: true,
            });
        } else {
            // Set color for the whole cloud
            materials = new THREE.ShaderMaterial({
                uniforms: {
                    unicolor: { value: pointCloudData.color },
                },
                vertexShader: document.getElementById('vertexshader').textContent,
                fragmentShader: document.getElementById('fragmentshader').textContent,
                transparent: true,
            });
        }

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

    // Change the color of a visual object
    function changeColor(meshId, hexaColor) {
        geometryCache[meshId].mesh.forEach((item) => {
            const mesh = item;
            if (mesh.material.color !== undefined) {
                mesh.material.color = new THREE.Color(hexaColor);
            } else {
                mesh.material.uniforms.unicolor.value = new THREE.Color(hexaColor);
            }
            mesh.material.needsUpdate = true;
        });

        $detailsWrapper.find(`#${meshId}-details`).css('color', `${hexaColor}`);
        render();
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
        let totalPoints = 0;
        let totalHighlighted = 0;
        let objects = geometryCache['scanned-points'].mesh;
        for (let i = 0; i < 5; i += 1) {
            objects = objects.concat(geometryCache[`completed-points-${i}`].mesh);
        }
        objects.forEach((object) => {
            // Get all geometry Attributes and set new values
            const positions = object.geometry.attributes.position;
            const alphas = object.geometry.attributes.alpha;

            const n = alphas.count;
            totalPoints += n;
            for (let i = 0; i < n; i += 1) {
                const j = i * 3;
                const position = new THREE.Vector3(
                    positions.array[j],
                    positions.array[j + 1],
                    positions.array[j + 2]);

                // Highlight sphere around selected point
                if (pointPosition.distanceTo(position) > selectionRegion) {
                    alphas.array[i] = fadedAlpha;
                } else {
                    alphas.array[i] = highlightedAlpha;
                    totalHighlighted += 1;
                }
            }

            alphas.needsUpdate = true;
        });

        $detailsWrapper.find('#selected-points-details').parent().remove();
        const highlightPercentage = ((totalHighlighted / totalPoints) * 100).toFixed(2);
        addDetails('Selected Points', `${totalHighlighted} (${highlightPercentage}%)`, 'selected-points-details');
    }

    // On mouse click event highlight the area around the selected point
    function selectionHandler(event) {
        event.preventDefault();

        // Get Mouse position
        const mouse = new THREE.Vector2(
            ((event.clientX / window.innerWidth) * 2) - 1,
            -((event.clientY / window.innerHeight) * 2) + 1);

        raycaster.setFromCamera(mouse, camera);

        // Points to check intersection with
        let points = geometryCache['scanned-points'].mesh;
        for (let i = 0; i < 5; i += 1) {
            points = points.concat(geometryCache[`completed-points-${i}`].mesh);
        }
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
        $detailsWrapper.find('#selected-points-details').parent().remove();
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
        changeColor,
        toggleObjectVisibility,
        updateSelectionRegionSize,
        resetHighlight,
        addDetailsCategory,
        addDetails,
        clearDetails,
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
        visualization.toggleObjectVisibility($(this).parent().attr('id'));

        const $eye = $(this);
        if ($eye.hasClass('fa-eye')) {
            $eye.removeClass('fa-eye');
            $eye.addClass('fa-eye-slash');
        } else {
            $eye.removeClass('fa-eye-slash');
            $eye.addClass('fa-eye');
        }
    }

    // Change the color mapping for visual objects
    function changeColorMapping() {
        const elementId = $(this).parent().prop('id');
        visualization.changeColor(elementId, this.value);
    }

    // Adds interactive elements for a given object to the Tools panel
    function addInteraction(id, alias, hexColor, visible = true, editable = true) {
        let eyeClass = 'fa-eye';
        if (!visible) {
            eyeClass = 'fa-eye-slash';
        }

        let colorPicker = '';
        if (editable) {
            colorPicker = `<input type="color" value='#${hexColor}'/>`;
        }

        $toolsWrapper.append(`<li id="${id}"><i class="fa ${eyeClass} fa-2x toggable" aria-hidden="true"></i>${colorPicker}${alias}
</li>`);

        const $newElement = $toolsWrapper.find(`#${id}`);
        $newElement.find('i').click(toggleObject);
        if (!editable) {
            $newElement.find('i').css('color', hexColor);
        }

        const $colorPicker = $toolsWrapper.find('input[type="color"]');
        $colorPicker.change(changeColorMapping);
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
    // Points completed by algorithm - simulation for now
    pointCloud.completed = [];

    // Scanned points
    pointCloud.scanned = {};
    pointCloud.scanned.vertices = {
        x: [],
        y: [],
        z: [],
    };

    // Scanned points which were moved and marked as completed for error calculation
    pointCloud.all = {};
    pointCloud.all.vertices = {
        x: [],
        y: [],
        z: [],
    };

    // pointCloud.completed.color = new THREE.Color('#e74343');
    pointCloud.scanned.color = new THREE.Color('#63bdf3');
    pointCloud.all.color = new THREE.Color('#aaaaaa');

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

    // Color tresholds for the completed points - heat map
    const colorTresholds = [
        '#43b034',
        '#a4e29c',
        '#e29ca4',
        '#d0616e',
        '#b03443',
    ];

    // --- Functions ---
    // Randomly choose points which will be marked as "completed",
    // and generate symmetri axes and planes
    function genSyntheticData(vertexes) {
        const n = vertexes.x.length;
        const xTreshold = Math.floor(Math.random() * n);
        const yTreshold = Math.floor(Math.random() * n);
        const zTreshold = Math.floor(Math.random() * n);

        // Empty the previously loaded vertices
        for (let i = 0; i < 5; i += 1) {
            pointCloud.completed[i] = {};
            pointCloud.completed[i].vertices = {
                x: [],
                y: [],
                z: [],
            };
            pointCloud.completed[i].colors = [];
        }
        pointCloud.scanned.vertices = {
            x: [],
            y: [],
            z: [],
        };
        pointCloud.all.vertices = {
            x: [],
            y: [],
            z: [],
        };

        const maxDistance = 0.0025;
        for (let i = 0; i < n; i += 1) {
            // All points
            pointCloud.all.vertices.x.push(vertexes.x[i]);
            pointCloud.all.vertices.y.push(vertexes.y[i]);
            pointCloud.all.vertices.z.push(vertexes.z[i]);
            if (i < xTreshold && i < yTreshold && i < zTreshold) {
                // Offset
                const xOffset = (Math.random() * 0.0025) - 0.00125;
                const yOffset = (Math.random() * 0.0025) - 0.00125;
                const zOffset = (Math.random() * 0.0025) - 0.00125;

                const newX = parseFloat(vertexes.x[i]) + xOffset;
                const newY = parseFloat(vertexes.y[i]) + yOffset;
                const newZ = parseFloat(vertexes.z[i]) + zOffset;
                const distance = Math.sqrt(
                    ((parseFloat(vertexes.x[i]) - newX) ** 2)
                    + ((parseFloat(vertexes.y[i]) - newY) ** 2)
                    + ((parseFloat(vertexes.z[i]) - newZ) ** 2),
                );
                const completeIndex = Math.floor((distance / maxDistance) * 5);

                pointCloud.completed[completeIndex].vertices.x.push(newX);
                pointCloud.completed[completeIndex].vertices.y.push(newY);
                pointCloud.completed[completeIndex].vertices.z.push(newZ);
                pointCloud.completed[completeIndex].colors.push(
                    colorTresholds[completeIndex],
                );
            } else {
                pointCloud.scanned.vertices.x.push(vertexes.x[i]);
                pointCloud.scanned.vertices.y.push(vertexes.y[i]);
                pointCloud.scanned.vertices.z.push(vertexes.z[i]);
            }
        }

        symmetryLines.start.x = [-200, -120, -90];
        symmetryLines.start.y = [80, 180, 110];
        symmetryLines.start.z = [8, 10, 80];
        symmetryLines.end.x = [200, 100, -40];
        symmetryLines.end.y = [80, 0, 180];
        symmetryLines.end.z = [8, 10, -60];

        symmetryPlanes.width = [200];
        symmetryPlanes.height = [200];
        symmetryPlanes.translationDistance = [100];
        symmetryPlanes.translationVector = [new THREE.Vector3(0, 1, 0.1)];
        symmetryPlanes.rotation = [new THREE.Euler(0, 1, 1.57)];
    }

    // Fill the point cloud with data
    function fillPointCloud(vertexes) {
        pointCloud.x = vertexes.x;
        pointCloud.y = vertexes.y;
        pointCloud.z = vertexes.z;

        // Get the synthetic data
        genSyntheticData(vertexes);
        visualization.clearScene();
        visualization.clearDetails();
        userInteraction.clearToolbox();

        // Calculate details for the summary details
        const scannedCount = pointCloud.scanned.vertices.x.length;
        let completedCount = 0;
        pointCloud.completed.forEach((points) => {
            completedCount += points.vertices.x.length;
        });

        const scannedPercentage =
            ((scannedCount / (scannedCount + completedCount)) * 100).toFixed(2);
        const completedPercentage =
            ((completedCount / (scannedCount + completedCount)) * 100).toFixed(2);

        // Add Summary details
        visualization.addPointCloud(pointCloud.scanned, 'scanned-points');
        visualization.addDetailsCategory('Point Cloud Summary');
        visualization.addDetails('Total points', `${scannedCount + completedCount} (100%)`, 'total-points-details');
        visualization.addDetails('Scanned points', `${scannedCount} (${scannedPercentage}%)`, 'scanned-points-details');
        visualization.addDetails('Completed points', `${completedCount} (${completedPercentage}%)`, 'completed-points-details');

        userInteraction.addInteraction('scanned-points', 'Scanned Points', pointCloud.scanned.color.getHexString());

        // Add completeness heat map
        visualization.addDetailsCategory('Completeness Accuracy Heat Map');
        let currentCompleted = 0;
        pointCloud.completed.forEach((points) => {
            const pointdId = `completed-points-${currentCompleted}`;
            const pointLabel = `Completed (Error: [${currentCompleted * 20}, ${(currentCompleted + 1) * 20}]%)`;
            visualization.addPointCloud(points, pointdId);
            visualization.addDetails(
                pointLabel,
                `${points.vertices.x.length} (${((points.vertices.x.length / (scannedCount + completedCount)) * 100).toFixed(2)}%)`,
                `${pointdId}-details`,
                colorTresholds[currentCompleted]);
            userInteraction.addInteraction(
                pointdId,
                pointLabel,
                colorTresholds[currentCompleted],
                true,
                false);
            currentCompleted += 1;
        });

        // Add point clouds to the scene
        visualization.addPointCloud(pointCloud.all, 'all-points', 0.4);
        userInteraction.addInteraction('all-points', 'All Points', pointCloud.all.color.getHexString(), false);
        visualization.toggleObjectVisibility('all-points');

        // Add lines
        visualization.addSymmetryLines(symmetryLines, 'symmetryLines', '444444');
        userInteraction.addInteraction('symmetryLines', 'Symmetry Axes', '444444');

        // Add planes
        visualization.addSymmetryPlanes(symmetryPlanes, 'symmetryPlanes', '444444');
        userInteraction.addInteraction('symmetryPlanes', 'Symmetry Planes', '444444');

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
