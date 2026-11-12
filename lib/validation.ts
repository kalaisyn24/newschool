import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Укажите e-mail")
  .max(191, "Слишком длинный e-mail")
  .email("Некорректный e-mail");

export const passwordSchema = z
  .string()
  .min(8, "Пароль должен быть не короче 8 символов")
  .max(100, "Пароль слишком длинный")
  .regex(/[A-Za-zА-Яа-я]/, "Пароль должен содержать буквы")
  .regex(/\d/, "Пароль должен содержать цифры");

export const nameSchema = z.string().trim().min(2, "Укажите имя").max(120, "Имя слишком длинное");
