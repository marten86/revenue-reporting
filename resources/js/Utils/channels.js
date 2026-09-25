// v20260926-channels-sot — satu sumber kebenaran label & warna kanal.
// Key = nilai kanal mentah di DB (revenue_details.channel / DashboardController).
// Label HARUS sama persis dengan AnalyticsController::$channelLabels,
// karena Analytics mengirim label (bukan key) ke frontend.
// Menambah/mengubah kanal? Ubah di sini DAN di $channelLabels.

export const CHANNELS = [
    { key: 'presentasi',        label: 'Presentasi',        color: '#16a34a' },
    { key: 'wgts',              label: 'WGTS',              color: '#2563eb' },
    { key: 'gerai',             label: 'Gerai',             color: '#d97706' },
    { key: 'dfi',               label: 'DFI (AR)',          color: '#dc2626' },
    { key: 'dfe',               label: 'DFE (AE)',          color: '#7c3aed' },
    { key: 'kotak',             label: 'Kotak Infak',       color: '#0891b2' },
    { key: 'qris',              label: 'QRIS',              color: '#0d9488' },
    { key: 'kantor',            label: 'Kantor',            color: '#be185d' },
    { key: 'kotak_qris',        label: 'Kotak/QRIS (Lama)', color: '#94a3b8' },
    { key: 'kotak_qris_legacy', label: 'Kotak/QRIS (Lama)', color: '#94a3b8' },
]

const FALLBACK_COLOR = '#6b7280'

// Peta per key mentah (Dashboard Area & Branch)
export const CHANNEL_LABELS = Object.fromEntries(CHANNELS.map(c => [c.key, c.label]))
export const CHANNEL_COLORS = Object.fromEntries(CHANNELS.map(c => [c.key, c.color]))

// Peta per label (Analytics — backend mengirim label)
export const CHANNEL_COLORS_BY_LABEL = Object.fromEntries(CHANNELS.map(c => [c.label, c.color]))

// Urutan stack "Revenue per Cabang per Kanal" — cocok dengan
// DashboardController::buildChannelPerBranch() (tanpa 'kotak_qris' mentah)
export const STACK_KEYS = CHANNELS.map(c => c.key).filter(k => k !== 'kotak_qris')

export const channelLabel = (key) => CHANNEL_LABELS[key] ?? key
export const channelColor = (key) => CHANNEL_COLORS[key] ?? FALLBACK_COLOR
export const channelColorByLabel = (label) => CHANNEL_COLORS_BY_LABEL[label] ?? FALLBACK_COLOR
