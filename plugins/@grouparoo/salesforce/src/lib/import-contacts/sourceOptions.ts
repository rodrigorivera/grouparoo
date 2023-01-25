import { getSourceOptions } from "../import/options";
import { SourceOptionsMethod } from "@grouparoo/core";

export const sourceOptions: SourceOptionsMethod = async ({
  appId,
  appOptions,
  destinationOptions: sourceOptions,
}) => {
  return getSourceOptions({
    appId,
    appOptions,
    sourceOptions,
    fieldsOptions: [
      {
        fieldName: "primaryKey",
        fieldValue: "Contact",
        specialFields: ["Email"],
      },
      {
        fieldName: "accountKey",
        fieldValue: "Account",
        specialFields: ["AccountNumber", "Name"],
      },
    ],
  });
};
