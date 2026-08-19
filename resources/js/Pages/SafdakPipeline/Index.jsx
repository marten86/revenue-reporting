import { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Components/AppLayout';

/**
 * Pipeline Safari Dakwah
 * penanda versi: pipeline-filter-dai-periode-20260819
 *
 * Ditambahkan 19 Agustus 2026:
 *   - Filter Dai (dropdown, dari kampanye yang benar-benar ada)
 *   - Filter periode Bulan / Kuartal / Semester / Tahun / Semua
 *
 * PERIODE DIHITUNG DI BACKEND. Tombol < > , label periode, dan kunci saat
 * berganti tipe semuanya datang sebagai string siap pakai lewat prop
 * `rangeNav` / `periodPresets` / `todayPresets`. Definisi kuartal & semester
 * SENGAJA tidak diduplikasi di sini -- rumahnya App\Support\PeriodRange.
 *
 * Semua persentase diturunkan di frontend dari prop yang sudah dikirim
 * controller -> tidak ada rumus yang hidup di dua tempat.
 * Penyebut 0 -> "-", BUKAN 0%. Angka yang tidak bisa dihitung lebih baik
 * absen daripada berbohong (pelajaran sesi Analytics single-channel).
 */

const STATUS_META = {
    rencana:  { label: 'Rencana',  badge: 'bg-slate-100 text-slate-700 border-slate-300',       dot: 'bg-slate-400',  accent: 'bg-slate-300' },
    berjalan: { label: 'Berjalan', badge: 'bg-amber-100 text-amber-800 border-amber-300',       dot: 'bg-amber-500',  accent: 'bg-amber-400' },
    selesai:  { label: 'Selesai',  badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', accent: 'bg-emerald-500' },
    batal:    { label: 'Batal',    badge: 'bg-rose-100 text-rose-700 border-rose-300',          dot: 'bg-rose-500',   accent: 'bg-rose-400' },
};

const NEXT_STATUS = { rencana: 'berjalan', berjalan: 'selesai' };

const TARGET_MIN_PER_DAY = 2;   // samakan dengan konstanta di model SafdakEvent
const TARGET_IDEAL_PER_DAY = 3;

// Tipe periode. `preset` = kunci di prop periodPresets/todayPresets;
// null berarti "semua periode" (range dikosongkan).
const PERIOD_TYPES = [
    { type: 'month',    label: 'Bulan',    preset: 'month' },
    { type: 'quarter',  label: 'Kuartal',  preset: 'quarter' },
    { type: 'semester', label: 'Semester', preset: 'semester' },
    { type: 'year',     label: 'Tahun',    preset: 'year' },
    { type: 'all',      label: 'Semua',    preset: null },
];

// Sentinel filter dai tanpa nama - harus sama dengan SPEAKER_NONE di controller
const SPEAKER_NONE = '__none__';

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

// Bentuk ringkas untuk kartu ringkasan; nominal penuh tetap tersedia di title
const shortRupiah = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return 'Rp 0';
    if (Math.abs(n) >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2).replace('.', ',') + ' M';
    if (Math.abs(n) >= 1e6) return 'Rp ' + Math.round(n / 1e6) + ' jt';
    return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

const formatTanggal = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTanggalPendek = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

// Tanggal hari ini dalam waktu LOKAL. Sengaja tidak memakai
// toISOString().slice(0,10) -- itu memberi tanggal UTC, dan di WITA (UTC+8)
// antara 00:00-08:00 hasilnya mundur satu hari.
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

// Jumlah hari (frontend, untuk preview live di form) - logika sama dengan
// accessor total_days di model
const countDays = (startDate, endDate, customDates) => {
    if (Array.isArray(customDates) && customDates.length > 0) return customDates.length;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
};

// ── Capaian: realisasi / komitmen ─────────────────────────────
// Komitmen 0 / kosong → null (tidak bisa dihitung, tampil "—"), BUKAN 0%.
// Sengaja dibedakan supaya kampanye yang belum diisi komitmennya tidak
// terlihat seperti kampanye yang gagal total.
const pctCapaian = (komitmen, realisasi) => {
    const k = Number(komitmen ?? 0);
    const r = Number(realisasi ?? 0);
    if (!Number.isFinite(k) || k <= 0) return null;
    if (!Number.isFinite(r)) return null;
    return Math.round((r / k) * 100);
};

const pctMeta = (pct) => {
    if (pct === null) return { text: 'text-gray-300', bar: 'bg-gray-300' };
    if (pct >= 100)   return { text: 'text-emerald-700', bar: 'bg-emerald-500' };
    if (pct >= 80)    return { text: 'text-sky-700',     bar: 'bg-sky-500' };
    if (pct >= 50)    return { text: 'text-amber-700',   bar: 'bg-amber-500' };
    return { text: 'text-red-600', bar: 'bg-red-500' };
};

function CapaianBadge({ komitmen, realisasi, withBar = false }) {
    const pct = pctCapaian(komitmen, realisasi);
    const meta = pctMeta(pct);

    if (pct === null) {
        return (
            <span className="text-xs text-gray-300" title="Komitmen belum diisi — capaian tidak bisa dihitung">
                —
            </span>
        );
    }

    return (
        <div className="inline-block min-w-[52px]" title={`Realisasi ${pct}% dari komitmen`}>
            <span className={`text-sm font-bold ${meta.text}`}>{pct}%</span>
            {withBar && (
                <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${meta.bar} rounded-full`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

// ── Rasio Cost: cost / realisasi ──────────────────────────────
// Dua alasan berbeda kenapa rasio tidak bisa dihitung, dan keduanya perlu
// tooltip yang berbeda supaya user tahu apa yang harus diisi:
//   realisasi <= 0 → pembagi nol
//   cost <= 0      → cost belum diisi (0 tidak bisa dibedakan dari kosong,
//                    jadi diperlakukan sebagai belum diisi -- bukan "gratis")
const rasioCost = (cost, realisasi) => {
    const c = Number(cost ?? 0);
    const r = Number(realisasi ?? 0);
    if (!Number.isFinite(r) || r <= 0) {
        return { pct: null, note: 'Realisasi belum ada — rasio tidak bisa dihitung' };
    }
    if (!Number.isFinite(c) || c <= 0) {
        return { pct: null, note: 'Cost belum diisi' };
    }
    return { pct: Math.round((c / r) * 100), note: null };
};

// Gradasi DIBALIK dari pctMeta: makin kecil makin efisien.
const rasioMeta = (pct) => {
    if (pct === null) return { chip: 'border-gray-200 bg-white', text: 'text-gray-300' };
    if (pct <= 20)    return { chip: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-700' };
    if (pct <= 35)    return { chip: 'border-sky-300 bg-sky-50',         text: 'text-sky-700' };
    if (pct <= 50)    return { chip: 'border-amber-300 bg-amber-50',     text: 'text-amber-700' };
    return { chip: 'border-rose-300 bg-rose-50', text: 'text-rose-700' };
};

const rasioLabel = (pct) => {
    if (pct === null) return '';
    if (pct <= 20) return 'sangat efisien';
    if (pct <= 35) return 'efisien';
    if (pct <= 50) return 'perlu dicermati';
    return 'biaya tinggi';
};

function RasioBadge({ cost, realisasi }) {
    const { pct, note } = rasioCost(cost, realisasi);
    const meta = rasioMeta(pct);

    if (pct === null) {
        return (
            <span className="text-[11px] text-gray-300" title={note}>
                —
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[11px] font-semibold ${meta.chip} ${meta.text}`}
            title={`Cost ${pct}% dari realisasi (${rasioLabel(pct)}) — makin kecil makin baik`}
        >
            <span className="text-[9px] leading-none opacity-60">↓</span>
            {pct}%
        </span>
    );
}

// Bar mungil untuk angka Deal / Eksekusi di tabel
function MiniBar({ value, max, color }) {
    const pct = max > 0 ? clampPct((Number(value) / max) * 100) : 0;
    return (
        <div className="mt-1 h-1 w-10 mx-auto bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
    );
}

const emptyForm = {
    branch_id: '',
    title: '',
    start_date: '',
    end_date: '',
    custom_dates: [],
    speaker: '',
    grade: '',
    status: 'rencana',
    titik_deal: '',
    titik_eksekusi: '',
    total_cost: '',
    revenue_komitmen: '',
    revenue_realisasi: '',
    has_mou: false,
    notes: '',
};

export default function Index({
    events,
    branches,
    speakers,
    speakerOptions = [],
    hasUnnamedSpeaker = false,
    statuses,
    summary,
    rangeNav,
    periodPresets = {},
    todayPresets = {},
    filters,
    canWrite,
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [dateMode, setDateMode] = useState('rentang'); // 'rentang' | 'custom'
    const [customDateInput, setCustomDateInput] = useState('');

    const form = useForm({ ...emptyForm });

    const perStatus = summary?.per_status ?? {};
    const TODAY = todayStr();

    // Capaian agregat pada filter aktif
    const summaryPct = pctCapaian(summary?.revenue_komitmen, summary?.revenue_realisasi);
    const summaryPctMeta = pctMeta(summaryPct);

    // Rasio cost agregat pada filter aktif
    const summaryRasio = rasioCost(summary?.total_cost, summary?.revenue_realisasi);
    const summaryRasioMeta = rasioMeta(summaryRasio.pct);

    // Preview target live di modal
    const previewDays = countDays(
        form.data.start_date,
        form.data.end_date,
        dateMode === 'custom' ? form.data.custom_dates : []
    );

    // ── Filter handlers (server-side, via query string) ──────
    const applyFilters = (patch) => {
        const next = { ...filters, ...patch };
        const query = {};
        if (next.status) query.status = next.status;
        if (next.branch) query.branch = next.branch;
        if (next.range) query.range = next.range;
        if (next.speaker) query.speaker = next.speaker;
        router.get('/safari-pipeline', query, { preserveState: true, preserveScroll: true });
    };

    const activeStatus = filters?.status || '';
    const activeSpeaker = filters?.speaker || '';

    const periodType = rangeNav?.type || 'all';
    const periodLabel = rangeNav?.label || 'Semua periode';
    const isAllPeriod = periodType === 'all';

    // Tombol "Periode ini" hanya bermakna kalau kita sedang TIDAK di sana
    const todayKey = todayPresets?.[periodType] || '';
    const showTodayButton = !isAllPeriod && todayKey && todayKey !== (rangeNav?.key || '');

    // Dai yang sedang difilter tapi tidak ada di daftar opsi (mis. karena
    // filter cabang berganti). Tetap ditampilkan supaya user tidak terjebak
    // pada filter yang tak terlihat -- pola yang sama dengan fallback
    // "(belum di master)" pada dropdown dai di modal.
    const speakerNotInList =
        activeSpeaker &&
        activeSpeaker !== SPEAKER_NONE &&
        !(speakerOptions || []).includes(activeSpeaker);

    const speakerFilterLabel =
        activeSpeaker === SPEAKER_NONE ? 'Belum ditentukan' : activeSpeaker;

    // ── Dai untuk cabang terpilih di form ─────────────────────
    const speakerOptionsForm = useMemo(() => {
        const list = (speakers || []).filter(
            (s) => s.branch_id === null || s.branch_id === form.data.branch_id
        );
        if (form.data.speaker && !list.some((s) => s.name === form.data.speaker)) {
            list.push({ id: '__fallback', name: form.data.speaker, branch_id: null, fallback: true });
        }
        return list;
    }, [speakers, form.data.branch_id, form.data.speaker]);

    // ── Custom dates handlers ─────────────────────────────────
    const addCustomDate = () => {
        if (!customDateInput) return;
        if (form.data.start_date && customDateInput < form.data.start_date) return;
        if (form.data.end_date && customDateInput > form.data.end_date) return;
        if (form.data.custom_dates.includes(customDateInput)) return;
        form.setData('custom_dates', [...form.data.custom_dates, customDateInput].sort());
        setCustomDateInput('');
    };

    const removeCustomDate = (date) => {
        form.setData('custom_dates', form.data.custom_dates.filter((d) => d !== date));
    };

    // ── Modal open/close ──────────────────────────────────────
    const openCreate = () => {
        setEditingId(null);
        setDateMode('rentang');
        setCustomDateInput('');
        form.setData({
            ...emptyForm,
            branch_id: filters?.branch || (branches.length === 1 ? branches[0].id : ''),
        });
        form.clearErrors();
        setModalOpen(true);
    };

    const openEdit = (ev) => {
        setEditingId(ev.id);
        const hasCustom = Array.isArray(ev.custom_dates) && ev.custom_dates.length > 0;
        setDateMode(hasCustom ? 'custom' : 'rentang');
        setCustomDateInput('');
        form.setData({
            branch_id: ev.branch_id,
            title: ev.title || '',
            start_date: ev.start_date ? ev.start_date.substring(0, 10) : '',
            end_date: ev.end_date ? ev.end_date.substring(0, 10) : '',
            custom_dates: hasCustom ? ev.custom_dates.map((d) => d.substring(0, 10)) : [],
            speaker: ev.speaker || '',
            grade: ev.grade || '',
            status: ev.status,
            titik_deal: ev.titik_deal ?? '',
            titik_eksekusi: ev.titik_eksekusi ?? '',
            total_cost: ev.total_cost ?? '',
            revenue_komitmen: ev.revenue_komitmen ?? '',
            revenue_realisasi: ev.revenue_realisasi ?? '',
            has_mou: !!ev.has_mou,
            notes: ev.notes || '',
        });
        form.clearErrors();
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
    };

    const submit = (e) => {
        e.preventDefault();
        // Mode rentang → custom_dates dikosongkan
        form.transform((data) => ({
            ...data,
            custom_dates: dateMode === 'custom' ? data.custom_dates : [],
        }));
        const options = { preserveScroll: true, onSuccess: closeModal };
        if (editingId) {
            form.put(`/safdak-events/${editingId}`, options);
        } else {
            form.post('/safdak-events', options);
        }
    };

    // ── Aksi cepat ────────────────────────────────────────────
    const quickStatus = (ev, status) => {
        router.patch(`/safdak-events/${ev.id}/status`, { status }, { preserveScroll: true });
    };

    const destroy = (ev) => {
        const label = ev.title || `SafDak ${ev.speaker || ''} ${formatTanggalPendek(ev.start_date)}`;
        if (confirm(`Hapus kampanye "${label}"?`)) {
            router.delete(`/safdak-events/${ev.id}`, { preserveScroll: true });
        }
    };

    // Kampanye yang tanggal hari ini berada di dalam rentangnya
    const isAktifHariIni = (ev) => {
        if (!ev.start_date || !ev.end_date) return false;
        return TODAY >= ev.start_date.substring(0, 10) && TODAY <= ev.end_date.substring(0, 10);
    };

    const targetMin = Number(summary?.target_min ?? 0);
    const targetIdeal = Number(summary?.target_ideal ?? 0);
    const titikDeal = Number(summary?.titik_deal ?? 0);
    const titikEksekusi = Number(summary?.titik_eksekusi ?? 0);

    const pctDealVsMin = targetMin > 0 ? Math.round((titikDeal / targetMin) * 100) : null;
    const pctEksekusiVsDeal = titikDeal > 0 ? Math.round((titikEksekusi / titikDeal) * 100) : null;

    const barDeal = targetIdeal > 0 ? clampPct((titikDeal / targetIdeal) * 100) : 0;
    const barEksekusi = targetIdeal > 0 ? clampPct((titikEksekusi / targetIdeal) * 100) : 0;

    const totalKampanye = summary?.total ?? 0;
    const isKosong = (events?.length ?? 0) === 0;

    return (
        <AppLayout title="Pipeline Safari Dakwah">
            <Head title="Pipeline Safari Dakwah" />

            <div className="space-y-3">
                {/* ── Header ── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span>⏳</span> Pipeline Safari Dakwah
                        </h1>
                        <p className="text-sm text-gray-500">
                            Rencana &amp; progres kampanye &middot; target 2&ndash;3 titik/hari &middot;{' '}
                            <span className="font-medium text-gray-600">{periodLabel}</span>
                            {activeSpeaker && (
                                <>
                                    {' '}&middot;{' '}
                                    <span className="font-medium text-gray-600">{speakerFilterLabel}</span>
                                </>
                            )}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            onClick={openCreate}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-emerald-700 transition"
                        >
                            + Kampanye Baru
                        </button>
                    )}
                </div>

                {/* ── Ringkasan proses: total + funnel titik ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Total kampanye + sebaran status */}
                    <div className="bg-white border border-gray-200 rounded-xl p-3">
                        <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center text-base">
                                📋
                            </span>
                            <div className="min-w-0">
                                <div className="text-xs text-gray-500">Total Kampanye</div>
                                <div className="text-2xl font-bold text-gray-900 leading-tight">{totalKampanye}</div>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                            {statuses.map((s) => (
                                <span key={s} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                    <span className={`w-2 h-2 rounded-full ${STATUS_META[s]?.dot || 'bg-gray-300'}`} />
                                    {STATUS_META[s]?.label ?? s}{' '}
                                    <span className="font-semibold text-gray-700">{perStatus[s] ?? 0}</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Funnel titik */}
                    <div className="bg-white border border-gray-200 rounded-xl p-3 lg:col-span-2">
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-xs font-semibold text-gray-600">Funnel Titik</span>
                            <span className="text-[11px] text-gray-400">
                                target otomatis dari jumlah hari &middot; ℹ️ angka manajerial
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Target */}
                            <div>
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-xs text-gray-500">Target</span>
                                    <span className="text-sm font-bold text-slate-700 whitespace-nowrap">
                                        {targetMin}&ndash;{targetIdeal}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-slate-400" style={{ width: '100%' }} />
                                </div>
                                <div className="mt-1 text-[11px] text-gray-400">min &ndash; ideal</div>
                            </div>
                            {/* Deal */}
                            <div>
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-xs text-gray-500">Deal</span>
                                    <span className="text-sm font-bold text-amber-600">{titikDeal}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${barDeal}%` }} />
                                </div>
                                <div className="mt-1 text-[11px] text-gray-400">
                                    {pctDealVsMin !== null ? `${pctDealVsMin}% dari target min` : '—'}
                                </div>
                            </div>
                            {/* Eksekusi */}
                            <div>
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-xs text-gray-500">Eksekusi</span>
                                    <span className="text-sm font-bold text-emerald-700">{titikEksekusi}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${barEksekusi}%` }} />
                                </div>
                                <div className="mt-1 text-[11px] text-gray-400">
                                    {pctEksekusiVsDeal !== null ? `${pctEksekusiVsDeal}% dari deal` : '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Strip uang: komitmen / realisasi / cost ── */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50/70 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-600">💰 Revenue &amp; Biaya</span>
                        <span className="text-[11px] text-gray-400">
                            ℹ️ Angka manajerial &mdash; angka resmi tetap di laporan bulanan
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                        {/* Komitmen */}
                        <div className="p-3">
                            <div className="text-xs text-gray-500">Revenue Komitmen</div>
                            <div
                                className="text-xl font-bold text-gray-900 leading-tight"
                                title={formatRupiah(summary?.revenue_komitmen)}
                            >
                                {shortRupiah(summary?.revenue_komitmen)}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-400">
                                {totalKampanye} kampanye pada filter ini
                            </div>
                        </div>

                        {/* Realisasi + capaian */}
                        <div className="p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs text-gray-500">Revenue Realisasi</span>
                                <span className={`text-xs font-bold ${summaryPctMeta.text}`}>
                                    {summaryPct === null ? '—' : `${summaryPct}%`}
                                </span>
                            </div>
                            <div
                                className="text-xl font-bold text-emerald-700 leading-tight"
                                title={formatRupiah(summary?.revenue_realisasi)}
                            >
                                {shortRupiah(summary?.revenue_realisasi)}
                            </div>
                            {summaryPct !== null ? (
                                <>
                                    <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${summaryPctMeta.bar} rounded-full transition-all`}
                                            style={{ width: `${Math.min(summaryPct, 100)}%` }}
                                        />
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-400">
                                        Capaian vs komitmen
                                        {summaryPct > 100 && (
                                            <span className="text-emerald-700 font-medium"> &middot; melampaui komitmen</span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1 text-[11px] text-gray-400">
                                    Capaian muncul setelah Rev. Komitmen diisi.
                                </div>
                            )}
                        </div>

                        {/* Cost + rasio */}
                        <div className="p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs text-gray-500">Total Cost</span>
                                <span className={`text-xs font-bold ${summaryRasioMeta.text}`}>
                                    {summaryRasio.pct === null ? '—' : `↓ ${summaryRasio.pct}%`}
                                </span>
                            </div>
                            <div
                                className="text-xl font-bold text-gray-900 leading-tight"
                                title={formatRupiah(summary?.total_cost)}
                            >
                                {shortRupiah(summary?.total_cost)}
                            </div>
                            {summaryRasio.pct !== null ? (
                                <>
                                    <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                summaryRasio.pct <= 20
                                                    ? 'bg-emerald-500'
                                                    : summaryRasio.pct <= 35
                                                    ? 'bg-sky-500'
                                                    : summaryRasio.pct <= 50
                                                    ? 'bg-amber-500'
                                                    : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${clampPct(summaryRasio.pct)}%` }}
                                        />
                                    </div>
                                    <div className="mt-1 text-[11px] text-gray-400">
                                        Rasio Cost vs Realisasi &middot;{' '}
                                        <span className={summaryRasioMeta.text}>{rasioLabel(summaryRasio.pct)}</span>
                                        <span className="text-gray-300"> &middot; makin kecil makin baik</span>
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1 text-[11px] text-gray-400">{summaryRasio.note}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Filter bar ── */}
                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
                    {/* Tipe periode */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                            {PERIOD_TYPES.map((pt) => (
                                <button
                                    key={pt.type}
                                    onClick={() =>
                                        applyFilters({
                                            range: pt.preset ? periodPresets?.[pt.preset] || '' : '',
                                        })
                                    }
                                    className={`px-3 py-1.5 text-xs font-medium border-r border-gray-200 last:border-r-0 transition ${
                                        periodType === pt.type
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {pt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Navigasi periode */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => rangeNav?.prev && applyFilters({ range: rangeNav.prev })}
                            disabled={isAllPeriod || !rangeNav?.prev}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-30 disabled:hover:bg-white disabled:cursor-not-allowed"
                            aria-label="Periode sebelumnya"
                        >
                            &lsaquo;
                        </button>
                        <span className="text-sm font-semibold text-gray-800 min-w-[180px] text-center">
                            {periodLabel}
                        </span>
                        <button
                            onClick={() => rangeNav?.next && applyFilters({ range: rangeNav.next })}
                            disabled={isAllPeriod || !rangeNav?.next}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-30 disabled:hover:bg-white disabled:cursor-not-allowed"
                            aria-label="Periode berikutnya"
                        >
                            &rsaquo;
                        </button>
                        {showTodayButton && (
                            <button
                                onClick={() => applyFilters({ range: todayKey })}
                                className="px-3 h-8 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition"
                            >
                                Periode Ini
                            </button>
                        )}
                    </div>

                    {/* Cabang (pill) */}
                    {branches.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => applyFilters({ branch: '' })}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                                    !filters?.branch
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Semua Cabang
                            </button>
                            {branches.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => applyFilters({ branch: b.id })}
                                    title={b.name}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                                        filters?.branch === b.id
                                            ? 'bg-gray-900 text-white border-gray-900'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {b.code}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Dai (dropdown) */}
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-medium text-gray-600">🎤 Dai</label>
                        <select
                            value={activeSpeaker}
                            onChange={(e) => applyFilters({ speaker: e.target.value })}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700 max-w-[260px]"
                        >
                            <option value="">Semua dai</option>
                            {speakerNotInList && (
                                <option value={activeSpeaker}>{activeSpeaker} (di luar filter cabang)</option>
                            )}
                            {(speakerOptions || []).map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                            {hasUnnamedSpeaker && (
                                <option value={SPEAKER_NONE}>&mdash; Belum ditentukan &mdash;</option>
                            )}
                        </select>
                        {activeSpeaker && (
                            <button
                                onClick={() => applyFilters({ speaker: '' })}
                                className="text-xs text-gray-500 underline"
                            >
                                Reset dai
                            </button>
                        )}
                        {(speakerOptions || []).length === 0 && !hasUnnamedSpeaker && (
                            <span className="text-[11px] text-gray-400">
                                Belum ada kampanye untuk cabang ini
                            </span>
                        )}
                    </div>

                    {/* Status (pill) + jumlah */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => applyFilters({ status: '' })}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                                !activeStatus
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Semua status
                            <span className="ml-1 opacity-70">({totalKampanye})</span>
                        </button>
                        {statuses.map((s) => (
                            <button
                                key={s}
                                onClick={() => applyFilters({ status: activeStatus === s ? '' : s })}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                                    activeStatus === s
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : STATUS_META[s].badge + ' hover:opacity-80'
                                }`}
                            >
                                {STATUS_META[s].label}
                                <span className="ml-1 opacity-70">({perStatus[s] ?? 0})</span>
                            </button>
                        ))}
                    </div>

                    {/* Catatan: ringkasan mengikuti periode/cabang/dai, TAPI bukan status */}
                    {activeStatus && (
                        <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                            Ringkasan &amp; funnel di atas mengikuti filter{' '}
                            <span className="font-semibold">periode, cabang, dan dai</span>, tetapi{' '}
                            <span className="font-semibold">tidak</span> mengikuti filter status &mdash; angkanya
                            tetap menghitung semua status agar gambaran periodenya utuh. Yang disaring status{' '}
                            <span className="font-semibold">{STATUS_META[activeStatus]?.label ?? activeStatus}</span>{' '}
                            hanyalah daftar di bawah.
                        </div>
                    )}

                    {/* Catatan semantik periode panjang */}
                    {(periodType === 'quarter' || periodType === 'semester' || periodType === 'year') && (
                        <div className="text-[11px] text-gray-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                            Kampanye yang <span className="font-semibold">bersinggungan</span> dengan periode ini
                            dihitung penuh &mdash; kampanye lintas periode akan muncul di kedua periode, jadi angka
                            antar-periode tidak untuk dijumlahkan.
                        </div>
                    )}
                </div>

                {/* ── Tabel (desktop) ── */}
                <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-3 py-2.5 pl-5">Periode</th>
                                <th className="px-3 py-2.5">Cabang</th>
                                <th className="px-3 py-2.5">Dai</th>
                                <th className="px-3 py-2.5 text-center border-l border-gray-200">Hari</th>
                                <th className="px-3 py-2.5 text-center">Target</th>
                                <th className="px-3 py-2.5 text-center">Deal</th>
                                <th className="px-3 py-2.5 text-center">Eksekusi</th>
                                <th className="px-3 py-2.5 text-right border-l border-gray-200" title="Total cost kampanye + rasio terhadap realisasi">
                                    Cost
                                </th>
                                <th className="px-3 py-2.5 text-right">Komitmen / Realisasi</th>
                                <th className="px-3 py-2.5 text-center" title="Realisasi dibagi komitmen">
                                    Capaian
                                </th>
                                <th className="px-3 py-2.5 text-center border-l border-gray-200">Status</th>
                                {canWrite && <th className="px-3 py-2.5 text-right">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isKosong && (
                                <tr>
                                    <td colSpan={canWrite ? 12 : 11} className="px-3 py-12 text-center">
                                        <div className="text-4xl mb-2">🗂️</div>
                                        <div className="text-sm font-medium text-gray-700">
                                            Belum ada kampanye pada filter ini
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Coba ganti periode, dai, atau status di atas
                                            {canWrite && ', atau buat lewat tombol "+ Kampanye Baru"'}.
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {events.map((ev) => {
                                const aktif = isAktifHariIni(ev);
                                return (
                                    <tr key={ev.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="relative px-3 py-2.5 pl-5 whitespace-nowrap">
                                            <span
                                                className={`absolute left-0 top-0 bottom-0 w-1 ${
                                                    STATUS_META[ev.status]?.accent || 'bg-gray-200'
                                                }`}
                                            />
                                            <div className="text-gray-800">
                                                {formatTanggalPendek(ev.start_date)} &ndash; {formatTanggal(ev.end_date)}
                                            </div>
                                            {aktif && (
                                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-gray-900 text-white text-[10px] font-bold">
                                                    HARI INI
                                                </span>
                                            )}
                                            {Array.isArray(ev.custom_dates) && ev.custom_dates.length > 0 && (
                                                <div className="text-[11px] text-gray-400">
                                                    {ev.custom_dates.length} tanggal terpilih
                                                </div>
                                            )}
                                            {ev.title && <div className="text-xs text-gray-500">{ev.title}</div>}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-gray-700">{ev.branch?.code}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="text-gray-800">{ev.speaker || '—'}</div>
                                            <div className="flex flex-wrap gap-x-2 text-[11px] text-gray-400">
                                                {ev.grade && <span>Grade {ev.grade}</span>}
                                                {ev.has_mou && <span className="text-blue-600">MOU ✓</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-600 border-l border-gray-100">
                                            {ev.total_days}
                                        </td>
                                        <td className="px-3 py-2.5 text-center whitespace-nowrap text-gray-500">
                                            {ev.target_min}&ndash;{ev.target_ideal}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="text-amber-600 font-semibold">{ev.titik_deal ?? '—'}</span>
                                            <MiniBar value={ev.titik_deal} max={ev.target_ideal} color="bg-amber-400" />
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="text-emerald-700 font-semibold">{ev.titik_eksekusi ?? '—'}</span>
                                            <MiniBar value={ev.titik_eksekusi} max={ev.target_ideal} color="bg-emerald-500" />
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-l border-gray-100">
                                            <div className="text-gray-700">{formatRupiah(ev.total_cost)}</div>
                                            <div className="mt-0.5">
                                                <RasioBadge cost={ev.total_cost} realisasi={ev.revenue_realisasi} />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                            <div className="text-gray-700">{formatRupiah(ev.revenue_komitmen)}</div>
                                            <div className="text-emerald-700 font-medium">
                                                {formatRupiah(ev.revenue_realisasi)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                            <CapaianBadge
                                                komitmen={ev.revenue_komitmen}
                                                realisasi={ev.revenue_realisasi}
                                                withBar
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 text-center border-l border-gray-100">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_META[ev.status]?.badge}`}
                                            >
                                                {STATUS_META[ev.status]?.label ?? ev.status}
                                            </span>
                                        </td>
                                        {canWrite && (
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                {NEXT_STATUS[ev.status] && (
                                                    <button
                                                        onClick={() => quickStatus(ev, NEXT_STATUS[ev.status])}
                                                        className="text-xs text-emerald-700 hover:underline mr-2"
                                                        title={`Naikkan ke ${STATUS_META[NEXT_STATUS[ev.status]].label}`}
                                                    >
                                                        &rarr; {STATUS_META[NEXT_STATUS[ev.status]].label}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openEdit(ev)}
                                                    className="text-xs text-blue-600 hover:underline mr-2"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => destroy(ev)}
                                                    className="text-xs text-red-600 hover:underline"
                                                >
                                                    Hapus
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Kartu (mobile) ── */}
                <div className="md:hidden space-y-2">
                    {isKosong && (
                        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                            <div className="text-3xl mb-2">🗂️</div>
                            <div className="text-sm font-medium text-gray-700">Belum ada kampanye</div>
                            <div className="text-xs text-gray-500 mt-1">
                                Coba ganti periode, dai, atau status di atas.
                            </div>
                        </div>
                    )}
                    {events.map((ev) => (
                        <div
                            key={ev.id}
                            className="bg-white border border-gray-200 rounded-xl overflow-hidden flex"
                        >
                            <span className={`w-1 shrink-0 ${STATUS_META[ev.status]?.accent || 'bg-gray-200'}`} />
                            <div className="flex-1 min-w-0 p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-900 truncate">
                                            {ev.speaker || ev.title || 'Kampanye SafDak'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {ev.branch?.code} &middot; {formatTanggalPendek(ev.start_date)} &ndash;{' '}
                                            {formatTanggal(ev.end_date)}
                                            {ev.grade && ` · Grade ${ev.grade}`}
                                        </div>
                                    </div>
                                    <span
                                        className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_META[ev.status]?.badge}`}
                                    >
                                        {STATUS_META[ev.status]?.label ?? ev.status}
                                    </span>
                                </div>

                                {isAktifHariIni(ev) && (
                                    <span className="inline-block px-1.5 py-0.5 rounded-full bg-gray-900 text-white text-[10px] font-bold">
                                        HARI INI
                                    </span>
                                )}

                                {/* Titik */}
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                    <span>🎯 {ev.total_days} hari</span>
                                    <span className="text-gray-400">|</span>
                                    <span>
                                        Target <span className="font-medium text-slate-700">{ev.target_min}&ndash;{ev.target_ideal}</span>
                                    </span>
                                    <span className="text-gray-400">|</span>
                                    <span>
                                        D <span className="text-amber-600 font-semibold">{ev.titik_deal ?? '—'}</span>
                                        {' / '}
                                        E <span className="text-emerald-700 font-semibold">{ev.titik_eksekusi ?? '—'}</span>
                                    </span>
                                    {ev.has_mou && <span className="text-blue-600">MOU ✓</span>}
                                </div>

                                {/* Uang */}
                                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Komitmen</span>
                                        <span className="font-medium text-gray-800">{formatRupiah(ev.revenue_komitmen)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Realisasi</span>
                                        <span className="font-medium text-emerald-700">{formatRupiah(ev.revenue_realisasi)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Capaian</span>
                                        <CapaianBadge komitmen={ev.revenue_komitmen} realisasi={ev.revenue_realisasi} />
                                    </div>
                                    <div className="h-px bg-gray-200" />
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Cost</span>
                                        <span className="font-medium text-gray-800">{formatRupiah(ev.total_cost)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-500">Rasio Cost vs Realisasi</span>
                                        <RasioBadge cost={ev.total_cost} realisasi={ev.revenue_realisasi} />
                                    </div>
                                </div>

                                {canWrite && (
                                    <div className="flex gap-3 pt-0.5">
                                        {NEXT_STATUS[ev.status] && (
                                            <button
                                                onClick={() => quickStatus(ev, NEXT_STATUS[ev.status])}
                                                className="text-xs text-emerald-700 font-medium"
                                            >
                                                &rarr; {STATUS_META[NEXT_STATUS[ev.status]].label}
                                            </button>
                                        )}
                                        <button onClick={() => openEdit(ev)} className="text-xs text-blue-600 font-medium">
                                            Edit
                                        </button>
                                        <button onClick={() => destroy(ev)} className="text-xs text-red-600 font-medium">
                                            Hapus
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Legenda metrik ── */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 px-1">
                    <span>
                        <span className="font-semibold text-gray-500">Capaian</span> = realisasi &divide; komitmen &middot; makin besar makin baik
                    </span>
                    <span>
                        <span className="font-semibold text-gray-500">↓ Rasio Cost</span> = cost &divide; realisasi &middot; makin kecil makin baik
                    </span>
                    <span>&mdash; = belum bisa dihitung (penyebut kosong)</span>
                </div>
            </div>

            {/* ── Modal form ── */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-3 overflow-y-auto"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-xl w-full max-w-lg my-6 p-4 space-y-3 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold text-gray-800">
                            {editingId ? '✏️ Edit Kampanye' : '➕ Kampanye Baru'}
                        </h2>

                        <form onSubmit={submit} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Cabang *</label>
                                    <select
                                        value={form.data.branch_id}
                                        onChange={(e) => form.setData('branch_id', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        required
                                    >
                                        <option value="">— Pilih cabang —</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.code} — {b.name}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.branch_id && (
                                        <p className="text-xs text-red-600 mt-0.5">{form.errors.branch_id}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Label (opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.title}
                                        onChange={(e) => form.setData('title', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        placeholder="cth: SafDak Ramadan"
                                    />
                                </div>
                            </div>

                            {/* Periode */}
                            <div className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-600">Periode Kampanye *</span>
                                    <div className="flex rounded-lg border overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setDateMode('rentang')}
                                            className={`px-3 py-1 ${
                                                dateMode === 'rentang'
                                                    ? 'bg-gray-800 text-white'
                                                    : 'bg-white text-gray-600'
                                            }`}
                                        >
                                            Rentang penuh
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDateMode('custom')}
                                            className={`px-3 py-1 ${
                                                dateMode === 'custom'
                                                    ? 'bg-gray-800 text-white'
                                                    : 'bg-white text-gray-600'
                                            }`}
                                        >
                                            Tanggal custom
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">Tanggal mulai</label>
                                        <input
                                            type="date"
                                            value={form.data.start_date}
                                            onChange={(e) => form.setData('start_date', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                            required
                                        />
                                        {form.errors.start_date && (
                                            <p className="text-xs text-red-600 mt-0.5">{form.errors.start_date}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">Tanggal akhir</label>
                                        <input
                                            type="date"
                                            value={form.data.end_date}
                                            onChange={(e) => form.setData('end_date', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                            required
                                        />
                                        {form.errors.end_date && (
                                            <p className="text-xs text-red-600 mt-0.5">{form.errors.end_date}</p>
                                        )}
                                    </div>
                                </div>

                                {dateMode === 'custom' && (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                value={customDateInput}
                                                min={form.data.start_date || undefined}
                                                max={form.data.end_date || undefined}
                                                onChange={(e) => setCustomDateInput(e.target.value)}
                                                className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={addCustomDate}
                                                disabled={!customDateInput}
                                                className="px-3 py-1.5 text-xs border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
                                            >
                                                + Tambah
                                            </button>
                                        </div>
                                        {form.data.custom_dates.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {form.data.custom_dates.map((d) => (
                                                    <span
                                                        key={d}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border rounded-full text-[11px] text-gray-700"
                                                    >
                                                        {formatTanggalPendek(d)}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCustomDate(d)}
                                                            className="text-red-500 hover:text-red-700 font-bold"
                                                            aria-label={`Hapus ${d}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-gray-400">
                                                Pilih tanggal dalam rentang di atas (mis. akhir pekan saja).
                                            </p>
                                        )}
                                        {form.errors.custom_dates && (
                                            <p className="text-xs text-red-600">{form.errors.custom_dates}</p>
                                        )}
                                    </div>
                                )}

                                {/* Preview target live */}
                                <div className="text-xs text-gray-600 bg-white border rounded-lg px-3 py-2">
                                    📊 <span className="font-medium">{previewDays} hari</span> &rarr; target{' '}
                                    <span className="font-bold text-slate-700">
                                        min {previewDays * TARGET_MIN_PER_DAY}
                                    </span>{' '}
                                    &middot;{' '}
                                    <span className="font-bold text-emerald-700">
                                        ideal {previewDays * TARGET_IDEAL_PER_DAY}
                                    </span>{' '}
                                    titik <span className="text-gray-400">(otomatis, tidak perlu diinput)</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nama Dai</label>
                                    <select
                                        value={form.data.speaker}
                                        onChange={(e) => form.setData('speaker', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        disabled={!form.data.branch_id}
                                    >
                                        <option value="">— Belum ditentukan —</option>
                                        {speakerOptionsForm.map((s) => (
                                            <option key={s.id} value={s.name}>
                                                {s.name}
                                                {s.branch_id === null && !s.fallback ? ' · Nasional' : ''}
                                                {s.fallback ? ' (belum di master)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {!form.data.branch_id && (
                                        <p className="text-[11px] text-gray-400 mt-0.5">Pilih cabang dulu</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Grade Dai</label>
                                    <input
                                        type="text"
                                        value={form.data.grade}
                                        onChange={(e) => form.setData('grade', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        placeholder="cth: A / B / C"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                                    <select
                                        value={form.data.status}
                                        onChange={(e) => form.setData('status', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        required
                                    >
                                        {statuses.map((s) => (
                                            <option key={s} value={s}>
                                                {STATUS_META[s].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end pb-1.5">
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={form.data.has_mou}
                                            onChange={(e) => form.setData('has_mou', e.target.checked)}
                                            className="rounded"
                                        />
                                        Sudah ada MOU
                                    </label>
                                </div>
                            </div>

                            {/* Input progres tim */}
                            <div className="border rounded-lg p-3 space-y-3 bg-gray-50/50">
                                <span className="text-xs font-medium text-gray-600">Progres (diisi tim)</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">Titik Deal</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.titik_deal}
                                            onChange={(e) => form.setData('titik_deal', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">Titik Eksekusi</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.titik_eksekusi}
                                            onChange={(e) => form.setData('titik_eksekusi', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">Total Cost (Rp)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.total_cost}
                                            onChange={(e) => form.setData('total_cost', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            Rev. Komitmen (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.revenue_komitmen}
                                            onChange={(e) => form.setData('revenue_komitmen', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            Rev. Realisasi (Rp)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.revenue_realisasi}
                                            onChange={(e) => form.setData('revenue_realisasi', e.target.value)}
                                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Preview turunan live di form */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="text-xs text-gray-600 bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
                                        📈 <span className="text-gray-500">Capaian:</span>
                                        <CapaianBadge
                                            komitmen={form.data.revenue_komitmen}
                                            realisasi={form.data.revenue_realisasi}
                                        />
                                    </div>
                                    <div className="text-xs text-gray-600 bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
                                        🧾 <span className="text-gray-500">Rasio Cost:</span>
                                        <RasioBadge
                                            cost={form.data.total_cost}
                                            realisasi={form.data.revenue_realisasi}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
                                <textarea
                                    value={form.data.notes}
                                    onChange={(e) => form.setData('notes', e.target.value)}
                                    rows={2}
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {form.processing ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Tambah Kampanye'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
