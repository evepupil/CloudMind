import { z } from "zod";

import {
  GLOBAL_CONTEXT_KEY,
  isValidContextKey,
  RECORD_KINDS,
} from "./classification";

export const recordKindSchema = z.enum(RECORD_KINDS);

export const contextKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(isValidContextKey, {
    message: `Context key must be "${GLOBAL_CONTEXT_KEY}" or start with "project:"`,
  });
