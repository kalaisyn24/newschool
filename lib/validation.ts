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

/* ---------- first / last name (stored together in User.name as "Имя Фамилия") ---------- */

const namePart = (required?: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(required ? z.string().min(1, required).max(60, "Слишком длинное значение") : z.string().max(60, "Слишком длинное значение"));

export const firstNameSchema = namePart("Укажите имя");
export const lastNameSchema = namePart("Укажите фамилию");
/** For editing old accounts that were registered without a last name. */
export const optionalLastNameSchema = namePart();

export function joinName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

/** "Иван Петров" → { firstName: "Иван", lastName: "Петров" }; the last name may be empty. */
export function splitName(name: string) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}
