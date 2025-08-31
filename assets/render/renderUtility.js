// Convert the graph coordinates into screen coordinates
export function mapToPixels(simulator, vertexList) {
  // Transposes it based on the grid size and centers the origin at the middle of the screen
  vertexList.x = vertexList.x * simulator.gridSpacing.spatialCoordinates + simulator.window.x / 2;
  vertexList.y = -vertexList.y * simulator.gridSpacing.spatialCoordinates + simulator.window.y / 2;

  return vertexList;
}

// Applies the weak perspective projection equation to a vertex point
export function WP_projectionEquation(render, vertexList) {
  vertexList.x = render.focalLength * vertexList.x / (render.focalLength - vertexList.z);
  vertexList.y = render.focalLength * vertexList.y / (render.focalLength - vertexList.z);
  vertexList.z = 0;

  return vertexList;
}

export function edgeDeclaration(render) {
  // store edge data & unique keys
  let visibleEdges = [];

  if (render.renderType.fill !== 'Wireframe [full]') {
    let keyRegistry = new Set();
    for (let i = render.faceList.length - 1; i >= 0; i--) {
      // Add sub-arrays corresponding to each face
      visibleEdges.push([]);
      let visibleEdgeList = visibleEdges[visibleEdges.length - 1];

      // return only visible edges from the model
      for (let j = 0; j < render.faceList[i].vertexPoint.length; j++) {
        // constants
        let currentEdge = render.faceEdges[render.faceList[i].face][j];
        let edgeKey = currentEdge.key;

        // Push each edge onto the list (w/o duplicates)
        if (!keyRegistry.has(edgeKey)) {
          keyRegistry.add(edgeKey);
          visibleEdgeList.push(render.renderType.view === 'Polygonal' ? currentEdge.edge : {edge: currentEdge.edge});
        }
      }
    }

    // reverse list as to make sure edges are rendered via back to front
    visibleEdges.reverse();
  } else {
    visibleEdges = render.renderType.view === 'Pixelated' ? 
    render.edgeList.map(i => ([{edge: i}])) : render.edgeList.map(edge => [edge]);
  }

  render.visibleEdges = visibleEdges; // return the visible edges
}

export function deduplicatedLinePos(pixelatedLinePos) {
  // shorthand for calling the line positions
  let lineList = {x: pixelatedLinePos.x, y: pixelatedLinePos.y};

  // select and filter unique line positions
  let keyRegistry = new Set();
  let uniqueLinePos = [];

  for (let i = 0; i < lineList.x.length; i++) {
    let key = `${lineList.x[i]}, ${lineList.y[i]}`; // check if line pos is already declared

    // check if the line position is already declared, if not, then push it onto the list as a unique
    if (!keyRegistry.has(key)) {
      keyRegistry.add(key);
      uniqueLinePos.push([lineList.x[i], lineList.y[i]]);
    }
  }

  return uniqueLinePos; // return the list w/o any duplicates
}


// Multiply two quaternions together
export function quaternionMultiplication(render, q1, q2) {
  let quaternion = {};

  // Get the vector and scalar part
  quaternion.w = q1.w * q2.w - dotProduct(render, q1, q2);
  for(let axis = 0; axis < render.axis.length; axis++) {
    quaternion[render.axis[axis]] = q1.w * q2[render.axis[axis]] + q2.w * q1[render.axis[axis]] + crossProduct(render, q1, q2)[render.axis[axis]];
  }

  return quaternion;
}

// Normalizes a vector
export function normalizeVector(render, vctr) {
  let vector = {...vctr};
  const vectorMagnitude = Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));

  for(let axis = 0; axis < render.axis.length; axis++) {
    vector[render.axis[axis]] /= vectorMagnitude;
  }

  return vector;
}


// Different ways of multiplying vectors together
export function dotProduct(render, vector1, vector2) { // Returns scalar
  let vectorProduct = [];

  // Multiply the vectors axes together then add it all together
  for(let axis = 0; axis < render.axis.length; axis++) {
    vectorProduct.push(vector1[render.axis[axis]] * vector2[render.axis[axis]]);
  }
  return vectorProduct.reduce((a, b) => a + b);
}

export function crossProduct(render, vector1, vector2) { // Returns vector
  // Create a 2x3 matrix from the vectors | Get 3 different matricies for each of the determinants
  let mainMatrix = [Object.values(vector1).slice(-3), Object.values(vector2).slice(-3)];
  let subMatrix = {x: [], y: [], z: []};

  let productVector = {};

  // Get the 3 determinants for each of the different axes of the vector
  for(let axis = 0; axis < render.axis.length; axis++) {
    for(let i = 0; i < 2; i++) {
      subMatrix[render.axis[axis]][i] = mainMatrix[i].toSpliced(axis, 1);
    } 
    productVector[render.axis[axis]] = vectorDeterminant(subMatrix[render.axis[axis]]);
  }

  // Change y to negative since [a x b = i - j + k]
  productVector.y *= -1;
  return productVector;
}


// The transformation area that a vector creates
function vectorDeterminant(matrix) {
  // Multiplies the values inside a 2x2 matrix by the value diagonal to it
  return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
}