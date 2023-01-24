import { getSourceOptions } from "../export/options";
import { SourceOptionsMethod } from "@grouparoo/core";

export const sourceOptions: SourceOptionsMethod = async ({
  appId,
  appOptions,
  sourceOptions,
}) => {
  return getSourceOptions({
    appId,
    appOptions,
    sourceOptions,
    fieldsOptions: [
      {
        fieldName: "primaryKey",
        fieldValue: "Account",
        specialFields: ["AccountNumber", "Name"],
      },
    ],
  });
};
