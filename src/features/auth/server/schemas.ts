import { z } from "zod";

export const loginPayloadSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  next: z.string().trim().optional(),
});

export const changePasswordPayloadSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(1).max(200),
    next: z.string().trim().optional(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "New password and confirmation must match.",
  });
