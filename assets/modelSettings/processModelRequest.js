 import { readWrite_data, saveModelSettings } from "../modelSettings/dataStore.js";
 import { polygonMesh } from "../render/polygonMeshData.js";
 import { updateModelList } from "../simulatorItems/configurationScreen.js";

export function modelSelectionBar(sim, type) {
  // helper variables
  let model = sim.polygonMeshRenderer.model;
  let index = sim.models.indexOf(model);

  switch (type) {
    case 'Move Up':
    case 'Move Down':
        // find the new position the model should be at considering which way we shift the array
        let newIndexPosition = type === 'Move Up' ? (index + 1) % sim.models.length: index - 1;
        if (newIndexPosition === -1) newIndexPosition = sim.models.length - 1;
        
        // take out the model at the current index and insert it at the new index position
        sim.models.splice(index, 1);
        sim.models.splice(newIndexPosition, 0, model);

        // save the updated model list
        saveModelSettings('write', sim);
      break;
    case 'Add':
        // open file manager
        let input = document.getElementById('selectFile');
        input.click();

        input.addEventListener("change", () => {
          if (input.files.length > 0) {
            // find the file
            const reader = new FileReader();
            const file = input.files[0];

            // read the file
            reader.readAsText(file);

            reader.onload = (event) => {
              const fileData = event.target.result;

              // remove file type suffix
              let staticFileName = file.name.slice(0, file.name.length - 4)
              let fileName = staticFileName;

              // check if the file type is an obj, if it isnt, alert, if it is, proceed.
              if (!file.name.toLowerCase().endsWith('.obj')) {
                alert('This file type is incompatible with the renderer \n Please try and import a .OBJ file');
                return;
              } else {
                // add a leading number if the model name already exists
                let numberSuffix = 1;
                while (sim.models.includes(fileName)) {
                  numberSuffix++;
                  fileName = staticFileName + numberSuffix;
                }

                // append the model to the database
                readWrite_data('write', fileName, fileData).then(() => {
                  // adds it to polygonMeshData and appends it to the modelList
                  processImportedModelData(sim, fileName, true);
                });
              }
            };
          }

          // reset the input value (so that the file change event is cleared and doesnt stack causing issues)
          input.value = '';
        });
      break;
    case 'Delete':
        // check if he model is imported, if so, then ask if the user wants to delete it
        if (!sim.presetModels.includes(model)) {
          let deleteModel = confirm('Are you sure you want to delete this model? \n This action cannot be undone');

          // delete the model if user confirms
          if (deleteModel) {
            let prevModel = Math.max(index - 1, 0);

            // delete the model from the modelList
            sim.models.splice(index, 1);

            // update the model list save data
            saveModelSettings('write', sim);

            // update the renderer
            sim.polygonMeshRenderer.updateModelAttributes('model', sim.models[prevModel]);

            //delete the model from polygonMeshData
            delete polygonMesh[model];

            // delete the model from the database
            readWrite_data('delete', model).then(() => {
              // update the gui display
              updateModelList(sim);
            });
          }
        } else {
          // alert the user that they cannot delete a pre-existing model
          alert('You cannot delete this Model, \n Please try and delete an imported Model.');
        }
      break;
    case 'Rename':
        // new model name
        let newName = prompt('Enter new Model name here: ');
        let checkName = newName !== null;

        // throw an error if the user tries to rename a preset model
        if (sim.presetModels.includes(model) && checkName) {
          alert('Model name can only be edited for imported models \n Please try and rename an imported model');

        // throw an error if the user tries to rename the model to the same name
        } else if (newName === model && checkName) {
          alert('New model name cant be the same as previous name \n Please try and choose a different name');
          modelSelectionBar(sim, 'Rename');

        // throw and error if the name already exists for another model
        } else if (sim.models.includes(newName) && checkName) {
          alert('Model name already exists \n Please try and choose a different name');
          modelSelectionBar(sim, 'Rename');

        // throw an error if the user doesnt input anything
        } else if (newName.length === 0 && checkName) {
          alert('Please provide a name for the specificed model');
          modelSelectionBar(sim, 'Rename');

        // update and change the model name
        } else if (checkName) {
          // update the name in modelList
          sim.models[index] = newName;
          saveModelSettings('write', sim);

          // update the name in polygonMesh
          polygonMesh[newName] = polygonMesh[model];
          delete polygonMesh[model]; 

          // update the new name in the model's database
          renameModelDB(model, newName);

          // update the renderer
          sim.polygonMeshRenderer.updateModelAttributes('model', newName);

          // update the gui display
          updateModelList(sim);
        }
      break;
  }
}

