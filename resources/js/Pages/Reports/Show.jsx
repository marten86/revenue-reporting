import { useState, useMemo, useEffect } from 'react'
import { router, useForm } from '@inertiajs/react'
import React from 'react'
import AppLayout from '../../Components/AppLayout'

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

const formatRp = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(n ?? 0)

const formatRpShort = (n) => {
    if (!n) return '—'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

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
    presentasi: { hasSource: true, sourceLabel: 'Nama Tim',      hasSubChannel: true  },
    gerai:      { hasSource: true, sourceLabel: 'Lokasi Gerai',  hasSubChannel: false, hasLocation: true },
    wgts:       { hasSource: true, sourceLabel: 'Nama Tim',      hasSubChannel: true  },
    dfi:        { hasSource: true, sourceLabel: 'Nama Karyawan', hasSubChannel: false },
    dfe:        { hasSource: true, sourceLabel: 'Nama Relawan',  hasSubChannel: false },
    kotak_qris: { hasSource: false,                               hasSubChannel: false },
    kantor:     { hasSource: false,                               hasSubChannel: false },
}

const SUB_CHANNELS = [
    { key: 'reguler', label: 'Reguler' },
    { key: 'safdak',  label: 'Safdak' },
    { key: 'df',      label: 'DF' },
]

const DAYS_ID = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

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
const numInputStyle = { ...inputStyle, textAlign: 'right', fontFamily: 'monospace' }
const btnPrimary = {
    background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
}

// ══════════════════════════════════════════════════════════
// Tab Rekap
// ══════════════════════════════════════════════════════════

