import { PluginConnection, DestinationSyncMode } from "@grouparoo/core";
import { importRecords } from "./importRecords";

import { sourceOptions } from "./sourceOptions";
import { sourceMappingOptions } from "./sourceMappingOptions";
import { importArrayProperties } from "../import/importArrayProperties";

export const accountsSupportedSyncModes: DestinationSyncMode[] = [
  "sync",
  "additive",
  "enrich",
];

export const accountsDestinationConnection: PluginConnection = {
  name: "salesforce-import-accounts",
  displayName: "Salesforce Import Accounts",
  direction: "import",
  description: "Import Records to Salesforce Accounts.",
  apps: ["salesforce"],
  syncModes: accountsSupportedSyncModes,
  options: [
    {
      key: "primaryKey",
      displayName: "Primary Key",
      required: true,
      description: "Which Account field is used to match Grouparoo records?",
    },
  ],
  methods: {
    importRecords,
    sourceOptions,
    sourceMappingOptions,
    importArrayProperties,
  },
};
