import type { CloudMindResourceNames, WranglerMode } from "./options.ts";

export interface DataPackageOperationInput {
  projectRoot: string;
  mode: WranglerMode;
  resources: CloudMindResourceNames;
}

export interface ExportDataPackageInput extends DataPackageOperationInput {
  outputPath: string;
}

export interface RestoreDataPackageInput extends DataPackageOperationInput {
  packagePath: string;
  resume: boolean;
  confirmEmptyTarget: boolean;
}
