// import dat.GUI from CSN
import * as dat from 'https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js';

// helper functions for advanced settings
import { modelSelectionBar } from '../modelSettings/processModelRequest.js';

// configuration settings (using dat.GUI)
export default function ConfigurationSettings(sim) {
  // initialize gui
  const gui = new dat.GUI();

  // different folders
  const folder = {
    general: gui.addFolder('General Settings'),
    rotation: gui.addFolder('Model Rotation'),
    render: gui.addFolder('Rendering Style'),
    miscellaneous: gui.addFolder('Miscellaneous'),
    advancedSettings: gui.addFolder('Advanced Settings'),
  };

  // Have all the folders open by default (except advanced settings)
  Object.values(folder).forEach(folder => { folder.open(); });
  folder.advancedSettings.close();

  // placeholder for values that dont belong to any external object
  const placeHolderObj = { modelSelection: 'Move Up', githubLink: () => window.open('https://github.com') };
  placeHolderObj.invokeButton = () => modelSelectionBar(sim, placeHolderObj.modelSelection);


  // general settings
  let model = folder.general.add(sim.polygonMeshRenderer, 'model', sim.models).name('Model').onChange(() => {
    sim.polygonMeshRenderer.updateModelAttributes('model', 0);
  });

  let size = folder.general.add(sim.camera.pos, 'z', sim.modelSize.min, sim.modelSize.max, 1).name('Model Size').onChange(() => {
    sim.polygonMeshRenderer.updateModelAttributes('size', 0);
  });

  let pause = folder.general.add(sim, 'pauseProgram').name('Pause/Unpause');

  // model rotation
  ['x', 'y', 'z'].forEach(axis => {
    folder.rotation.add(sim.polygonMeshRenderer.rotation, axis, -100, 100, 1).name(`${axis.toUpperCase()} Rotation`).onChange(() => {
      sim.polygonMeshRenderer.updateModelAttributes('rotation', 'rotation');
    });
  });

  // model rotation speed
  folder.rotation.add(sim.polygonMeshRenderer, 'rotationSpeed', 0, 10, 1).onChange(() => {
    sim.polygonMeshRenderer.updateModelAttributes('rotation', 'speed');
  });

  // rendering style
  folder.render.add(sim.polygonMeshRenderer.renderType, 'fill', sim.renderingStyle.fill).name('Fill Style');
  folder.render.add(sim.polygonMeshRenderer.renderType, 'view', sim.renderingStyle.view).name('Render Style');

  // loop over each render folder and update the model attribute
  folder.render.__controllers.forEach(controller => {
    controller.onChange(() => sim.polygonMeshRenderer.updateModelAttributes('initEdges?'));
  });

  // miscellaneous
  folder.miscellaneous.add(sim.gridSpacing, 'pixelDisplay', sim.pixelResolution.min, sim.pixelResolution.max, 1).name('Pixel Resolution').onChange(() => {
    sim.polygonMeshRenderer.updateModelAttributes('pixelResolution');
  });

  folder.miscellaneous.add(sim.polygonMeshRenderer, 'lineWidth', 1, sim.pixelResolution.max, 1).name('Line Thickness');

  // advanced settings
  folder.advancedSettings.add(placeHolderObj, 'modelSelection', sim.advancedOptions).name('Advanced Options');
  folder.advancedSettings.add(placeHolderObj, 'invokeButton').name('Run Advanced Option -----------').onChange(() => {
    updateModelList();
  });
  
  folder.advancedSettings.add(placeHolderObj, 'githubLink').name('\u00A0'.repeat(7) + '--------- Github Respository 🌐 ---------');


  // disable keys when changing number values
  document.querySelectorAll('.dg input').forEach(input => {
    input.addEventListener('focus', () => sim.usingGUI = true);
    input.addEventListener('blur', ()  => sim.usingGUI = false);
  });

  // update the modelList in the general folder (helper function)
  function updateModelList() {
    setTimeout(() => {
      // delete all the controller in the general folder
      folder.general.remove(model);
      folder.general.remove(size);
      folder.general.remove(pause);

      // rewrite the controllers so that sim.models is updated properly & at the same position
      model = folder.general.add(sim.polygonMeshRenderer, 'model', [...sim.models]).name('Model').onChange(() => {
        sim.polygonMeshRenderer.updateModelAttributes('model', 0);
      });
      size = folder.general.add(sim.camera.pos, 'z', sim.modelSize.min, sim.modelSize.max, 1).name('Model Size').onChange(() => {
        sim.polygonMeshRenderer.updateModelAttributes('size', 0);
      });
      pause = folder.general.add(sim, 'pauseProgram').name('Pause/Unpause');
    }, 0);
  }

  return gui;
}

/*
FUTURE ADDITIONS-----
 - Add advanced settings
 - Support custom blender models

 - Make torus less computationally expensive

 - Add to github
 - Add a readme

 - rewrite all the names of these thing
 - add more comments
*/

/*
link to github page
  - Description
  - Source code
  - Google document describing the rendering pipeline
place to import custom blender models
1 - 2 more things here

So basically for the model support, I will have a dropdown, which includes (move up, move down, delete), then I will have a button that will confirm this action, tnen for delete, fi you try and delete a pre-existing one, it will not let you, but if you try and delete one you created, it will confirm with you if you actually want to delete it, if so, then it will delete it
Then somehow I will try and save all of this to local storage
*/