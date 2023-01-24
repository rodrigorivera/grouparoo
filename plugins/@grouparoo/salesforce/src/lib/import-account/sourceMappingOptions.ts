import { SourceMappingOptionsMethod } from "@grouparoo/core";
import { sourceModel } from "./model";

import { getSourceMappingOptions } from "../source/mapping";

export const destinationMappingOptions: SourceMappingOptionsMethod =
  async ({ appId, appOptions, source, sourceOptions }) => {
    return getSourceMappingOptions({
      appId,
      appOptions,
      source,
      model: sourceModel(sourceOptions),
    });
  };
