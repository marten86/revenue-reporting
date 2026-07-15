import { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/Components/AppLayout';

// ── Palet cabang: warna tetap per index supaya konsisten antar bulan ──
const BRANCH_COLORS = [
    { chip: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
    { chip: 'bg-sky-100 text-sky-800 border-sky-300', dot: 'bg-sky-500' },
    { chip: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
    { chip: 'bg-violet-100 text-violet-800 border-violet-300', dot: 'bg-violet-500' },
    { chip: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
    { chip: 'bg-teal-100 text-teal-800 border-teal-300', dot: 'bg-teal-500' },
    { chip: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
    { chip: 'bg-indigo-100 text-indigo-800 border-indigo-300', dot: 'bg-indigo-500' },
];

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd'];

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const LEVEL_BADGE = {
    'Nasional Grade A': 'bg-green-600 text-white',
    'Nasional Grade B': 'bg-green-100 text-green-800',
    'Lokal': 'bg-blue-100 text-blue-800',
    'Internal': 'bg-gray-200 text-gray-700',
};

// Badge status kampanye (pipeline) — samakan istilah dengan /safari-pipeline
const CAMPAIGN_STATUS = {
    rencana:  { label: 'Rencana',  badge: 'bg-slate-100 text-slate-700' },
    berjalan: { label: 'Berjalan', badge: 'bg-amber-100 text-amber-800' },
    selesai:  { label: 'Selesai',  badge: 'bg-emerald-100 text-emerald-700' },
    batal:    { label: 'Batal',    badge: 'bg-rose-100 text-rose-700' },
};

const rupiah = (n) =>
    'Rp ' + new Intl.NumberFormat('id-ID').format(n || 0);

const shortRupiah = (n) => {
    if (!n) return 'Rp 0';
    if (n >= 1000000000) return 'Rp ' + (n / 1000000000).toFixed(2).replace('.', ',') + ' M';
    if (n >= 1000000) return 'Rp ' + Math.round(n / 1000000) + ' jt';
    return rupiah(n);
};

const tanggalPendek = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()].slice(0, 3);
};

export default function SafariCalendarIndex({ month, logs, events = [], branches, branchFilter, canSeeAll }) {
    const [selected, setSelected] = useState(null);           // log realisasi
    const [selectedEvent, setSelectedEvent] = useState(null); // kampanye pipeline

    const [year, monthNum] = month.split('-').map(Number);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Map warna per cabang
    const branchColor = useMemo(() => {
        const map = {};
        branches.forEach((b, i) => {
            map[b.id] = BRANCH_COLORS[i % BRANCH_COLORS.length];
        });
        return map;
    }, [branches]);

    // Kelompokkan log per tanggal
    const logsByDate = useMemo(() => {
        const map = {};
        logs.forEach((log) => {
            if (!map[log.date]) map[log.date] = [];
            map[log.date].push(log);
        });
        return map;
    }, [logs]);

    // Kelompokkan kampanye per tanggal aktifnya (satu kampanye bisa banyak hari)
    const eventsByDate = useMemo(() => {
        const map = {};
        events.forEach((ev) => {
            (ev.dates || []).forEach((dateStr) => {
                if (!map[dateStr]) map[dateStr] = [];
                map[dateStr].push(ev);
            });
        });
        return map;
    }, [events]);

    // Bangun grid: minggu dimulai Senin
    const weeks = useMemo(() => {
        const first = new Date(year, monthNum - 1, 1);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const startOffset = (first.getDay() + 6) % 7; // Senin = 0

        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({
                day: d,
                dateStr,
                events: logsByDate[dateStr] || [],
                campaigns: eventsByDate[dateStr] || [],
            });
        }
        while (cells.length % 7 !== 0) cells.push(null);

        const rows = [];
        for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
        return rows;
    }, [year, monthNum, logsByDate, eventsByDate]);

    // Ringkasan bulan berjalan (rupiah tetap HANYA dari logs — kampanye tidak
    // pernah dijumlahkan ke komitmen/realisasi agar tak dobel hitung)
    const summary = useMemo(() => {
        const total = logs.length;
        const commitment = logs.reduce((s, l) => s + (l.commitment || 0), 0);
        const realization = logs.reduce((s, l) => s + (l.realization || 0), 0);
        const failed = logs.filter((l) => l.status === 'failed').length;
        const campaigns = events.filter((e) => e.status !== 'batal').length;
        return { total, commitment, realization, failed, campaigns };
    }, [logs, events]);

    const navigate = (params) => {
        router.get(route('safari.calendar'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const changeMonth = (delta) => {
        const d = new Date(year, monthNum - 1 + delta, 1);
        const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        navigate({ month: next, branch_id: branchFilter || undefined });
    };

    const goToday = () => {
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        navigate({ month: cur, branch_id: branchFilter || undefined });
    };

    const setBranch = (id) => {
        navigate({ month, branch_id: id || undefined });
    };

    const isUpcoming = (dateStr) => dateStr >= todayStr;

    // Chip kampanye — gaya bergradasi mengikuti status:
    // rencana  → putus-putus, latar putih (masih niat)
    // berjalan → putus-putus, terisi warna cabang + tebal (aktif di lapangan)
    // selesai  → solid seperti chip realisasi (fakta terjadi), prefix ✓
    // batal    → putus-putus, redup + coret
    const campaignChipClass = (ev) => {
        const color = branchColor[ev.branch_id];
        const base = 'w-full text-left px-1.5 py-0.5 rounded border text-[11px] leading-tight truncate ';
        if (ev.status === 'selesai') {
            return base + (color?.chip || 'bg-gray-100 text-gray-700 border-gray-300');
        }
        if (ev.status === 'berjalan') {
            return base + 'border-dashed font-semibold ' + (color?.chip || 'bg-gray-100 text-gray-700 border-gray-400');
        }
        if (ev.status === 'batal') {
            return base + 'border-dashed bg-white opacity-50 line-through ' +
                (color?.chip.replace(/bg-\S+\s*/, '') || 'text-gray-500 border-gray-400');
        }
        // rencana
        return base + 'border-dashed bg-white ' +
            (color?.chip.replace(/bg-\S+\s*/, '') || 'text-gray-700 border-gray-400');
    };

    const campaignPrefix = (ev) => (ev.status === 'selesai' ? '✓' : '▸');

    return (
        <AppLayout>
            <Head title="Kalender Safari Dakwah" />

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            Kalender Safari Dakwah
                        </h1>
                        <p className="text-sm text-gray-500">
                            Jadwal kegiatan seluruh cabang dalam satu tampilan
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => changeMonth(-1)}
                            className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                            aria-label="Bulan sebelumnya"
                        >
                            ‹
                        </button>
                        <div className="min-w-[150px] text-center font-semibold text-gray-800">
                            {MONTH_NAMES[monthNum - 1]} {year}
                        </div>
                        <button
                            onClick={() => changeMonth(1)}
                            className="w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center"
                            aria-label="Bulan berikutnya"
                        >
                            ›
                        </button>
                        <button
                            onClick={goToday}
                            className="ml-1 px-3 h-9 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                        >
                            Hari Ini
                        </button>
                    </div>
                </div>

                {/* ── Ringkasan bulan ── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">Total Kegiatan</div>
                        <div className="text-lg font-bold text-gray-900">{summary.total}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">Kampanye</div>
                        <div className="text-lg font-bold text-gray-900">{summary.campaigns}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">Komitmen</div>
                        <div className="text-lg font-bold text-gray-900">{shortRupiah(summary.commitment)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">Realisasi</div>
                        <div className="text-lg font-bold text-emerald-700">{shortRupiah(summary.realization)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500">Gagal / Batal</div>
                        <div className="text-lg font-bold text-rose-600">{summary.failed}</div>
                    </div>
                </div>

                {/* ── Filter cabang ── */}
                {canSeeAll && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                            onClick={() => setBranch(null)}
                            className={
                                'px-3 py-1.5 rounded-full text-sm border ' +
                                (!branchFilter
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')
                            }
                        >
                            Semua Cabang
                        </button>
                        {branches.map((b) => (
                            <button
                                key={b.id}
                                onClick={() => setBranch(b.id)}
                                className={
                                    'px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ' +
                                    (branchFilter === b.id
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')
                                }
                            >
                                <span className={'w-2 h-2 rounded-full ' + (branchColor[b.id]?.dot || 'bg-gray-400')} />
                                {b.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Grid bulanan (desktop / tablet) ── */}
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                        {DAY_LABELS.map((d, i) => (
                            <div
                                key={d}
                                className={
                                    'px-2 py-2 text-xs font-semibold text-center ' +
                                    (i >= 5 ? 'text-emerald-700' : 'text-gray-600')
                                }
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    {weeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                            {week.map((cell, ci) => (
                                <div
                                    key={ci}
                                    className={
                                        'min-h-[104px] p-1.5 border-r border-gray-100 last:border-r-0 ' +
                                        (cell === null ? 'bg-gray-50' : '')
                                    }
                                >
                                    {cell && (
                                        <>
                                            <div
                                                className={
                                                    'w-6 h-6 mb-1 flex items-center justify-center text-xs rounded-full ' +
                                                    (cell.dateStr === todayStr
                                                        ? 'bg-gray-900 text-white font-bold'
                                                        : 'text-gray-500')
                                                }
                                            >
                                                {cell.day}
                                            </div>
                                            <div className="space-y-1">
                                                {/* Kampanye (rencana) dulu — garis putus-putus */}
                                                {cell.campaigns.slice(0, 2).map((ev) => (
                                                    <button
                                                        key={'c-' + ev.id}
                                                        onClick={() => setSelectedEvent(ev)}
                                                        title={'Kampanye: ' + (ev.speaker || ev.title || '-') + ' — ' + ev.branch_name}
                                                        className={campaignChipClass(ev)}
                                                    >
                                                        {campaignPrefix(ev)} {ev.speaker || ev.title || '(kampanye)'}
                                                    </button>
                                                ))}
                                                {cell.campaigns.length > 2 && (
                                                    <button
                                                        onClick={() => setSelectedEvent(cell.campaigns[2])}
                                                        className="w-full text-left px-1.5 text-[11px] text-gray-400 hover:text-gray-700"
                                                    >
                                                        +{cell.campaigns.length - 2} kampanye
                                                    </button>
                                                )}
                                                {/* Realisasi (logs) — solid, seperti semula */}
                                                {cell.events.slice(0, 3).map((ev) => (
                                                    <button
                                                        key={ev.id}
                                                        onClick={() => setSelected(ev)}
                                                        title={ev.speaker + ' — ' + ev.branch_name}
                                                        className={
                                                            'w-full text-left px-1.5 py-0.5 rounded border text-[11px] leading-tight truncate ' +
                                                            (branchColor[ev.branch_id]?.chip ||
                                                                'bg-gray-100 text-gray-700 border-gray-300') +
                                                            (ev.status === 'failed'
                                                                ? ' opacity-50 line-through'
                                                                : '') +
                                                            (isUpcoming(ev.dateStr || cell.dateStr) && ev.status !== 'failed'
                                                                ? ' font-semibold'
                                                                : '')
                                                        }
                                                    >
                                                        {ev.speaker || '(tanpa nama)'}
                                                    </button>
                                                ))}
                                                {cell.events.length > 3 && (
                                                    <button
                                                        onClick={() => setSelected(cell.events[3])}
                                                        className="w-full text-left px-1.5 text-[11px] text-gray-500 hover:text-gray-800"
                                                    >
                                                        +{cell.events.length - 3} lainnya
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* ── Agenda list (mobile) ── */}
                <div className="md:hidden space-y-3">
                    {Object.keys(logsByDate).length === 0 && Object.keys(eventsByDate).length === 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
                            Belum ada kegiatan Safari Dakwah pada bulan ini.
                        </div>
                    )}
                    {[...new Set([...Object.keys(logsByDate), ...Object.keys(eventsByDate)])]
                        .sort()
                        .map((dateStr) => {
                            const d = new Date(dateStr + 'T00:00:00');
                            const dayLabel = DAY_LABELS[(d.getDay() + 6) % 7];
                            return (
                                <div key={dateStr} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div
                                        className={
                                            'px-3 py-2 text-sm font-semibold flex items-center gap-2 border-b border-gray-100 ' +
                                            (dateStr === todayStr
                                                ? 'bg-gray-900 text-white'
                                                : 'bg-gray-50 text-gray-700')
                                        }
                                    >
                                        <span>{dayLabel}, {d.getDate()} {MONTH_NAMES[monthNum - 1]}</span>
                                        {dateStr === todayStr && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-gray-900 font-bold">
                                                HARI INI
                                            </span>
                                        )}
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {(eventsByDate[dateStr] || []).map((ev) => (
                                            <button
                                                key={'c-' + ev.id}
                                                onClick={() => setSelectedEvent(ev)}
                                                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50"
                                            >
                                                <span
                                                    className={
                                                        'mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 border-2 border-dashed bg-white ' +
                                                        (branchColor[ev.branch_id]?.dot.replace('bg-', 'border-') ||
                                                            'border-gray-400')
                                                    }
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className={
                                                            'block text-sm font-medium truncate ' +
                                                            (ev.status === 'batal'
                                                                ? 'text-gray-400 line-through'
                                                                : 'text-gray-700')
                                                        }
                                                    >
                                                        {campaignPrefix(ev)} {ev.speaker || ev.title || '(kampanye)'}
                                                    </span>
                                                    <span className="block text-xs text-gray-500 truncate">
                                                        {ev.branch_name} · Kampanye {tanggalPendek(ev.start_date)}–{tanggalPendek(ev.end_date)}
                                                    </span>
                                                </span>
                                                <span
                                                    className={
                                                        'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ' +
                                                        (CAMPAIGN_STATUS[ev.status]?.badge || 'bg-gray-100 text-gray-600')
                                                    }
                                                >
                                                    {CAMPAIGN_STATUS[ev.status]?.label || ev.status}
                                                </span>
                                            </button>
                                        ))}
                                        {(logsByDate[dateStr] || []).map((ev) => (
                                            <button
                                                key={ev.id}
                                                onClick={() => setSelected(ev)}
                                                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50"
                                            >
                                                <span
                                                    className={
                                                        'mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ' +
                                                        (branchColor[ev.branch_id]?.dot || 'bg-gray-400')
                                                    }
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className={
                                                            'block text-sm font-medium truncate ' +
                                                            (ev.status === 'failed'
                                                                ? 'text-gray-400 line-through'
                                                                : 'text-gray-900')
                                                        }
                                                    >
                                                        {ev.speaker || '(tanpa nama)'}
                                                    </span>
                                                    <span className="block text-xs text-gray-500 truncate">
                                                        {ev.branch_name}
                                                        {ev.time ? ' · ' + ev.time : ''}
                                                        {ev.location ? ' · ' + ev.location : ''}
                                                    </span>
                                                </span>
                                                {ev.level && (
                                                    <span
                                                        className={
                                                            'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ' +
                                                            (LEVEL_BADGE[ev.level] || 'bg-gray-100 text-gray-600')
                                                        }
                                                    >
                                                        {ev.level.replace('Nasional Grade ', 'Nas. ')}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* ── Legenda cabang (desktop) ── */}
                {canSeeAll && (
                    <div className="hidden md:flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                        {branches.map((b) => (
                            <span key={b.id} className="flex items-center gap-1.5">
                                <span className={'w-2.5 h-2.5 rounded-full ' + (branchColor[b.id]?.dot || 'bg-gray-400')} />
                                {b.name}
                            </span>
                        ))}
                    </div>
                )}
                {/* Legenda jenis entri */}
                <div className="hidden md:flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-3 rounded border bg-emerald-100 border-emerald-300" />
                        Realisasi
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-3 rounded border border-dashed border-emerald-400 bg-white" />
                        ▸ Kampanye rencana
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-3 rounded border border-dashed bg-emerald-100 border-emerald-400" />
                        ▸ Kampanye berjalan
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-3 rounded border bg-emerald-100 border-emerald-300" />
                        ✓ Kampanye selesai
                    </span>
                </div>
            </div>

            {/* ── Modal detail kegiatan (log realisasi) ── */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span
                                        className={
                                            'w-2.5 h-2.5 rounded-full ' +
                                            (branchColor[selected.branch_id]?.dot || 'bg-gray-400')
                                        }
                                    />
                                    <span className="text-xs font-medium text-gray-500">
                                        {selected.branch_name}
                                    </span>
                                </div>
                                <h2 className="text-base font-bold text-gray-900">
                                    {selected.speaker || '(tanpa nama)'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"
                                aria-label="Tutup"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                                {selected.level && (
                                    <span
                                        className={
                                            'text-xs px-2 py-1 rounded-full ' +
                                            (LEVEL_BADGE[selected.level] || 'bg-gray-100 text-gray-600')
                                        }
                                    >
                                        {selected.level}
                                    </span>
                                )}
                                <span
                                    className={
                                        'text-xs px-2 py-1 rounded-full ' +
                                        (selected.status === 'failed'
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-emerald-100 text-emerald-700')
                                    }
                                >
                                    {selected.status === 'failed' ? 'Gagal / Batal' : 'Terlaksana'}
                                </span>
                                {selected.has_mou && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                        MOU ✓
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500">Tanggal</div>
                                    <div className="font-medium text-gray-900">{selected.date}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Waktu</div>
                                    <div className="font-medium text-gray-900">{selected.time || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-gray-500">Lokasi</div>
                                    <div className="font-medium text-gray-900">{selected.location || '-'}</div>
                                </div>
                            </div>

                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500">Komitmen</div>
                                    <div className="font-bold text-gray-900">{rupiah(selected.commitment)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Realisasi</div>
                                    <div className="font-bold text-emerald-700">{rupiah(selected.realization)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">RCR</div>
                                    <div className="font-bold text-gray-900">
                                        {selected.commitment > 0
                                            ? Math.round((selected.realization / selected.commitment) * 100) + '%'
                                            : '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Cost</div>
                                    <div className="font-bold text-gray-900">{rupiah(selected.cost)}</div>
                                </div>
                            </div>

                            {selected.notes && (
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Catatan</div>
                                    <div className="text-gray-700 whitespace-pre-wrap">{selected.notes}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal detail kampanye (pipeline) ── */}
            {selectedEvent && (
                <div
                    className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
                    onClick={() => setSelectedEvent(null)}
                >
                    <div
                        className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span
                                        className={
                                            'w-2.5 h-2.5 rounded-full border-2 border-dashed bg-white ' +
                                            (branchColor[selectedEvent.branch_id]?.dot.replace('bg-', 'border-') ||
                                                'border-gray-400')
                                        }
                                    />
                                    <span className="text-xs font-medium text-gray-500">
                                        {selectedEvent.branch_name} · Kampanye Pipeline
                                    </span>
                                </div>
                                <h2 className="text-base font-bold text-gray-900">
                                    {selectedEvent.speaker || selectedEvent.title || '(kampanye)'}
                                </h2>
                                {selectedEvent.title && selectedEvent.speaker && (
                                    <div className="text-xs text-gray-500">{selectedEvent.title}</div>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"
                                aria-label="Tutup"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className={
                                        'text-xs px-2 py-1 rounded-full ' +
                                        (CAMPAIGN_STATUS[selectedEvent.status]?.badge || 'bg-gray-100 text-gray-600')
                                    }
                                >
                                    {CAMPAIGN_STATUS[selectedEvent.status]?.label || selectedEvent.status}
                                </span>
                                {selectedEvent.grade && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                        Grade {selectedEvent.grade}
                                    </span>
                                )}
                                {selectedEvent.has_mou && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                        MOU ✓
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500">Periode</div>
                                    <div className="font-medium text-gray-900">
                                        {tanggalPendek(selectedEvent.start_date)} – {tanggalPendek(selectedEvent.end_date)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Hari Aktif</div>
                                    <div className="font-medium text-gray-900">
                                        {selectedEvent.total_days} hari
                                        {selectedEvent.is_custom ? ' (custom)' : ''}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-gray-500">Target Titik</div>
                                    <div className="font-bold text-gray-900">
                                        {selectedEvent.target_min}–{selectedEvent.target_ideal}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Deal / Eksekusi</div>
                                    <div className="font-bold text-gray-900">
                                        <span className="text-amber-600">{selectedEvent.titik_deal ?? '-'}</span>
                                        {' / '}
                                        <span className="text-emerald-700">{selectedEvent.titik_eksekusi ?? '-'}</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Komitmen</div>
                                    <div className="font-bold text-gray-900">{rupiah(selectedEvent.revenue_komitmen)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Realisasi</div>
                                    <div className="font-bold text-emerald-700">{rupiah(selectedEvent.revenue_realisasi)}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-gray-500">Total Cost</div>
                                    <div className="font-bold text-gray-900">{rupiah(selectedEvent.total_cost)}</div>
                                </div>
                            </div>

                            <div className="text-[11px] text-gray-400">
                                ℹ️ Angka kampanye bersifat manajerial — angka resmi tetap di laporan bulanan.
                            </div>

                            {selectedEvent.notes && (
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Catatan</div>
                                    <div className="text-gray-700 whitespace-pre-wrap">{selectedEvent.notes}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
