import { getSalesforceModel, SalesforceModel } from "../import/model";
import { SimpleSourceOptions } from "@grouparoo/core";

export function sourceModel(
  sourceOptions: SimpleSourceOptions
): SalesforceModel {
  return getSalesforceModel(sourceOptions, {
    recordObject: "Account",
    recordMatchField: sourceOptions.primaryKey as string,
  });
}
