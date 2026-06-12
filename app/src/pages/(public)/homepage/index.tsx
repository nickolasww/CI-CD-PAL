import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { FaCloudUploadAlt, FaBook } from "react-icons/fa";
import { z } from "zod";

// ✅ Schema validasi Zod
const guestSchema = z.object({
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

// Tipe error per field
type FieldErrors = Partial<Record<keyof z.infer<typeof guestSchema>, string>>;

interface GuestFormData {
  name: string;
  company: string;
  purpose: string;
  arrival_time: string;
  ktp_url: File | null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<GuestFormData>({
    name: "",
    company: "",
    purpose: "",
    arrival_time: "",
    ktp_url: null,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});  // ✅ error per field
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ✅ Validasi satu field saat blur
  const validateField = (name: keyof z.infer<typeof guestSchema>, value: string) => {
    const result = guestSchema.shape[name].safeParse(value);
    setFieldErrors((prev) => ({
      ...prev,
      [name]: result.success ? undefined : result.error.issues[0].message,
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // ✅ Hapus error saat user mulai mengetik
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name in guestSchema.shape) {
      validateField(name as keyof z.infer<typeof guestSchema>, value);
    }
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setFileError("File harus berformat PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("Ukuran file maksimal 5MB");
      return;
    }
    setFileError("");
    setFormData({ ...formData, ktp_url: file });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    // ✅ Validasi semua field sekaligus dengan Zod
    const result = guestSchema.safeParse({
      name: formData.name,
      company: formData.company,
      purpose: formData.purpose,
      arrival_time: formData.arrival_time,
    });

    if (!result.success) {
      // Tampilkan semua error per field
      const errors: FieldErrors = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof FieldErrors;
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      let ktp_url: string | null = null;

      if (formData.ktp_url) {
        const fileName = `${Date.now()}_${formData.ktp_url.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ktp-letters")
          .upload(fileName, formData.ktp_url);
        if (uploadError) throw uploadError;
        ktp_url = uploadData.path;
      }

      const { error: insertError } = await supabase.from("guests").insert({
        name: formData.name,
        company: formData.company,
        purpose: formData.purpose,
        arrival_time: formData.arrival_time,
        ktp_url,
      });

      if (insertError) throw insertError;
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || "Gagal menyimpan data. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", company: "", purpose: "", arrival_time: "", ktp_url: null });
    setFieldErrors({});
    setFileError("");
    setSubmitError("");
    setSubmitted(false);
  };

  // ✅ Helper class untuk input dengan error
  const inputClass = (field: keyof FieldErrors) =>
    `w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors ${
      fieldErrors[field]
        ? "border-red-400 dark:border-red-500 focus:ring-red-400"
        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
    }`;

  return (
    <div className="min-h-screen font-sans">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1a3a2a] dark:bg-emerald-700 rounded-lg flex items-center justify-center">
              <FaBook />
            </div>
            <span className="font-bold text-[#1a3a2a] dark:text-white tracking-tight text-lg">
              Buku Tamu
            </span>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 text-sm bg-[#1a3a2a] text-white rounded-lg hover:bg-[#2d5c42] transition-colors"
          >
            Login
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-20 px-6">
        <div className="min-h-screen mx-auto relative z-10 flex flex-col md:flex-row md:items-center md:justify-center text-center gap-10">
          <div className="max-w-xl">
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-4">
              Selamat Datang di
              <br />
              <span className="text-emerald-400">Buku Tamu - Tes</span>
            </h1>
            <p className="text-emerald-100/70 text-lg leading-relaxed">
              Daftarkan kedatangan Anda dengan mudah dan cepat. Tidak perlu akun,
              cukup isi formulir di bawah.
            </p>
          </div>
        </div>
      </section>

      {/* ── CARA PENGGUNAAN ── */}
      <section className="py-12 px-6 bg-white dark:bg-[#141414] border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs font-semibold text-stone-400 uppercase tracking-widest mb-8">
            Cara Pendaftaran
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Isi Formulir", desc: "Lengkapi data diri dan keperluan kunjungan Anda" },
              { step: "02", title: "Upload KTP Pengunjung", desc: "Lampirkan KTP pengunjung dalam format PDF" },
              { step: "03", title: "Kirim & Datang", desc: "Petugas akan memverifikasi dan mengarahkan Anda ketika datang ke lokasi" },
            ].map((s) => (
              <div key={s.step} className="flex gap-4 items-start p-5 rounded-xl bg-stone-50 dark:bg-[#1a1a1a] border border-stone-100 dark:border-stone-800">
                <span className="text-3xl font-black text-stone-200 dark:text-stone-700 leading-none">{s.step}</span>
                <div>
                  <div className="font-semibold text-stone-800 dark:text-white mb-1">{s.title}</div>
                  <div className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM TAMU ── */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-stone-800 dark:text-white mb-2">
              Formulir Pendaftaran Tamu
            </h2>
          </div>

          {submitted ? (
            <div className="bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-stone-700 rounded-2xl p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-stone-800 dark:text-white mb-2">Pendaftaran Berhasil!</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
                Data Anda telah tercatat. Silakan menuju resepsionis untuk konfirmasi dan mendapatkan kartu tamu.
              </p>
              <button onClick={resetForm} className="px-6 py-2.5 bg-[#1a3a2a] text-white rounded-xl text-sm hover:bg-[#2d5c42] transition-colors">
                Daftarkan Tamu Lain
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white dark:bg-[#1a1a1a] border border-stone-200 dark:border-stone-700 rounded-2xl p-8 shadow-sm space-y-6"
            >
              {/* Nama */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Contoh: Budi Santoso"
                  className={inputClass("name")}
                />
                {/* ✅ Pesan error per field */}
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Perusahaan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Perusahaan/Asal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Contoh: PT. Maju Bersama"
                  className={inputClass("company")}
                />
                {fieldErrors.company && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.company}
                  </p>
                )}
              </div>

              {/* Keperluan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Keperluan Kunjungan <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleTextareaChange}
                  onBlur={handleBlur}
                  placeholder="Contoh: Rapat koordinasi dengan tim IT mengenai proyek sistem informasi..."
                  rows={3}
                  className={inputClass("purpose")}
                />
                <div className="flex justify-between items-center mt-1">
                  {fieldErrors.purpose ? (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {fieldErrors.purpose}
                    </p>
                  ) : <span />}
                  {/* ✅ Counter karakter */}
                  <p className={`text-xs ${formData.purpose.length > 500 ? "text-red-500" : "text-stone-400"}`}>
                    {formData.purpose.length}/500
                  </p>
                </div>
              </div>

              {/* Waktu Kedatangan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Waktu Kedatangan <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="arrival_time"
                  value={formData.arrival_time}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={inputClass("arrival_time")}
                />
                {fieldErrors.arrival_time && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors.arrival_time}
                  </p>
                )}
              </div>

              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  KTP Pengunjung
                  <span className="ml-2 text-xs font-normal text-stone-400">(PDF, maks. 5MB — opsional)</span>
                </label>
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    <span className="font-semibold">Dokumen yang disarankan:</span>{" "}
                    Surat Tugas dari perusahaan/instansi, Surat Pengantar resmi, atau dokumen kunjungan kerja lainnya dalam format PDF.
                  </p>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
                      : formData.ktp_url
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10"
                        : fileError
                          ? "border-red-400 bg-red-50 dark:bg-red-900/10"
                          : "border-stone-200 dark:border-stone-700 hover:border-emerald-400 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {formData.ktp_url ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{formData.ktp_url.name}</p>
                        <p className="text-xs text-stone-400">{(formData.ktp_url.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, ktp_url: null }); }}
                        className="ml-auto text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <FaCloudUploadAlt />
                      </div>
                      <p className="text-sm text-stone-600 dark:text-stone-400">
                        <span className="font-medium text-emerald-600">Klik untuk upload</span> atau seret file ke sini
                      </p>
                      <p className="text-xs text-stone-400 mt-1">PDF hingga 5MB</p>
                    </>
                  )}
                </div>
                {/* ✅ Error file */}
                {fileError && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fileError}
                  </p>
                )}
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#1a3a2a] hover:bg-[#2d5c42] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</>
                ) : "Kirim Pendaftaran"}
              </button>
              <p className="text-center text-xs text-stone-400">
                Data Anda aman dan hanya digunakan untuk keperluan administrasi kunjungan
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-6 px-6 border-t border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-stone-400">© 2026 Developer Defsekop in Zero Trust we Trust.</p>
          <p className="text-xs text-stone-400">Dibangun untuk kemudahan administrasi kunjungan</p>
        </div>
      </footer>
    </div>
  );
}