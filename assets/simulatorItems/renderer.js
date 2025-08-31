// import
import { polygonMesh } from '../render/polygonMeshData.js';
import { mapToPixels, WP_projectionEquation, edgeDeclaration, deduplicatedLinePos, quaternionMultiplication, normalizeVector, dotProduct } from '../render/renderUtility.js';

export default class PolygonMeshRenderer {
  constructor(simulator, model) {
    // Simulator
    this.sim = simulator;

    // Stores all of the modified vertex points | Keeps a static version of the non-rotated model
    this.vertexList = []; this.staticVertexList = [];
    this.axeVertexList = {}; // vertexList in a different format meant for transforming the model

    // keeps track of all of the faces that are going to be drawn onto the screen
    this.faceList = [];

    // stores all unique edge values from the model
    this.edgeList = [];

    // stores all of the edges for each face
    this.faceEdges = [];
    this.uniqueEdgeMap = new Map();

    // stores all of the normals for each face
    this.normalList = [];
    this.staticNormalList = []; // return to a static version (for rotation)

    // keeps track of all of the visible edges that are going to be rasterized & drawn onto the screen
    this.rasterizedLineList = [];

    // Keeps track of the model and different axes
    this.axis = ['x', 'y', 'z']; this.model = model;


    // model attributes
    this.rotation = {x: 33, y: 33, z: 33};
    this.rotationSpeed = 5;
    this.modelSize = this.sim.camera.pos.z;
    this.centroid = {x: 0, y: 0, z: 0};

    // Render attributes
    this.focalLength = this.sim.camera.pos.z;
    this.pixelGrid = this.sim.gridSpacing.pixelDisplay;
    this.margin = {x: 0, y: 0};

    for (let axis = 0; axis < this.axis.length - 1; axis++) { // set the margin
      this.margin[this.axis[axis]] = this.sim.window[this.axis[axis]] % this.pixelGrid / 2;
    }


    // Defining the rotation of the model
    this.rotationQuaternion = {w: 0, x: 0, y: 0, z: 0};
    this.rotationAngle = 0;
    this.modelRotation = {x: 0, y: 0, z: 0};

    //check if the model has rotation
    this.hasRotation = !Object.values(this.rotation).every(value => value === 0);
    this.isRotating = this.hasRotation && this.rotationSpeed !== 0;

    //normalize the rotation axes
    if (this.hasRotation) this.modelRotation = normalizeVector(this, this.rotation);

    // Convert the rotationSpeed to radians
    this.radRotationSpeed = this.rotationSpeed * Math.PI / 500;


    // The vectors used for surface handling and processing
    this.faceVectors = {
      viewVector: {},
      centroid: {},
      vertexPoint: [],
      shadeColor: 0,
    };

    // The different sources of lights in the program used for surface shading
    this.lightIntensity = {ambient: this.sim.ambientLightIntensity, camera: this.sim.camera.lightIntensity};


    // A list of all the visible face edges to be rasterized
    this.visibleEdges = [];

    // The parameters used to draw a line (using DDA algorithm)
    this.pixelResolutionDepth = 8;
    this.lineDrawer = {
      position: {x: [], y: []},
      currentPosition: {x: 0, y: 0},
      increment: {x: 0, y: 0},
      steps: 0,
      distance: {x: 0, y: 0},
    };

    // line drawing algorithm extract variables
    this.pixelGridRatio = this.pixelGrid / this.pixelResolutionDepth


    // different ways of rendering the model
    this.renderType = {fill: 'Solid', view: 'Polygonal'};
    this.isWireframe = this.renderType.fill.slice(0, 9) === 'Wireframe';
    this.isRenderingEdges = this.isWireframe || this.renderType.view === 'Pixelated';
    this.prevModel = this.model;
    this.lineWidth = 5;


    // miscellaneous
    this.vertexFace = (index, vertex, axis) => this.vertexList[polygonMesh[this.model].face[index][vertex]][axis];
    this.faceVerticies = (index) => Object.keys(polygonMesh[this.model].face[index]);
    this.axisLength = [];
    this.epsilon = 1e-6; // Very small value to prevent float-point precision errors


    // Initialize the models scale and position
    this.modelInitialization(1, 1, this.isRenderingEdges, 1);
  }
  
