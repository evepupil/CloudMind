export type MemoryLifecycleErrorCode =
  | "NOT_MEMORY"
  | "SCOPE_MISMATCH"
  | "CONTEXT_MISMATCH"
  | "NOT_CURRENT"
  | "UPDATE_PENDING"
  | "NOT_READY"
  | "NOT_DELETED"
  | "PURGE_CONFIRMATION_MISMATCH"
  | "PURGE_PENDING";

export class MemoryLifecycleError extends Error {
  public readonly code: MemoryLifecycleErrorCode;

  public constructor(code: MemoryLifecycleErrorCode, message: string) {
    super(message);
    this.name = "MemoryLifecycleError";
    this.code = code;
  }
}
