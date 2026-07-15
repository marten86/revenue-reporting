import { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Components/AppLayout';

const STATUS_META = {
    rencana:  { label: 'Rencana',  badge: 'bg-slate-100 text-slate-700 border-slate-300',  dot: 'bg-slate-400' },
    berjalan: { label: 'Berjalan', badge: 'bg-amber-100 text-amber-800 border-amber-300',  dot: 'bg-amber-500' },
    selesai:  { label: 'Selesai',  badge: 'bg-green-100 text-green-800 border-green-300',  dot: 'bg-green-500' },
    batal:    { label: 'Batal',    badge: 'bg-red-100 text-red-700 border-red-300',        dot: 'bg-red-500' },
};

const NEXT_STATUS = { rencana: 'berjalan', berjalan: 'selesai' };

const TARGET_MIN_PER_DAY = 2;   // samakan dengan konstanta di model SafdakEvent
const TARGET_IDEAL_PER_DAY = 3;

const formatRupiah = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return 'Rp ' + Number(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
};

const formatTanggal = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTanggalPendek = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const currentMonthStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (monthStr, delta) => {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (monthStr) => {
    if (!monthStr) return 'Semua bulan';
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

// Jumlah hari (frontend, untuk preview live di form) — logika sama dengan
// accessor total_days di model
const countDays = (startDate, endDate, customDates) => {
    if (Array.isArray(customDates) && customDates.length > 0) return customDates.length;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
};

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

export default function Index({ events, branches, speakers, reports = [], statuses, summary, filters, canWrite }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [dateMode, setDateMode] = useState('rentang'); // 'rentang' | 'custom'
    const [customDateInput, setCustomDateInput] = useState('');
    const [realizeFor, setRealizeFor] = useState(null); // kampanye yang sedang dicatat realisasinya

    const form = useForm({ ...emptyForm });

    const formR = useForm({
        monthly_report_id: '',
        date: '',
        time: '',
        location: '',
        commitment: '',
        realization: '',
        cost: '',
        notes: '',
    });

    const monthYearLabel = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr.substring(0, 10) + 'T00:00:00');
        return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    };

    // Laporan kandidat untuk kampanye yang dipilih (cabang sama)
    const reportOptions = useMemo(() => {
        if (!realizeFor) return [];
        return reports.filter((r) => r.branch_id === realizeFor.branch_id);
    }, [reports, realizeFor]);

    const openRealize = (ev) => {
        setRealizeFor(ev);
        formR.setData({
            monthly_report_id: '',
            date: ev.end_date ? ev.end_date.substring(0, 10) : '',
            time: '',
            location: '',
            commitment: ev.revenue_komitmen ? Math.round(Number(ev.revenue_komitmen)) : '',
            realization: ev.revenue_realisasi ? Math.round(Number(ev.revenue_realisasi)) : '',
            cost: '',
            notes: '',
        });
        formR.clearErrors();
    };

    const closeRealize = () => setRealizeFor(null);

    const submitRealize = (e) => {
        e.preventDefault();
        formR.post(`/safdak-events/${realizeFor.id}/realization`, {
            preserveScroll: true,
            onSuccess: closeRealize,
        });
    };

    const perStatus = summary?.per_status ?? {};

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
        if (next.month) query.month = next.month;
        router.get('/safari-pipeline', query, { preserveState: true, preserveScroll: true });
    };

    const activeMonth = filters?.month || '';

    // ── Dai untuk cabang terpilih di form ─────────────────────
    const speakerOptions = useMemo(() => {
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

    const pctDealVsMin = summary?.target_min > 0
        ? Math.round((summary.titik_deal / summary.target_min) * 100)
        : null;
    const pctEksekusiVsDeal = summary?.titik_deal > 0
        ? Math.round((summary.titik_eksekusi / summary.titik_deal) * 100)
        : null;

    return (
        <AppLayout title="Pipeline Safari Dakwah">
            <Head title="Pipeline Safari Dakwah" />

            <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">🎯 Pipeline Safari Dakwah</h1>
                        <p className="text-sm text-gray-500">
                            Kampanye per periode &middot; target 2&ndash;3 titik/hari &middot; {monthLabel(activeMonth)}
                        </p>
                    </div>
                    {canWrite && (
                        <button
                            onClick={openCreate}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                        >
                            + Kampanye Baru
                        </button>
                    )}
                </div>

                {/* Ringkasan funnel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white border rounded-xl p-3">
                        <div className="text-xs text-gray-500">Total Kampanye</div>
                        <div className="text-2xl font-bold text-gray-800">{summary?.total ?? 0}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {statuses.map((s) => (
                                <span key={s} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                <span className={`w-2 h-2 rounded-full ${STATUS_META[s]?.dot || 'bg-gray-300'}`}></span>
                                    {perStatus[s] ?? 0}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-3">
                        <div className="text-xs text-gray-500">Target Titik</div>
                        <div className="text-2xl font-bold text-slate-700">
                            {summary?.target_min ?? 0}
                            <span className="text-sm font-normal text-gray-400"> – {summary?.target_ideal ?? 0}</span>
                        </div>
                        <div className="text-[11px] text-gray-400">min – ideal (otomatis dari hari)</div>
                    </div>
                    <div className="bg-white border rounded-xl p-3">
                        <div className="text-xs text-gray-500">Titik Deal</div>
                        <div className="text-2xl font-bold text-amber-600">{summary?.titik_deal ?? 0}</div>
                        <div className="text-[11px] text-gray-400">
                            {pctDealVsMin !== null ? `${pctDealVsMin}% dari target min` : '—'}
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-3">
                        <div className="text-xs text-gray-500">Titik Eksekusi</div>
                        <div className="text-2xl font-bold text-green-600">{summary?.titik_eksekusi ?? 0}</div>
                        <div className="text-[11px] text-gray-400">
                            {pctEksekusiVsDeal !== null ? `${pctEksekusiVsDeal}% dari deal` : '—'}
                        </div>
                    </div>
                </div>

                {/* Strip revenue (informasional) */}
                <div className="bg-white border rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                    <div>
                        <span className="text-xs text-gray-500">Revenue Komitmen: </span>
                        <span className="text-sm font-bold text-gray-800">{formatRupiah(summary?.revenue_komitmen)}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500">Revenue Realisasi: </span>
                        <span className="text-sm font-bold text-emerald-700">{formatRupiah(summary?.revenue_realisasi)}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                        ℹ️ Angka manajerial — angka resmi tetap di laporan bulanan
                    </div>
                </div>

                {/* Filter bar */}
                <div className="bg-white border rounded-xl p-3 space-y-3">
                    {/* Bulan */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => applyFilters({ month: shiftMonth(activeMonth || currentMonthStr(), -1) })}
                            className="px-2 py-1 border rounded-lg text-sm hover:bg-gray-50"
                            aria-label="Bulan sebelumnya"
                        >
                            &larr;
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
                            {monthLabel(activeMonth)}
                        </span>
                        <button
                            onClick={() => applyFilters({ month: shiftMonth(activeMonth || currentMonthStr(), 1) })}
                            className="px-2 py-1 border rounded-lg text-sm hover:bg-gray-50"
                            aria-label="Bulan berikutnya"
                        >
                            &rarr;
                        </button>
                        {activeMonth ? (
                            <button
                                onClick={() => applyFilters({ month: '' })}
                                className="text-xs text-gray-500 underline ml-1"
                            >
                                Semua bulan
                            </button>
                        ) : (
                            <button
                                onClick={() => applyFilters({ month: currentMonthStr() })}
                                className="text-xs text-gray-500 underline ml-1"
                            >
                                Bulan ini
                            </button>
                        )}
                    </div>

                    {/* Cabang (pill) */}
                    {branches.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => applyFilters({ branch: '' })}
                                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                    !filters?.branch
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Semua
                            </button>
                            {branches.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => applyFilters({ branch: b.id })}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                        filters?.branch === b.id
                                            ? 'bg-gray-800 text-white border-gray-800'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {b.code}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Status (pill) */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => applyFilters({ status: '' })}
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                !filters?.status
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Semua status
                        </button>
                        {statuses.map((s) => (
                            <button
                                key={s}
                                onClick={() => applyFilters({ status: s })}
                                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                    filters?.status === s
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : STATUS_META[s].badge + ' hover:opacity-80'
                                }`}
                            >
                                {STATUS_META[s].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tabel (desktop) ── */}
                <div className="hidden md:block bg-white border rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                            <tr>
                                <th className="px-3 py-2">Periode</th>
                                <th className="px-3 py-2">Cabang</th>
                                <th className="px-3 py-2">Dai</th>
                                <th className="px-3 py-2 text-center">Hari</th>
                                <th className="px-3 py-2 text-center">Target</th>
                                <th className="px-3 py-2 text-center">D / E</th>
                                <th className="px-3 py-2 text-right">Cost</th>
                                <th className="px-3 py-2 text-right">Komitmen / Realisasi</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                {canWrite && <th className="px-3 py-2 text-right">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {events.length === 0 && (
                                <tr>
                                    <td colSpan={canWrite ? 10 : 9} className="px-3 py-8 text-center text-gray-400">
                                        Belum ada kampanye pada filter ini.
                                        {canWrite && ' Tambahkan lewat tombol "+ Kampanye Baru".'}
                                    </td>
                                </tr>
                            )}
                            {events.map((ev) => (
                                <tr key={ev.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <div>
                                            {formatTanggalPendek(ev.start_date)} &ndash; {formatTanggal(ev.end_date)}
                                        </div>
                                        {Array.isArray(ev.custom_dates) && ev.custom_dates.length > 0 && (
                                            <div className="text-[11px] text-gray-400">
                                                {ev.custom_dates.length} tanggal terpilih
                                            </div>
                                        )}
                                        {ev.title && <div className="text-xs text-gray-500">{ev.title}</div>}
                                    </td>
                                    <td className="px-3 py-2 font-medium">{ev.branch?.code}</td>
                                    <td className="px-3 py-2">
                                        <div>{ev.speaker || '—'}</div>
                                        {ev.grade && (
                                            <div className="text-[11px] text-gray-400">Grade: {ev.grade}</div>
                                        )}
                                        {ev.has_mou && <div className="text-[11px] text-gray-400">MOU ✅</div>}
                                    </td>
                                    <td className="px-3 py-2 text-center">{ev.total_days}</td>
                                    <td className="px-3 py-2 text-center whitespace-nowrap text-gray-600">
                                        {ev.target_min}&ndash;{ev.target_ideal}
                                    </td>
                                    <td className="px-3 py-2 text-center whitespace-nowrap">
                                        <span className="text-amber-600 font-medium">{ev.titik_deal ?? '—'}</span>
                                        {' / '}
                                        <span className="text-green-600 font-medium">{ev.titik_eksekusi ?? '—'}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        {formatRupiah(ev.total_cost)}
                                    </td>
                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <div>{formatRupiah(ev.revenue_komitmen)}</div>
                                        <div className="text-emerald-700">{formatRupiah(ev.revenue_realisasi)}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_META[ev.status]?.badge}`}
                                        >
                                            {STATUS_META[ev.status]?.label ?? ev.status}
                                        </span>
                                    </td>
                                    {canWrite && (
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {['berjalan', 'selesai'].includes(ev.status) && (
                                                <button
                                                    onClick={() => openRealize(ev)}
                                                    className="text-xs text-purple-700 hover:underline mr-2"
                                                    title="Catat ke laporan bulanan sebagai realisasi"
                                                >
                                                    💾 Realisasi
                                                </button>
                                            )}
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
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Kartu (mobile) ── */}
                <div className="md:hidden space-y-2">
                    {events.length === 0 && (
                        <div className="bg-white border rounded-xl p-6 text-center text-sm text-gray-400">
                            Belum ada kampanye pada filter ini.
                        </div>
                    )}
                    {events.map((ev) => (
                        <div key={ev.id} className="bg-white border rounded-xl p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="font-medium text-gray-800">
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
                            <div className="text-xs text-gray-600">
                                {ev.total_days} hari &middot; Target {ev.target_min}&ndash;{ev.target_ideal} &middot; D{' '}
                                <span className="text-amber-600 font-medium">{ev.titik_deal ?? '—'}</span> / E{' '}
                                <span className="text-green-600 font-medium">{ev.titik_eksekusi ?? '—'}</span>
                                {ev.has_mou ? ' · MOU ✅' : ''}
                            </div>
                            <div className="text-xs text-gray-600">
                                Cost {formatRupiah(ev.total_cost)} &middot; Komit {formatRupiah(ev.revenue_komitmen)}{' '}
                                &middot; <span className="text-emerald-700">Real {formatRupiah(ev.revenue_realisasi)}</span>
                            </div>
                            {canWrite && (
                                <div className="flex gap-3 pt-1">
                                    {['berjalan', 'selesai'].includes(ev.status) && (
                                        <button
                                            onClick={() => openRealize(ev)}
                                            className="text-xs text-purple-700 font-medium"
                                        >
                                            💾 Realisasi
                                        </button>
                                    )}
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
                    ))}
                </div>
            </div>

            {/* ── Modal form ── */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-3 overflow-y-auto"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-xl w-full max-w-lg my-6 p-4 space-y-3"
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
                                        {speakerOptions.map((s) => (
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

            {/* ── Modal Catat Realisasi (jembatan kampanye → log) ── */}
            {realizeFor && (
                <div
                    className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-3 overflow-y-auto"
                    onClick={closeRealize}
                >
                    <div
                        className="bg-white rounded-xl w-full max-w-lg my-6 p-4 space-y-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">💾 Catat Realisasi</h2>
                            <p className="text-xs text-gray-500">
                                {realizeFor.speaker || realizeFor.title || 'Kampanye'} &middot;{' '}
                                {formatTanggalPendek(realizeFor.start_date)} &ndash;{' '}
                                {formatTanggal(realizeFor.end_date)} &middot; masuk ke laporan bulanan sebagai
                                entri Safari Dakwah resmi.
                            </p>
                        </div>

                        <form onSubmit={submitRealize} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Laporan Bulanan Tujuan *
                                </label>
                                <select
                                    value={formR.data.monthly_report_id}
                                    onChange={(e) => formR.setData('monthly_report_id', e.target.value)}
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    required
                                >
                                    <option value="">— Pilih laporan —</option>
                                    {reportOptions.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {monthYearLabel(r.period_month)} — {r.status}
                                        </option>
                                    ))}
                                </select>
                                {reportOptions.length === 0 && (
                                    <p className="text-[11px] text-amber-600 mt-1">
                                        ⚠️ Belum ada laporan bulanan untuk cabang ini (6 bulan terakhir).
                                        Buat dulu lewat menu Laporan Revenue, lalu kembali ke sini.
                                    </p>
                                )}
                                {formR.errors.monthly_report_id && (
                                    <p className="text-xs text-red-600 mt-0.5">{formR.errors.monthly_report_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Tanggal Kegiatan *
                                    </label>
                                    <input
                                        type="date"
                                        value={formR.data.date}
                                        onChange={(e) => formR.setData('date', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        required
                                    />
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        Tanggal asli acara — boleh bulan lampau
                                    </p>
                                    {formR.errors.date && (
                                        <p className="text-xs text-red-600 mt-0.5">{formR.errors.date}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Waktu</label>
                                    <input
                                        type="text"
                                        value={formR.data.time}
                                        onChange={(e) => formR.setData('time', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                        placeholder="cth: Ba'da Subuh"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Lokasi</label>
                                <input
                                    type="text"
                                    value={formR.data.location}
                                    onChange={(e) => formR.setData('location', e.target.value)}
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    placeholder="Masjid / alamat titik"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Komitmen (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formR.data.commitment}
                                        onChange={(e) => formR.setData('commitment', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Realisasi (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formR.data.realization}
                                        onChange={(e) => formR.setData('realization', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Cost (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formR.data.cost}
                                        onChange={(e) => formR.setData('cost', e.target.value)}
                                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
                                <textarea
                                    value={formR.data.notes}
                                    onChange={(e) => formR.setData('notes', e.target.value)}
                                    rows={2}
                                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                                />
                            </div>

                            <p className="text-[11px] text-gray-400">
                                ℹ️ Angka di sini menjadi angka resmi laporan bulanan (berbeda dari angka
                                manajerial kampanye). Nama dai ({realizeFor.speaker || '-'}) ikut tercatat
                                otomatis.
                            </p>

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={closeRealize}
                                    className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={formR.processing || reportOptions.length === 0}
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-lg hover:bg-purple-800 disabled:opacity-50"
                                >
                                    {formR.processing ? 'Menyimpan…' : 'Catat ke Laporan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
