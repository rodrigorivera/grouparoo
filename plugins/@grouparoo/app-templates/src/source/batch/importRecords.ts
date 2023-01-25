import { Errors } from "@grouparoo/core";
import { BatchSyncModeData } from "./types";
import { setGroupNames, checkErrors } from "../shared/batch";
import {
  BatchGroupMode,
  BatchImport,
  BuildBatchImportMethod,
  RecordBatchRecordsPluginMethod,
  ImportBatchRecordsPluginMethod,
  BatchMethods,
  BatchConfig,
  GroupNameListMap,
  SourceIdMap,
  ForeignKeyMap,
  GetForeignKeyMapMethod,
} from "./types";

export const buildBatchImports: BuildBatchImportMethod = (imports) => {
  const batchImports: BatchImport[] = [];
  for (const importedRecord of imports) {
    const info: BatchImport = Object.assign({}, importedRecord);
    batchImports.push(info);
  }
  return batchImports;
};

export const importRecordsInBatch: RecordBatchRecordsPluginMethod = async (
  imports,
  config,
  methods
) => {
  return importOneBatch(imports, config, methods);
};

const importOneBatch: ImportBatchRecordsPluginMethod = async (
  imports,
  config,
  methods
) => {
  if (imports.length === 0) {
    return { success: true };
  }

  const client = config.connection || (await methods.getClient({ config }));

  for (const importedRecord of imports) {
    try {
      setGroupNames(importedRecord, methods, config);
      assignForeignKeys(importedRecord, methods, config);
    } catch (error) {
      // if just one of them is missing foreign key or something, move on
      importedRecord.error = error;
    }
  }

  // If oldFK != newFK, look them up by old FK first...
  await lookupSourceIds(client, imports, methods, config, "old");
  // Then override the FK with newFK if it also exists in the source...
  // Note: If newFK does not exist, the oldFK will be used
  await lookupSourceIds(client, imports, methods, config, "new");

  assignActions(imports, config);

  await deleteImports(client, imports, methods, config);
  await updateByIds(client, imports, methods, config);
  await createByForeignKey(client, imports, methods, config);

  verifyAllProcessed(imports);

  // so now, all the imports that don't have an error and where not deleted should have a sourceId
  // use those ids to update the groups
  await updateGroups(client, imports, methods, config);

  return checkErrors(imports);
};

function verifyAllProcessed(imports: BatchImport[]) {
  for (const importedRecord of imports) {
    try {
      verifyProcessed(importedRecord);
    } catch (error) {
      importedRecord.error = error;
    }
  }
}

function verifyProcessed(importedRecord: BatchImport) {
  const {
    recordId,
    sourceId,
    processed,
    error,
    shouldCreate,
    shouldUpdate,
    shouldDelete,
  } = importedRecord;

  let needProcessed = false;
  let needSourceId = false;

  if (error) {
    return;
  }

  if (shouldCreate || shouldUpdate) {
    needProcessed = true;
    needSourceId = true;
  }
  if (shouldDelete) {
    needProcessed = true;
  }

  if (needProcessed && !processed) {
    throw new Error(
      `record (${recordId}) has not processed: ${importedRecord.foreignKeyValue}`
    );
  }

  if (needSourceId && !sourceId) {
    throw new Error(
      `record (${recordId}) does not have a source id: ${importedRecord.foreignKeyValue}`
    );
  }
}

async function updateGroups(
  client,
  imports: BatchImport[],
  methods: BatchMethods,
  config: BatchConfig
) {
  const removal: GroupNameListMap = {};
  const addition: GroupNameListMap = {};

  for (const importedRecord of imports) {
    if (importedRecord.error) {
      continue;
    }
    if (!importedRecord.shouldGroups) {
      continue;
    }
    if (!importedRecord.sourceId) {
      continue;
    }

    // build up groups situation of group names to addition and removal
    for (const list of importedRecord.removedGroups) {
      removal[list] = removal[list] || [];
      removal[list].push(importedRecord);
    }
    for (const list of importedRecord.addedGroups) {
      addition[list] = addition[list] || [];
      addition[list].push(importedRecord);
    }
  }

  if (Object.keys(removal).length > 0) {
    await batchGroups(client, GroupAction.Remove, removal, methods, config);
  }

  if (Object.keys(addition).length > 0) {
    await batchGroups(client, GroupAction.Add, addition, methods, config);
  }
}