  updateModelAttributes(type, value) {
    //define certain things
    this.isWireframe = this.renderType.fill.slice(0, 9) === 'Wireframe';
    let isFrozen = !this.isRotating || this.sim.pauseProgram;
    this.isRenderingEdges = this.isWireframe || this.renderType.view === 'Pixelated';

    switch (type) {
      case 'model':
          // update the model value
          if (value !== 0) this.model = value; // dont use the given value if its coming from configMenu

          // update the model
          if (this.prevModel !== this.model) {
            this.faceEdges = []; // reset edge data when changing models
            this.modelInitialization(1, 1, this.isRenderingEdges, isFrozen);
          }

          this.prevModel = this.model;  // update the previous model status
        break;
      case 'size':
          this.sim.camera.pos.z += value;
          this.focalLength = this.sim.camera.pos.z;
          this.modelInitialization(1, 1, 0, isFrozen);
        break;
      case 'pixelResolution':
          this.pixelGrid = this.sim.gridSpacing.pixelDisplay;
          if (isFrozen && this.renderType.view === 'Pixelated') this.edgeRasterization();
        break;
      case 'initEdges?':
          // After each change in the rendering style, check if the edges need to be initialized, if not, dont do anything
          if (this.isRenderingEdges) {
            if (this.faceEdges.length === 0) this.modelInitialization(1, 1, 1, 0);
            this.render(null, true);
          }
        break;
      case 'renderStyle':
          let array = this.sim.renderingStyle[value];
          this.renderType[value] = array[(array.indexOf(this.renderType[value]) + 1) % array.length];
        break;
      case 'centerModel':
          // Center the model
          this.vertexList = JSON.parse(JSON.stringify(this.staticVertexList));

          // Move the model back
          for (let i = 0; i < this.vertexList.length; i++) {
            this.vertexList[i].z -= this.focalLength;
          } 

          // Render the centered model (for a single frame)
          this.render(null, true);
        break;
      case 'rotation':
          if (value === 'rotation') {
            // check if the model has rotation, and if so, update accordingly
            this.hasRotation = !Object.values(this.rotation).every(value => value === 0);
            if (this.hasRotation) this.modelRotation = normalizeVector(this, this.rotation);
          } else {
            // update rotation speed
            this.radRotationSpeed = this.rotationSpeed * Math.PI / 500;
          }

          this.isRotating = this.hasRotation && this.rotationSpeed !== 0; // check if the model has rotation
          if (isFrozen && this.isRotating) this.render(this.sim.deltaTiming, true);
        break;
      case 'resetModel':
          // reset the model parameters
          this.rotationAngle = 0;
          this.renderType = {fill: 'Solid', view: 'Polygonal'};

          // return it to the center
          this.updateModelAttributes('centerModel');

          // pause program
          this.sim.pauseProgram = true;
        break;
      case 'stepThruModel':
          // pause (if not already), and render the next frame of the model
          this.sim.pauseProgram = true;
          this.render(this.sim.deltaTiming, true);
        break
    }
  }

