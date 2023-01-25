import { PluginConnection, DestinationSyncMode } from "@grouparoo/core";
import { importRecords } from "./importRecords";

import { sourceOptions } from "./sourceOptions";
import { sourceMappingOptions } from "./sourceMappingOptions";
import { importArrayProperties } from "../import/importArrayProperties";

export const contactsSupportedSyncModes: DestinationSyncMode[] = [
  "sync",
  "additive",
  "enrich",
];

export const contactsSourceConnection: PluginConnection = {
  name: "salesforce-import-contacts",
  displayName: "Salesforce Import Contacts",
  direction: "import",
  description: "Import Records from Salesforce Contacts.",
  apps: ["salesforce"],
  syncModes: contactsSupportedSyncModes,
  options: [
    {
      key: "primaryKey",
      displayName: "Primary Key",
      required: true,
      description: "Which Contact field is used to match Grouparoo records?",
    },
    {
      key: "accountKey",
      displayName: "Account Key",
      required: false,
      description: "What Account field is used to match Grouparoo records?",
    },
  ],
  methods: {
    importRecords,
    sourceOptions,
    sourceMappingOptions,
    importArrayProperties,
  },
};
