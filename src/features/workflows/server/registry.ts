import type { WorkflowType } from "@/features/workflows/model/types";

import { createNoteIngestWorkflowDefinition } from "./note-ingest-workflow";
import { createPdfIngestWorkflowDefinition } from "./pdf-ingest-workflow";
import type { WorkflowDefinition } from "./runtime";
import { createUrlIngestWorkflowDefinition } from "./url-ingest-workflow";

// 这里集中注册 workflow definition，方便 Queue consumer 按类型恢复执行。
export const getWorkflowDefinition = (
  workflowType: WorkflowType
): WorkflowDefinition => {
  switch (workflowType) {
    case "note_ingest_v1":
      return createNoteIngestWorkflowDefinition();
    case "pdf_ingest_v1":
      return createPdfIngestWorkflowDefinition();
    case "url_ingest_v1":
      return createUrlIngestWorkflowDefinition();
    default:
      throw new Error(`Workflow type "${workflowType}" is not registered.`);
  }
};
