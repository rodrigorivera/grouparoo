import {
  ImportedRecord,
  App,
  SimpleAppOptions,
  Source,
  SourceSyncOperations,
  SimpleSourceOptions,
  ErrorWithRecordId,
} from "@grouparoo/core";

export enum BatchGroupMode {
  WithinGroup = "WithinGroup", // update group by group
  TotalMembers = "TotalMembers", // update all groups at once
}

export enum BatchSyncMode {
  // these values actually used in sourceOptions settings
  Sync = "Sync", // create, update, delete (default)
  Enrich = "Enrich", // update only (no create or delete)
  Additive = "Additive", // create or update (no delete)
}

export const BatchSyncModeData = {
  [BatchSyncMode.Sync]: {
    create: true,
    update: true,
    delete: true,
    description: "Sync all records (create, update, delete)",
  },
  [BatchSyncMode.Enrich]: {
    create: false,
    update: true,
    delete: false,
    description: "Only update existing objects (update)",
  },
  [BatchSyncMode.Additive]: {
    create: true,
    update: true,
    delete: false,
    description: "Sync all records, but do not delete (create, update)",
  },
};

export interface BatchImport extends ImportedRecord {
  foreignKeyValue?: string;
  oldForeignKeyValue?: string;
  sourceId?: string;
  addedGroups?: string[];
  removedGroups?: string[];
  shouldCreate?: boolean;
  shouldUpdate?: boolean;
  shouldDelete?: boolean;
  shouldGroups?: boolean;
  skippedMessage?: string;
  result?: any; // result from find
  data?: any; // can stick other things on here
  processed?: boolean;
  error?: any;
}

export declare type ForeignKeyMap = { [value: string]: BatchImport };
export declare type SourceIdMap = { [value: string]: BatchImport };
export declare type GroupNameListMap = { [groupName: string]: BatchImport[] };

export interface BatchConfig {
  batchSize: number; // max number to update, create, delete
  findSize: number; // max query parameters to send to findAndSetSourceIds
  groupMode: BatchGroupMode;
  syncMode?: BatchSyncMode; // New plugins should pass syncOperations instead
  syncOperations?: SourceSyncOperations;
  foreignKey: string;
  connection?: any;
  app?: App;
  appOptions?: SimpleAppOptions;
  source?: Source;
  sourceOptions?: SimpleSourceOptions;
  data?: any; // set any object you want on here
}

export interface BuildBatchImportMethod {
  (imports: ImportedRecord[]): BatchImport[];
}

export interface RecordBatchRecordsPluginMethod {
  (
    imports: BatchImport[],
    config: BatchConfig,
    methods: BatchMethods
  ): Promise<{
    success: boolean;
    retryDelay?: number;
    errors?: ErrorWithRecordId[];
  }>;
}

export interface ImportBatchRecordsPluginMethod {
  (
    imports: BatchImport[],
    config: BatchConfig,
    methods: BatchMethods
  ): Promise<{
    success: boolean;
    retryDelay?: number;
    errors?: ErrorWithRecordId[];
  }>;
}

export interface GetForeignKeyMapMethod {
  (key: string): BatchImport;
}

export interface BatchMethodGetClient {
  // return an object that you can connect with
  (argument: { config: BatchConfig }): Promise<any>;
}

export interface BatchMethodFindAndSetSourceIds {
  // fetch using the keys to set sourceId and result on BatchImports
  // use the getByForeignKey to lookup results
  (argument: {
    client: any;
    users: BatchImport[];
    foreignKeys: string[]; // has newValue and oldValue of foreignKey
    getByForeignKey: GetForeignKeyMapMethod;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodDeleteBySourceIds {
  // delete the given sourceIds
  (argument: {
    client: any;
    users: BatchImport[];
    sourceIdMap: SourceIdMap;
    getByForeignKey: GetForeignKeyMapMethod;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodUpdateBySourceIds {
  // update these users by sourceId
  (argument: {
    client: any;
    users: BatchImport[];
    sourceIdMap: SourceIdMap;
    getByForeignKey: GetForeignKeyMapMethod;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodCreateByForeignKeyAndSetSourceIds {
  // usually this is creating them. ideally upsert. set the sourceId on each when done
  (argument: {
    client: any;
    users: BatchImport[];
    getByForeignKey: GetForeignKeyMapMethod;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodAddToGroups {
  // make sure these user are in these groups (keys of map are group names)
  (argument: {
    client: any;
    users: BatchImport[];
    groupMap: GroupNameListMap;
    sourceIdMap: SourceIdMap;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodRemoveFromGroups {
  // make sure these users are not in these groups (keys of map are group names)
  (argument: {
    client: any;
    users: BatchImport[];
    groupMap: GroupNameListMap;
    sourceIdMap: SourceIdMap;
    config: BatchConfig;
  }): Promise<void>;
}

export interface BatchMethodNormalizeForeignKeyValue {
  // mess with the keys (lowercase emails, for example)
  (argument: { keyValue: any; config: BatchConfig }): string;
}

export interface BatchMethodNormalizeGroupName {
  // mess with the names of groups (tags with no spaces, for example)
  (argument: { groupName: string; config: BatchConfig }): string;
}

export interface BatchMethods {
  getClient: BatchMethodGetClient;
  findAndSetSourceIds: BatchMethodFindAndSetSourceIds;
  deleteBySourceIds: BatchMethodDeleteBySourceIds;
  updateBySourceIds: BatchMethodUpdateBySourceIds;
  createByForeignKeyAndSetSourceIds: BatchMethodCreateByForeignKeyAndSetSourceIds;
  addToGroups: BatchMethodAddToGroups;
  removeFromGroups: BatchMethodRemoveFromGroups;
  normalizeForeignKeyValue?: BatchMethodNormalizeForeignKeyValue;
  // mess with the names of groups (tags with no spaces, for example)
  normalizeGroupName?: BatchMethodNormalizeGroupName;
}
