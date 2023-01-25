import { getSalesforceModel, SalesforceModel } from "../import/model";
import { SimpleSourceOptions } from "@grouparoo/core";

export function sourceModel(
  sourceOptions: SimpleSourceOptions
): SalesforceModel {
  const mapping: { [key: string]: string } = {};
  if (sourceOptions.primaryKey) {
    Object.assign(mapping, {
      recordObject: "Contact",
      recordMatchField: sourceOptions.primaryKey as string,
    });
  }
  if (sourceOptions.accountKey) {
    Object.assign(mapping, {
      recordReferenceField: "AccountId",
      recordReferenceObject: "Account",
      recordReferenceMatchField: sourceOptions.accountKey as string,
    });
  }
  return getSalesforceModel(sourceOptions, mapping);
}
