import { useState, useMemo, useEffect } from 'react'
import { router, useForm } from '@inertiajs/react'
import React from 'react'
import AppLayout from '../../Components/AppLayout'

// ── Hook: deteksi layar mobile ────────────────────────────

function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    )
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < breakpoint)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [breakpoint])
    return isMobile
}

// ── Utilitas ──────────────────────────────────────────────

const formatRp = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(n ?? 0)

const formatRpShort = (n) => {
    if (!n) return '—'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

// ── Konstanta ─────────────────────────────────────────────

const CHANNELS = [
    { key: 'presentasi', label: 'Presentasi' },
    { key: 'gerai',      label: 'Gerai' },
    { key: 'wgts',       label: 'WGTS' },
    { key: 'dfi',        label: 'DFI (AR)' },
    { key: 'dfe',        label: 'DFE (AE)' },
    { key: 'kotak_qris', label: 'Kotak/QRIS' },
    { key: 'kantor',     label: 'Kantor' },
]

const CHANNEL_CONFIG = {
    presentasi: { hasSource: true, sourceLabel: 'Nama Tim',       hasSubChannel: true  },
    gerai:      { hasSource: true, sourceLabel: 'Petugas',          hasSubChannel: false, hasLocation: true },
    wgts:       { hasSource: true, sourceLabel: 'Nama Tim',       hasSubChannel: true  },
    dfi:        { hasSource: true, sourceLabel: 'Nama Karyawan',   hasSubChannel: false },
    dfe:        { hasSource: true, sourceLabel: 'Nama Relawan',    hasSubChannel: false },
    kotak_qris: { hasSource: false,                                hasSubChannel: false },
    kantor:     { hasSource: false,                                hasSubChannel: false },
}

const SUB_CHANNELS = [
    { key: 'reguler', label: 'Reguler' },
    { key: 'safdak',  label: 'Safdak' },
    { key: 'df',      label: 'DF' },
]

// ── Styles ────────────────────────────────────────────────

const thStyle = {
    padding: '8px 10px', fontSize: 11, fontWeight: 500,
    color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', whiteSpace: 'nowrap', textAlign: 'right',
}
const tdStyle = {
    padding: '8px 10px', fontSize: 12, textAlign: 'right',
    borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace', whiteSpace: 'nowrap',
}
const pillBase = {
    padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 99,
    border: 'none', cursor: 'pointer', transition: 'all .15s',
}
const inputStyle = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
}
const numInputStyle = {
    ...inputStyle, textAlign: 'right', fontFamily: 'monospace',
}
const btnPrimary = {
    background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
}

// ══════════════════════════════════════════════════════════
// Tab Rekap — READ-ONLY (data dari cache daily_revenues)
// ══════════════════════════════════════════════════════════

