import { SourceMappingOptionsMethod } from "@grouparoo/core";
import { sourceModel } from "./model";

import { getSourceMappingOptions } from "../import/mapping";

export const sourceMappingOptions: SourceMappingOptionsMethod =
  async ({ appId, appOptions, source, sourceOptions }) => {
    return getSourceMappingOptions({
      appId,
      appOptions,
      source,
      model: sourceModel(sourceOptions),
    });
  };