enum GroupAction {
  Add = "ADD",
  Remove = "REMOVE",
}
async function batchGroups(
  client: any,
  action: GroupAction,
  groupMap: GroupNameListMap,
  methods: BatchMethods,
  config: BatchConfig
) {
  let currentGroupMap: GroupNameListMap = {};
  let currentDeskIdMap: SourceIdMap = {};
  let currentCount = 0;
  let hasData = false;

  const batches: {
    groupMap: GroupNameListMap;
    sourceIdMap: SourceIdMap;
  }[] = [];

  for (const name in groupMap) {
    if (config.groupMode === BatchGroupMode.WithinGroup) {
      // the count is per group
      currentCount = 0;
    }
    const users = groupMap[name] || [];
    for (const user of users) {
      if (currentCount >= config.batchSize) {
        batches.push({
          groupMap: currentGroupMap,
          sourceIdMap: currentDeskIdMap,
        });
        currentGroupMap = {};
        currentDeskIdMap = {};
        currentCount = 0;
        hasData = false;
      }

      currentGroupMap[name] = currentGroupMap[name] || [];
      currentGroupMap[name].push(user);
      currentDeskIdMap[user.sourceId] = user;
      currentCount++;
      hasData = true;
    }
  }

  if (hasData) {
    batches.push({
      groupMap: currentGroupMap,
      sourceIdMap: currentDeskIdMap,
    });
  }

  for (const { groupMap, sourceIdMap } of batches) {
    if (action === GroupAction.Add) {
      await methods.addToGroups({
        client,
        users: Object.values(sourceIdMap),
        groupMap,
        sourceIdMap,
        config,
      });
    } else if (action === GroupAction.Remove) {
      await methods.removeFromGroups({
        client,
        users: Object.values(sourceIdMap),
        groupMap,
        sourceIdMap,
        config,
      });
    } else {
      throw new Error(`Unknown GroupAction: ${action}`);
    }
  }
}

async function createByForeignKey(
  client,
  imports: BatchImport[],
  methods: BatchMethods,
  config: BatchConfig
) {
  const batches: { fkMap: ForeignKeyMap }[] = [];
  let currentFkMap: ForeignKeyMap = {};
  let currentCount = 0;

  for (const importedRecord of imports) {
    if (importedRecord.processed || importedRecord.error) {
      continue;
    }
    if (!importedRecord.shouldCreate) {
      continue;
    }
    if (!importedRecord.foreignKeyValue) {
      throw new Error(`cannot create without foreignKeyValue`);
    }

    if (currentCount >= config.batchSize) {
      batches.push({ fkMap: currentFkMap });
      currentFkMap = {};
      currentCount = 0;
    }

    setForeignKey(currentFkMap, importedRecord.foreignKeyValue, importedRecord);
    currentCount++;
  }

  if (currentCount > 0) {
    batches.push({ fkMap: currentFkMap });
  }

  for (const { fkMap } of batches) {
    const users = Object.values(fkMap);
    const getByForeignKey = functionToGetForeignKey(fkMap, methods, config);

    await methods.createByForeignKeyAndSetSourceIds({
      client,
      users,
      getByForeignKey,
      config,
    });

    for (const user of users) {
      user.processed = true;
    }
  }
}