  modelInitialization(modelData, modelPosData, edgeData, renderFrame) {
    // Writting the vertex points
    const writeModelData = () => {
      this.vertexList = [];
      for (let i = 0; i < polygonMesh[this.model].vertex.length; i++) {
        this.vertexList.push({
          w: 0,
          x: polygonMesh[this.model].vertex[i].x,
          y: polygonMesh[this.model].vertex[i].y,
          z: polygonMesh[this.model].vertex[i].z,
        });
      }

      // Writting the face normals
      this.normalList = [];
      for (let i = 0; i < polygonMesh[this.model].normal.length; i++) {
        this.normalList.push({
          w: 0,
          x: polygonMesh[this.model].normal[i].x,
          y: polygonMesh[this.model].normal[i].y,
          z: polygonMesh[this.model].normal[i].z,
        });
      }

      // create a static list of face normals
      this.staticNormalList = JSON.parse(JSON.stringify(this.normalList));
    }
    if (modelData) writeModelData();


    // Appropriately scale and center the model-----------------------------------------------------------
    const modifyModelPos = () => {
      this.modelSize = this.sim.camera.pos.z;
      for (let axis = 0; axis < this.axis.length; axis++) {
        // Define a list of vertex positions for each axe
        this.axeVertexList[this.axis[axis]] = this.vertexList.map(vertex => vertex[this.axis[axis]]);

        // Find the length of each of the model's axes
        this.axisLength[axis] = Math.max(...this.axeVertexList[this.axis[axis]]) - Math.min(...this.axeVertexList[this.axis[axis]]);
      }

      this.modelSize /= Math.max(...this.axisLength); // Get the model ScaleFactor

      for (let axis = 0; axis < this.axis.length; axis++) {
        for (let i = 0; i < this.vertexList.length; i++) {
          // Normalize the size of the model
          this.vertexList[i][this.axis[axis]] *= this.modelSize;
        }

        // Redefine axeVertexList after model transformation
        this.axeVertexList[this.axis[axis]] = this.vertexList.map(vertex => vertex[this.axis[axis]]);

        // Get the model's center (via its centroid)
        this.centroid[this.axis[axis]] = this.axeVertexList[this.axis[axis]].reduce((sum, value) => sum + value) / this.vertexList.length;

        // Centering the model to the origin point
        for (let i = 0; i < this.vertexList.length; i++) {
          this.vertexList[i][this.axis[axis]] -= this.centroid[this.axis[axis]];
        }
      }
    }
    if (modelPosData) modifyModelPos();


    // Write the edge positions for each face---------------------------------------------------------
    const writeEdges = () => {
      this.faceEdges = [];
      for (let i = 0; i < polygonMesh[this.model].face.length; i++) {
        // define each face
        this.faceEdges[i] = [];

        // set the number of verticies for each face
        let faceVerticies = this.faceVerticies(i).length;

        // write the edges for each face
        for (let j = 0; j < faceVerticies; j++) {
          this.faceEdges[i][j] = {edge: [
            polygonMesh[this.model].face[i]['v' + (j + 1)],
            polygonMesh[this.model].face[i]['v' + ((j + 1) % faceVerticies + 1)],
          ]};

          // create a unique key for any unordered pair of verticies in an edge (used to generate a list of unique edges)
          this.faceEdges[i][j].key = JSON.stringify(this.faceEdges[i][j].edge.toSorted((a, b) => a - b));
        }
      }

      // Remove duplicates from edge list to get one big list of the model's edges (w no face identify)
      this.edgeList = [...new Set(this.faceEdges.flat().map(i => i.key))].map(JSON.parse);
    }
    if (edgeData === 1 || edgeData === true) writeEdges();


    // create a static list of verticies
    this.staticVertexList = JSON.parse(JSON.stringify(this.vertexList));
    for (let i = 0; i < this.vertexList.length; i++) {
      this.vertexList[i].z -= this.focalLength;
    }
    
    // initialize a single rendered frame
    if (renderFrame) this.render(null, true);
  }

  rotate(deltaTiming) {
    // Increase the rotation angle
    this.rotationAngle += this.radRotationSpeed * deltaTiming;

    // Define the rotation quaternion
    this.rotationQuaternion.w = Math.cos(this.rotationAngle / 2);
    let conjugateQuaternion = {w: this.rotationQuaternion.w, x: 0, y: 0, z: 0};

    for (let axis = 0; axis < this.axis.length; axis++) {
      this.rotationQuaternion[this.axis[axis]] = Math.sin(this.rotationAngle / 2) * this.modelRotation[this.axis[axis]];

      // get the conjugate of the rotation quaternion
      conjugateQuaternion[this.axis[axis]] = -this.rotationQuaternion[this.axis[axis]];
    }


    // Return the model back to its original position
    this.vertexList = JSON.parse(JSON.stringify(this.staticVertexList));

    for (let i = 0; i < this.vertexList.length; i++) {
      // Multiply by the rotation quaternion (q * p * -q)
      this.vertexList[i] = quaternionMultiplication(this, this.rotationQuaternion, this.vertexList[i]);
      this.vertexList[i] = quaternionMultiplication(this, this.vertexList[i], conjugateQuaternion);

      // Move the model back
      this.vertexList[i].z -= this.focalLength;
    }


    // Rotate the face normals
    if (this.renderType.fill === 'Wireframe [full]') return;
    this.normalList = JSON.parse(JSON.stringify(this.staticNormalList)); // Reset the face normals back to its default position

    //Multiply the face normals by the rotation quaternion (q * p * -q)
    for (let i = 0; i < this.normalList.length; i++) {
      this.normalList[i] = quaternionMultiplication(this, this.rotationQuaternion, this.normalList[i]);
      this.normalList[i] = quaternionMultiplication(this, this.normalList[i], conjugateQuaternion);
    }
  }

