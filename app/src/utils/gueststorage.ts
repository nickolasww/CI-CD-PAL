import { supabase } from "../lib/supabase"

export interface Guest {
  id: string
  name: string
  company: string
  purpose: string
  arrivalTime: string
  createdAt: string
  ktpUrl?: string | null
}

const BUCKET = "ktp-letters"

const mapGuestData = (row: any): Guest => ({
  id: row.id,
  name: row.name,
  company: row.company,
  purpose: row.purpose,
  arrivalTime: row.arrival_time,
  createdAt: row.created_at,
  ktpUrl: row.ktp_url ?? null,
})

// Upload PDF helper — return path saja (bukan signed URL)
async function uploadPdf(file: File): Promise<string | null> {
  const fileName = `${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file)
  if (error) { console.error("Upload error:", error); return null }
  return data.path
}

// Ekstrak storage path dari full signed URL (untuk data lama di DB)
// Input:  "https://xxx.supabase.co/storage/v1/object/sign/ktp-letters/1234_file.pdf?token=..."
// Output: "1234_file.pdf"
function extractStoragePath(ktpUrl: string): string {
  try {
    const url = new URL(ktpUrl)
    const prefix = `/storage/v1/object/sign/${BUCKET}/`
    if (url.pathname.startsWith(prefix)) {
      return decodeURIComponent(url.pathname.slice(prefix.length))
    }
  } catch {
    // bukan URL valid, anggap sudah berupa path langsung
  }
  return ktpUrl
}

export const getGuests = async (): Promise<Guest[]> => {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data.map(mapGuestData)
}

// addGuest terima File opsional
export const addGuest = async (
  guestData: Omit<Guest, "id" | "createdAt">,
  pdfFile?: File | null
): Promise<Guest | null> => {
  let ktp_url = guestData.ktpUrl ?? null
  if (pdfFile) ktp_url = await uploadPdf(pdfFile)

  const { data, error } = await supabase
    .from("guests")
    .insert({
      name: guestData.name,
      company: guestData.company,
      purpose: guestData.purpose,
      arrival_time: guestData.arrivalTime,
      ktp_url,
    })
    .select()
    .single()

  if (error) { console.error(error); return null }
  return mapGuestData(data)
}

// updateGuest terima File opsional — upload PDF baru jika ada
export const updateGuest = async (
  id: string,
  guestData: Partial<Guest>,
  newPdfFile?: File | null
): Promise<boolean> => {
  let ktp_url = guestData.ktpUrl ?? null

  // Jika ada file PDF baru, upload dulu
  if (newPdfFile) ktp_url = await uploadPdf(newPdfFile)

  const { error } = await supabase
    .from("guests")
    .update({
      name: guestData.name,
      company: guestData.company,
      purpose: guestData.purpose,
      arrival_time: guestData.arrivalTime,
      ktp_url,  //  update dengan path baru atau tetap path lama
    })
    .eq("id", id)

  if (error) { console.error(error); return false }
  return true
}

export const deleteGuest = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from("guests").delete().eq("id", id)
  if (error) { console.error(error); return false }
  return true
}

export const searchGuest = async (keyword: string): Promise<Guest[]> => {
  const kw = `%${keyword}%`
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .or(`name.ilike.${kw},company.ilike.${kw},purpose.ilike.${kw}`)
    .order("created_at", { ascending: false })
  if (error) { console.error(error); return [] }
  return data.map(mapGuestData)
}

// Generate signed URL — hanya admin yang bisa akses
// Handle data lama yang menyimpan full signed URL, bukan path
export const getSignedUrl = async (path: string): Promise<string | null> => {
  const storagePath = extractStoragePath(path)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60)
  if (error) { console.error(error); return null }
  return data.signedUrl
}
