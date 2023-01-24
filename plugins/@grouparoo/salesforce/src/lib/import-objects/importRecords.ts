import {
  buildBatchImports,
  BatchImport,
} from "@grouparoo/app-templates/dist/source/batch";
import { importSalesforceBatch } from "../import/salesforceImporter";
import { sourceModel } from "./model";
import {
  ImportRecordsPluginMethod,
  ErrorWithRecordId,
  SimpleAppOptions,
  SimpleDestinationOptions,
  DestinationSyncOperations,
} from "@grouparoo/core";

export interface MyBatchMethod {
  (argument: {
    appId: string;
    appOptions: SimpleAppOptions;
    sourceOptions: SimpleDestinationOptions;
    syncOperations: DestinationSyncOperations;
    imports: BatchImport[];
  }): Promise<{
    success: boolean;
    retryDelay?: number;
    errors?: ErrorWithRecordId[];
  }>;
}

export const importBatch: MyBatchMethod = async ({
  appId,
  appOptions,
  sourceOptions,
  syncOperations,
  imports,
}) => {
  return importSalesforceBatch({
    appId,
    appOptions,
    sourceOptions,
    imports,
    syncOperations,
    model: sourceModel(sourceOptions),
  });
};

export const importRecords: ImportRecordsPluginMethod = async ({
  appId,
  appOptions,
  sourceOptions,
  syncOperations,
  imports: recordsToImport,
}) => {
  const batchImports = buildBatchImports(recordsToImport);
  return importBatch({
    appId,
    appOptions,
    sourceOptions,
    syncOperations,
    imports: batchImports,
  });
};
