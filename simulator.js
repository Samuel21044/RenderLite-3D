// import
import PolygonMeshRenderer from './assets/simulatorItems/renderer.js';
import ConfigurationSettings from './assets/simulatorItems/configurationScreen.js';
import Keyboard from './assets/userInterface/keyInput.js';
import { createDatabase, readWrite_data } from './assets/modelSettings/dataStore.js';
import { processImportedModelData } from './assets/modelSettings/processModelRequest.js';

export default class Simulator {
  constructor() {
    // Simulator setup
    this.simulator = document.getElementById('simulation_window');
    this.window = {x: 1366, y: window.innerHeight - screen.height + 768}; // window width and height dimensions
    this.scaleFactor = {x: null, y: null};
    this.deltaTiming;


    // Scene initialization
    this.backgroundColor = 20;
    this.gridSpacing = {spatialCoordinates: 40, pixelDisplay: 11};

    this.ambientLightIntensity = this.backgroundColor;
    this.camera = {pos: {x: 0, y: 0, z: 15}, lightIntensity: 255 - this.ambientLightIntensity * 2};
    this.modelSize = {min: 1, max: 25};
    this.pixelResolution = {min: 2, max: 20};

    this.pauseProgram = true;
    this.usingGUI = false;


    // Render the specified model
    this.polygonMeshRenderer = new PolygonMeshRenderer(this, 'cube');
    this.models = ['cube', 'pyramid', 'dodecahedron', 'icosahedron', 'torus', 'wideTorus'];
    this.presetModels = [...this.models];

    // different ways of rendering the model
    this.renderingStyle = {
      fill: ['Solid', 'Wireframe [full]', 'Wireframe [cull]'],
      view: ['Polygonal', 'Pixelated'],
    };

    // different advanced options
    this.advancedOptions = ['Move Up', 'Move Down', 'Add', 'Delete', 'Rename'];


    // user interface (Configuration screen)
    this.keyboard = new Keyboard(this);

    // Config settings
    this.configurationSettings = ConfigurationSettings(this);

    // call the database
    this.addImportedModels();
  }
  
  // load the user's imported models
  async addImportedModels() {
    // make sure database is initialized / created
    await createDatabase();

    // get the models
    let models = await readWrite_data('read', 'all');

    // process the imported models and add them to the model list
    for (let i = 0; i < models.length; i++) {
      processImportedModelData(this, models[i].modelName);
    }
  }

  update(dt) {
    // sim-setup
    if (this.window.y !== window.innerHeight - screen.height + 768) {
      this.window.y = window.innerHeight - screen.height + 768;

      // Center model when user enters/exit fullscreen mode
      this.polygonMeshRenderer.updateModelAttributes('centerModel');
    }
    this.scaleFactor.x = window.innerWidth / this.window.x; this.scaleFactor.y = window.innerHeight / this.window.y;
    this.deltaTiming = dt;


    // update the keyboard
    this.keyboard.keyUpdate();
    this.keyboard.keyFunctions();

    // // Update the renderer
    if (!this.pauseProgram) this.polygonMeshRenderer.render(this.deltaTiming);
  }

  draw(ctx)  {
    // background
    ctx.fillStyle = `rgb(${this.backgroundColor}, ${this.backgroundColor}, ${this.backgroundColor})`;
    ctx.fillRect(0, 0, this.window.x, this.window.y);

    // Displaying the rendered model
    this.polygonMeshRenderer.draw(ctx);
  }
}