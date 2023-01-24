import {
  SourceOptionsMethodResponse,
  SimpleAppOptions,
  SimpleSourceOptions,
} from "@grouparoo/core";
import { connect } from "../connect";
import { getSupportedSalesforceTypes } from "../import/mapping";
import { getObjectMatchNames } from "../import-objects/options";
import { SalesforceCacheData } from "../objects";

export interface fieldsOptions {
  fieldName: string;
  fieldValue: string;
  specialFields: string[];
}
interface SalesforceSourceOptions {
  (argument: {
    appId: string;
    appOptions: SimpleAppOptions;
    sourceOptions: SimpleSourceOptions;
    fieldsOptions: fieldsOptions[];
  }): Promise<SourceOptionsMethodResponse>;
}
export const getSourceOptions: SalesforceSourceOptions = async ({
  appId,
  appOptions,
  sourceOptions,
  fieldsOptions,
}) => {
  const cacheData: SalesforceCacheData = { appId, appOptions };
  const out: SourceOptionsMethodResponse = {};
  const conn = await connect(appOptions);
  for (const fieldOption of fieldsOptions) {
    const options = await getOptions(
      conn,
      cacheData,
      sourceOptions,
      fieldOption.fieldName,
      fieldOption.fieldValue,
      fieldOption.specialFields
    );
    Object.assign(out, options);
  }
  return out;
};

async function getOptions(
  conn: any,
  cacheData: SalesforceCacheData,
  sourceOptions: SimpleSourceOptions,
  fieldName: string,
  fieldValue: string,
  specialFields: string[]
) {
  const out: SourceOptionsMethodResponse = {
    [fieldName]: { type: "list", options: [] },
  };
  const supportedTypes = getSupportedSalesforceTypes();
  const refFields = await getObjectMatchNames(
    conn,
    cacheData,
    fieldValue,
    true,
    specialFields,
    supportedTypes
  );
  out[fieldName].options = refFields;
  if (!refFields.includes(sourceOptions[fieldName])) {
    sourceOptions[fieldName] = null;
  }
  return out;
}
