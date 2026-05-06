import { useState, useEffect, useRef } from "react"
import type { Guest } from "../../utils/gueststorage"
import { getSignedUrl } from "../../utils/gueststorage"

interface GuestModalProps {
  isOpen: boolean
  onClose: () => void
  // ✅ onSave sekarang terima newPdfFile sebagai parameter kedua
  onSave: (guestData: Omit<Guest, "id" | "createdAt">, newPdfFile?: File | null) => Promise<void>
  guest?: Guest | null
}

export default function GuestModal({ isOpen, onClose, onSave, guest }: GuestModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    purpose: "",
    arrivalTime: "",
  })
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (guest) {
      setFormData({
        name: guest.name,
        company: guest.company,
        purpose: guest.purpose,
        // ✅ format yang benar untuk datetime-local
        arrivalTime: guest.arrivalTime
          ? new Date(guest.arrivalTime).toISOString().slice(0, 16)
          : "",
      })
    } else {
      setFormData({
        name: "",
        company: "",
        purpose: "",
        arrivalTime: new Date().toISOString().slice(0, 16),
      })
    }
    // ✅ reset file setiap modal dibuka/tutup
    setNewPdfFile(null)
    setFileError("")
  }, [guest, isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (file.type !== "application/pdf") {
      setFileError("File harus berformat PDF")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("Ukuran file maksimal 5MB")
      return
    }
    setFileError("")
    setNewPdfFile(file)
  }

  // ✅ Lihat PDF lama via signed URL
  const handleViewExistingPdf = async () => {
    if (!guest?.ktpUrl) return
    const url = await getSignedUrl(guest.ktpUrl)
    if (url) window.open(url, "_blank")
    else alert("Gagal membuka dokumen")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSave(
        { ...formData, ktpUrl: guest?.ktpUrl ?? null },
        newPdfFile  // ✅ kirim file baru, atau null jika tidak ganti
      )
      onClose()
    } catch (err) {
      console.error("Gagal menyimpan tamu:", err)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {guest ? "Edit Tamu" : "Tambah Tamu Baru"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Perusahaan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Perusahaan/Asal</label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Keperluan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keperluan Kunjungan</label>
            <textarea
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Waktu Kedatangan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Waktu Kedatangan</label>
            <input
              type="datetime-local"
              name="arrivalTime"
              value={formData.arrivalTime}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* ✅ Section PDF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              KTP / Surat Pengantar
              <span className="ml-1 text-xs font-normal text-gray-400">(PDF, maks. 5MB — opsional)</span>
            </label>

            {/* Tampilkan info PDF lama jika ada dan belum diganti */}
            {guest?.ktpUrl && !newPdfFile && (
              <div className="flex items-center gap-2 mb-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 flex-1">Dokumen tersimpan</span>
                <button
                  type="button"
                  onClick={handleViewExistingPdf}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium hover:underline"
                >
                  Lihat PDF
                </button>
              </div>
            )}

            {/* Drop zone upload PDF baru */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                newPdfFile
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10"
                  : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {newPdfFile ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">
                    {newPdfFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNewPdfFile(null); setFileError("") }}
                    className="text-red-400 hover:text-red-600 ml-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {guest?.ktpUrl ? "Klik untuk ganti PDF" : "Klik untuk upload PDF"}
                </p>
              )}
            </div>

            {/* Error file */}
            {fileError && (
              <p className="mt-1 text-xs text-red-500">{fileError}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{guest ? "Mengupdate..." : "Menyimpan..."}</>
              ) : (
                guest ? "Update" : "Simpan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}