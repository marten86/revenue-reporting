import { useState } from 'react'
import { Link, router, useForm } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'
import React from 'react'

const formatRp = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(n ?? 0)

export default function TargetsIndex({ branches, currentMonth }) {
    const [month, setMonth] = useState(currentMonth.slice(0, 7))
    const [editingBranch, setEditingBranch] = useState(null)

    const { data, setData, post, processing, reset } = useForm({
        branch_id:         '',
        period_month:      currentMonth,
        target_total:      0,
        target_presentasi: 0,
        target_gerai:      0,
        target_wgts:       0,
        target_dfi:        0,
        target_dfe:        0,
        target_kotak_qris: 0,
        target_kantor:     0,
        notes:             '',
    })

    const handleMonthChange = (e) => {
        setMonth(e.target.value)
        router.get('/targets', { month: e.target.value + '-01' }, { preserveState: true })
    }

    const startEdit = (branch) => {
        const target = branch.targets?.[0]
        setEditingBranch(branch.id)
        setData({
            branch_id:         branch.id,
            period_month:      currentMonth,
            target_total:      target?.target_total ?? 0,
            target_presentasi: target?.target_presentasi ?? 0,
            target_gerai:      target?.target_gerai ?? 0,
            target_wgts:       target?.target_wgts ?? 0,
            target_dfi:        target?.target_dfi ?? 0,
            target_dfe:        target?.target_dfe ?? 0,
            target_kotak_qris: target?.target_kotak_qris ?? 0,
            target_kantor:     target?.target_kantor ?? 0,
            notes:             target?.notes ?? '',
        })
    }

    const handleSave = () => {
        post('/targets', {
            preserveScroll: true,
            onSuccess: () => { setEditingBranch(null); reset() },
        })
    }

    const periodLabel = new Date(currentMonth)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const inputStyle = {
        width: '100%', padding: '6px 8px', border: '1px solid #d1d5db',
        borderRadius: 6, fontSize: 12, textAlign: 'right',
        fontFamily: 'monospace', boxSizing: 'border-box',
    }

    return (
        <AppLayout title="Target Cabang">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Target Cabang</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{periodLabel}</p>
                </div>
                <input type="month" value={month} onChange={handleMonthChange}
                    style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
                Klik <strong>Set Target</strong> pada cabang untuk mengatur target bulan ini. Target akan otomatis tersync ke laporan yang sudah dibuat.
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Cabang', 'Target Total', 'Presentasi', 'Gerai', 'WGTS', 'DFI', 'DFE', 'Kotak/QRIS', 'Kantor', ''].map(h => (
                                <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', textAlign: h === 'Cabang' || h === '' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map(branch => {
                            const target = branch.targets?.[0]
                            const isEdit = editingBranch === branch.id
                            return (
                                <React.Fragment key={branch.id}>
                                    <tr style={{ borderBottom: isEdit ? 'none' : '1px solid #f3f4f6', background: isEdit ? '#f0fdf4' : undefined }}>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontWeight: 500 }}>{branch.name}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{branch.city}</div>
                                        </td>
                                        {isEdit ? (
                                            <>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <input type="number" min="0" step="1000000" value={data.target_total || ''} placeholder="0"
                                                        onChange={e => setData('target_total', parseInt(e.target.value) || 0)}
                                                        style={{ ...inputStyle, fontWeight: 600, borderColor: '#166534' }} />
                                                </td>
                                                {['target_presentasi','target_gerai','target_wgts','target_dfi','target_dfe','target_kotak_qris','target_kantor'].map(k => (
                                                    <td key={k} style={{ padding: '6px 8px' }}>
                                                        <input type="number" min="0" step="1000000" value={data[k] || ''} placeholder="0"
                                                            onChange={e => setData(k, parseInt(e.target.value) || 0)}
                                                            style={inputStyle} />
                                                    </td>
                                                ))}
                                                <td style={{ padding: '6px 8px' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={handleSave} disabled={processing}
                                                            style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                                                            {processing ? '...' : 'Simpan'}
                                                        </button>
                                                        <button onClick={() => setEditingBranch(null)}
                                                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                                                            Batal
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: target ? '#111827' : '#d1d5db' }}>
                                                    {target ? formatRp(target.target_total) : '—'}
                                                </td>
                                                {['target_presentasi','target_gerai','target_wgts','target_dfi','target_dfe','target_kotak_qris','target_kantor'].map(k => (
                                                    <td key={k} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: target?.[k] ? '#111827' : '#e5e7eb' }}>
                                                        {target?.[k] ? formatRp(target[k]) : '—'}
                                                    </td>
                                                ))}
                                                <td style={{ padding: '10px 12px' }}>
                                                    <button onClick={() => startEdit(branch)}
                                                        style={{ fontSize: 12, color: '#166534', background: 'none', border: '1px solid #166534', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 500 }}>
                                                        {target ? 'Edit' : 'Set Target'}
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                    {isEdit && (
                                        <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f0fdf4' }}>
                                            <td colSpan={10} style={{ padding: '0 8px 8px 12px' }}>
                                                <input value={data.notes} placeholder="Catatan (opsional)"
                                                    onChange={e => setData('notes', e.target.value)}
                                                    style={{ width: '40%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    )
}