function TabRekap({ report, weeklyBreakdown, isMobile }) {
    const pct = report.target_amount > 0 ? (report.total_revenue / report.target_amount * 100) : 0

    return (
        <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4},1fr)`, gap: isMobile ? 8 : 12, marginBottom: 16 }}>
                {[
                    { label: 'Total Realisasi', value: formatRp(report.total_revenue) },
                    { label: 'Target', value: formatRp(report.target_amount) },
                    { label: 'Capaian', value: `${pct.toFixed(1)}%`, color: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626' },
                    { label: 'Selisih', value: formatRp(report.total_revenue - report.target_amount), color: report.total_revenue >= report.target_amount ? '#166534' : '#dc2626' },
                ].map(m => (
                    <div key={m.label} className="rev-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: m.color ?? '#111827', fontFamily: 'monospace' }}>{m.value}</div>
                    </div>
                ))}
            </div>

            {/* Tabel harian — read-only */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Data Harian per Kanal</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>(Otomatis dari tab Rincian)</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: 'left', width: 36 }}>Tgl</th>
                            <th style={{ ...thStyle, textAlign: 'left', width: 72 }}>Hari</th>
                            {CHANNELS.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}
                            <th style={thStyle}>Total</th>
                            <th style={thStyle}>Kumulatif</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeklyBreakdown.map((week, wi) => (
                            <React.Fragment key={wi}>
                                {week.days.map(day => (
                                    <tr key={day.date} className="rev-row">
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{new Date(day.date).getDate()}</td>
                                        <td style={{ ...tdStyle, textAlign: 'left', color: '#6b7280' }}>{day.day_name}</td>
                                        {CHANNELS.map(c => (
                                            <td key={c.key} style={tdStyle}>
                                                {day[c.key] ? formatRpShort(day[c.key]) : <span style={{ color: '#e5e7eb' }}>—</span>}
                                            </td>
                                        ))}
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                                            {day.total_daily ? formatRp(day.total_daily) : <span style={{ color: '#e5e7eb' }}>—</span>}
                                        </td>
                                        <td style={{ ...tdStyle, color: '#6b7280' }}>
                                            {day.cumulative ? formatRpShort(day.cumulative) : '—'}
                                        </td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                                    <td colSpan={2} style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#166534' }}>Total Pekan {wi + 1}</td>
                                    {CHANNELS.map(c => (
                                        <td key={c.key} style={{ ...tdStyle, fontWeight: 600, background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                                            {week[`total_${c.key}`] ? formatRpShort(week[`total_${c.key}`]) : '—'}
                                        </td>
                                    ))}
                                    <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>{formatRp(week.total)}</td>
                                    <td style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}></td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f0fdf4' }}>
                            <td colSpan={2} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }}>GRAND TOTAL</td>
                            {CHANNELS.map(c => (
                                <td key={c.key} style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>
                                    {formatRpShort(report[`total_${c.key}`])}
                                </td>
                            ))}
                            <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>{formatRp(report.total_revenue)}</td>
                            <td style={{ background: '#f0fdf4' }}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════
// Tab Rincian — INPUT per kanal (sumber kebenaran)
// ══════════════════════════════════════════════════════════

function TabRincian({ report, canEdit, sources = {}, isMobile }) {
    const [activeChannel, setActiveChannel] = useState('presentasi')
    const config = CHANNEL_CONFIG[activeChannel]
    const channelLabel = CHANNELS.find(c => c.key === activeChannel)?.label ?? ''

    // Revenue detail data
    const allDetails = report.revenue_details ?? []
    const channelDetails = allDetails.filter(d => d.channel === activeChannel)

    // Sumber dari master data (per cabang)
    const channelSources = sources[activeChannel] ?? []

    // Fallback: sumber dari entri yang sudah diinput (untuk backward compatibility)
    const existingLabels = useMemo(() =>
        [...new Set(channelDetails.map(d => d.source_label).filter(Boolean))].sort(),
        [channelDetails]
    )

    // Total per kanal (untuk badge)
    const channelTotals = useMemo(() => {
        const totals = {}
        CHANNELS.forEach(c => {
            totals[c.key] = allDetails.filter(d => d.channel === c.key).reduce((s, d) => s + (d.amount ?? 0), 0)
        })
        return totals
    }, [allDetails])

    // ── Form state ──
    const [formDate, setFormDate] = useState('')
    const [formSource, setFormSource] = useState('')
    const [formAmounts, setFormAmounts] = useState({ reguler: 0, safdak: 0, df: 0 })
    const [formAmount, setFormAmount] = useState(0)
    const [formLocation, setFormLocation] = useState('')
    const [saving, setSaving] = useState(false)
    const [showNewSource, setShowNewSource] = useState(false)
    const [newSourceName, setNewSourceName] = useState('')
    const [newSourcePersonnel, setNewSourcePersonnel] = useState('')
    const [savingSource, setSavingSource] = useState(false)

    const resetForm = () => {
        setFormDate('')
        setFormSource('')
        setFormAmounts({ reguler: 0, safdak: 0, df: 0 })
        setFormAmount(0)
        setFormLocation('')
    }

    const handleAddSource = () => {
        if (!newSourceName.trim()) return
        setSavingSource(true)
        router.post(`/branches/${report.branch_id}/sources`, {
            name: newSourceName.trim(),
            type: config.hasSubChannel ? 'team' : 'person',
            channel: activeChannel,
            personnel: newSourcePersonnel || null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setFormSource(newSourceName.trim())
                setNewSourceName('')
                setNewSourcePersonnel('')
                setShowNewSource(false)
            },
            onFinish: () => setSavingSource(false),
        })
    }

    const handleSave = () => {
        setSaving(true)

        if (config.hasSubChannel) {
            // Presentasi → 3 entries via bulk
            const entries = SUB_CHANNELS
                .map(sc => ({
                    date: formDate,
                    channel: activeChannel,
                    source_label: formSource,
                    sub_channel: sc.key,
                    amount: formAmounts[sc.key] || 0,
                }))
                .filter(e => e.amount > 0)

            if (entries.length === 0) { setSaving(false); return }

            router.post(`/reports/${report.id}/details/bulk`, { entries }, {
                preserveScroll: true,
                onSuccess: resetForm,
                onFinish: () => setSaving(false),
            })
        } else {
            // Flat / DFI / DFE → 1 entry
            const payload = {
                date: formDate,
                channel: activeChannel,
                source_label: config.hasSource ? formSource : null,
                amount: formAmount,
                notes: config.hasLocation ? formLocation : null,
            }

            router.post(`/reports/${report.id}/details`, payload, {
                preserveScroll: true,
                onSuccess: resetForm,
                onFinish: () => setSaving(false),
            })
        }
    }

    const handleDelete = (id) => {
        if (!confirm('Hapus data ini?')) return
        router.delete(`/reports/${report.id}/details/${id}`, { preserveScroll: true })
    }

    // ── Edit state ──
    const [editingKey, setEditingKey] = useState(null)  // Presentasi: "date_source"
    const [editingId, setEditingId] = useState(null)    // Flat/DFI/DFE: entry id
    const [editData, setEditData] = useState({})
    const [savingEdit, setSavingEdit] = useState(false)

    // Edit Presentasi (3 sub-kanal sekaligus)
    const startEditPresentasi = (row) => {
        setEditingKey(`${row.date}_${row.source_label}`)
        setEditData({ date: row.date, source_label: row.source_label, reguler: row.reguler, safdak: row.safdak, df: row.df })
    }
    const saveEditPresentasi = () => {
        setSavingEdit(true)

        // Cek apakah source_label berubah
        const origParts = editingKey.split('_')
        const origSourceLabel = origParts.slice(1).join('_')
        const sourceChanged = editData.source_label !== origSourceLabel

        const entries = SUB_CHANNELS.map(sc => ({
            date: editData.date, channel: activeChannel,
            source_label: editData.source_label, sub_channel: sc.key,
            amount: editData[sc.key] || 0,
        }))

        if (sourceChanged) {
            // Hapus entri lama dulu, lalu buat baru dengan source_label baru
            const group = groupedPresentasi.find(g => `${g.date}_${g.source_label}` === editingKey)
            if (group && group.ids.length > 0) {
                let deleted = 0
                group.ids.forEach(id => {
                    router.delete(`/reports/${report.id}/details/${id}`, {
                        preserveScroll: true,
                        preserveState: true,
                        onSuccess: () => {
                            deleted++
                            if (deleted === group.ids.length) {
                                router.post(`/reports/${report.id}/details/bulk`, { entries }, {
                                    preserveScroll: true,
                                    onSuccess: () => setEditingKey(null),
                                    onFinish: () => setSavingEdit(false),
                                })
                            }
                        },
                    })
                })
            }
        } else {
            router.post(`/reports/${report.id}/details/bulk`, { entries }, {
                preserveScroll: true,
                onSuccess: () => setEditingKey(null),
                onFinish: () => setSavingEdit(false),
            })
        }
    }

    // Edit Flat / DFI / DFE (1 entry)
    const startEditFlat = (entry) => {
        setEditingId(entry.id)
        setEditData({
            date: entry.date, channel: entry.channel,
            source_label: entry.source_label, amount: entry.amount, notes: entry.notes,
        })
    }
    const saveEditFlat = () => {
        setSavingEdit(true)
        router.put(`/reports/${report.id}/details/${editingId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditingId(null),
            onFinish: () => setSavingEdit(false),
        })
    }
    const cancelEdit = () => { setEditingKey(null); setEditingId(null); setEditData({}) }

    // ── Grouped display untuk Presentasi ──
    const groupedPresentasi = useMemo(() => {
        if (!config.hasSubChannel) return null
        const groups = {}
        channelDetails.forEach(d => {
            const key = `${d.date}_${d.source_label || ''}`
            if (!groups[key]) {
                groups[key] = { date: d.date, source_label: d.source_label, reguler: 0, safdak: 0, df: 0, ids: [] }
            }
            if (d.sub_channel) groups[key][d.sub_channel] = d.amount
            groups[key].ids.push(d.id)
        })
        return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || (a.source_label ?? '').localeCompare(b.source_label ?? ''))
    }, [channelDetails, config.hasSubChannel])

    // ── Sorted flat entries (non-Presentasi) ──
    const flatEntries = useMemo(() => {
        if (config.hasSubChannel) return null
        return [...channelDetails].sort((a, b) => a.date.localeCompare(b.date))
    }, [channelDetails, config.hasSubChannel])

    const channelTotal = channelDetails.reduce((s, d) => s + (d.amount ?? 0), 0)

    const canSave = formDate && (
        config.hasSubChannel
            ? formSource && (formAmounts.reguler > 0 || formAmounts.safdak > 0 || formAmounts.df > 0)
            : config.hasSource ? formSource && formAmount > 0 : formAmount > 0
    )

    return (
        <div>
            {/* Channel pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {CHANNELS.map(c => {
                    const isActive = activeChannel === c.key
                    const total = channelTotals[c.key]
                    return (
                        <button key={c.key}
                            className={`rev-pill ${isActive ? 'rev-pill-active' : ''}`}
                            onClick={() => { setActiveChannel(c.key); resetForm() }}
                            style={{
                                ...pillBase,
                                background: isActive ? '#166534' : '#f3f4f6',
                                color: isActive ? '#fff' : '#374151',
                            }}>
                            {c.label}
                            {total > 0 && (
                                <span style={{
                                    marginLeft: 6, fontSize: 10, opacity: .8,
                                    background: isActive ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.06)',
                                    padding: '1px 6px', borderRadius: 99,
                                }}>
                                    {formatRpShort(total)}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Summary */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total {channelLabel}</span>
                <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{formatRp(channelTotal)}</span>
            </div>

            {/* Entries table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>Data {channelLabel}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
                            ({config.hasSubChannel ? (groupedPresentasi?.length ?? 0) : (flatEntries?.length ?? 0)} entri)
                        </span>
                    </div>
                    {canEdit && <span style={{ fontSize: 12, color: '#9ca3af' }}>Klik baris untuk edit</span>}
                </div>

                {/* === TABEL PRESENTASI (pivoted: reguler/safdak/df as columns) === */}
                {config.hasSubChannel && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 70 }}>Tanggal</th>
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 100 }}>Tim</th>
                                {SUB_CHANNELS.map(sc => <th key={sc.key} style={{ ...thStyle, minWidth: 110 }}>{sc.label}</th>)}
                                <th style={{ ...thStyle, minWidth: 110 }}>Total</th>
                                {canEdit && <th style={{ ...thStyle, width: 70 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(!groupedPresentasi || groupedPresentasi.length === 0) && (
                                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada data {channelLabel}.</td></tr>
                            )}
                            {groupedPresentasi?.map((row, i) => {
                                const rowKey = `${row.date}_${row.source_label}`
                                const isEditing = editingKey === rowKey
                                const total = isEditing
                                    ? (editData.reguler || 0) + (editData.safdak || 0) + (editData.df || 0)
                                    : row.reguler + row.safdak + row.df
                                return (
                                    <tr key={i} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6', background: isEditing ? '#f0fdf4' : undefined, cursor: canEdit && !editingKey ? 'pointer' : undefined }}
                                        onClick={() => { if (canEdit && !editingKey && !editingId) startEditPresentasi(row) }}>
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>
                                            {new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                                            {isEditing ? (
                                                <input value={editData.source_label || ''}
                                                    onClick={e => e.stopPropagation()}
                                                    onChange={e => setEditData(p => ({ ...p, source_label: e.target.value }))}
                                                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                            ) : row.source_label}
                                        </td>
                                        {isEditing ? (
                                            SUB_CHANNELS.map(sc => (
                                                <td key={sc.key} style={{ ...tdStyle, padding: '4px 6px' }} onClick={e => e.stopPropagation()}>
                                                    <input type="number" min="0" step="1000"
                                                        value={editData[sc.key] || ''}
                                                        onChange={e => setEditData(p => ({ ...p, [sc.key]: parseInt(e.target.value) || 0 }))}
                                                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                                </td>
                                            ))
                                        ) : (
                                            <>
                                                <td style={tdStyle}>{row.reguler ? formatRpShort(row.reguler) : '—'}</td>
                                                <td style={tdStyle}>{row.safdak ? formatRpShort(row.safdak) : '—'}</td>
                                                <td style={tdStyle}>{row.df ? formatRpShort(row.df) : '—'}</td>
                                            </>
                                        )}
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{formatRp(total)}</td>
                                        {canEdit && (
                                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={saveEditPresentasi} disabled={savingEdit}
                                                            style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                                                            {savingEdit ? '...' : '✓'}
                                                        </button>
                                                        <button onClick={cancelEdit}
                                                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => row.ids.forEach(id => handleDelete(id))}
                                                        style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}

                {/* === TABEL FLAT / DFI / DFE === */}
                {!config.hasSubChannel && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'left' }}>Tanggal</th>
                                {config.hasSource && <th style={{ ...thStyle, textAlign: 'left' }}>{config.sourceLabel}</th>}
                                {config.hasLocation && <th style={{ ...thStyle, textAlign: 'left' }}>Lokasi</th>}
                                <th style={thStyle}>Jumlah</th>
                                {canEdit && <th style={{ ...thStyle, width: 50 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(!flatEntries || flatEntries.length === 0) && (
                                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada data {channelLabel}.</td></tr>
                            )}
                            {flatEntries?.map(entry => {
                                const isEditing = editingId === entry.id
                                return (
                                    <tr key={entry.id} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6', background: isEditing ? '#f0fdf4' : undefined, cursor: canEdit && !editingId && !editingKey ? 'pointer' : undefined }}
                                        onClick={() => { if (canEdit && !editingId && !editingKey) startEditFlat(entry) }}>
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>
                                            {new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </td>
                                        {config.hasSource && (
                                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                                                {isEditing ? (
                                                    <input value={editData.source_label || ''}
                                                        onClick={e => e.stopPropagation()}
                                                        onChange={e => setEditData(p => ({ ...p, source_label: e.target.value }))}
                                                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                                ) : (entry.source_label ?? '—')}
                                            </td>
                                        )}
                                        {config.hasLocation && (
                                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                                            {isEditing ? (
                                                    <input value={editData.notes || ''} onClick={e => e.stopPropagation()}
                                                        onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                                                        style={{ width: '100%', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                                ) : (entry.notes ?? '—')}
                                            </td>
                                        )}
                                        <td style={{ ...tdStyle, fontWeight: 600, padding: isEditing ? '4px 6px' : undefined }} onClick={e => e.stopPropagation()}>
                                            {isEditing ? (
                                                <input type="number" min="0" step="1000"
                                                    value={editData.amount || ''}
                                                    onChange={e => setEditData(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
                                                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                            ) : formatRp(entry.amount)}
                                        </td>
                                        {canEdit && (
                                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={saveEditFlat} disabled={savingEdit}
                                                            style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                                                            {savingEdit ? '...' : '✓'}
                                                        </button>
                                                        <button onClick={cancelEdit}
                                                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleDelete(entry.id)}
                                                        style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add form */}
            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah Data {channelLabel}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : config.hasLocation ? '140px 1fr 1fr' : config.hasSource ? '140px 1fr' : '140px', gap: 10, marginBottom: 10 }}>
                        {/* Tanggal */}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                                style={inputStyle} />
                        </div>

                        {/* Source (tim / petugas / karyawan / relawan) */}
                        {config.hasSource && (
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{config.sourceLabel}</label>
                                {!showNewSource ? (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <select value={formSource} onChange={e => setFormSource(e.target.value)}
                                            style={{ ...inputStyle, flex: 1 }}>
                                            <option value="">Pilih {config.sourceLabel.toLowerCase()}</option>
                                            {channelSources.map(s => (
                                                <option key={s.id} value={s.name}>{s.name}{s.personnel ? ` (${s.personnel})` : ''}</option>
                                            ))}
                                            {/* Fallback: tampilkan label dari entri lama yang belum ada di master */}
                                            {existingLabels.filter(l => !channelSources.find(s => s.name === l)).map(l => (
                                                <option key={`old-${l}`} value={l}>{l}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => setShowNewSource(true)} type="button"
                                            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            + Baru
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <input value={newSourceName}
                                            onChange={e => setNewSourceName(e.target.value)}
                                            placeholder={`Nama ${config.sourceLabel.toLowerCase()} baru`}
                                            style={inputStyle} autoFocus />
                                        {config.hasSubChannel && (
                                            <input value={newSourcePersonnel}
                                                onChange={e => setNewSourcePersonnel(e.target.value)}
                                                placeholder="Nama anggota (opsional)"
                                                style={inputStyle} />
                                        )}
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={handleAddSource} disabled={savingSource || !newSourceName.trim()} type="button"
                                                style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12, opacity: !newSourceName.trim() ? .5 : 1 }}>
                                                {savingSource ? '...' : 'Simpan'}
                                            </button>
                                            <button onClick={() => { setShowNewSource(false); setNewSourceName(''); setNewSourcePersonnel('') }} type="button"
                                                style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', fontSize: 12, cursor: 'pointer' }}>
                                                Batal
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lokasi (khusus Gerai) */}
                        {config.hasLocation && (
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Lokasi</label>
                                <input value={formLocation}
                                    onChange={e => setFormLocation(e.target.value)}
                                    placeholder="Nama tempat / lokasi gerai"
                                    style={inputStyle} />
                            </div>
                        )}
                    </div>

                    {/* Amount fields */}
                    {config.hasSubChannel ? (
                        /* Presentasi: 3 sub-kanal + total */
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                            {SUB_CHANNELS.map(sc => (
                                <div key={sc.key}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{sc.label} (Rp)</label>
                                    <input type="number" min="0" step="1000"
                                        value={formAmounts[sc.key] || ''}
                                        onChange={e => setFormAmounts(p => ({ ...p, [sc.key]: parseInt(e.target.value) || 0 }))}
                                        placeholder="0" style={numInputStyle} />
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Total (auto)</label>
                                <div style={{ ...numInputStyle, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280', lineHeight: '19px' }}>
                                    {formatRp(Object.values(formAmounts).reduce((s, v) => s + (v || 0), 0))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Flat / DFI / DFE: satu amount */
                        <div style={{ maxWidth: 200, marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Jumlah (Rp)</label>
                            <input type="number" min="0" step="1000"
                                value={formAmount || ''}
                                onChange={e => setFormAmount(parseInt(e.target.value) || 0)}
                                placeholder="0" style={numInputStyle} />
                        </div>
                    )}

                    <button disabled={saving || !canSave}
                        onClick={handleSave}
                        style={{ ...btnPrimary, opacity: !canSave ? .5 : 1 }}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════
// Tab Safari Dakwah — TIDAK BERUBAH
// ══════════════════════════════════════════════════════════

function TabSafari({ report, canEdit, isMobile }) {
    const logs = report.safari_dakwah_logs ?? []
    const total = {
        target: logs.reduce((s, l) => s + (l.target ?? 0), 0),
        commitment: logs.reduce((s, l) => s + (l.commitment ?? 0), 0),
        realization: logs.reduce((s, l) => s + (l.realization ?? 0), 0),
    }
    const DAYS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const { data, setData, post, processing, reset } = useForm({
        date: '', day_name: '', time: '', location: '', speaker: '',
        target: 0, commitment: 0, realization: 0,
    })

    const handleDateChange = (e) => {
        const d = new Date(e.target.value)
        setData(prev => ({ ...prev, date: e.target.value, day_name: DAYS[d.getDay()] }))
    }

    return (
        <div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Rekap Revenue Safari Dakwah</span>
                    {total.realization > 0 && <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>Total: {formatRp(total.realization)}</span>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Tanggal', 'Hari', 'Lokasi', 'Narasumber', 'Target', 'Komitmen', 'Realisasi', 'Capaian', canEdit ? '' : null].filter(Boolean).map(h => (
                                <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', textAlign: ['Target', 'Komitmen', 'Realisasi', 'Capaian'].includes(h) ? 'right' : 'left' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 && (
                            <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada data Safari Dakwah.</td></tr>
                        )}
                        {logs.map(l => {
                            const pct = l.target > 0 ? (l.realization / l.target * 100) : null
                            return (
                                <tr key={l.id} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{new Date(l.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280' }}>{l.day_name}</td>
                                    <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.location ?? '—'}</td>
                                    <td style={{ padding: '9px 12px', fontSize: 12 }}>{l.speaker ?? '—'}</td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(l.target)}</td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(l.commitment)}</td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{formatRp(l.realization)}</td>
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: pct === null ? '#9ca3af' : pct >= 100 ? '#166534' : pct >= 70 ? '#d97706' : '#dc2626' }}>
                                        {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                                    </td>
                                    {canEdit && (
                                        <td style={{ padding: '9px 12px' }}>
                                            <button onClick={() => { if (confirm('Hapus?')) router.delete(`/reports/${report.id}/safari/${l.id}`) }}
                                                style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                    {logs.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#f0fdf4' }}>
                                <td colSpan={4} style={{ padding: '9px 12px', fontWeight: 700 }}>TOTAL</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{formatRp(total.target)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{formatRp(total.commitment)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{formatRp(total.realization)}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: total.target > 0 && total.realization >= total.target ? '#166534' : '#d97706' }}>
                                    {total.target > 0 ? `${(total.realization / total.target * 100).toFixed(1)}%` : '—'}
                                </td>
                                {canEdit && <td></td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah Sesi Safari Dakwah</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '140px 100px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                            <input type="date" value={data.date} onChange={handleDateChange}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Hari</label>
                            <input readOnly value={data.day_name}
                                style={{ ...inputStyle, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Lokasi</label>
                            <input value={data.location} placeholder="Nama tempat / masjid" onChange={e => setData('location', e.target.value)}
                                style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Narasumber</label>
                            <input value={data.speaker} placeholder="Nama narasumber" onChange={e => setData('speaker', e.target.value)}
                                style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {[
                            { key: 'target', label: 'Target (Rp)' },
                            { key: 'commitment', label: 'Komitmen (Rp)' },
                            { key: 'realization', label: 'Realisasi (Rp)' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                                <input type="number" min="0" step="1000" value={data[f.key] || ''} placeholder="0"
                                    onChange={e => setData(f.key, parseInt(e.target.value) || 0)}
                                    style={numInputStyle} />
                            </div>
                        ))}
                    </div>
                    <button disabled={processing || !data.date}
                        onClick={() => post(`/reports/${report.id}/safari`, { onSuccess: () => reset() })}
                        style={{ ...btnPrimary, opacity: !data.date ? .5 : 1 }}>
                        {processing ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════
// Tab Rekap Per Tim
// ══════════════════════════════════════════════════════════

function TabRekapPerTim({ report, isMobile }) {
    const [selectedChannel, setSelectedChannel] = useState('presentasi')

    const allDetails = report.revenue_details ?? []

    const rekapData = useMemo(() => {
        const channelDetails = allDetails.filter(d => d.channel === selectedChannel)

        const bySource = {}
        channelDetails.forEach(detail => {
            const sourceLabel = detail.source_label ?? 'Tanpa Sumber'
            if (!bySource[sourceLabel]) {
                bySource[sourceLabel] = { source_label: sourceLabel, subtotal: 0, details: {} }
            }
            if (detail.sub_channel) {
                if (!bySource[sourceLabel].details[detail.sub_channel]) {
                    bySource[sourceLabel].details[detail.sub_channel] = 0
                }
                bySource[sourceLabel].details[detail.sub_channel] += detail.amount
            }
            bySource[sourceLabel].subtotal += detail.amount
        })

        const sources = Object.values(bySource).map(s => ({
            ...s,
            details: Object.entries(s.details).map(([sc, amt]) => ({ sub_channel: sc, amount: amt })),
        }))
        sources.sort((a, b) => b.subtotal - a.subtotal)

        return { sources, total: sources.reduce((sum, s) => sum + s.subtotal, 0) }
    }, [allDetails, selectedChannel])

    const selectedChannelLabel = CHANNELS.find(c => c.key === selectedChannel)?.label ?? ''
    const config = CHANNEL_CONFIG[selectedChannel]

    return (
        <div>
            {/* Channel pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {CHANNELS.map(c => {
                    const isActive = selectedChannel === c.key
                    const total = allDetails.filter(d => d.channel === c.key).reduce((s, d) => s + (d.amount ?? 0), 0)
                    return (
                        <button key={c.key} onClick={() => setSelectedChannel(c.key)}
                            style={{
                                ...pillBase,
                                background: isActive ? '#166534' : '#f3f4f6',
                                color: isActive ? '#fff' : '#374151',
                            }}>
                            {c.label}
                            {total > 0 && (
                                <span style={{
                                    marginLeft: 6, fontSize: 10, opacity: .8,
                                    background: isActive ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.06)',
                                    padding: '1px 6px', borderRadius: 99,
                                }}>{formatRpShort(total)}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Summary */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total {selectedChannelLabel}</span>
                <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{formatRp(rekapData.total)}</span>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Rekap {selectedChannelLabel} per Sumber</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>({rekapData.sources.length} sumber)</span>
                </div>

                {rekapData.sources.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                        Belum ada data {selectedChannelLabel.toLowerCase()}.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 150 }}>Nama</th>
                                {config.hasSubChannel && (
                                    <>
                                        <th style={{ ...thStyle, minWidth: 100 }}>Reguler</th>
                                        <th style={{ ...thStyle, minWidth: 100 }}>Safdak</th>
                                        <th style={{ ...thStyle, minWidth: 100 }}>DF</th>
                                    </>
                                )}
                                <th style={{ ...thStyle, minWidth: 120 }}>Subtotal</th>
                                <th style={{ ...thStyle, minWidth: 70 }}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rekapData.sources.map((source, i) => {
                                const pct = rekapData.total > 0 ? (source.subtotal / rekapData.total * 100).toFixed(1) : '0'
                                return (
                                    <tr key={i} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{source.source_label}</td>
                                        {config.hasSubChannel && (
                                            <>
                                                <td style={tdStyle}>{source.details.find(d => d.sub_channel === 'reguler')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'reguler').amount) : '—'}</td>
                                                <td style={tdStyle}>{source.details.find(d => d.sub_channel === 'safdak')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'safdak').amount) : '—'}</td>
                                                <td style={tdStyle}>{source.details.find(d => d.sub_channel === 'df')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'df').amount) : '—'}</td>
                                            </>
                                        )}
                                        <td style={{ ...tdStyle, fontWeight: 700 }}>{formatRp(source.subtotal)}</td>
                                        <td style={{ ...tdStyle, fontSize: 11, color: '#6b7280' }}>{pct}%</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#f0fdf4' }}>
                                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: '#166534' }}>TOTAL</td>
                                {config.hasSubChannel && <td colSpan={3} style={{ background: '#f0fdf4' }}></td>}
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>{formatRp(rekapData.total)}</td>
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>100%</td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    )
}



// ══════════════════════════════════════════════════════════
// Halaman utama
// ══════════════════════════════════════════════════════════

export default function ReportShow({ report, weeklyBreakdown, sources, canSubmit, canApprove }) {
    const [tab, setTab] = useState('rincian')  // default ke tab input
    const canEdit = canSubmit
    const isMobile = useIsMobile()

    const periodLabel = new Date(report.period_month)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const statusMap = {
        draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
        submitted: { label: 'Disubmit',  bg: '#dbeafe', color: '#1d4ed8' },
        approved:  { label: 'Disetujui', bg: '#dcfce7', color: '#166534' },
        revision:  { label: 'Revisi',    bg: '#fef3c7', color: '#d97706' },
    }
    const st = statusMap[report.status] ?? statusMap.draft

    return (
        <AppLayout title={`${report.branch?.name} — ${periodLabel}`}>
            <style>{`
                .rev-row:hover { background: #f9fafb !important; }
                .rev-row td { transition: background .15s; }
                .rev-card { transition: box-shadow .2s, transform .15s; }
                .rev-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); transform: translateY(-1px); }
                .rev-pill { transition: all .15s !important; }
                .rev-pill:hover:not(.rev-pill-active) { background: #e5e7eb !important; }
                @media (max-width: 768px) {
                    table { font-size: 11px !important; }
                    table th, table td { padding: 6px 8px !important; }
                }
            `}</style>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 600, margin: 0 }}>{report.branch?.name}</h1>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                        {periodLabel}
                        {report.submitted_by && ` · Disubmit oleh ${report.submitted_by?.name}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`/reports/${report.id}/export/excel`}
                        style={{ background: '#fff', color: '#166534', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #166534', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        ↓ Excel
                    </a>
                    <a href={`/reports/${report.id}/export/pdf`}
                        style={{ background: '#fff', color: '#6b7280', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #d1d5db', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        ↓ PDF
                    </a>
                    {canSubmit && (
                        <button onClick={() => { if (confirm('Submit laporan ini?')) router.patch(`/reports/${report.id}/submit`) }}
                            style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', flex: isMobile ? 1 : undefined }}>
                            Submit Laporan
                        </button>
                    )}
                    {canApprove && (
                        <button onClick={() => { if (confirm('Setujui laporan ini?')) router.patch(`/reports/${report.id}/approve`) }}
                            style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', flex: isMobile ? 1 : undefined }}>
                            Setujui
                        </button>
                    )}
                </div>
            </div>

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20, overflowX: 'auto' }}>
                {[
                { key: 'rincian', label: 'Rincian Revenue' },
                { key: 'rekap',   label: 'Rekap per Kanal' },
                { key: 'tim',     label: 'Rekap Per Tim' },
                { key: 'safari',  label: 'Safari Dakwah' },
            ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            padding: isMobile ? '8px 12px' : '8px 16px', fontSize: 13, fontWeight: 500,
                            border: 'none', background: 'none', cursor: 'pointer',
                            borderBottom: tab === t.key ? '2px solid #166534' : '2px solid transparent',
                            color: tab === t.key ? '#166534' : '#6b7280',
                            marginBottom: -1, whiteSpace: 'nowrap',
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'rincian' && <TabRincian report={report} canEdit={canEdit} sources={sources} isMobile={isMobile} />}
            {tab === 'rekap' && <TabRekap report={report} weeklyBreakdown={weeklyBreakdown} isMobile={isMobile} />}
            {tab === 'tim' && <TabRekapPerTim report={report} isMobile={isMobile} />}
            {tab === 'safari' && <TabSafari report={report} canEdit={canEdit} isMobile={isMobile} />}
        </AppLayout>
    )
}
