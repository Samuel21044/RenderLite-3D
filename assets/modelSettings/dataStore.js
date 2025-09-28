let databaseConnection;

export function createDatabase() {
  // create/define a database
  return new Promise((resolve, reject) => {
    const database = indexedDB.open("modelDatabase", 1);

    database.onupgradeneeded = (event) => {
      databaseConnection = event.target.result;

      // Create an object store for models
      if (!databaseConnection.objectStoreNames.contains("importedModels")) {
        databaseConnection.createObjectStore("importedModels", { keyPath: 'modelName' });
      }
    };

    // assign databaseConnection on success
    database.onsuccess = (event) => {
      databaseConnection = event.target.result;
      resolve(databaseConnection);
    };

    // reject if an error occurs
    database.onerror = (event) => {
      reject(event.target.error);
    };
  }).catch(err => {
    // log the error in console & alert user
    alert(`Sorry, something went wrong with initializing the model database \n Please restart program or delete cookies`);
    console.error(`IndexedDB could not initialize the model database: \n\n IndexDB error: ${err}`);
  });
}

export function readWrite_data(type, modelName, modelData) {
  return new Promise((resolve, reject) => {
    // find the transaction type and database
    const transaction = databaseConnection.transaction("importedModels", "readwrite");
    const storeModel = transaction.objectStore("importedModels");

    // return a promise as a resolve
    let returnData;

    // perform an action (read/write/del) based on what the user inputs
    switch (type) {
      case 'read':
          modelName === 'all' ? returnData = storeModel.getAll() : returnData = storeModel.get(modelName);
        break;
      case 'write':
          // store model metadata + the actual model data
          const modelMetadata = {
            modelName: modelName,
            modelData: modelData,
          };

          // append the model to the database
          returnData = storeModel.put(modelMetadata);
        break;
      case 'delete':
          returnData = storeModel.delete(modelName);
        break;
    }

    // resolve the promise
    returnData.onsuccess = () => {
      resolve(returnData.result);
    }

    // reject if an error occurs
    returnData.onerror = (event) => {
      reject(event.target.error);
    };
  }).catch(err => {
    // log the error in console & alert user
    alert(`Sorry, something went wrong with the following action: ${type} \n Please try again or delete cookies`);
    console.error(`IndexedDB could not perform the following action: ${type} \n\n IndexDB error: ${err}`);
  });
}

// saves the settings (regarding the models) that user edited in the advanced settings folder
export function saveModelSettings(type, sim) {
  // saved model list
  let savedModelList = JSON.parse(localStorage.getItem('modelSettings'));

  switch (type) {
    case 'read':
        // if model settings isnt defined, then define it and return the current model list
        if (!savedModelList) {
          localStorage.setItem('modelSettings', JSON.stringify(sim.models));
          return sim.models;
        }

        // if already defined, read from regular local storage
        return savedModelList;
      break;
    case 'write':
        // write the new updated model list
        localStorage.setItem('modelSettings', JSON.stringify(sim.models));
      break;
  }
}