  surfaceShading(faceIndex) {
    // reset the data in faceVectors
    this.faceVectors.vertexPoint = this.faceVerticies(faceIndex);

    for (let axis = 0; axis < this.axis.length; axis++) {
      // Find the face centroid
      this.faceVectors.centroid[this.axis[axis]] = this.faceVectors.vertexPoint.reduce((sum, vertex) => sum + this.vertexFace(faceIndex, vertex, this.axis[axis]), 0) / this.faceVectors.vertexPoint.length;

      // Finds the viewingVector
      this.faceVectors.viewVector[this.axis[axis]] = this.sim.camera.pos[this.axis[axis]] - this.faceVectors.centroid[this.axis[axis]];
    }

    // Normalize the viewing vector
    this.faceVectors.viewVector = normalizeVector(this, this.faceVectors.viewVector);

    // Calculate the shadeColor for each face
    this.faceVectors.shadeColor = dotProduct(this, this.normalList[faceIndex], this.faceVectors.viewVector);

    // Set which faces are visible
    if (this.faceVectors.shadeColor > 0) {
      this.faceList.push({
        face: faceIndex,
        color: this.lightIntensity.ambient + this.lightIntensity.camera * this.faceVectors.shadeColor,
        vertexPoint: this.faceVectors.vertexPoint,
        zIndex: this.faceVectors.centroid.z,
      });
    }
  }

  edgeRasterization() {
    // DDA line drawing algorithm                   ---(credit to: geeksforgeeks.com for the algorithm template)---

    this.rasterizedLineList = []; // reset rasterizedLineList after each iteration (eg. frame)

    for (let i = 0; i < this.visibleEdges.length; i++) {

      // define what rasterizedLineList is and how it will we used
      this.rasterizedLineList[i] = [];
      for (let j = 0; j < this.visibleEdges[i].length; j++) {
        this.rasterizedLineList[i][j] = {position: {x: [], y: []}, color: 0};

        // write something here
        for (let axis = 0; axis < this.axis.length - 1; axis++) {
          // extract variable
          let pos = this.lineDrawer.position[this.axis[axis]];

          // Get the line positions          (x1, y1, x2, y2)
          for (let k = 0; k < 2; k++) {
            pos[k] = this.vertexList[this.visibleEdges[i][j].edge[k]][this.axis[axis]];
          }

          // Get the distance for both axes (used to find the line resolution)
          this.lineDrawer.distance[this.axis[axis]] = pos[0] - pos[1];
        }

        // Set the line resolution
        let steps = this.lineDrawer.steps;
        steps = Math.ceil(Math.max(Math.abs(this.lineDrawer.distance.x), Math.abs(this.lineDrawer.distance.y)) / this.pixelGridRatio);

        for (let axis = 0; axis < this.axis.length - 1; axis++) {
          this.lineDrawer.increment[this.axis[axis]] = this.lineDrawer.distance[this.axis[axis]] / steps;

          // The line's starting position
          let currentPos = this.lineDrawer.currentPosition[this.axis[axis]]
          currentPos = this.lineDrawer.position[this.axis[axis]][1];

          for (let k = 0; k <= steps; k++) {
            // extract variables
            let raw = currentPos + this.epsilon;
            let margin = this.margin[this.axis[axis]];

            // Write the line positions
            this.rasterizedLineList[i][j].position[this.axis[axis]][k] = raw - (raw  - margin) % this.pixelGrid;

            // Update the line positions
            currentPos += this.lineDrawer.increment[this.axis[axis]];
          }
        }

        // write the color of each line
        if (this.renderType.fill === 'Solid') this.rasterizedLineList[i][j].color = this.faceList[i].color;

        // remove duplicate line positions
        let pixelatedLinePos = this.rasterizedLineList[i][j].position;
        this.rasterizedLineList[i][j].position = deduplicatedLinePos(pixelatedLinePos);
      }
    }
  }

