import { useState } from 'react'
import { Link, router, useForm } from '@inertiajs/react'
import React from 'react'
import AppLayout from '../../Components/AppLayout'

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

function TabRekap({ report, weeklyBreakdown, canEdit }) {
    const [editingDate, setEditingDate] = useState(null)
    const [editRow, setEditRow] = useState({})
    const [saving, setSaving] = useState(false)

    const startEdit = (day) => {
        setEditingDate(day.date)
        setEditRow({
            date: day.date, day_name: day.day_name,
            presentasi: day.presentasi, gerai: day.gerai,
            wgts: day.wgts, dfi: day.dfi, dfe: day.dfe,
            kotak_qris: day.kotak_qris, kantor: day.kantor,
        })
    }

    const saveEdit = () => {
        setSaving(true)
        router.post(`/reports/${report.id}/daily`, editRow, {
            preserveScroll: true,
            onFinish: () => { setSaving(false); setEditingDate(null) },
        })
    }

    const pct = report.target_amount > 0 ? (report.total_revenue / report.target_amount * 100) : 0

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                    { label: 'Total Realisasi', value: formatRp(report.total_revenue) },
                    { label: 'Target', value: formatRp(report.target_amount) },
                    { label: 'Capaian', value: `${pct.toFixed(1)}%`, color: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626' },
                    { label: 'Selisih', value: formatRp(report.total_revenue - report.target_amount), color: report.total_revenue >= report.target_amount ? '#166534' : '#dc2626' },
                ].map(m => (
                    <div key={m.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: m.color ?? '#111827', fontFamily: 'monospace' }}>{m.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Data Harian per Kanal</span>
                    {canEdit && <span style={{ fontSize: 12, color: '#9ca3af' }}>Klik baris untuk edit</span>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: 'left', width: 36 }}>Tgl</th>
                            <th style={{ ...thStyle, textAlign: 'left', width: 72 }}>Hari</th>
                            {CHANNELS.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}
                            <th style={thStyle}>Total</th>
                            <th style={thStyle}>Kumulatif</th>
                            {canEdit && <th style={{ ...thStyle, width: 60 }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {weeklyBreakdown.map((week, wi) => (
                            <React.Fragment key={wi}>
                                {week.days.map(day => {
                                    const isEdit = editingDate === day.date
                                    return (
                                        <tr key={day.date}
                                            style={{ cursor: canEdit && !editingDate ? 'pointer' : undefined, background: isEdit ? '#f0fdf4' : undefined }}
                                            onClick={() => { if (canEdit && !editingDate) startEdit(day) }}>
                                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{new Date(day.date).getDate()}</td>
                                            <td style={{ ...tdStyle, textAlign: 'left', color: '#6b7280' }}>{day.day_name}</td>
                                            {isEdit ? (
                                                CHANNELS.map(c => (
                                                    <td key={c.key} style={{ padding: '4px 6px' }} onClick={e => e.stopPropagation()}>
                                                        <input type="number" min="0" step="1000"
                                                            value={editRow[c.key] || ''}
                                                            onChange={e => setEditRow(p => ({ ...p, [c.key]: parseInt(e.target.value) || 0 }))}
                                                            style={{ width: 90, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }} />
                                                    </td>
                                                ))
                                            ) : (
                                                CHANNELS.map(c => (
                                                    <td key={c.key} style={tdStyle}>
                                                        {day[c.key] ? formatRpShort(day[c.key]) : <span style={{ color: '#e5e7eb' }}>—</span>}
                                                    </td>
                                                ))
                                            )}
                                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                                                {day.total_daily ? formatRp(day.total_daily) : <span style={{ color: '#e5e7eb' }}>—</span>}
                                            </td>
                                            <td style={{ ...tdStyle, color: '#6b7280' }}>
                                                {day.cumulative ? formatRpShort(day.cumulative) : '—'}
                                            </td>
                                            {canEdit && (
                                                <td style={{ padding: '4px 8px' }} onClick={e => e.stopPropagation()}>
                                                    {isEdit ? (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button onClick={saveEdit} disabled={saving}
                                                                style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                                                                {saving ? '...' : '✓'}
                                                            </button>
                                                            <button onClick={() => setEditingDate(null)}
                                                                style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                                <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                                    <td colSpan={2} style={{ padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#166534' }}>Total Pekan {wi + 1}</td>
                                    {CHANNELS.map(c => (
                                        <td key={c.key} style={{ ...tdStyle, fontWeight: 600, background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                                            {week[`total_${c.key}`] ? formatRpShort(week[`total_${c.key}`]) : '—'}
                                        </td>
                                    ))}
                                    <td style={{ ...tdStyle, fontWeight: 700, background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>{formatRp(week.total)}</td>
                                    <td style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }} colSpan={canEdit ? 2 : 1}></td>
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
                            <td style={{ background: '#f0fdf4' }} colSpan={canEdit ? 2 : 1}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}

function TabTim({ report, canEdit }) {
    const teams = report.team_revenues ?? []
    const { data, setData, post, processing, reset } = useForm({
        team_name: '', team_code: '', personnel: '',
        is_unit_cabang: false, reguler: 0, safdak: 0, df: 0,
    })
    const grandTotal = teams.reduce((s, t) => s + t.total, 0)

    return (
        <div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 14 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Rincian Revenue per Tim</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Tim / Unit', 'Personil', 'Reguler', 'Safdak', 'DF', 'Total', canEdit ? '' : null].filter(Boolean).map(h => (
                                <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', textAlign: ['Tim / Unit', 'Personil', ''].includes(h) ? 'left' : 'right' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {teams.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada data tim.</td></tr>
                        )}
                        {teams.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ fontWeight: 500 }}>{t.team_name}</div>
                                    {t.is_unit_cabang && <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: 99 }}>Unit Cabang</span>}
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.personnel ?? '—'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{t.reguler ? formatRpShort(t.reguler) : '—'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{t.safdak ? formatRpShort(t.safdak) : '—'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{t.df ? formatRpShort(t.df) : '—'}</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{formatRp(t.total)}</td>
                                {canEdit && (
                                    <td style={{ padding: '9px 12px' }}>
                                        <button onClick={() => { if (confirm('Hapus?')) router.delete(`/reports/${report.id}/teams/${t.id}`) }}
                                            style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                    {teams.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#f0fdf4' }}>
                                <td colSpan={5} style={{ padding: '9px 12px', fontWeight: 700, fontSize: 13 }}>GRAND TOTAL</td>
                                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{formatRp(grandTotal)}</td>
                                {canEdit && <td></td>}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah / Update Tim</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        {[
                            { key: 'team_name', label: 'Nama Tim', placeholder: 'TIM 1 KENDARI' },
                            { key: 'team_code', label: 'Kode Tim', placeholder: 'TIM1' },
                            { key: 'personnel', label: 'Personil', placeholder: 'Nama-nama anggota' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                                <input value={data[f.key]} placeholder={f.placeholder}
                                    onChange={e => setData(f.key, f.key === 'team_code' ? e.target.value.toUpperCase() : e.target.value)}
                                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {[
                            { key: 'reguler', label: 'Reguler (Rp)' },
                            { key: 'safdak', label: 'Safdak (Rp)' },
                            { key: 'df', label: 'DF (Rp)' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                                <input type="number" min="0" step="1000" value={data[f.key] || ''} placeholder="0"
                                    onChange={e => setData(f.key, parseInt(e.target.value) || 0)}
                                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                            </div>
                        ))}
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Total (auto)</label>
                            <div style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, textAlign: 'right', fontFamily: 'monospace', background: '#f9fafb', color: '#6b7280' }}>
                                {formatRp((data.reguler || 0) + (data.safdak || 0) + (data.df || 0))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button disabled={processing}
                            onClick={() => post(`/reports/${report.id}/teams`, { onSuccess: () => reset() })}
                            style={{ background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                            {processing ? 'Menyimpan...' : 'Simpan Tim'}
                        </button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                            <input type="checkbox" checked={data.is_unit_cabang} onChange={e => setData('is_unit_cabang', e.target.checked)} />
                            Unit Cabang
                        </label>
                    </div>
                </div>
            )}
        </div>
    )
}

function TabSafari({ report, canEdit }) {
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
                                <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                            <input type="date" value={data.date} onChange={handleDateChange}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Hari</label>
                            <input readOnly value={data.day_name}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#f9fafb', color: '#6b7280', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Lokasi</label>
                            <input value={data.location} placeholder="Nama tempat / masjid" onChange={e => setData('location', e.target.value)}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Narasumber</label>
                            <input value={data.speaker} placeholder="Nama narasumber" onChange={e => setData('speaker', e.target.value)}
                                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                        {[
                            { key: 'target', label: 'Target (Rp)' },
                            { key: 'commitment', label: 'Komitmen (Rp)' },
                            { key: 'realization', label: 'Realisasi (Rp)' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>{f.label}</label>
                                <input type="number" min="0" step="1000" value={data[f.key] || ''} placeholder="0"
                                    onChange={e => setData(f.key, parseInt(e.target.value) || 0)}
                                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, textAlign: 'right', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                            </div>
                        ))}
                    </div>
                    <button disabled={processing || !data.date}
                        onClick={() => post(`/reports/${report.id}/safari`, { onSuccess: () => reset() })}
                        style={{ background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: !data.date ? .5 : 1 }}>
                        {processing ? 'Menyimpan...' : 'Simpan'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default function ReportShow({ report, weeklyBreakdown, canSubmit, canApprove }) {
    const [tab, setTab] = useState('rekap')
    const canEdit = canSubmit

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{report.branch?.name}</h1>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                        {periodLabel}
                        {report.submitted_by && ` · Disubmit oleh ${report.submitted_by?.name}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
                            style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                            Submit Laporan
                        </button>
                    )}
                    {canApprove && (
                        <button onClick={() => { if (confirm('Setujui laporan ini?')) router.patch(`/reports/${report.id}/approve`) }}
                            style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                            Setujui
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
                {[
                    { key: 'rekap', label: 'Rekap per Kanal' },
                    { key: 'tim', label: 'Rincian Tim' },
                    { key: 'safari', label: 'Safari Dakwah' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            padding: '8px 16px', fontSize: 13, fontWeight: 500,
                            border: 'none', background: 'none', cursor: 'pointer',
                            borderBottom: tab === t.key ? '2px solid #166534' : '2px solid transparent',
                            color: tab === t.key ? '#166534' : '#6b7280',
                            marginBottom: -1,
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'rekap' && <TabRekap report={report} weeklyBreakdown={weeklyBreakdown} canEdit={canEdit} />}
            {tab === 'tim' && <TabTim report={report} canEdit={canEdit} />}
            {tab === 'safari' && <TabSafari report={report} canEdit={canEdit} />}
        </AppLayout>
    )
}