import { getSalesforceModel, SalesforceModel } from "../export/model";
import { SimpleSourceOptions } from "@grouparoo/core";

export function sourceModel(
  sourceOptions: SimpleSourceOptions
): SalesforceModel {
  return getSalesforceModel(sourceOptions);
}
