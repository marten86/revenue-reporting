// v20260925-standar-capaian
// Standar warna capaian target BWA Indotim (satu sumber untuk semua halaman):
//   >= 100%  hijau  "Tercapai"      — target tercapai atau lebih
//   80–<100% amber  "Masuk target"  — sudah masuk standar, belum 100%
//   < 80%    merah  "Di bawah 80%"
//   null     abu    "—"             — tidak ada target (jangan tampil 0%)
export const ACH_TERCAPAI = 100
export const ACH_MASUK    = 80

const TIERS = {
    tercapai: { key: 'tercapai', color: '#16a34a', bg: '#dcfce7', label: 'Tercapai' },
    masuk:    { key: 'masuk',    color: '#d97706', bg: '#fef3c7', label: 'Masuk target' },
    kurang:   { key: 'kurang',   color: '#dc2626', bg: '#fee2e2', label: 'Di bawah 80%' },
    none:     { key: 'none',     color: '#9ca3af', bg: '#f3f4f6', label: '—' },
}

export const achievementTier = (pct) => {
    if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return TIERS.none
    const v = Number(pct)
    if (v >= ACH_TERCAPAI) return TIERS.tercapai
    if (v >= ACH_MASUK)    return TIERS.masuk
    return TIERS.kurang
}

export const achievementColor = (pct) => achievementTier(pct).color