async function updateByIds(
  client: any,
  imports: BatchImport[],
  methods: BatchMethods,
  config: BatchConfig
) {
  let currentFkMap: ForeignKeyMap = {};
  let currentDeskIdMap: SourceIdMap = {};
  let currentCount = 0;

  const batches: {
    fkMap: ForeignKeyMap;
    sourceIdMap: SourceIdMap;
  }[] = [];

  for (const importedRecord of imports) {
    if (importedRecord.processed || importedRecord.error) {
      continue;
    }
    if (!importedRecord.shouldUpdate) {
      continue;
    }
    if (!importedRecord.sourceId) {
      throw new Error(
        `cannot update without sourceId: ${importedRecord.foreignKeyValue} for record ${importedRecord.recordId}`
      );
    }

    if (currentCount >= config.batchSize) {
      batches.push({ fkMap: currentFkMap, sourceIdMap: currentDeskIdMap });
      currentCount = 0;
      currentFkMap = {};
      currentDeskIdMap = {};
    }

    setForeignKey(currentFkMap, importedRecord.foreignKeyValue, importedRecord);
    currentDeskIdMap[importedRecord.sourceId] = importedRecord;
    currentCount++;
  }

  if (currentCount > 0) {
    batches.push({ fkMap: currentFkMap, sourceIdMap: currentDeskIdMap });
  }

  for (const { fkMap, sourceIdMap } of batches) {
    const users = Object.values(sourceIdMap);
    const getByForeignKey = functionToGetForeignKey(fkMap, methods, config);

    await methods.updateBySourceIds({
      client,
      users,
      sourceIdMap,
      getByForeignKey,
      config,
    });

    for (const user of users) {
      user.processed = true;
    }
  }
}

async function deleteImports(
  client,
  imports: BatchImport[],
  methods: BatchMethods,
  config: BatchConfig
) {
  let currentFkMap: ForeignKeyMap = {};
  let currentDeskIdMap: SourceIdMap = {};
  let currentCount = 0;

  const batches: {
    fkMap: ForeignKeyMap;
    sourceIdMap: SourceIdMap;
  }[] = [];

  for (const importedRecord of imports) {
    if (importedRecord.processed || importedRecord.error) {
      continue;
    }
    if (!importedRecord.shouldDelete) {
      continue;
    }
    if (!importedRecord.sourceId) {
      // if trying to delete someone that doesn't exist, just inform the user
      try {
        throw new Errors.InfoError(
          `sourceId not found to delete: ${importedRecord.foreignKeyValue}`
        );
      } catch (error) {
        importedRecord.error = error;
      }
      continue;
    }

    if (currentCount >= config.batchSize) {
      batches.push({ fkMap: currentFkMap, sourceIdMap: currentDeskIdMap });
      currentFkMap = {};
      currentDeskIdMap = {};
      currentCount = 0;
    }

    setForeignKey(currentFkMap, importedRecord.foreignKeyValue, importedRecord);
    currentDeskIdMap[importedRecord.sourceId] = importedRecord;
    currentCount++;
  }

  if (currentCount > 0) {
    batches.push({ fkMap: currentFkMap, sourceIdMap: currentDeskIdMap });
  }

  for (const { fkMap, sourceIdMap } of batches) {
    const users = Object.values(sourceIdMap);
    const getByForeignKey = functionToGetForeignKey(fkMap, methods, config);

    await methods.deleteBySourceIds({
      client,
      users,
      sourceIdMap,
      getByForeignKey,
      config,
    });

    for (const user of users) {
      user.processed = true;
    }
  }
}

async function lookupSourceIds(
  client: any,
  imports: BatchImport[],
  methods: BatchMethods,
  config: BatchConfig,
  fkType: "old" | "new"
) {
  let currentFkMap: ForeignKeyMap = {};
  let currentUsers: BatchImport[] = [];
  let currentForeignKeys: string[] = [];
  let currentCount = 0;

  const batches: {
    fkMap: ForeignKeyMap;
    users: BatchImport[];
    foreignKeys: string[];
  }[] = [];

  for (const importedRecord of imports) {
    if (importedRecord.error) {
      continue;
    }

    let foreignKeyValue: string;
    switch (fkType) {
      case "new":
        foreignKeyValue = importedRecord.foreignKeyValue;
        break;
      case "old":
        foreignKeyValue = importedRecord.oldForeignKeyValue;
        break;
      default:
        throw new Error(`Unknown foreign key type: ${fkType}`);
    }

    if (!foreignKeyValue) continue;

    if (currentCount >= config.findSize) {
      batches.push({
        fkMap: currentFkMap,
        users: currentUsers,
        foreignKeys: currentForeignKeys,
      });
      currentFkMap = {};
      currentUsers = [];
      currentForeignKeys = [];
      currentCount = 0;
    }

    currentUsers.push(importedRecord);
    setForeignKey(currentFkMap, foreignKeyValue, importedRecord);
    currentForeignKeys.push(foreignKeyValue);
    currentCount++;
  }

  if (currentCount > 0) {
    batches.push({
      fkMap: currentFkMap,
      users: currentUsers,
      foreignKeys: currentForeignKeys,
    });
  }

  for (const { fkMap, users, foreignKeys } of batches) {
    const getByForeignKey = functionToGetForeignKey(fkMap, methods, config);
    await methods.findAndSetSourceIds({
      client,
      users,
      foreignKeys,
      getByForeignKey,
      config,
    });
  }
}

