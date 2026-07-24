import type { MemoryScope } from "@/core/memory/scope";

import type { ContextKey, RecordKind } from "./classification";

export interface RecordFilterInput {
  recordKind?: RecordKind | undefined;
  recordKinds?: readonly RecordKind[] | undefined;
  scopeId?: MemoryScope | undefined;
  scopeIds?: readonly MemoryScope[] | undefined;
  contextKey?: ContextKey | undefined;
  contextKeys?: readonly ContextKey[] | undefined;
}

export interface AppliedRecordFilters {
  recordKinds?: RecordKind[] | undefined;
  scopeIds?: MemoryScope[] | undefined;
  contextKeys?: ContextKey[] | undefined;
}

export class RecordFilterConflictError extends Error {
  public constructor(singularKey: string, pluralKey: string) {
    super(
      `Fields "${singularKey}" and "${pluralKey}" cannot be used together.`
    );
    this.name = "RecordFilterConflictError";
  }
}

const normalizeValues = <T extends string>(
  values: readonly T[] | undefined
): T[] | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  return [...new Set(values)];
};

const normalizeDimension = <T extends string>(
  singularKey: string,
  singularValue: T | undefined,
  pluralKey: string,
  pluralValues: readonly T[] | undefined
): T[] | undefined => {
  if (singularValue !== undefined && pluralValues !== undefined) {
    throw new RecordFilterConflictError(singularKey, pluralKey);
  }

  return normalizeValues(
    pluralValues ?? (singularValue === undefined ? undefined : [singularValue])
  );
};

export const normalizeRecordFilters = (
  input: RecordFilterInput = {}
): AppliedRecordFilters => {
  const recordKinds = normalizeDimension(
    "recordKind",
    input.recordKind,
    "recordKinds",
    input.recordKinds
  );
  const scopeIds = normalizeDimension(
    "scopeId",
    input.scopeId,
    "scopeIds",
    input.scopeIds
  );
  const contextKeys = normalizeDimension(
    "contextKey",
    input.contextKey,
    "contextKeys",
    input.contextKeys
  );

  return {
    ...(recordKinds ? { recordKinds } : {}),
    ...(scopeIds ? { scopeIds } : {}),
    ...(contextKeys ? { contextKeys } : {}),
  };
};

export const withRecordFilterDefaults = (
  input: RecordFilterInput,
  defaults: AppliedRecordFilters
): AppliedRecordFilters => {
  const normalized = normalizeRecordFilters(input);
  const recordKinds =
    normalized.recordKinds ?? normalizeValues(defaults.recordKinds);
  const scopeIds = normalized.scopeIds ?? normalizeValues(defaults.scopeIds);
  const contextKeys =
    normalized.contextKeys ?? normalizeValues(defaults.contextKeys);

  return {
    ...(recordKinds ? { recordKinds } : {}),
    ...(scopeIds ? { scopeIds } : {}),
    ...(contextKeys ? { contextKeys } : {}),
  };
};

export const matchesRecordFilters = (
  record: {
    recordKind: RecordKind;
    scopeId: string;
    contextKey: ContextKey;
  },
  filters: AppliedRecordFilters
): boolean => {
  return (
    (!filters.recordKinds || filters.recordKinds.includes(record.recordKind)) &&
    (!filters.scopeIds ||
      filters.scopeIds.some((scopeId) => scopeId === record.scopeId)) &&
    (!filters.contextKeys || filters.contextKeys.includes(record.contextKey))
  );
};
