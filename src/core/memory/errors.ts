export type MemoryLifecycleErrorCode =
  | "NOT_MEMORY"
  | "SCOPE_MISMATCH"
  | "CONTEXT_MISMATCH"
  | "NOT_CURRENT"
  | "NOT_READY"
  | "NOT_DELETED";

export class MemoryLifecycleError extends Error {
  public readonly code: MemoryLifecycleErrorCode;

  public constructor(code: MemoryLifecycleErrorCode, message: string) {
    super(message);
    this.name = "MemoryLifecycleError";
    this.code = code;
  }
}
