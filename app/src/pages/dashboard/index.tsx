import { useState, useEffect, useCallback } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { getGuests, addGuest, updateGuest, deleteGuest, searchGuest, type Guest } from "../../utils/gueststorage"
import Navbar from "../../components/navbar"
import SearchFilter from "../../components/seacrh/searchfilter"
import GuestCard from "../../components/card/guestcard"
import GuestModal from "../../components/modal/usermodal"
import Pagination from "../../components/pagination/pagination"

const ITEMS_PER_PAGE = 6

export default function Dashboard() {
  const { profile } = useAuth()
  const [guests, setGuests] = useState<Guest[]>([])
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [paginatedGuests, setPaginatedGuests] = useState<Guest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const location = useLocation()

  useEffect(() => { loadGuests() }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const page = Number.parseInt(searchParams.get("page") || "1")
    setCurrentPage(page)
  }, [location.search])

  useEffect(() => {
    const total = Math.ceil(filteredGuests.length / ITEMS_PER_PAGE)
    setTotalPages(total || 1)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    setPaginatedGuests(filteredGuests.slice(startIndex, startIndex + ITEMS_PER_PAGE))
  }, [filteredGuests, currentPage])

  const loadGuests = async () => {
    setIsLoading(true)
    const allGuests = await getGuests()
    setGuests(allGuests)
    setFilteredGuests(allGuests)
    setIsLoading(false)
  }

  const handleSearch = useCallback(
    async (keyword: string) => {
      if (keyword.trim()) {
        const results = await searchGuest(keyword)
        setFilteredGuests(results)
      } else {
        setFilteredGuests(guests)
      }
    },
    [guests]
  )

  const handleAddGuest = () => { setEditingGuest(null); setIsModalOpen(true) }
  const handleEditGuest = (guest: Guest) => { setEditingGuest(guest); setIsModalOpen(true) }

  const handleSaveGuest = async (
    guestData: Omit<Guest, "id" | "createdAt">,
    newPdfFile?: File | null
  ) => {
    if (editingGuest) {
      await updateGuest(editingGuest.id, guestData, newPdfFile)
    } else {
      await addGuest(guestData, newPdfFile)
    }
    await loadGuests()
    setIsModalOpen(false)
    setEditingGuest(null)
  }

  const handleDeleteGuest = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data tamu ini?")) {
      await deleteGuest(id)
      await loadGuests()
    }
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Nama", "Perusahaan", "Keperluan", "Waktu Kedatangan", "Waktu Input"],
      ...filteredGuests.map((guest) => [
        guest.name,
        guest.company,
        guest.purpose,
        new Date(guest.arrivalTime).toLocaleString("id-ID"),
        new Date(guest.createdAt).toLocaleString("id-ID"),
      ]),
    ]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.setAttribute("href", URL.createObjectURL(blob))
    link.setAttribute("download", `data-tamu-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard Tamu</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Login sebagai: <span className="font-medium">{profile?.email}</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={exportToCSV} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                Export CSV
              </button>
              <button onClick={handleAddGuest} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Tambah Tamu
              </button>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* ... stat cards sama seperti sebelumnya ... */}
        </div>

        <SearchFilter onSearch={handleSearch} />

        {/* ✅ Tambah loading state */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Memuat data tamu...</p>
          </div>
        ) : paginatedGuests.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {paginatedGuests.map((guest) => (
                <GuestCard
                  key={guest.id}
                  guest={guest}
                  onEdit={handleEditGuest}
                  onDelete={handleDeleteGuest}
                />
              ))}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredGuests.length} itemsPerPage={ITEMS_PER_PAGE} />
          </>
        ) : (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Tidak ada data tamu</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {new URLSearchParams(location.search).get("keyword") ? "Tidak ditemukan hasil pencarian." : "Mulai dengan menambahkan tamu baru."}
            </p>
          </div>
        )}
      </div>

      <GuestModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingGuest(null) }}
        onSave={handleSaveGuest}
        guest={editingGuest}
      />
    </div>
  )
}