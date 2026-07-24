export const RECORD_KINDS = ["library", "memory"] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export const LIBRARY_RECORD_KIND: RecordKind = "library";
export const MEMORY_RECORD_KIND: RecordKind = "memory";

export const GLOBAL_CONTEXT_KEY = "global";
export const PROJECT_CONTEXT_PREFIX = "project:";

export type ContextKey = string;

export const normalizeContextKey = (
  value: string | null | undefined
): ContextKey => {
  const normalized = value?.trim();

  return normalized || GLOBAL_CONTEXT_KEY;
};

export const isValidContextKey = (value: string): boolean => {
  if (value === GLOBAL_CONTEXT_KEY) {
    return true;
  }

  return (
    value.startsWith(PROJECT_CONTEXT_PREFIX) &&
    value.length > PROJECT_CONTEXT_PREFIX.length &&
    value.length <= 300
  );
};