function TabRekap({ report, weeklyBreakdown, isMobile }) {
    const pct = report.target_amount > 0 ? (report.total_revenue / report.target_amount * 100) : 0
    return (
        <div>
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
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{day.total_daily ? formatRp(day.total_daily) : <span style={{ color: '#e5e7eb' }}>—</span>}</td>
                                        <td style={{ ...tdStyle, color: '#6b7280' }}>{day.cumulative ? formatRpShort(day.cumulative) : '—'}</td>
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
                                <td key={c.key} style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>{formatRpShort(report[`total_${c.key}`])}</td>
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
// Grid View
// ══════════════════════════════════════════════════════════

function GridView({ report, activeChannel, config, sources, isMobile }) {
    const channelLabel = CHANNELS.find(c => c.key === activeChannel)?.label ?? ''
    const channelSources = sources[activeChannel] ?? []
    const allDetails = report.revenue_details ?? []
    const channelDetails = allDetails.filter(d => d.channel === activeChannel)
    const isGerai = activeChannel === 'gerai'

    const [selectedSource, setSelectedSource] = useState('')
    const [gridData, setGridData] = useState({})
    const [saving, setSaving] = useState(false)
    const [savedMsg, setSavedMsg] = useState('')
    const [deletingGrid, setDeletingGrid] = useState(false)

    const periodMonth = report.period_month
    const year = new Date(periodMonth).getFullYear()
    const month = new Date(periodMonth).getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    const getDayName = (day) => new Date(year, month, day).toLocaleDateString('id-ID', { weekday: 'short' })
    const toDateStr = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    const selectedSourceData = channelSources.find(s => s.name === selectedSource)
    const petugasLabel = selectedSourceData?.personnel ?? ''

    useEffect(() => {
        if (!selectedSource) { setGridData({}); return }
        const sourceDetails = channelDetails.filter(d => d.source_label === selectedSource)
        const data = {}
        days.forEach(day => {
            const dateStr = toDateStr(day)
            if (config.hasSubChannel) {
                data[day] = { reguler: 0, safdak: 0, df: 0 }
                sourceDetails.filter(d => d.date === dateStr || d.date?.startsWith?.(dateStr)).forEach(d => {
                    if (d.sub_channel && data[day][d.sub_channel] !== undefined) data[day][d.sub_channel] = d.amount || 0
                })
            } else {
                const entry = sourceDetails.find(d => d.date === dateStr || d.date?.startsWith?.(dateStr))
                data[day] = { amount: entry?.amount || 0 }
            }
        })
        setGridData(data)
        setSavedMsg('')
    }, [selectedSource, channelDetails.length])

    const updateCell = (day, field, value) => {
        setGridData(prev => ({ ...prev, [day]: { ...prev[day], [field]: parseInt(value) || 0 } }))
        setSavedMsg('')
    }

    const handlePaste = (e, startDay, field) => {
        e.preventDefault()
        const rows = e.clipboardData.getData('text').trim().split(/\r?\n/)
        setGridData(prev => {
            const next = { ...prev }
            rows.forEach((row, i) => {
                const day = startDay + i
                if (day > daysInMonth) return
                next[day] = { ...next[day], [field]: parseInt(row.trim().replace(/[^0-9]/g, '')) || 0 }
            })
            return next
        })
        setSavedMsg('')
    }

    const totals = useMemo(() => {
        if (config.hasSubChannel) {
            const t = { reguler: 0, safdak: 0, df: 0 }
            Object.values(gridData).forEach(row => { t.reguler += row.reguler || 0; t.safdak += row.safdak || 0; t.df += row.df || 0 })
            t.total = t.reguler + t.safdak + t.df
            return t
        }
        return { total: Object.values(gridData).reduce((s, row) => s + (row.amount || 0), 0) }
    }, [gridData])

    const handleSave = () => {
        if (!selectedSource && config.hasSource) return
        setSaving(true)
        const entries = []
        days.forEach(day => {
            const row = gridData[day]
            if (!row) return
            if (config.hasSubChannel) {
                SUB_CHANNELS.forEach(sc => entries.push({ date: toDateStr(day), channel: activeChannel, source_label: selectedSource, sub_channel: sc.key, amount: row[sc.key] || 0 }))
            } else {
                if (row.amount > 0) entries.push({ date: toDateStr(day), channel: activeChannel, source_label: config.hasSource ? selectedSource : null, amount: row.amount, notes: isGerai && petugasLabel ? petugasLabel : null })
            }
        })
        if (entries.length === 0) { setSaving(false); return }
        router.post(`/reports/${report.id}/details/bulk`, { entries }, {
            preserveScroll: true,
            onSuccess: () => setSavedMsg(`${entries.length} entri berhasil disimpan!`),
            onFinish: () => setSaving(false),
        })
    }

    const handleDeleteSource = () => {
        if (!selectedSource) return
        const idsToDelete = channelDetails.filter(d => d.source_label === selectedSource).map(d => d.id)
        if (idsToDelete.length === 0) { alert('Tidak ada data untuk dihapus.'); return }
        if (!confirm(`Hapus semua ${idsToDelete.length} entri untuk "${selectedSource}"? Tindakan ini tidak bisa dibatalkan.`)) return
        setDeletingGrid(true)
        router.delete(`/reports/${report.id}/details/bulk`, {
            data: { ids: idsToDelete },
            preserveScroll: true,
            onSuccess: () => { setGridData({}); setSavedMsg('') },
            onFinish: () => setDeletingGrid(false),
        })
    }

    const rowTotal = (day) => {
        const row = gridData[day]
        if (!row) return 0
        if (config.hasSubChannel) return (row.reguler || 0) + (row.safdak || 0) + (row.df || 0)
        return row.amount || 0
    }

    const isWeekend = (day) => { const d = new Date(year, month, day).getDay(); return d === 0 || d === 6 }

    const inputCellStyle = {
        width: '100%', padding: '4px 6px', border: '1px solid #d1d5db',
        borderRadius: 4, fontSize: 12, textAlign: 'right', fontFamily: 'monospace',
        boxSizing: 'border-box', background: '#fff',
    }

    const sourceHasData = selectedSource && channelDetails.some(d => d.source_label === selectedSource)

    return (
        <div>
            {config.hasSource && (
                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Pilih {config.sourceLabel}:</label>
                        <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, minWidth: 200 }}>
                            <option value="">— Pilih {config.sourceLabel.toLowerCase()} —</option>
                            {channelSources.map(s => <option key={s.id} value={s.name}>{s.name}{s.personnel ? ` · ${s.personnel}` : ''}</option>)}
                        </select>
                    </div>
                    {isGerai && selectedSource && petugasLabel && (
                        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                            Petugas: <strong>{petugasLabel}</strong>
                        </div>
                    )}
                    {isGerai && selectedSource && !petugasLabel && (
                        <div style={{ padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                            Petugas belum diisi — update di Kelola Sumber
                        </div>
                    )}
                    {sourceHasData && (
                        <button onClick={handleDeleteSource} disabled={deletingGrid}
                            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, border: '1px solid #dc2626', borderRadius: 8, background: '#fff', color: '#dc2626', cursor: 'pointer', opacity: deletingGrid ? .5 : 1 }}>
                            {deletingGrid ? 'Menghapus...' : `🗑 Hapus Semua Data "${selectedSource}"`}
                        </button>
                    )}
                </div>
            )}

            {(selectedSource || !config.hasSource) && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                            Grid Input — {channelLabel}
                            {selectedSource && <span style={{ color: '#6b7280' }}> · {selectedSource}</span>}
                            {isGerai && petugasLabel && <span style={{ color: '#9ca3af', fontSize: 12 }}> · {petugasLabel}</span>}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {savedMsg && <span style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', padding: '4px 10px', borderRadius: 6 }}>✓ {savedMsg}</span>}
                            <button onClick={handleSave} disabled={saving}
                                style={{ background: '#166534', color: '#fff', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: saving ? .5 : 1 }}>
                                {saving ? 'Menyimpan...' : 'Simpan Semua'}
                            </button>
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'center', width: 36 }}>Tgl</th>
                                <th style={{ ...thStyle, textAlign: 'left', width: 50 }}>Hari</th>
                                {isGerai && <th style={{ ...thStyle, textAlign: 'left', minWidth: 110 }}>Petugas</th>}
                                {config.hasSubChannel ? (
                                    <><th style={{ ...thStyle, minWidth: 90 }}>Reguler</th><th style={{ ...thStyle, minWidth: 90 }}>Safdak</th><th style={{ ...thStyle, minWidth: 90 }}>DF</th></>
                                ) : (
                                    <th style={{ ...thStyle, minWidth: 120 }}>Jumlah</th>
                                )}
                                <th style={{ ...thStyle, minWidth: 100 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => {
                                const weekend = isWeekend(day)
                                const total = rowTotal(day)
                                return (
                                    <tr key={day} style={{ borderBottom: '1px solid #f3f4f6', background: weekend ? '#f9fafb' : undefined }}>
                                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: weekend ? '#9ca3af' : '#374151' }}>{day}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 11, color: weekend ? '#9ca3af' : '#6b7280' }}>{getDayName(day)}</td>
                                        {isGerai && <td style={{ padding: '4px 8px', fontSize: 12, color: petugasLabel ? (weekend ? '#9ca3af' : '#374151') : '#d1d5db' }}>{petugasLabel || '—'}</td>}
                                        {config.hasSubChannel ? (
                                            <>
                                                <td style={{ padding: '3px 4px' }}><input type="number" min="0" step="1000" value={gridData[day]?.reguler || ''} onChange={e => updateCell(day, 'reguler', e.target.value)} onPaste={e => handlePaste(e, day, 'reguler')} placeholder="0" style={inputCellStyle} /></td>
                                                <td style={{ padding: '3px 4px' }}><input type="number" min="0" step="1000" value={gridData[day]?.safdak || ''} onChange={e => updateCell(day, 'safdak', e.target.value)} onPaste={e => handlePaste(e, day, 'safdak')} placeholder="0" style={inputCellStyle} /></td>
                                                <td style={{ padding: '3px 4px' }}><input type="number" min="0" step="1000" value={gridData[day]?.df || ''} onChange={e => updateCell(day, 'df', e.target.value)} onPaste={e => handlePaste(e, day, 'df')} placeholder="0" style={inputCellStyle} /></td>
                                            </>
                                        ) : (
                                            <td style={{ padding: '3px 4px' }}><input type="number" min="0" step="1000" value={gridData[day]?.amount || ''} onChange={e => updateCell(day, 'amount', e.target.value)} onPaste={e => handlePaste(e, day, 'amount')} placeholder="0" style={inputCellStyle} /></td>
                                        )}
                                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: total > 0 ? 600 : 400, color: total > 0 ? '#111827' : '#d1d5db', fontSize: 12 }}>
                                            {total > 0 ? formatRp(total) : '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                                <td colSpan={isGerai ? 3 : 2} style={{ padding: '8px 6px', fontWeight: 700, fontSize: 12, color: '#166534' }}>TOTAL</td>
                                {config.hasSubChannel ? (
                                    <>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#166534' }}>{totals.reguler > 0 ? formatRp(totals.reguler) : '—'}</td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#166534' }}>{totals.safdak > 0 ? formatRp(totals.safdak) : '—'}</td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#166534' }}>{totals.df > 0 ? formatRp(totals.df) : '—'}</td>
                                    </>
                                ) : <td style={{ padding: '8px 6px' }}></td>}
                                <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#166534' }}>{formatRp(totals.total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {!selectedSource && config.hasSource && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Pilih {config.sourceLabel.toLowerCase()} di atas untuk mulai input grid.
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════
// Tab Rincian
// ══════════════════════════════════════════════════════════

function TabRincian({ report, canEdit, sources = {}, isMobile }) {
    const [activeChannel, setActiveChannel] = useState('presentasi')
    const [viewMode, setViewMode] = useState('list')
    const config = CHANNEL_CONFIG[activeChannel]
    const channelLabel = CHANNELS.find(c => c.key === activeChannel)?.label ?? ''

    const allDetails = report.revenue_details ?? []
    const channelDetails = allDetails.filter(d => d.channel === activeChannel)
    const channelSources = sources[activeChannel] ?? []

    const existingLabels = useMemo(() =>
        [...new Set(channelDetails.map(d => d.source_label).filter(Boolean))].sort(),
        [channelDetails]
    )

    const channelTotals = useMemo(() => {
        const totals = {}
        CHANNELS.forEach(c => { totals[c.key] = allDetails.filter(d => d.channel === c.key).reduce((s, d) => s + (d.amount ?? 0), 0) })
        return totals
    }, [allDetails])

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

    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)

    const resetForm = () => { setFormDate(''); setFormSource(''); setFormAmounts({ reguler: 0, safdak: 0, df: 0 }); setFormAmount(0); setFormLocation('') }

    const handleChannelChange = (key) => { setActiveChannel(key); setSelectedIds(new Set()); resetForm() }

    const handleAddSource = () => {
        if (!newSourceName.trim()) return
        setSavingSource(true)
        router.post(`/branches/${report.branch_id}/sources`, {
            name: newSourceName.trim(), type: config.hasSubChannel ? 'team' : 'person',
            channel: activeChannel, personnel: newSourcePersonnel || null,
        }, {
            preserveScroll: true,
            onSuccess: () => { setFormSource(newSourceName.trim()); setNewSourceName(''); setNewSourcePersonnel(''); setShowNewSource(false) },
            onFinish: () => setSavingSource(false),
        })
    }

    const handleSave = () => {
        setSaving(true)
        if (config.hasSubChannel) {
            const entries = SUB_CHANNELS.map(sc => ({ date: formDate, channel: activeChannel, source_label: formSource, sub_channel: sc.key, amount: formAmounts[sc.key] || 0 })).filter(e => e.amount > 0)
            if (entries.length === 0) { setSaving(false); return }
            router.post(`/reports/${report.id}/details/bulk`, { entries }, { preserveScroll: true, onSuccess: resetForm, onFinish: () => setSaving(false) })
        } else {
            const selectedSourceData = channelSources.find(s => s.name === formSource)
            router.post(`/reports/${report.id}/details`, {
                date: formDate, channel: activeChannel,
                source_label: config.hasSource ? formSource : null,
                amount: formAmount,
                notes: activeChannel === 'gerai' && selectedSourceData?.personnel ? selectedSourceData.personnel : (config.hasLocation ? formLocation : null),
            }, { preserveScroll: true, onSuccess: resetForm, onFinish: () => setSaving(false) })
        }
    }

    const handleDelete = (id) => { if (!confirm('Hapus data ini?')) return; router.delete(`/reports/${report.id}/details/${id}`, { preserveScroll: true }) }

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return
        if (!confirm(`Hapus ${selectedIds.size} entri yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return
        setBulkDeleting(true)
        router.delete(`/reports/${report.id}/details/bulk`, {
            data: { ids: Array.from(selectedIds) },
            preserveScroll: true,
            onSuccess: () => setSelectedIds(new Set()),
            onFinish: () => setBulkDeleting(false),
        })
    }

    const toggleId = (id) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

    const [editingKey, setEditingKey] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [editData, setEditData] = useState({})
    const [savingEdit, setSavingEdit] = useState(false)

    const startEditPresentasi = (row) => { setEditingKey(`${row.date}_${row.source_label}`); setEditData({ date: row.date, source_label: row.source_label, reguler: row.reguler, safdak: row.safdak, df: row.df }) }
    const saveEditPresentasi = () => {
        setSavingEdit(true)
        const origSourceLabel = editingKey.split('_').slice(1).join('_')
        const sourceChanged = editData.source_label !== origSourceLabel
        const entries = SUB_CHANNELS.map(sc => ({ date: editData.date, channel: activeChannel, source_label: editData.source_label, sub_channel: sc.key, amount: editData[sc.key] || 0 }))
        if (sourceChanged) {
            const group = groupedPresentasi.find(g => `${g.date}_${g.source_label}` === editingKey)
            if (group?.ids.length > 0) {
                let deleted = 0
                group.ids.forEach(id => router.delete(`/reports/${report.id}/details/${id}`, {
                    preserveScroll: true, preserveState: true,
                    onSuccess: () => { deleted++; if (deleted === group.ids.length) router.post(`/reports/${report.id}/details/bulk`, { entries }, { preserveScroll: true, onSuccess: () => setEditingKey(null), onFinish: () => setSavingEdit(false) }) },
                }))
            }
        } else {
            router.post(`/reports/${report.id}/details/bulk`, { entries }, { preserveScroll: true, onSuccess: () => setEditingKey(null), onFinish: () => setSavingEdit(false) })
        }
    }
    const startEditFlat = (entry) => { setEditingId(entry.id); setEditData({ date: entry.date, channel: entry.channel, source_label: entry.source_label, amount: entry.amount, notes: entry.notes }) }
    const saveEditFlat = () => { setSavingEdit(true); router.put(`/reports/${report.id}/details/${editingId}`, editData, { preserveScroll: true, onSuccess: () => setEditingId(null), onFinish: () => setSavingEdit(false) }) }
    const cancelEdit = () => { setEditingKey(null); setEditingId(null); setEditData({}) }

    const groupedPresentasi = useMemo(() => {
        if (!config.hasSubChannel) return null
        const groups = {}
        channelDetails.forEach(d => {
            const key = `${d.date}_${d.source_label || ''}`
            if (!groups[key]) groups[key] = { date: d.date, source_label: d.source_label, reguler: 0, safdak: 0, df: 0, ids: [] }
            if (d.sub_channel) groups[key][d.sub_channel] = d.amount
            groups[key].ids.push(d.id)
        })
        return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || (a.source_label ?? '').localeCompare(b.source_label ?? ''))
    }, [channelDetails, config.hasSubChannel])

    const flatEntries = useMemo(() => {
        if (config.hasSubChannel) return null
        return [...channelDetails].sort((a, b) => a.date.localeCompare(b.date))
    }, [channelDetails, config.hasSubChannel])

    const channelTotal = channelDetails.reduce((s, d) => s + (d.amount ?? 0), 0)

    const allSelectableIds = useMemo(() => {
        if (config.hasSubChannel) return (groupedPresentasi ?? []).flatMap(r => r.ids)
        return (flatEntries ?? []).map(e => e.id)
    }, [groupedPresentasi, flatEntries, config.hasSubChannel])

    const allSelected = allSelectableIds.length > 0 && allSelectableIds.every(id => selectedIds.has(id))
    const someSelected = selectedIds.size > 0
    const toggleSelectAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(allSelectableIds))
    const isRowSelected = (ids) => ids.every(id => selectedIds.has(id))
    const toggleRowPresentasi = (ids) => setSelectedIds(prev => { const next = new Set(prev); const sel = ids.every(id => next.has(id)); ids.forEach(id => sel ? next.delete(id) : next.add(id)); return next })

    const canSave = formDate && (config.hasSubChannel ? formSource && (formAmounts.reguler > 0 || formAmounts.safdak > 0 || formAmounts.df > 0) : config.hasSource ? formSource && formAmount > 0 : formAmount > 0)
    const isGerai = activeChannel === 'gerai'
    const selectedSourceDataForm = channelSources.find(s => s.name === formSource)

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {CHANNELS.map(c => {
                    const isActive = activeChannel === c.key
                    const total = channelTotals[c.key]
                    return (
                        <button key={c.key} className={`rev-pill ${isActive ? 'rev-pill-active' : ''}`}
                            onClick={() => handleChannelChange(c.key)}
                            style={{ ...pillBase, background: isActive ? '#166534' : '#f3f4f6', color: isActive ? '#fff' : '#374151' }}>
                            {c.label}
                            {total > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: .8, background: isActive ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.06)', padding: '1px 6px', borderRadius: 99 }}>{formatRpShort(total)}</span>}
                        </button>
                    )
                })}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total {channelLabel}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{formatRp(channelTotal)}</span>
                    {canEdit && (
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db', marginLeft: 8 }}>
                            <button onClick={() => { setViewMode('list'); setSelectedIds(new Set()) }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', background: viewMode === 'list' ? '#166534' : '#f9fafb', color: viewMode === 'list' ? '#fff' : '#6b7280' }}>List</button>
                            <button onClick={() => { setViewMode('grid'); setSelectedIds(new Set()) }} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? '#166534' : '#f9fafb', color: viewMode === 'grid' ? '#fff' : '#6b7280', borderLeft: '1px solid #d1d5db' }}>Grid</button>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'grid' && canEdit && <GridView report={report} activeChannel={activeChannel} config={config} sources={sources} isMobile={isMobile} />}

            {viewMode === 'list' && (
            <>
            {canEdit && someSelected && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#92400e' }}>{selectedIds.size} entri dipilih</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#374151' }}>Batal</button>
                        <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ fontSize: 12, padding: '5px 12px', border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 500, opacity: bulkDeleting ? .5 : 1 }}>
                            {bulkDeleting ? 'Menghapus...' : `Hapus ${selectedIds.size} Entri`}
                        </button>
                    </div>
                </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>Data {channelLabel}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>({config.hasSubChannel ? (groupedPresentasi?.length ?? 0) : (flatEntries?.length ?? 0)} entri)</span>
                    </div>
                    {canEdit && <span style={{ fontSize: 12, color: '#9ca3af' }}>Klik baris untuk edit</span>}
                </div>

                {config.hasSubChannel && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                {canEdit && <th style={{ ...thStyle, width: 36, textAlign: 'center' }}><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} /></th>}
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 70 }}>Tanggal</th>
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 100 }}>Tim</th>
                                {SUB_CHANNELS.map(sc => <th key={sc.key} style={{ ...thStyle, minWidth: 110 }}>{sc.label}</th>)}
                                <th style={{ ...thStyle, minWidth: 110 }}>Total</th>
                                {canEdit && <th style={{ ...thStyle, width: 70 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(!groupedPresentasi || groupedPresentasi.length === 0) && <tr><td colSpan={canEdit ? 8 : 6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada data {channelLabel}.</td></tr>}
                            {groupedPresentasi?.map((row, i) => {
                                const rowKey = `${row.date}_${row.source_label}`
                                const isEditing = editingKey === rowKey
                                const rowSelected = isRowSelected(row.ids)
                                const total = isEditing ? (editData.reguler || 0) + (editData.safdak || 0) + (editData.df || 0) : row.reguler + row.safdak + row.df
                                return (
                                    <tr key={i} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6', background: isEditing ? '#f0fdf4' : rowSelected ? '#fffbeb' : undefined, cursor: canEdit && !editingKey ? 'pointer' : undefined }}
                                        onClick={() => { if (canEdit && !editingKey && !editingId) startEditPresentasi(row) }}>
                                        {canEdit && <td style={{ padding: '4px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={rowSelected} onChange={() => toggleRowPresentasi(row.ids)} style={{ cursor: 'pointer' }} /></td>}
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{new Date(row.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                                            {isEditing ? <input value={editData.source_label || ''} onClick={e => e.stopPropagation()} onChange={e => setEditData(p => ({ ...p, source_label: e.target.value }))} style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} /> : row.source_label}
                                        </td>
                                        {isEditing ? SUB_CHANNELS.map(sc => (
                                            <td key={sc.key} style={{ ...tdStyle, padding: '4px 6px' }} onClick={e => e.stopPropagation()}>
                                                <input type="number" min="0" step="1000" value={editData[sc.key] || ''} onChange={e => setEditData(p => ({ ...p, [sc.key]: parseInt(e.target.value) || 0 }))} style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                                            </td>
                                        )) : (<><td style={tdStyle}>{row.reguler ? formatRpShort(row.reguler) : '—'}</td><td style={tdStyle}>{row.safdak ? formatRpShort(row.safdak) : '—'}</td><td style={tdStyle}>{row.df ? formatRpShort(row.df) : '—'}</td></>)}
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{formatRp(total)}</td>
                                        {canEdit && (
                                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={saveEditPresentasi} disabled={savingEdit} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>{savingEdit ? '...' : '✓'}</button>
                                                        <button onClick={cancelEdit} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                    </div>
                                                ) : <button onClick={() => row.ids.forEach(id => handleDelete(id))} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}

                {!config.hasSubChannel && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                {canEdit && <th style={{ ...thStyle, width: 36, textAlign: 'center' }}><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} /></th>}
                                <th style={{ ...thStyle, textAlign: 'left' }}>Tanggal</th>
                                {config.hasSource && <th style={{ ...thStyle, textAlign: 'left' }}>{config.sourceLabel}</th>}
                                {isGerai && <th style={{ ...thStyle, textAlign: 'left' }}>Petugas</th>}
                                <th style={thStyle}>Jumlah</th>
                                {canEdit && <th style={{ ...thStyle, width: 50 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(!flatEntries || flatEntries.length === 0) && <tr><td colSpan={canEdit ? 6 : 4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada data {channelLabel}.</td></tr>}
                            {flatEntries?.map(entry => {
                                const isEditing = editingId === entry.id
                                const rowSelected = selectedIds.has(entry.id)
                                return (
                                    <tr key={entry.id} className="rev-row" style={{ borderBottom: '1px solid #f3f4f6', background: isEditing ? '#f0fdf4' : rowSelected ? '#fffbeb' : undefined, cursor: canEdit && !editingId && !editingKey ? 'pointer' : undefined }}
                                        onClick={() => { if (canEdit && !editingId && !editingKey) startEditFlat(entry) }}>
                                        {canEdit && <td style={{ padding: '4px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={rowSelected} onChange={() => toggleId(entry.id)} style={{ cursor: 'pointer' }} /></td>}
                                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{new Date(entry.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
                                        {config.hasSource && (
                                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                                                {isEditing ? <input value={editData.source_label || ''} onClick={e => e.stopPropagation()} onChange={e => setEditData(p => ({ ...p, source_label: e.target.value }))} style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} /> : (entry.source_label ?? '—')}
                                            </td>
                                        )}
                                        {isGerai && (
                                            <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'inherit' }}>
                                                {isEditing ? <input value={editData.notes || ''} onClick={e => e.stopPropagation()} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} /> : (entry.notes ?? '—')}
                                            </td>
                                        )}
                                        <td style={{ ...tdStyle, fontWeight: 600, padding: isEditing ? '4px 6px' : undefined }} onClick={e => e.stopPropagation()}>
                                            {isEditing ? <input type="number" min="0" step="1000" value={editData.amount || ''} onChange={e => setEditData(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))} style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} /> : formatRp(entry.amount)}
                                        </td>
                                        {canEdit && (
                                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={saveEditFlat} disabled={savingEdit} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>{savingEdit ? '...' : '✓'}</button>
                                                        <button onClick={cancelEdit} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                    </div>
                                                ) : <button onClick={() => handleDelete(entry.id)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah Data {channelLabel}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : config.hasSource ? '140px 1fr' : '140px', gap: 10, marginBottom: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                            <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
                        </div>
                        {config.hasSource && (
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{config.sourceLabel}</label>
                                {!showNewSource ? (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <select value={formSource} onChange={e => setFormSource(e.target.value)} style={inputStyle}>
                                                <option value="">Pilih {config.sourceLabel.toLowerCase()}</option>
                                                {channelSources.map(s => <option key={s.id} value={s.name}>{s.name}{s.personnel ? ` · ${s.personnel}` : ''}</option>)}
                                                {existingLabels.filter(l => !channelSources.find(s => s.name === l)).map(l => <option key={`old-${l}`} value={l}>{l}</option>)}
                                            </select>
                                            {isGerai && formSource && selectedSourceDataForm?.personnel && (
                                                <div style={{ marginTop: 6, fontSize: 12, color: '#166534', background: '#f0fdf4', padding: '4px 8px', borderRadius: 6 }}>Petugas: <strong>{selectedSourceDataForm.personnel}</strong> (otomatis tersimpan)</div>
                                            )}
                                        </div>
                                        <button onClick={() => setShowNewSource(true)} type="button" style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Baru</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <input value={newSourceName} onChange={e => setNewSourceName(e.target.value)} placeholder={isGerai ? 'Nama lokasi gerai' : `Nama ${config.sourceLabel.toLowerCase()} baru`} style={inputStyle} autoFocus />
                                        <input value={newSourcePersonnel} onChange={e => setNewSourcePersonnel(e.target.value)} placeholder={isGerai ? 'Nama petugas gerai' : 'Nama anggota (opsional)'} style={inputStyle} />
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={handleAddSource} disabled={savingSource || !newSourceName.trim()} type="button" style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12, opacity: !newSourceName.trim() ? .5 : 1 }}>{savingSource ? '...' : 'Simpan'}</button>
                                            <button onClick={() => { setShowNewSource(false); setNewSourceName(''); setNewSourcePersonnel('') }} type="button" style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', fontSize: 12, cursor: 'pointer' }}>Batal</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {config.hasSubChannel ? (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                            {SUB_CHANNELS.map(sc => (
                                <div key={sc.key}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{sc.label} (Rp)</label>
                                    <input type="number" min="0" step="1000" value={formAmounts[sc.key] || ''} onChange={e => setFormAmounts(p => ({ ...p, [sc.key]: parseInt(e.target.value) || 0 }))} placeholder="0" style={numInputStyle} />
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Total (auto)</label>
                                <div style={{ ...numInputStyle, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#6b7280', lineHeight: '19px' }}>{formatRp(Object.values(formAmounts).reduce((s, v) => s + (v || 0), 0))}</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: 200, marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Jumlah (Rp)</label>
                            <input type="number" min="0" step="1000" value={formAmount || ''} onChange={e => setFormAmount(parseInt(e.target.value) || 0)} placeholder="0" style={numInputStyle} />
                        </div>
                    )}
                    <button disabled={saving || !canSave} onClick={handleSave} style={{ ...btnPrimary, opacity: !canSave ? .5 : 1 }}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
                </div>
            )}
            </>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════
// Tab Safari Dakwah — Inline edit + narasumber autocomplete
// ══════════════════════════════════════════════════════════

function TabSafari({ report, canEdit, isMobile, narasumberList = [] }) {
    const logs = report.safari_dakwah_logs ?? []
    const total = {
        target: logs.reduce((s, l) => s + (l.target ?? 0), 0),
        commitment: logs.reduce((s, l) => s + (l.commitment ?? 0), 0),
        realization: logs.reduce((s, l) => s + (l.realization ?? 0), 0),
    }

    // ── Inline edit state ──
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})
    const [savingEdit, setSavingEdit] = useState(false)

    const startEdit = (log) => {
        setEditId(log.id)
        setEditData({
            date: log.date?.substring(0, 10) ?? '',
            day_name: log.day_name ?? '',
            location: log.location ?? '',
            speaker: log.speaker ?? '',
            target: log.target ?? 0,
            commitment: log.commitment ?? 0,
            realization: log.realization ?? 0,
        })
    }

    const saveEdit = () => {
        setSavingEdit(true)
        router.put(`/reports/${report.id}/safari/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
            onFinish: () => setSavingEdit(false),
        })
    }

    const cancelEdit = () => { setEditId(null); setEditData({}) }

    const handleDelete = (id) => {
        if (!confirm('Hapus data ini?')) return
        router.delete(`/reports/${report.id}/safari/${id}`, { preserveScroll: true })
    }

    // Auto-fill hari saat tanggal berubah
    const handleEditDateChange = (val) => {
        const d = new Date(val)
        setEditData(p => ({ ...p, date: val, day_name: isNaN(d) ? '' : DAYS_ID[d.getDay()] }))
    }

    // ── Form tambah ──
    const [formDate, setFormDate] = useState('')
    const [formDayName, setFormDayName] = useState('')
    const [formLocation, setFormLocation] = useState('')
    const [formSpeaker, setFormSpeaker] = useState('')
    const [formTarget, setFormTarget] = useState(0)
    const [formCommitment, setFormCommitment] = useState(0)
    const [formRealization, setFormRealization] = useState(0)
    const [saving, setSaving] = useState(false)

    const handleFormDateChange = (val) => {
        const d = new Date(val)
        setFormDate(val)
        setFormDayName(isNaN(d) ? '' : DAYS_ID[d.getDay()])
    }

    const resetForm = () => { setFormDate(''); setFormDayName(''); setFormLocation(''); setFormSpeaker(''); setFormTarget(0); setFormCommitment(0); setFormRealization(0) }

    const handleSave = () => {
        if (!formDate) return
        setSaving(true)
        router.post(`/reports/${report.id}/safari`, {
            date: formDate, day_name: formDayName, location: formLocation,
            speaker: formSpeaker, target: formTarget, commitment: formCommitment, realization: formRealization,
        }, { preserveScroll: true, onSuccess: resetForm, onFinish: () => setSaving(false) })
    }

    const inputCell = { padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', width: '100%' }
    const numCell = { ...inputCell, textAlign: 'right', fontFamily: 'monospace' }

    return (
        <div>
            {/* Datalist narasumber */}
            <datalist id="narasumber-list">
                {narasumberList.map(n => <option key={n} value={n} />)}
            </datalist>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Rekap Revenue Safari Dakwah</span>
                    {total.realization > 0 && <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>Total: {formatRp(total.realization)}</span>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: 70 }}>Tanggal</th>
                            <th style={{ ...thStyle, textAlign: 'left', width: 60 }}>Hari</th>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: 120 }}>Lokasi</th>
                            <th style={{ ...thStyle, textAlign: 'left', minWidth: 120 }}>Narasumber</th>
                            <th style={{ ...thStyle, minWidth: 110 }}>Target</th>
                            <th style={{ ...thStyle, minWidth: 110 }}>Komitmen</th>
                            <th style={{ ...thStyle, minWidth: 110 }}>Realisasi</th>
                            <th style={{ ...thStyle, minWidth: 70 }}>Capaian</th>
                            {canEdit && <th style={{ ...thStyle, width: 80 }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 && <tr><td colSpan={canEdit ? 9 : 8} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada data Safari Dakwah.</td></tr>}
                        {logs.map(l => {
                            const pct = l.target > 0 ? (l.realization / l.target * 100) : null
                            const isEditing = editId === l.id
                            return (
                                <tr key={l.id} className="rev-row"
                                    style={{ borderBottom: '1px solid #f3f4f6', background: isEditing ? '#f0fdf4' : undefined, cursor: canEdit && !editId ? 'pointer' : undefined }}
                                    onClick={() => { if (canEdit && !editId) startEdit(l) }}>
                                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                                        {isEditing ? (
                                            <input type="date" value={editData.date} onClick={e => e.stopPropagation()}
                                                onChange={e => handleEditDateChange(e.target.value)}
                                                style={{ ...inputCell, minWidth: 130 }} />
                                        ) : new Date(l.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'left', color: '#6b7280' }}>
                                        {isEditing ? (
                                            <input value={editData.day_name} readOnly style={{ ...inputCell, background: '#f9fafb', color: '#6b7280', width: 70 }} />
                                        ) : l.day_name}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                                        {isEditing ? (
                                            <input value={editData.location} onClick={e => e.stopPropagation()}
                                                onChange={e => setEditData(p => ({ ...p, location: e.target.value }))}
                                                style={inputCell} />
                                        ) : (l.location ?? '—')}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                                        {isEditing ? (
                                            <input list="narasumber-list" value={editData.speaker} onClick={e => e.stopPropagation()}
                                                onChange={e => setEditData(p => ({ ...p, speaker: e.target.value }))}
                                                placeholder="Ketik atau pilih..." style={inputCell} />
                                        ) : (l.speaker ?? '—')}
                                    </td>
                                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                        {isEditing ? <input type="number" min="0" step="1000" value={editData.target || ''} onChange={e => setEditData(p => ({ ...p, target: parseInt(e.target.value) || 0 }))} style={numCell} /> : formatRpShort(l.target)}
                                    </td>
                                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                        {isEditing ? <input type="number" min="0" step="1000" value={editData.commitment || ''} onChange={e => setEditData(p => ({ ...p, commitment: parseInt(e.target.value) || 0 }))} style={numCell} /> : formatRpShort(l.commitment)}
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: 600 }} onClick={e => e.stopPropagation()}>
                                        {isEditing ? <input type="number" min="0" step="1000" value={editData.realization || ''} onChange={e => setEditData(p => ({ ...p, realization: parseInt(e.target.value) || 0 }))} style={numCell} /> : formatRp(l.realization)}
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: 600, color: pct === null ? '#9ca3af' : pct >= 100 ? '#166534' : pct >= 70 ? '#d97706' : '#dc2626' }}>
                                        {isEditing ? (
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>auto</span>
                                        ) : (pct !== null ? `${pct.toFixed(1)}%` : '—')}
                                    </td>
                                    {canEdit && (
                                        <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button onClick={saveEdit} disabled={savingEdit} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>{savingEdit ? '...' : '✓'}</button>
                                                    <button onClick={cancelEdit} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleDelete(l.id)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}
                    </tbody>
                    {logs.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#f0fdf4' }}>
                                <td colSpan={4} style={{ padding: '9px 12px', fontWeight: 700, fontSize: 12 }}>TOTAL</td>
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>{formatRp(total.target)}</td>
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>{formatRp(total.commitment)}</td>
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4' }}>{formatRp(total.realization)}</td>
                                <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4', color: total.target > 0 && total.realization >= total.target ? '#166534' : '#d97706' }}>
                                    {total.target > 0 ? `${(total.realization / total.target * 100).toFixed(1)}%` : '—'}
                                </td>
                                {canEdit && <td style={{ background: '#f0fdf4' }}></td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Form tambah compact */}
            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Tambah Sesi Safari Dakwah</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '130px 80px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                            <input type="date" value={formDate} onChange={e => handleFormDateChange(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Hari</label>
                            <input readOnly value={formDayName} style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Lokasi</label>
                            <input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Nama tempat / masjid" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Narasumber</label>
                            <input list="narasumber-list" value={formSpeaker} onChange={e => setFormSpeaker(e.target.value)} placeholder="Ketik atau pilih..." style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {[
                            { label: 'Target (Rp)', val: formTarget, set: setFormTarget },
                            { label: 'Komitmen (Rp)', val: formCommitment, set: setFormCommitment },
                            { label: 'Realisasi (Rp)', val: formRealization, set: setFormRealization },
                        ].map(f => (
                            <div key={f.label}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                                <input type="number" min="0" step="1000" value={f.val || ''} placeholder="0"
                                    onChange={e => f.set(parseInt(e.target.value) || 0)} style={numInputStyle} />
                            </div>
                        ))}
                    </div>
                    <button disabled={saving || !formDate} onClick={handleSave}
                        style={{ ...btnPrimary, opacity: !formDate ? .5 : 1 }}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
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
            if (!bySource[sourceLabel]) bySource[sourceLabel] = { source_label: sourceLabel, subtotal: 0, details: {} }
            if (detail.sub_channel) { if (!bySource[sourceLabel].details[detail.sub_channel]) bySource[sourceLabel].details[detail.sub_channel] = 0; bySource[sourceLabel].details[detail.sub_channel] += detail.amount }
            bySource[sourceLabel].subtotal += detail.amount
        })
        const sources = Object.values(bySource).map(s => ({ ...s, details: Object.entries(s.details).map(([sc, amt]) => ({ sub_channel: sc, amount: amt })) }))
        sources.sort((a, b) => b.subtotal - a.subtotal)
        return { sources, total: sources.reduce((sum, s) => sum + s.subtotal, 0) }
    }, [allDetails, selectedChannel])

    const selectedChannelLabel = CHANNELS.find(c => c.key === selectedChannel)?.label ?? ''
    const config = CHANNEL_CONFIG[selectedChannel]

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {CHANNELS.map(c => {
                    const isActive = selectedChannel === c.key
                    const total = allDetails.filter(d => d.channel === c.key).reduce((s, d) => s + (d.amount ?? 0), 0)
                    return (
                        <button key={c.key} onClick={() => setSelectedChannel(c.key)}
                            style={{ ...pillBase, background: isActive ? '#166534' : '#f3f4f6', color: isActive ? '#fff' : '#374151' }}>
                            {c.label}
                            {total > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: .8, background: isActive ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.06)', padding: '1px 6px', borderRadius: 99 }}>{formatRpShort(total)}</span>}
                        </button>
                    )
                })}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Total {selectedChannelLabel}</span>
                <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{formatRp(rekapData.total)}</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Rekap {selectedChannelLabel} per Sumber</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>({rekapData.sources.length} sumber)</span>
                </div>
                {rekapData.sources.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada data {selectedChannelLabel.toLowerCase()}.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, textAlign: 'left', minWidth: 150 }}>Nama</th>
                                {config.hasSubChannel && (<><th style={{ ...thStyle, minWidth: 100 }}>Reguler</th><th style={{ ...thStyle, minWidth: 100 }}>Safdak</th><th style={{ ...thStyle, minWidth: 100 }}>DF</th></>)}
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
                                            <><td style={tdStyle}>{source.details.find(d => d.sub_channel === 'reguler')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'reguler').amount) : '—'}</td><td style={tdStyle}>{source.details.find(d => d.sub_channel === 'safdak')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'safdak').amount) : '—'}</td><td style={tdStyle}>{source.details.find(d => d.sub_channel === 'df')?.amount ? formatRpShort(source.details.find(d => d.sub_channel === 'df').amount) : '—'}</td></>
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

