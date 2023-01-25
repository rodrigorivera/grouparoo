import {
  ImportedRecord,
  App,
  SimpleAppOptions,
  Source,
  SimpleSourceOptions,
  ErrorWithRecordId,
  SourceSyncOperations,
} from "@grouparoo/core";
export { ImportedRecord } from "@grouparoo/core";

export enum GroupSizeMode {
  WithinGroup = "WithinGroup", // update group by group
  TotalMembers = "TotalMembers", // update all groups at once
}

export declare type ForeignKeyMap = { [value: string]: GroupImport };
export declare type GroupNameListMap = { [groupName: string]: GroupImport[] };

export interface GroupConfig {
  batchSize: number; // max number to manipulate groups
  groupMode: GroupSizeMode;
  syncOperations: SourceSyncOperations;
  foreignKey: string;
  connection?: any;
  app?: App;
  appOptions?: SimpleAppOptions;
  source?: Source;
  sourceOptions?: SimpleSourceOptions;
  data?: any; // set any object you want on here
}

export interface GroupMethodGetClient {
  // return an object that you can connect with
  (argument: { config: GroupConfig }): Promise<any>;
}

export interface GroupMethodAddToGroups {
  // make sure these user are in these groups (keys of map are group names)
  (argument: {
    client: any;
    users: GroupImport[];
    groupMap: GroupNameListMap;
    foreignKeyMap: ForeignKeyMap;
    config: GroupConfig;
  }): Promise<void>;
}

export interface GroupMethodRemoveFromGroups {
  // make sure these users are not in these groups (keys of map are group names)
  (argument: {
    client: any;
    users: GroupImport[];
    groupMap: GroupNameListMap;
    foreignKeyMap: ForeignKeyMap;
    config: GroupConfig;
  }): Promise<void>;
}

export interface GroupMethodNormalizeForeignKeyValue {
  // mess with the keys (lowercase emails, for example)
  (argument: { keyValue: any; config: GroupConfig }): string;
}

export interface GroupMethodNormalizeGroupName {
  // mess with the names of groups (tags with no spaces, for example)
  (argument: { groupName: string; config: GroupConfig }): string;
}

export interface GroupMethods {
  getClient: GroupMethodGetClient;
  addToGroups: GroupMethodAddToGroups;
  removeFromGroups: GroupMethodRemoveFromGroups;
  normalizeForeignKeyValue?: GroupMethodNormalizeForeignKeyValue;
  // mess with the names of groups (tags with no spaces, for example)
  normalizeGroupName?: GroupMethodNormalizeGroupName;
}

export interface RecordGroupRecordsPluginMethod {
  (
    exports: ImportedRecord[],
    config: GroupConfig,
    methods: GroupMethods
  ): Promise<{
    success: boolean;
    retryDelay?: number;
    errors?: ErrorWithRecordId[];
  }>;
}

export type GroupImportType = "new" | "old";

export interface GroupImport extends ImportedRecord {
  foreignKeyValue?: string; // could be old or new one
  addedGroups?: string[];
  removedGroups?: string[];
  skippedMessage?: string;
  type?: GroupImportType;
  data?: any; // can stick other things on here
  error?: any;
}
