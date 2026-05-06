import { z } from "zod"

export const guestSchema = z.object({
  name: z
    .string()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter")
    .regex(/^[a-zA-Z\s.'-]+$/, "Nama hanya boleh huruf dan spasi"),
  company: z
    .string()
    .min(2, "Perusahaan/Asal minimal 2 karakter")
    .max(100, "Perusahaan/Asal maksimal 100 karakter"),
  purpose: z
    .string()
    .min(10, "Keperluan minimal 10 karakter")
    .max(500, "Keperluan maksimal 500 karakter"),
  arrival_time: z
    .string()
    .min(1, "Waktu kedatangan wajib diisi")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Format waktu tidak valid"),
});