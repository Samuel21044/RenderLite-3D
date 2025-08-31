// Import
import Simulator from './simulator.js';

// Variables for the simulator
const simulation_window = document.getElementById('simulation_window');
const ctx = simulation_window.getContext("2d");
let simulator = new Simulator();
window.renderer = simulator.polygonMeshRenderer;

// variables for clock
const fps = 60;
let previousFrame = performance.now();


// simulation loop
function programLoop() {
  // Change the simulator dimensions
  simulation_window.width = window.innerWidth;
  simulation_window.height = window.innerHeight;

  // clock
  const currentFrame = performance.now();
  const deltaTime = currentFrame - previousFrame;
  previousFrame = currentFrame;
  const deltaTiming = deltaTime / (1000 / fps);


  // set the simulator transformations
  ctx.scale(simulator.scaleFactor.x, simulator.scaleFactor.y);

  // simulator
  ctx.clearRect(0, 0, simulation_window.width, simulation_window.height);
  simulator.update(deltaTiming);
  simulator.draw(ctx);

  // loop function
  requestAnimationFrame(programLoop);
}
requestAnimationFrame(programLoop);