export async function processImportedModelData(sim, fileName, updateRenderer) {
  // the polygonMeshData for the model that is to be parsed
  let objectData = {
    vertex: [],
    normal: [],
    face: [],
  };

  // gets the model data
  let fileData = await readWrite_data('read', fileName);

  // makes sure the model data defined, if not, exit function
  if (typeof fileData !== 'object') return;

  let rawModelData = fileData.modelData.split('\n');

  // face normals get reused so we put it in a seperate list and call them by the index stated by the faces
  let normalList = [];

  let incompleteDataAlert = (type) => {
    type === 1 ?
    alert('Sorry, but some of the file data seems to be missing or incomplete. \n Please check the file and try again') :
    alert('Sorry, but some of the file data seems to be missing or incomplete. \n Please try and import a model that includes face normals');
  };

  // parse the vertex, normal, and face data into the model obj
  for (let i = 0; i < rawModelData.length; i++) {
    // loop thorugh each line in the model data
    let entry = rawModelData[i].trim();

    if (entry.startsWith('v ') || entry.startsWith('vn ')) {
      // get the vertex and normal data
      let [o, a, b, c] = entry.split(' ').map(Number);

      // exit early if data is not defined/numerical
      if ([a, b, c].some(num => isNaN(num))) {
        incompleteDataAlert(1);

        // delete from database and exit
        await readWrite_data('delete', fileName);
        return;
      }

      // push the vertex and normal data into their respective arrays
      entry[1] === ' ' ? objectData.vertex.push({x: a, y: b, z: c}) : normalList.push({x: a, y: b, z: c});
    } else if (entry.startsWith('f ')) {
      // exit early if face normals are not defined
      if (normalList.length === 0) {
        incompleteDataAlert(2);

        // delete from database and exit
        await readWrite_data('delete', fileName);
        return;
      }

      // find the vertex and face indexes defined by the data in the face entries
      entry = entry.slice(2, entry.length).split(' ');
      let currentVertexLine = entry.map(j => j.split('/')[0]).map(Number);
      let currentNormalIndex = Number(entry[0].split('/')[2]);

      // exit early if data is not defined/numerical
      if (currentVertexLine.some(n => isNaN(n)) || isNaN(currentNormalIndex)) {
        incompleteDataAlert(1);

        // delete from database and exit
        await readWrite_data('delete', fileName);
        return;
      }

      // define the model faces
      let faceData = {};
      for (let j = 0; j < currentVertexLine.length; j++) {
        faceData[`v${j + 1}`] = currentVertexLine[j] - 1;
      }
      objectData.face.push(faceData);

      // append the face normals to the model object
      objectData.normal.push(normalList[currentNormalIndex - 1]);

    }
  }

  // add it to polygonMeshData (eg. where the model data is stored and retreived)
  polygonMesh[fileName] = objectData;
  
  if (updateRenderer) {
    // add it to model list
    sim.models.push(fileName);

    // update the model list save data
    saveModelSettings('write', sim);

    // update the renderer
    sim.polygonMeshRenderer.updateModelAttributes('model', fileName);

    // update the gui display
    updateModelList(sim);
  }
}

async function renameModelDB(oldName, newName) {
  // read old record
  const oldRecord = await readWrite_data('read', oldName);

  // Step 2: Delete the old record
  await readWrite_data('delete', oldName);

  // Step 3: Write a new record with the new name, reusing the old data
  await readWrite_data('write', newName, oldRecord.modelData);
}

/*
Test adding a new model
Test adding a new model with smooth shading
Test adding a model with the same name as a pre-existing model
Test deleting a model (both pre-existing and imported)
Test adding a model
Test program startup with imported models
Test importing a model with missing data
 - Missing face normals
 - Skewed data values

Add a rename function in this file

Make sure we return an alert if there are no face normals
Add error corrections. (fallbacks)
Polish it up
Rename stuff in configMenu
*/

/*
Test error detection and how it looks both in alert and console
Make sure importedModelData is correct
*/


/*
I now want to test the following things

 - Same name imported model {DONE}
 - Smooth shading
 - No face normals
 - Model with missing data

 - Move imported models
 - Delete imported models {DONE}
 - Max data size
 - Max name size
*/


/**

Fixed things:
 - Less expensive torus
 - Saved model dropdown settings
 - Importing correct .obj models
 - Detection of incorrect file type
 - Appearance of model types being shown on model dropdown on first import
 - Model deletion
 - Renaming function
 */

 /*
 BUGS------

 - Make sure that when I change any settings regarding rotation that I make sure that the program is unpaused
 - Whenever moving models, it using hotkeys it sitll stays in its original place plus where it got moved to
 - Can import more than 10 models
 - Some weird stuff going on with the modified imported models
 */

 /*
  - Missing vertex data (some)
  - Missing normal data (some)
  - Missing normal data (all)
  - Missing face data (some)

  -Missing data (all 3, some)
  -Make sure model on startup is the model in the first list

  Note that any modified numerical values dont affect it just the display

  Need to implement jargon so see how renderer handles that (note multiple variatns to see what works and what doesnt work)
 */


  /*
  Thigns I want to have done-
   - Have imported models working correctly
     - Correctly detect when models have messed up data
  
   - Include limits such as character and file size limits
  */