export default function ReportShow({ report, weeklyBreakdown, sources, canSubmit, canApprove, canRevise, narasumberList = [] }) {
    const [tab, setTab] = useState('rincian')
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [approveNote, setApproveNote] = useState('')
    const [showReviseModal, setShowReviseModal] = useState(false)
    const [reviseNote, setReviseNote] = useState('')
    const canEdit = canSubmit
    const isMobile = useIsMobile()

    const periodLabel = new Date(report.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const statusMap = {
        draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
        submitted: { label: 'Disubmit',  bg: '#dbeafe', color: '#1d4ed8' },
        approved:  { label: 'Disetujui', bg: '#dcfce7', color: '#166534' },
        revision:  { label: 'Revisi',    bg: '#fef3c7', color: '#d97706' },
    }
    const st = statusMap[report.status] ?? statusMap.draft

    // Detect if this is a draft that was sent back for revision
    const isRevisionDraft = report.status === 'draft' && report.revised_at

    return (
        <AppLayout title={`${report.branch?.name} — ${periodLabel}`}>
            <style>{`
                .rev-row:hover { background: #f9fafb !important; }
                .rev-row td { transition: background .15s; }
                .rev-card { transition: box-shadow .2s, transform .15s; }
                .rev-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); transform: translateY(-1px); }
                .rev-pill { transition: all .15s !important; }
                .rev-pill:hover:not(.rev-pill-active) { background: #e5e7eb !important; }
                @media (max-width: 768px) { table { font-size: 11px !important; } table th, table td { padding: 6px 8px !important; } }
            `}</style>

            {/* ── Revision Banner ── */}
            {isRevisionDraft && (
                <div style={{
                    background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10,
                    padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                            Laporan dikembalikan untuk revisi
                            {report.revised_by && <span style={{ fontWeight: 400 }}> oleh <strong>{report.revised_by.name}</strong></span>}
                        </div>
                        {report.revision_notes && (
                            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                                {report.revision_notes}
                            </div>
                        )}
                        {report.revised_at && (
                            <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>
                                {new Date(report.revised_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 600, margin: 0 }}>{report.branch?.name}</h1>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{periodLabel}{report.submitted_by && ` · Disubmit oleh ${report.submitted_by?.name}`}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`/reports/${report.id}/export/excel`} style={{ background: '#fff', color: '#166534', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #166534', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>↓ Excel</a>
                    <a href={`/reports/${report.id}/export/pdf`} style={{ background: '#fff', color: '#6b7280', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #d1d5db', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>↓ PDF</a>
                    {canSubmit && <button onClick={() => { if (confirm('Submit laporan ini?')) router.patch(`/reports/${report.id}/submit`) }} style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', flex: isMobile ? 1 : undefined }}>Submit Laporan</button>}
                    {canApprove && (
                        <>
                            <button
                                onClick={() => setShowApproveModal(true)}
                                style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', flex: isMobile ? 1 : undefined }}
                            >Setujui</button>

                            {showApproveModal && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                                    onClick={() => setShowApproveModal(false)}>
                                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                                        onClick={e => e.stopPropagation()}>
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Setujui Laporan</div>
                                        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                                            {report.branch?.name} — {new Date(report.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </div>
                                        <textarea
                                            placeholder="Catatan (opsional)..."
                                            value={approveNote}
                                            onChange={e => setApproveNote(e.target.value)}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', minHeight: 80, boxSizing: 'border-box', marginBottom: 16 }}
                                        />
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button onClick={() => setShowApproveModal(false)}
                                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                                                Batal
                                            </button>
                                            <button onClick={() => {
                                                router.patch(`/reports/${report.id}/approve`, { evaluation: approveNote })
                                                setShowApproveModal(false)
                                                setApproveNote('')
                                            }}
                                                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                                                ✓ Setujui
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {canRevise && (
                        <>
                            <button
                                onClick={() => setShowReviseModal(true)}
                                style={{ background: '#fff', color: '#d97706', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #d97706', cursor: 'pointer', flex: isMobile ? 1 : undefined }}
                            >Revisi</button>

                            {showReviseModal && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                                    onClick={() => setShowReviseModal(false)}>
                                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                                        onClick={e => e.stopPropagation()}>
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#92400e' }}>Kembalikan untuk Revisi</div>
                                        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                                            {report.branch?.name} — {new Date(report.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </div>
                                        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Catatan revisi <span style={{ color: '#dc2626' }}>*</span></div>
                                        <textarea
                                            placeholder="Jelaskan apa yang perlu diperbaiki..."
                                            value={reviseNote}
                                            onChange={e => setReviseNote(e.target.value)}
                                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', minHeight: 100, boxSizing: 'border-box', marginBottom: 16 }}
                                            autoFocus
                                        />
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button onClick={() => { setShowReviseModal(false); setReviseNote('') }}
                                                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                                                Batal
                                            </button>
                                            <button
                                                disabled={!reviseNote.trim()}
                                                onClick={() => {
                                                    router.patch(`/reports/${report.id}/revise`, { revision_notes: reviseNote })
                                                    setShowReviseModal(false)
                                                    setReviseNote('')
                                                }}
                                                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: !reviseNote.trim() ? '#d1d5db' : '#d97706', color: '#fff', fontSize: 13, fontWeight: 500, cursor: !reviseNote.trim() ? 'not-allowed' : 'pointer' }}>
                                                Kembalikan
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 20, overflowX: 'auto' }}>
                {[
                    { key: 'rincian', label: 'Rincian Revenue' },
                    { key: 'rekap',   label: 'Rekap per Kanal' },
                    { key: 'tim',     label: 'Rekap Per Tim' },
                    { key: 'safari',  label: 'Safari Dakwah' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{ padding: isMobile ? '8px 12px' : '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', borderBottom: tab === t.key ? '2px solid #166534' : '2px solid transparent', color: tab === t.key ? '#166534' : '#6b7280', marginBottom: -1, whiteSpace: 'nowrap' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'rincian' && <TabRincian report={report} canEdit={canEdit} sources={sources} isMobile={isMobile} />}
            {tab === 'rekap' && <TabRekap report={report} weeklyBreakdown={weeklyBreakdown} isMobile={isMobile} />}
            {tab === 'tim' && <TabRekapPerTim report={report} isMobile={isMobile} />}
            {tab === 'safari' && <TabSafari report={report} canEdit={canEdit} isMobile={isMobile} narasumberList={narasumberList} />}

            {/* ── Audit Log Timeline ── */}
            <div style={{ marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Riwayat Laporan</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                    {/* Dibuat */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d1d5db', marginTop: 3, flexShrink: 0 }} />
                            <div style={{ width: 2, height: 28, background: '#e5e7eb' }} />
                        </div>
                        <div style={{ paddingBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Laporan dibuat</div>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    {/* Disubmit */}
                    {report.submitted_at ? (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginTop: 3, flexShrink: 0 }} />
                                <div style={{ width: 2, height: (report.revised_at || report.approved_at) ? 28 : 0, background: '#e5e7eb' }} />
                            </div>
                            <div style={{ paddingBottom: (report.revised_at || report.approved_at) ? 16 : 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                                    Disubmit
                                    {report.submitted_by && <span style={{ fontWeight: 400, color: '#6b7280' }}> oleh <strong>{report.submitted_by.name}</strong></span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                    {new Date(report.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 20, display: 'flex', justifyContent: 'center' }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e5e7eb', marginTop: 3, border: '2px dashed #d1d5db' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Belum disubmit</div>
                            </div>
                        </div>
                    )}

                    {/* Dikembalikan untuk Revisi */}
                    {report.revised_at && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706', marginTop: 3, flexShrink: 0 }} />
                                <div style={{ width: 2, height: report.approved_at ? 28 : 0, background: '#e5e7eb' }} />
                            </div>
                            <div style={{ paddingBottom: report.approved_at ? 16 : 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                                    Dikembalikan untuk revisi
                                    {report.revised_by && <span style={{ fontWeight: 400, color: '#6b7280' }}> oleh <strong>{report.revised_by.name}</strong></span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                    {new Date(report.revised_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {report.revision_notes && (
                                    <div style={{ marginTop: 6, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                                        💬 {report.revision_notes}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Disetujui */}
                    {report.approved_at && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#166534', marginTop: 3, flexShrink: 0 }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                                    Disetujui
                                    {report.approved_by && <span style={{ fontWeight: 400, color: '#6b7280' }}> oleh <strong>{report.approved_by.name}</strong></span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                                    {new Date(report.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {report.evaluation && (
                                    <div style={{ marginTop: 6, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#166534' }}>
                                        💬 {report.evaluation}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

        </AppLayout>
    )
}
