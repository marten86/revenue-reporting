import { useState, useRef } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)
const formatRpShort = (n) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

const parseAmount = (str) => parseInt(String(str).replace(/[^0-9]/g, '')) || 0

const StatusBadge = ({ status }) => {
    const map = {
        draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
        submitted: { label: 'Disubmit',  bg: '#dbeafe', color: '#1d4ed8' },
        approved:  { label: 'Disetujui', bg: '#dcfce7', color: '#166534' },
    }
    const s = map[status] ?? map.draft
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>{s.label}</span>
}

export default function CostsShow({ cost, categories, canSubmit, canApprove, canRevise }) {
    const [activeTab, setActiveTab]         = useState('grid')
    const [saving, setSaving]               = useState(false)
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [showReviseModal, setShowReviseModal]   = useState(false)
    const [approveNote, setApproveNote]     = useState('')
    const [reviseNote, setReviseNote]       = useState('')

    const periodLabel = new Date(cost.period_month + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    const isDraft = cost.status === 'draft'

    // Inisialisasi grid dari cost_details yang sudah ada
    const initialGrid = () => {
        const map = {}
        ;(cost.cost_details ?? []).forEach(d => {
            map[d.category] = { amount: d.amount, description: d.description ?? '' }
        })
        return categories.map(cat => ({
            category:    cat,
            amount:      map[cat]?.amount ?? 0,
            description: map[cat]?.description ?? '',
        }))
    }

    const [grid, setGrid] = useState(initialGrid)
    const inputRefs = useRef([])

    const total = grid.reduce((s, r) => s + (parseAmount(r.amount)), 0)

    const updateAmount = (idx, val) => {
        const clean = parseAmount(val)
        setGrid(prev => prev.map((r, i) => i === idx ? { ...r, amount: clean } : r))
    }

    const updateDesc = (idx, val) => {
        setGrid(prev => prev.map((r, i) => i === idx ? { ...r, description: val } : r))
    }

    const handlePaste = (e, startIdx) => {
        e.preventDefault()
        const text = (e.clipboardData || window.clipboardData).getData('text')
        const values = text.split(/\t/).map(v => parseAmount(v))
        setGrid(prev => {
            const next = [...prev]
            values.forEach((val, j) => {
                if (next[startIdx + j]) next[startIdx + j] = { ...next[startIdx + j], amount: val }
            })
            return next
        })
        // Fokus ke sel terakhir yang diisi
        const lastIdx = Math.min(startIdx + values.length - 1, categories.length - 1)
        setTimeout(() => inputRefs.current[lastIdx]?.focus(), 50)
    }

    const handleSave = () => {
        setSaving(true)
        router.post(`/costs/${cost.id}/grid`, {
            items: grid.map(r => ({
                category:    r.category,
                amount:      parseAmount(r.amount),
                description: r.description,
            }))
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        })
    }

    const handleReset = () => {
        if (!confirm('Reset semua nilai ke 0?')) return
        setGrid(prev => prev.map(r => ({ ...r, amount: 0, description: '' })))
    }

    const handleSubmit = () => {
        if (!confirm('Submit laporan biaya ini?')) return
        router.patch(`/costs/${cost.id}/submit`, {}, { preserveScroll: true })
    }

    const handleApprove = () => {
        router.patch(`/costs/${cost.id}/approve`, { evaluation: approveNote }, {
            preserveScroll: true,
            onSuccess: () => { setShowApproveModal(false); setApproveNote('') },
        })
    }

    const handleRevise = () => {
        router.patch(`/costs/${cost.id}/revise`, { revision_notes: reviseNote }, {
            preserveScroll: true,
            onSuccess: () => { setShowReviseModal(false); setReviseNote('') },
        })
    }

    // Rekap per kategori (dari grid)
    const rekapData = grid
        .filter(r => parseAmount(r.amount) > 0)
        .sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))

    return (
        <AppLayout title="Detail Laporan Biaya">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{cost.branch?.name}</h1>
                        <StatusBadge status={cost.status} />
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                        Laporan Biaya · {periodLabel} · {cost.branch?.area?.name}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isDraft && (
                        <button onClick={handleSave} disabled={saving}
                            style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'Menyimpan...' : '💾 Simpan'}
                        </button>
                    )}
                    {canSubmit && (
                        <button onClick={handleSubmit}
                            style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                            Submit Laporan
                        </button>
                    )}
                    {canRevise && (
                        <button onClick={() => setShowReviseModal(true)}
                            style={{ background: '#fff', color: '#d97706', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid #d97706', cursor: 'pointer' }}>
                            Revisi
                        </button>
                    )}
                    {canApprove && (
                        <button onClick={() => setShowApproveModal(true)}
                            style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                            Setujui
                        </button>
                    )}
                </div>
            </div>

            {/* Banner revisi */}
            {cost.revised_at && cost.status === 'draft' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#d97706' }}>⚠ Laporan dikembalikan untuk revisi</span>
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>oleh {cost.revised_by?.name}</span>
                    <div style={{ color: '#374151', marginTop: 4 }}>{cost.revision_notes}</div>
                </div>
            )}

            {/* Summary */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Total Biaya</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{formatRp(total)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Kategori Terisi</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{rekapData.length} / {categories.length}</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#f3f4f6', borderRadius: 8, padding: 4, width: 'fit-content' }}>
                {[
                    { key: 'grid',    label: 'Input Grid' },
                    { key: 'rekap',   label: 'Rekap per Kategori' },
                    { key: 'riwayat', label: 'Riwayat' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            background: activeTab === tab.key ? '#fff' : 'transparent',
                            color: activeTab === tab.key ? '#111827' : '#6b7280',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Grid Input */}
            {activeTab === 'grid' && (
                <div>
                    {/* Hint */}
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        💡 Copy 16 nilai nominal dari satu baris cabang di Excel → klik sel pertama → Ctrl+V. Navigasi: Tab / Arrow.
                    </div>

                    {/* Grid horizontal — scroll */}
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {categories.map(cat => (
                                            <th key={cat} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 120, textAlign: 'center' }}>
                                                {cat}
                                            </th>
                                        ))}
                                        <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 130, textAlign: 'right', background: '#f9fafb' }}>
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Baris Nominal */}
                                    <tr>
                                        {grid.map((row, idx) => (
                                            <td key={idx} style={{ padding: '6px 6px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                                                <input
                                                    ref={el => inputRefs.current[idx] = el}
                                                    type="text"
                                                    value={row.amount > 0 ? row.amount.toLocaleString('id-ID') : ''}
                                                    placeholder="0"
                                                    disabled={!isDraft}
                                                    onChange={e => updateAmount(idx, e.target.value)}
                                                    onPaste={e => handlePaste(e, idx)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Tab' || e.key === 'ArrowRight') {
                                                            if (inputRefs.current[idx + 1]) { e.preventDefault(); inputRefs.current[idx + 1].focus() }
                                                        }
                                                        if (e.key === 'ArrowLeft') {
                                                            if (inputRefs.current[idx - 1]) { e.preventDefault(); inputRefs.current[idx - 1].focus() }
                                                        }
                                                    }}
                                                    style={{
                                                        width: 110, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6,
                                                        fontSize: 12, textAlign: 'right', fontFamily: 'monospace',
                                                        background: row.amount > 0 ? '#f0fdf4' : '#fff',
                                                        borderColor: row.amount > 0 ? '#86efac' : '#d1d5db',
                                                        color: '#111827',
                                                    }}
                                                />
                                            </td>
                                        ))}
                                        {/* Total */}
                                        <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>
                                            {formatRp(total)}
                                        </td>
                                    </tr>
                                    {/* Baris Keterangan */}
                                    <tr>
                                        {grid.map((row, idx) => (
                                            <td key={idx} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={row.description}
                                                    placeholder="Ket..."
                                                    disabled={!isDraft}
                                                    onChange={e => updateDesc(idx, e.target.value)}
                                                    style={{
                                                        width: 110, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 6,
                                                        fontSize: 11, color: '#6b7280',
                                                    }}
                                                />
                                            </td>
                                        ))}
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {isDraft && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSave} disabled={saving}
                                style={{ background: '#166534', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                {saving ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button onClick={handleReset}
                                style={{ background: '#fff', color: '#dc2626', padding: '8px 16px', borderRadius: 8, fontSize: 13, border: '1px solid #dc2626', cursor: 'pointer' }}>
                                Reset
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Rekap per Kategori */}
            {activeTab === 'rekap' && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '9px 14px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' }}>Kategori</th>
                                <th style={{ padding: '9px 14px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' }}>Keterangan</th>
                                <th style={{ padding: '9px 14px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'right' }}>Nominal</th>
                                <th style={{ padding: '9px 14px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'right' }}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rekapData.length === 0 && (
                                <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data.</td></tr>
                            )}
                            {rekapData.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 14px', fontSize: 13 }}>
                                        <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{r.category}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{r.description || '—'}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 500, fontSize: 13 }}>{formatRp(parseAmount(r.amount))}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                                        {total > 0 ? `${(parseAmount(r.amount) / total * 100).toFixed(1)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {rekapData.length > 0 && (
                            <tfoot>
                                <tr style={{ background: '#f9fafb' }}>
                                    <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Total</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{formatRp(total)}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>100%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* Tab: Riwayat */}
            {activeTab === 'riwayat' && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Riwayat Laporan</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                            { label: 'Dibuat', color: '#166534', by: null, at: cost.created_at, note: null },
                            cost.revised_at ? { label: 'Dikembalikan untuk revisi', color: '#d97706', by: cost.revised_by?.name, at: cost.revised_at, note: cost.revision_notes } : null,
                            { label: 'Disubmit', color: cost.submitted_at ? '#1d4ed8' : null, by: cost.submitted_by?.name, at: cost.submitted_at, note: null },
                            { label: 'Disetujui', color: cost.approved_at ? '#166534' : null, by: cost.approved_by?.name, at: cost.approved_at, note: cost.evaluation },
                        ].filter(Boolean).map((item, i, arr) => (
                            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 99, marginTop: 3, background: item.color ?? 'transparent', border: item.color ? 'none' : '2px dashed #d1d5db' }} />
                                    {i < arr.length - 1 && <div style={{ width: 2, height: 40, background: '#e5e7eb' }} />}
                                </div>
                                <div style={{ paddingBottom: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: item.color ? '#111827' : '#9ca3af' }}>{item.label}</div>
                                    {item.at
                                        ? <div style={{ fontSize: 12, color: '#6b7280' }}>{item.by ? `oleh ${item.by} · ` : ''}{new Date(item.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        : <div style={{ fontSize: 12, color: '#9ca3af' }}>Menunggu...</div>}
                                    {item.note && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{item.note}"</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Approve */}
            {showApproveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowApproveModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Setujui Laporan Biaya</div>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Catatan evaluasi (opsional)</p>
                        <textarea value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="Catatan..." rows={3}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowApproveModal(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Batal</button>
                            <button onClick={handleApprove} style={{ padding: '8px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Setujui</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Revisi */}
            {showReviseModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowReviseModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Kembalikan untuk Revisi</div>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Catatan revisi wajib diisi</p>
                        <textarea value={reviseNote} onChange={e => setReviseNote(e.target.value)} placeholder="Tuliskan alasan revisi..." rows={3}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowReviseModal(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Batal</button>
                            <button onClick={handleRevise} disabled={!reviseNote.trim()}
                                style={{ padding: '8px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: !reviseNote.trim() ? .5 : 1 }}>
                                Kembalikan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}
