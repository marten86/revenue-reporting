import { useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const inputStyle = { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }
const thStyle = { padding: '9px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' }
const tdStyle = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }

const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n ?? 0)
const formatRpShort = (n) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

const StatusBadge = ({ status }) => {
    const map = {
        draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280' },
        submitted: { label: 'Disubmit',  bg: '#dbeafe', color: '#1d4ed8' },
        approved:  { label: 'Disetujui', bg: '#dcfce7', color: '#166534' },
    }
    const s = map[status] ?? map.draft
    return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500 }}>{s.label}</span>
}

export default function CostsShow({ cost, categories, rekapPerKategori, canSubmit, canApprove, canRevise }) {
    const [activeTab, setActiveTab] = useState('rincian')
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})
    const [selectedIds, setSelectedIds] = useState([])
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [showReviseModal, setShowReviseModal] = useState(false)
    const [approveNote, setApproveNote] = useState('')
    const [reviseNote, setReviseNote] = useState('')

    const periodLabel = new Date(cost.period_month + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const { data, setData, post, processing, reset, errors } = useForm({
        date: new Date().toISOString().slice(0, 10),
        category: categories[0] ?? '',
        description: '',
        amount: '',
    })

    const handleAdd = (e) => {
        e.preventDefault()
        post(`/costs/${cost.id}/details`, {
            preserveScroll: true,
            onSuccess: () => reset(),
        })
    }

    const startEdit = (d) => {
        setEditId(d.id)
        setEditData({
            date: d.date?.slice(0, 10) ?? '',
            category: d.category,
            description: d.description ?? '',
            amount: d.amount,
        })
    }

    const saveEdit = () => {
        router.put(`/costs/${cost.id}/details/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
        })
    }

    const handleDelete = (detailId) => {
        if (!confirm('Hapus item ini?')) return
        router.delete(`/costs/${cost.id}/details/${detailId}`, { preserveScroll: true })
    }

    const handleBulkDelete = () => {
        if (!confirm(`Hapus ${selectedIds.length} item?`)) return
        router.delete(`/costs/${cost.id}/details/bulk`, {
            data: { ids: selectedIds },
            preserveScroll: true,
            onSuccess: () => setSelectedIds([]),
        })
    }

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === cost.cost_details.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(cost.cost_details.map(d => d.id))
        }
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

    const details = cost.cost_details ?? []
    const isDraft = cost.status === 'draft'

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
            {cost.is_revision && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#d97706' }}>⚠ Laporan dikembalikan untuk revisi</span>
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>oleh {cost.revised_by?.name}</span>
                    <div style={{ color: '#374151', marginTop: 4 }}>{cost.revision_notes}</div>
                </div>
            )}

            {/* Summary card */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Total Biaya</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{formatRp(cost.total_cost)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Jumlah Item</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{details.length}</div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Kategori</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{rekapPerKategori.length}</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: '#f3f4f6', borderRadius: 8, padding: 4, width: 'fit-content' }}>
                {[
                    { key: 'rincian', label: 'Rincian Biaya' },
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

            {/* Tab: Rincian */}
            {activeTab === 'rincian' && (
                <div>
                    {/* Bulk action bar */}
                    {selectedIds.length > 0 && (
                        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#d97706' }}>{selectedIds.length} item dipilih</span>
                            <button onClick={handleBulkDelete}
                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                                Hapus
                            </button>
                            <button onClick={() => setSelectedIds([])}
                                style={{ background: 'none', border: 'none', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                                Batal
                            </button>
                        </div>
                    )}

                    {/* Tabel item */}
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 16 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {isDraft && (
                                        <th style={{ ...thStyle, width: 36 }}>
                                            <input type="checkbox"
                                                checked={selectedIds.length === details.length && details.length > 0}
                                                onChange={toggleSelectAll} />
                                        </th>
                                    )}
                                    <th style={thStyle}>Tanggal</th>
                                    <th style={thStyle}>Kategori</th>
                                    <th style={thStyle}>Keterangan</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Nominal</th>
                                    {isDraft && <th style={{ ...thStyle, width: 100 }}>Aksi</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {details.length === 0 && (
                                    <tr><td colSpan={isDraft ? 6 : 4} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                                        Belum ada item biaya. Tambah di bawah.
                                    </td></tr>
                                )}
                                {details.map(d => {
                                    const isEdit = editId === d.id
                                    return (
                                        <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {isDraft && (
                                                <td style={tdStyle}>
                                                    <input type="checkbox"
                                                        checked={selectedIds.includes(d.id)}
                                                        onChange={() => toggleSelect(d.id)} />
                                                </td>
                                            )}
                                            <td style={tdStyle}>
                                                {isEdit
                                                    ? <input type="date" value={editData.date} onChange={e => setEditData(p => ({...p, date: e.target.value}))} style={{...inputStyle, width: 130}} />
                                                    : <span style={{ fontSize: 12 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                            </td>
                                            <td style={tdStyle}>
                                                {isEdit
                                                    ? <select value={editData.category} onChange={e => setEditData(p => ({...p, category: e.target.value}))} style={inputStyle}>
                                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                                      </select>
                                                    : <span style={{ fontSize: 12, background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontWeight: 500 }}>{d.category}</span>}
                                            </td>
                                            <td style={tdStyle}>
                                                {isEdit
                                                    ? <input value={editData.description} onChange={e => setEditData(p => ({...p, description: e.target.value}))} style={inputStyle} placeholder="Keterangan..." />
                                                    : <span style={{ fontSize: 12, color: '#6b7280' }}>{d.description ?? '—'}</span>}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>
                                                {isEdit
                                                    ? <input type="number" value={editData.amount} onChange={e => setEditData(p => ({...p, amount: e.target.value}))} style={{...inputStyle, textAlign: 'right', width: 140}} />
                                                    : formatRp(d.amount)}
                                            </td>
                                            {isDraft && (
                                                <td style={tdStyle}>
                                                    {isEdit ? (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button onClick={saveEdit} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>✓</button>
                                                            <button onClick={() => setEditId(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button onClick={() => startEdit(d)} style={{ fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                                                            <button onClick={() => handleDelete(d.id)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Hapus</button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                            {details.length > 0 && (
                                <tfoot>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {isDraft && <td />}
                                        <td colSpan={3} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>Total</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{formatRp(cost.total_cost)}</td>
                                        {isDraft && <td />}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Form tambah item */}
                    {isDraft && (
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Tambah Item Biaya</div>
                            <form onSubmit={handleAdd}>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 160px', gap: 10, marginBottom: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tanggal</label>
                                        <input type="date" value={data.date} onChange={e => setData('date', e.target.value)} style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Kategori</label>
                                        <select value={data.category} onChange={e => setData('category', e.target.value)} style={inputStyle}>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Keterangan</label>
                                        <input value={data.description} onChange={e => setData('description', e.target.value)} placeholder="Opsional..." style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Nominal (Rp)</label>
                                        <input type="number" value={data.amount} onChange={e => setData('amount', e.target.value)} placeholder="0" min="0" style={inputStyle} />
                                        {errors.amount && <p style={{ color: '#dc2626', fontSize: 11, margin: '2px 0 0' }}>{errors.amount}</p>}
                                    </div>
                                </div>
                                <button type="submit" disabled={processing}
                                    style={{ background: '#166534', color: '#fff', padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                    {processing ? 'Menyimpan...' : '+ Tambah Item'}
                                </button>
                            </form>
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
                                <th style={thStyle}>Kategori</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Jumlah Item</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rekapPerKategori.length === 0 && (
                                <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data.</td></tr>
                            )}
                            {rekapPerKategori.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={tdStyle}>
                                        <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{r.category}</span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>{r.count}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{formatRp(r.total)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>
                                        {cost.total_cost > 0 ? `${(r.total / cost.total_cost * 100).toFixed(1)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {rekapPerKategori.length > 0 && (
                            <tfoot>
                                <tr style={{ background: '#f9fafb' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>Total</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{details.length}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{formatRp(cost.total_cost)}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>100%</td>
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
                        {/* Dibuat */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 12, height: 12, borderRadius: 99, background: '#166534', marginTop: 3 }} />
                                <div style={{ width: 2, height: 40, background: '#e5e7eb' }} />
                            </div>
                            <div style={{ paddingBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>Dibuat</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(cost.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                        </div>

                        {/* Revisi */}
                        {cost.revised_at && (
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 99, background: '#d97706', marginTop: 3 }} />
                                    <div style={{ width: 2, height: 40, background: '#e5e7eb' }} />
                                </div>
                                <div style={{ paddingBottom: 16 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>Dikembalikan untuk revisi</div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>oleh {cost.revised_by?.name} · {new Date(cost.revised_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                    {cost.revision_notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{cost.revision_notes}"</div>}
                                </div>
                            </div>
                        )}

                        {/* Disubmit */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 12, height: 12, borderRadius: 99, background: cost.submitted_at ? '#1d4ed8' : 'transparent', border: cost.submitted_at ? 'none' : '2px dashed #d1d5db', marginTop: 3 }} />
                                <div style={{ width: 2, height: 40, background: '#e5e7eb' }} />
                            </div>
                            <div style={{ paddingBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: cost.submitted_at ? '#111827' : '#9ca3af' }}>Disubmit</div>
                                {cost.submitted_at
                                    ? <div style={{ fontSize: 12, color: '#6b7280' }}>oleh {cost.submitted_by?.name} · {new Date(cost.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                    : <div style={{ fontSize: 12, color: '#9ca3af' }}>Menunggu submit</div>}
                            </div>
                        </div>

                        {/* Disetujui */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 12, height: 12, borderRadius: 99, background: cost.approved_at ? '#166534' : 'transparent', border: cost.approved_at ? 'none' : '2px dashed #d1d5db', marginTop: 3 }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: cost.approved_at ? '#111827' : '#9ca3af' }}>Disetujui</div>
                                {cost.approved_at
                                    ? <div style={{ fontSize: 12, color: '#6b7280' }}>oleh {cost.approved_by?.name} · {new Date(cost.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                    : <div style={{ fontSize: 12, color: '#9ca3af' }}>Menunggu persetujuan</div>}
                                {cost.evaluation && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{cost.evaluation}"</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Approve */}
            {showApproveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={() => setShowApproveModal(false)}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Setujui Laporan Biaya</div>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Tambahkan catatan evaluasi (opsional)</p>
                        <textarea value={approveNote} onChange={e => setApproveNote(e.target.value)}
                            placeholder="Catatan evaluasi..." rows={3}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowApproveModal(false)}
                                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Batal</button>
                            <button onClick={handleApprove}
                                style={{ padding: '8px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                                Setujui
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Revisi */}
            {showReviseModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={() => setShowReviseModal(false)}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Kembalikan untuk Revisi</div>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>Catatan revisi wajib diisi</p>
                        <textarea value={reviseNote} onChange={e => setReviseNote(e.target.value)}
                            placeholder="Tuliskan alasan revisi..." rows={3}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowReviseModal(false)}
                                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Batal</button>
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
