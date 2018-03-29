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
    let dataGeometries = [];
    const geometryTypes = {
        points: 'points',
        axis: 'axis',
        plane: 'plane',
    };

    const axesValueLabels = [];

    // Scanned Point Cloud
    const scannedParams = {};
    scannedParams.size = 1;

    // Adjustable variables
    let selectionRegion = 20.0;
    let selectedPoint;
    const dataRange = 200;
    // Highlight parameters
    const fadedAlpha = 0.2;
    const highlightedAlpha = 0.8;

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

    /**
     * Save geometry for later use.
     * @param {string} label Unique string key for the geometry.
     * @param {Object} geometry Three.js geometry object.
     * @param {string} type Type of the geometry. Enum value from the geometryTypes.
     */
    function saveGeometry(label, geometry, type) {
        if (!geometryCache[label]) {
            geometryCache[label] = {
                mesh: [],
                visible: true,
                type,
            };
        }
        geometryCache[label].mesh.push(geometry);

        if (persistantGeometries.indexOf(label) === -1
        && dataGeometries.indexOf(label) === -1) {
            dataGeometries.push(label);
        }
    }

    /**
     * Adds a plane geometry into the visualization.
     * @param {Object} plane Object containing 4 parameters of the plane (a, b, c, d).
     * @param {string} label Label of the plane.
     */
    function addSymmetryPlane(planeParams, label) {
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#444444'),
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
        });

        // The coordinate system axis seem to be reversed? Maybe my camera is set up incorrectly
        const normal = new THREE.Vector3(
            -planeParams.a,
            -planeParams.b,
            -planeParams.c,
        );
        normal.normalize();
        const plane = new THREE.Plane(
            normal,
            (-planeParams.d * dataRange), // Multiplying for the visualization
        );

        const geometry = new THREE.PlaneGeometry(500, 500);
        const mesh = new THREE.Mesh(geometry, material);

        // Move and rotate correctly
        const coplanarPoint = plane.coplanarPoint();
        mesh.translateX(coplanarPoint.x);
        mesh.translateY(coplanarPoint.y);
        mesh.translateZ(coplanarPoint.z);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);

        scene.add(mesh);
        saveGeometry(label, mesh, geometryTypes.plane);
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

            saveGeometry(label, plane, geometryTypes.plane);
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

            saveGeometry(label, line, geometryTypes.axis);
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

        saveGeometry('axes', sphere, geometryTypes.axis);

        const text = createText();
        text.setHTML(i.toString());
        text.setParent(sphere);
        $container[0].appendChild(text.element);
        axesValueLabels.push(text);
    }

    // Adds axes to the scene
    function createAxes() {
        const axesLength = dataRange;
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

            saveGeometry('axes', line, geometryTypes.axis);
        }

        // Draw axes values
        for (let i = -axesLength; i <= axesLength; i += 20) {
            createAxisValue(i, 'x');
            createAxisValue(i, 'y');
            createAxisValue(i, 'z');
        }
    }

    /**
     * Add point cloud to the visualization.
     * @param {Object} pointCloudData Contains three attributes (x, y, z) with array
     * of float numbers (point coordinates). Optionally can contain "normalize" value set to true
     * if normalization is required.
     * @param {string} label Label of the Point Cloud.
     * @param {number} alphaVal A float number indicating the alpha value for
     * the color of the points.
     */
    function addPointCloud(pointCloudData, label, alphaVal = 0.8) {
        const geometry = new THREE.BufferGeometry();

        const n = pointCloudData.vertices.x.length;
        const alpha = new Float32Array(n);
        const positions = new Float32Array(n * 3);
        const sizes = new Float32Array(n);

        // Normalization params
        const min = Math.min(
            ...pointCloudData.vertices.x,
            ...pointCloudData.vertices.y,
            ...pointCloudData.vertices.z,
        );
        const max = Math.max(
            ...pointCloudData.vertices.x,
            ...pointCloudData.vertices.y,
            ...pointCloudData.vertices.z,
        );
        const range = max - min;
        /**
         * Normalize the value to the range of [0, 1]. Min and max will be used from above.
         * @param {numeric} value Value to be normalized.
         */
        const normalize = value => (value - min) / range;

        const multiplier = dataRange;
        const reducer = dataRange / 2;
        for (let i = 0; i < n; i += 1) {
            let vertex;
            if (pointCloudData.normalize) {
                // Normalizing usually when we read it for the first time
                vertex = new THREE.Vector3(
                    (normalize(pointCloudData.vertices.x[i]) * multiplier) - reducer,
                    (normalize(pointCloudData.vertices.y[i]) * multiplier) - reducer,
                    (normalize(pointCloudData.vertices.z[i]) * multiplier) - reducer,
                );
            } else {
                // Just scaling up for the visualization
                vertex = new THREE.Vector3(
                    pointCloudData.vertices.x[i] * multiplier,
                    pointCloudData.vertices.y[i] * multiplier,
                    pointCloudData.vertices.z[i] * multiplier,
                );
            }
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

        saveGeometry(label, pointCloud, geometryTypes.points);
    }

    // Clear the scene
    function clearScene() {
        dataGeometries.forEach((category) => {
            geometryCache[category].mesh.forEach((geometry) => {
                scene.remove(geometry);
            });
            delete geometryCache[category];
        });
        dataGeometries = [];
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

    /**
     * Returns cached meshes by type.
     * @param {string} type Type of mesh to return. Use enum geometryType.
     * @return {Object[]} Array of Three.js meshes.
     */
    function getCachedMesh(type) {
        let objects;
        Object.keys(geometryCache).forEach((key) => {
            if (geometryCache[key].type === type) {
                if (objects === undefined) {
                    objects = geometryCache[key].mesh;
                } else {
                    objects = objects.concat(geometryCache[key].mesh);
                }
            }
        });

        return objects;
    }

    // Highlight area around a point
    function highlightArea(pointPosition) {
        // Traverse all points - scanned, completed...
        let totalPoints = 0;
        let totalHighlighted = 0;
        const objects = getCachedMesh(geometryTypes.points);
        objects.forEach((object) => {
            // Get all geometry Attributes and set new values
            const positions = object.geometry.attributes.position;
            const alphas = object.geometry.attributes.alpha;

            const n = alphas.count;
            totalPoints += n;
            for (let i = 0; i < n; i += 1) {
                const j = i * 3;

                // Position of one point
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
        const points = getCachedMesh(geometryTypes.points);
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

    /**
     * Returns all selected points as an object with three arrays of x, y and z coordinates.
     */
    function getSelection() {
        const selectedPoints = {};
        selectedPoints.x = [];
        selectedPoints.y = [];
        selectedPoints.z = [];

        const meshes = getCachedMesh(geometryTypes.points);
        meshes.forEach((mesh) => {
            const points = mesh.geometry.attributes.position;
            const alphas = mesh.geometry.attributes.alpha;
            const n = points.count;

            // Traverse all points
            for (let i = 0; i < n; i += 1) {
                if (alphas.array[i].toFixed(2) === highlightedAlpha.toFixed(2)) {
                    selectedPoints.x.push(points.array[i * 3] / dataRange);
                    selectedPoints.y.push(points.array[(i * 3) + 1] / dataRange);
                    selectedPoints.z.push(points.array[(i * 3) + 2] / dataRange);
                }
            }
        });

        return selectedPoints;
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
        addSymmetryPlane,
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
        geometryTypes,
        getSelection,
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
    /**
     * Toggle object visibility in the visualization
     */
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

    /**
     * Adds interactive elements for a given object to the Tools panel
     * @param {string} id Id for the element - same as point cloud.
     * @param {string} alias Name for the point cloud.
     * @param {string} hexColor Color for the cloud. No hash symbol, e.g. "ffffff".
     * @param {boolean} visible Is the cloud visible on init?
     * @param {boolean} editable Is the color of the cloud editable?
     * @param {object} htmlData Key value pairs for "data-*" attributes.
     * Good for storing dirnames, etc.
     */
    function addInteraction(id, alias, hexColor, visible = true, editable = true, htmlData = {}) {
        let eyeClass = 'fa-eye';
        if (!visible) {
            eyeClass = 'fa-eye-slash';
        }

        let colorPicker = '';
        if (editable) {
            colorPicker = `<input type="color" value='#${hexColor}'/>`;
        }

        // Get all the data attributes into the element
        let htmlDataString = '';
        Object.keys(htmlData).forEach((key) => {
            htmlDataString += `data-${key}="${htmlData[key]}"`;
        });
        $toolsWrapper.append(`<li id="${id}" ${htmlDataString}><i class="fa ${eyeClass} fa-2x toggable" aria-hidden="true"></i>${colorPicker}${alias}
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

    // Points completed by algorithm
    pointCloud.completed = [];

    // Scanned points
    pointCloud.scanned = {};
    pointCloud.scanned.vertices = {
        x: [],
        y: [],
        z: [],
    };

    // // Scanned points which were moved and marked as completed for error calculation
    // pointCloud.all = {};
    // pointCloud.all.vertices = {
    //     x: [],
    //     y: [],
    //     z: [],
    // };

    pointCloud.completed.color = new THREE.Color('#e74343');
    pointCloud.scanned.color = new THREE.Color('#63bdf3');
    // pointCloud.all.color = new THREE.Color('#aaaaaa');

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
    /**
     * Start a new visualization of the point cloud.
     * @param {Object} vertices Object containing three attributes of x, y and z
     * coordinate arrays of float numbers. These will be displayed as a "scanned"
     * or "ground truth" points.
     */
    function startNewVisualization(vertices) {
        // Clear the previous visualization
        visualization.clearScene();
        visualization.clearDetails();
        userInteraction.clearToolbox();

        pointCloud.scanned.vertices.x = vertices.x;
        pointCloud.scanned.vertices.y = vertices.y;
        pointCloud.scanned.vertices.z = vertices.z;
        pointCloud.scanned.normalize = true;

        // Init the visualization
        const scannedCount = pointCloud.scanned.vertices.x.length;
        visualization.addPointCloud(pointCloud.scanned, 'scanned-points');
        visualization.addDetailsCategory('Point Cloud Summary');
        visualization.addDetails('Total points', `${scannedCount} (100%)`, 'total-points-details');
        visualization.addDetails('Scanned points', `${scannedCount} (100%)`, 'scanned-points-details');

        userInteraction.addInteraction('scanned-points', 'Scanned Points', pointCloud.scanned.color.getHexString());
        visualization.render();
    }

    /**
     * Adds new points into an existing visualization.
     * @param {Object} vertices Object containing three attributes of x, y and z
     * coordinate arrays of float numbers. These will be displayed as a "scanned"
     * or "ground truth" points.
     * @param {string} dirname Name of the directory the data is being stored in.
     * @param {numeric} index Candidate number of the cloud inside the directory.
     * @param {boolean} visible Should the points be made visible?
     * @param {object} htmlData Data to be passed for interactions.
     */
    function addPointsToVisualization(vertices, dirname, index, visible, htmlData = {}) {
        const count = vertices.x.length;
        const id = `${dirname}-${index}`;
        const cloudLabel = `Completed Point Cloud #${index}`;

        const completed = {
            vertices,
            color: pointCloud.completed.color,
        };
        pointCloud.completed.push(completed);

        // Init the visualization
        visualization.addPointCloud(completed, id);
        userInteraction.addInteraction(
            id, cloudLabel, pointCloud.completed.color.getHexString(), visible, true, htmlData,
        );
        visualization.addDetails(
            cloudLabel,
            `${count}`,
            `${id}-details`,
            pointCloud.completed.color.getHexString(),
        );
        if (!visible) {
            // Render is already called inside
            visualization.toggleObjectVisibility(id);
        } else {
            visualization.render();
        }
    }

    // --- Reveal public methods ---
    return {
        startNewVisualization,
        addPointsToVisualization,
    };
}());

// --- Module for managing data ---
const dataManager = (function initialize() {
    // --- Attributes ---
    const supportedFormats = [
        'ply',
        'off',
    ];

    // --- Cache DOM ---
    const $fileInput = $('input[type="file"]');

    /**
     * Get an empty container to store points into.
     */
    function getEmptyContainer() {
        // Object containing all vertices
        const vertices = {};
        vertices.x = [];
        vertices.y = [];
        vertices.z = [];
        return vertices;
    }

    /**
     * Ply file parser. Fills the vertices object of x, y, z coordinates.
     * @param {string[]} lines Array of strings read from the file.
     */
    function loadPly(lines) {
        // Check if ply file is in ascii format
        let vertexCount;
        let lineIndex = 1;
        let line = lines[lineIndex];

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

        const vertices = getEmptyContainer();
        vertices.confidence = [];
        vertices.intensity = [];

        // Parse vertices
        for (let i = 0; i < vertexCount; i += 1) {
            const [x, y, z, confidence, intensity] = lines[lineIndex + i].split(' ');
            vertices.x.push(parseFloat(x));
            vertices.y.push(parseFloat(y));
            vertices.z.push(parseFloat(z));
            vertices.confidence.push(confidence);
            vertices.intensity.push(intensity);
        }
        return vertices;
    }

    /**
     * OFF file format parser. Reads x, y, z vertices into the vertices object.
     * @param {string[]} lines Array of string data lines read from the file.
     */
    function loadOff(lines) {
        let index = 1;

        // Skip possible comments and empty lines
        const dataStartRe = new RegExp(/^(\d)+ (\d)+ (\d)+.*$/);
        while (!lines[index].match(dataStartRe)) {
            index += 1;
        }

        // Read the complete number of points, faces and edges
        const [pointCount] = lines[index].split(' ').map(value => parseInt(value, 10));
        index += 1;

        const vertices = getEmptyContainer();

        // Load the points
        for (index; index < pointCount; index += 1) {
            const [x, y, z] = lines[index].split(' ');
            vertices.x.push(parseFloat(x));
            vertices.y.push(parseFloat(y));
            vertices.z.push(parseFloat(z));
        }
        return vertices;
    }

    /**
     * Parse contents of a file and return vertices to work with.
     * @param {string} content String content of a whole file.
     */
    function parseData(content) {
        const lines = content.split('\n');

        // --- Parse header ---
        // Check is the file is ply
        const fileFormatLine = lines[0];
        let vertices;
        if (fileFormatLine === 'ply') {
            vertices = loadPly(lines);
        } else if (fileFormatLine.toLowerCase() === 'off') {
            vertices = loadOff(lines);
        } else {
            alert(`Unsupported file type. Please use one of the following formats: ${supportedFormats.toString()}`);
        }

        return vertices;
    }

    // Read file content
    function readContent() {
        const reader = new FileReader();

        // Process the read content
        reader.onload = (e) => {
            const vertices = parseData(e.target.result);
            // Draw the data
            visualMapping.startNewVisualization(vertices);
        };

        // Read
        reader.readAsText(this.files[0]);
    }

    // --- Bindings ---
    $fileInput.change(readContent);

    // Public
    return {
        parseData,
    };
}());

/**
 * Server communication module.
 */
const communicator = (function init() {
    let dirname;
    const candidates = [];

    /**
     * Get the results of the completion tool.
     * @param {numeric} index Index of the results to fetch.
     */
    function getResults(index) {
        const searchParams = new URLSearchParams();
        searchParams.append('task', 'get_results');
        searchParams.append('dirname', dirname);
        searchParams.append('candidate_num', index);

        fetch('scripts/complete.cgi', {
            method: 'POST',
            body: searchParams,
            headers: new Headers({
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
        })
        .then(response => response.json())
        .catch(error => console.log('Error checking progress: ', error))
        .then((responseData) => {
            const vertices = dataManager.parseData(responseData.data);
            visualization.addSymmetryPlane(candidates[index], `${dirname}-${index}`);
            visualMapping.addPointsToVisualization(
                vertices,
                dirname,
                index,
                false,
                {
                    dirname,
                    candidateNum: index,
                },
            );
        });
    }

    /**
     * Get the candidates for the global symmetry planes.
     */
    function getCandidates() {
        const searchParams = new URLSearchParams();
        searchParams.append('task', 'get_candidates');
        searchParams.append('dirname', dirname);

        fetch('scripts/complete.cgi', {
            method: 'POST',
            body: searchParams,
            headers: new Headers({
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
        })
        .then(response => response.json())
        .catch(error => console.log('Error checking progress: ', error))
        .then((responseData) => {
            // Empty the array
            candidates.forEach(() => candidates.pop());
            // Print each candidate and add user interaction elements to it
            responseData.data.forEach((planeParams, index) => {
                candidates.push(planeParams);
                getResults(index);
            });
        });
    }

    /**
     * Periodically sends requests to the server to check on the progress of the completion.
     */
    function checkProgress() {
        const searchParams = new URLSearchParams();
        searchParams.append('task', 'progress');
        searchParams.append('dirname', dirname);

        let timer;
        const updateProgress = () => {
            fetch('scripts/complete.cgi', {
                method: 'POST',
                body: searchParams,
                headers: new Headers({
                    'Content-Type': 'application/x-www-form-urlencoded',
                }),
            })
            .then(response => response.json())
            .catch(error => console.log('Error checking progress: ', error))
            .then((responseData) => {
                const progress = responseData.progress;
                console.log(progress);
                if (parseInt(progress, 10) >= 100) {
                    clearTimeout(timer);
                    getCandidates();
                } else {
                    timer = setTimeout(updateProgress, 5000);
                }
            });
        };
        timer = setTimeout(updateProgress, 5000);
    }
    /**
     * Send the current selection to the server to be automatically completed.
     */
    function complete() {
        const data = visualization.getSelection();
        if (data.x.length === 0) {
            return;
        }

        const searchParams = new URLSearchParams();
        searchParams.append('task', 'submit');
        searchParams.append('data', JSON.stringify(data));

        fetch('scripts/complete.cgi', {
            method: 'POST',
            body: searchParams,
            headers: new Headers({
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
        })
        .then(response => response.json())
        .catch(error => console.log('Error fetching data: ', error))
        .then((responseData) => {
            if (responseData.status === 'ok') {
                dirname = responseData.dirname;
                checkProgress();
            }
        });
    }

    // TODO: Bind to a button, remove getResults
    return {
        complete,
        getResults,
        getCandidates,
        candidates,
    };
}());