function fixupKey(key: string): string {
  key = (key || "").toString().trim().toLowerCase();
  if (key.length === 0) {
    throw new Error(`blank key given`);
  }
  return key;
}
function setForeignKey(fkMap: ForeignKeyMap, key: string, value: BatchImport) {
  key = fixupKey(key);
  fkMap[key] = value;
}
function functionToGetForeignKey(
  fkMap: ForeignKeyMap,
  methods: BatchMethods,
  config: BatchConfig
): GetForeignKeyMapMethod {
  const func: GetForeignKeyMapMethod = function (key) {
    if (methods.normalizeForeignKeyValue) {
      key = methods.normalizeForeignKeyValue({ keyValue: key, config });
    }
    key = fixupKey(key);
    return fkMap[key];
  };
  return func;
}

function assignForeignKeys(
  importedRecord: BatchImport,
  methods: BatchMethods,
  config: BatchConfig
) {
  const { oldRecordProperties, newRecordProperties } = importedRecord;

  const { foreignKey } = config;
  let newValue = newRecordProperties[foreignKey];
  let oldValue = oldRecordProperties[foreignKey];
  if (!newValue) {
    throw new Error(`newRecordProperties[${foreignKey}] is a required mapping`);
  }
  if (methods.normalizeForeignKeyValue) {
    newValue = methods.normalizeForeignKeyValue({
      keyValue: newValue,
      config,
    });
    if (oldValue) {
      oldValue = methods.normalizeForeignKeyValue({
        keyValue: oldValue,
        config,
      });
    }
  }
  if (!newValue || newValue.toString().length === 0) {
    throw new Error(`${foreignKey} normalized to no value`);
  }

  newValue = newValue.toString();
  importedRecord.foreignKeyValue = newValue;

  // record other one if applicable
  if (oldValue) {
    oldValue = oldValue.toString();
    if (newValue !== oldValue && oldValue.length > 0) {
      importedRecord.oldForeignKeyValue = oldValue;
    }
  }

  return importedRecord;
}

function assignActions(imports: BatchImport[], config: BatchConfig) {
  for (const importedRecord of imports) {
    assignAction(importedRecord, config);
  }
}

function assignAction(importedRecord: BatchImport, config: BatchConfig) {
  const { toDelete, sourceId } = importedRecord;
  const { syncMode, syncOperations } = config;

  const mode = syncOperations || BatchSyncModeData[syncMode];
  if (!mode) {
    throw new Error("Unknown sync mode.");
  }

  let skippedMessage = null;

  // all shouldX are falsy to start with

  if (toDelete) {
    // semantic: delete
    if (mode.delete) {
      importedRecord.shouldDelete = true;
    } else {
      // just remove the groups
      importedRecord.shouldGroups = true;
      if (sourceId) {
        skippedMessage =
          "Source not deleting. Removing record from groups.";
      } else {
        skippedMessage =
          "Source not deleting, though record was not found.";
      }
    }
  } else if (sourceId) {
    // semantic: update
    if (mode.update) {
      importedRecord.shouldUpdate = true;
      importedRecord.shouldGroups = true;
    } else {
      skippedMessage = "Source not updating. No changes made.";
    }
  } else {
    // semantic: create
    if (mode.create) {
      importedRecord.shouldCreate = true;
      importedRecord.shouldGroups = true;
    } else {
      skippedMessage = "Source not creating. No changes made.";
    }
  }

  importedRecord.skippedMessage = skippedMessage;
}
