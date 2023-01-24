import { getSourceOptions } from "./options";
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
    which: {
      record: true,
      reference: true,
      group: true,
      membership: true,
    },
  });
};
