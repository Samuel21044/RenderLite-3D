export default class Keyboard {
  constructor (simulator) {
    // keyList (RAM)
    this.keyListNames = ['Escape', '`', '=', '-', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'f', 'v', 's', 'r'];
    this.key = {name: '', state: '', edgeTrigger: {state: 'falling', timing: 0}, pressed: false, repeat: false};


    // keydown event listener
    document.addEventListener('keydown', event => {
      if (this.keyListNames.includes(event.key)) {
        this.key.name = event.key;
        this.key.pressed = true;
        this.key.repeat = event.repeat;
      }
    });

    // keyup event listener
    document.addEventListener('keyup', event => {
      if (this.keyListNames.includes(event.key)) this.key.pressed = false;
    });

    // Simulator
    this.sim = simulator;
  }

  keyUpdate() {
    if (this.key.pressed === false && this.key.edgeTrigger.timing <= 0) return;

    // Trigger on the rising/falling edge
    if (this.key.pressed && this.key.edgeTrigger.timing < 2) {
      this.key.edgeTrigger.state = 'rising'; this.key.edgeTrigger.timing++;
    }
    if (!this.key.pressed && this.key.edgeTrigger.timing > 0) {
      this.key.edgeTrigger.state = 'falling'; this.key.edgeTrigger.timing--;
    }

    // Changing the state for each key
    switch (this.key.edgeTrigger.state) {
      case 'rising':
          switch (this.key.edgeTrigger.timing) {
            case 1:
                this.key.state = 'pressed';
              break;
            case 2:
                this.key.state = this.key.repeat ? 'held' : '';
              break;
          }
        break;
      case 'falling':
          switch (this.key.edgeTrigger.timing) {
            case 0:
                this.key.state = '';
              break;
            case 1:
                this.key.state = 'released';
              break;
          }
        break;
    }
  }

  keyFunctions() {
    if (this.key.state === '' || this.sim.usingGUI) return;

    switch (this.key.state) {
      case 'pressed':
          // Cycle through the models
          let keyName = this.key.name === '0' ? 10 : parseInt(this.key.name);
          if (keyName >= 1 && keyName <= this.sim.models.length) {
            this.sim.polygonMeshRenderer.updateModelAttributes('model', this.sim.models[keyName - 1]);
          }

          switch (this.key.name) {
            // Change the rendering style to the next one in the list | Check if the edges need to be initialized (f, v)
            case 'f':
                this.sim.polygonMeshRenderer.updateModelAttributes('renderStyle', 'fill');
                this.sim.polygonMeshRenderer.updateModelAttributes('initEdges?');
              break;
            case 'v':
                this.sim.polygonMeshRenderer.updateModelAttributes('renderStyle', 'view');
                this.sim.polygonMeshRenderer.updateModelAttributes('initEdges?');
              break;
            case 's':
                this.sim.polygonMeshRenderer.updateModelAttributes('stepThruModel');
              break;
            case 'r':
                this.sim.polygonMeshRenderer.updateModelAttributes('resetModel');
              break;
          }
        break;
      case 'released':
          switch (this.key.name) {
            case 'Escape':
                this.sim.configurationSettings.closed ?
                this.sim.configurationSettings.open() : this.sim.configurationSettings.close();
              break;
            case '`':
                this.sim.pauseProgram = !this.sim.pauseProgram;
              break;
            case '=':
                if (this.sim.camera.pos.z < this.sim.modelSize.max) { 
                  this.sim.polygonMeshRenderer.updateModelAttributes('size', 1);
                }
              break;
            case '-':
                if (this.sim.camera.pos.z > this.sim.modelSize.min) {
                  this.sim.polygonMeshRenderer.updateModelAttributes('size', -1);
                }
              break;
          }
        break;
      case 'held':
          switch (this.key.name) {
            case '=':
                if (this.sim.camera.pos.z < this.sim.modelSize.max) { 
                  this.sim.polygonMeshRenderer.updateModelAttributes('size', 1);
                }
              break;
            case '-':
                if (this.sim.camera.pos.z > this.sim.modelSize.min) {
                  this.sim.polygonMeshRenderer.updateModelAttributes('size', -1);
                }
              break;
            case 's':
                this.sim.polygonMeshRenderer.updateModelAttributes('stepThruModel');
              break;
          }
        break;
    }

    // update the GUI controller when a keybind is used
    this.sim.configurationSettings.updateDisplay();
  }
}