  asciiCharacterConversion() {
    // write something here
  }

  render(deltaTiming, InitStat) {
    // Check whether to render a single frame or to have it continuous
    if (!(this.isRotating || InitStat) || document.hidden) return;

    // rotate the model
    if (this.isRotating) this.rotate(deltaTiming);

    // apply lighting to the model
    if (this.renderType.fill !== 'Wireframe [full]') {
      this.faceList = [];
      for (let i = 0; i < polygonMesh[this.model].face.length; i++) {
        this.surfaceShading(i);
      }
      // sort by z-index
      this.faceList.sort((a, b) => a.zIndex - b.zIndex);
    }

    for (let i = 0; i < this.vertexList.length; i++) {
      // Weak Perspective Projection equation
      WP_projectionEquation(this, this.vertexList[i]);

      // Convert the graph coordinates into screen coordinates
      mapToPixels(this.sim, this.vertexList[i]);
    }
    
    // set the visible edges of the model
    if (this.isRenderingEdges) edgeDeclaration(this);

    // rasterize the edge lines
    if (this.renderType.view === 'Pixelated') this.edgeRasterization();

    // convert the model into ASCII Characters
    if (this.renderType.view === 'ASCII') this.asciiCharacterConversion();
  }

  draw(ctx) {
    // default color & lineWidth
    ctx.strokeStyle = `rgb(${this.lightIntensity.camera}, ${this.lightIntensity.camera}, ${this.lightIntensity.camera})`;
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = 'round';

    // render the model appropriately (according to the specified values in the gui)
    for (let i = 0; i < this[this.renderType.fill === 'Solid' ? 'faceList' : 'visibleEdges'].length; i++) {
      // render the faces
      if (this.renderType.fill !== 'Wireframe [full]') {
        // extract variable to improve readablity
        let face = this.faceList[i];

        // define the color for each face
        !this.isWireframe ? ctx.fillStyle = `rgb(${face.color}, ${face.color}, ${face.color})` : ctx.fillStyle = `rgb(${this.lightIntensity.ambient}, ${this.lightIntensity.ambient}, ${this.lightIntensity.ambient})`;

        // render the model's faces
        ctx.beginPath();
          ctx.moveTo(this.vertexFace(face.face, 'v1', 'x'), this.vertexFace(face.face, 'v1', 'y'));
          for (let p = 0; p < face.vertexPoint.length; p++) {
            ctx.lineTo(this.vertexFace(face.face, face.vertexPoint[p], 'x'), this.vertexFace(face.face, face.vertexPoint[p], 'y'));
          }
        ctx.fill();
      }

      // render the edges of the model
      if (this.isRenderingEdges) {
        let edge; // extract variable to improve readability

        for (let j = 0; j < this.visibleEdges[i].length; j++) {
          // render the wireframe (polygonal)
          if (this.renderType.view === 'Polygonal') {
            // draw the edges
            edge = this.visibleEdges[i][j];
            
            ctx.beginPath();
              ctx.moveTo(this.vertexList[edge[0]].x, this.vertexList[edge[0]].y);
              ctx.lineTo(this.vertexList[edge[1]].x, this.vertexList[edge[1]].y);
            ctx.stroke();
          } else {
            edge = this.rasterizedLineList[i][j];

            // define the color for each line
            this.renderType.fill === 'Solid' ? ctx.fillStyle = `rgb(${edge.color}, ${edge.color}, ${edge.color})` :
            ctx.fillStyle = `rgb(${this.lightIntensity.camera}, ${this.lightIntensity.camera}, ${this.lightIntensity.camera})`;

            // draw the rasterized lines
            for (let k = 0; k < edge.position.length; k++) {
              ctx.fillRect(edge.position[k][0], edge.position[k][1], this.pixelGrid, this.pixelGrid);
            }
          }
        }
      }
    }
  }
}