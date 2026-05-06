import type { PromptTemplate } from "./types";

type RegisteredPromptTemplate = PromptTemplate<unknown>;

export interface PromptRegistry {
  register<T>(template: PromptTemplate<T>): void;
  get<T = object>(id: string): PromptTemplate<T>;
  getVersion<T = object>(id: string, version: number): PromptTemplate<T>;
  list(): PromptTemplate[];
}

export const createPromptRegistry = (): PromptRegistry => {
  const templates = new Map<string, RegisteredPromptTemplate[]>();

  return {
    register<T>(template: PromptTemplate<T>): void {
      const group = templates.get(template.id) ?? [];
      const duplicate = group.find((t) => t.version === template.version);

      if (duplicate) {
        throw new Error(
          `Prompt "${template.id}" version ${template.version} is already registered.`
        );
      }

      group.push(template as RegisteredPromptTemplate);
      templates.set(template.id, group);
    },

    get<T = object>(id: string): PromptTemplate<T> {
      const group = templates.get(id);

      if (!group || group.length === 0) {
        throw new Error(`Prompt "${id}" is not registered.`);
      }

      const latest = group.reduce((max, t) =>
        t.version > max.version ? t : max
      );

      return latest as PromptTemplate<T>;
    },

    getVersion<T = object>(id: string, version: number): PromptTemplate<T> {
      const group = templates.get(id) ?? [];
      const found = group.find((t) => t.version === version);

      if (!found) {
        throw new Error(`Prompt "${id}" version ${version} is not registered.`);
      }

      return found as PromptTemplate<T>;
    },

    list(): PromptTemplate[] {
      const result: PromptTemplate[] = [];

      for (const group of templates.values()) {
        result.push(...group);
      }

      return result;
    },
  };
};
