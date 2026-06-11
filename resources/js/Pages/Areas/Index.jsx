import { useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Components/AppLayout'

const formatBadge = (isActive) => (
    <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 99,
        fontSize: 11, fontWeight: 600,
        background: isActive ? '#dcfce7' : '#f3f4f6',
        color: isActive ? '#166534' : '#6b7280',
    }}>
        {isActive ? 'Aktif' : 'Nonaktif'}
    </span>
)

const emptyBranch = { name: '', code: '', city: '', province: '' }

export default function AreasIndex({ areas }) {
    const [editId, setEditId]       = useState(null)
    const [editData, setEditData]   = useState({})
    const [addForm, setAddForm]     = useState({ name: '', code: '', description: '' })
    const [showAdd, setShowAdd]     = useState(false)
    const [expandedArea, setExpandedArea]   = useState(null)
    const [addingBranchArea, setAddingBranchArea] = useState(null)
    const [branchForm, setBranchForm] = useState(emptyBranch)
    const [branchErrors, setBranchErrors] = useState({})

    // ─── Edit area inline ─────────────────────────────────
    const startEdit = (area) => {
        setEditId(area.id)
        setEditData({ name: area.name, code: area.code, description: area.description || '' })
    }

    const saveEdit = (areaId) => {
        router.put(`/areas/${areaId}`, editData, {
            onSuccess: () => setEditId(null),
            preserveScroll: true,
        })
    }

    // ─── Toggle aktif ─────────────────────────────────────
    const toggleActive = (areaId) => {
        router.patch(`/areas/${areaId}/toggle`, {}, { preserveScroll: true })
    }

    // ─── Hapus area ───────────────────────────────────────
    const deleteArea = (areaId, name) => {
        if (!confirm(`Hapus area "${name}"? Pastikan tidak ada cabang yang terdaftar.`)) return
        router.delete(`/areas/${areaId}`, { preserveScroll: true })
    }

    // ─── Tambah area baru ─────────────────────────────────
    const submitAdd = () => {
        if (!addForm.name || !addForm.code) return
        router.post('/areas', addForm, {
            onSuccess: () => {
                setAddForm({ name: '', code: '', description: '' })
                setShowAdd(false)
            },
            preserveScroll: true,
        })
    }

    // ─── Tambah cabang baru ke area ───────────────────────
    const openAddBranch = (areaId) => {
        setAddingBranchArea(areaId)
        setBranchForm(emptyBranch)
        setBranchErrors({})
    }

    const submitAddBranch = (areaId) => {
        const errors = {}
        if (!branchForm.name)     errors.name     = 'Wajib diisi'
        if (!branchForm.code)     errors.code     = 'Wajib diisi'
        if (!branchForm.city)     errors.city     = 'Wajib diisi'
        if (!branchForm.province) errors.province = 'Wajib diisi'

        if (Object.keys(errors).length > 0) {
            setBranchErrors(errors)
            return
        }

        router.post('/branches', {
            ...branchForm,
            code:    branchForm.code.toUpperCase(),
            area_id: areaId,
        }, {
            onSuccess: () => {
                setAddingBranchArea(null)
                setBranchForm(emptyBranch)
                setBranchErrors({})
            },
            onError: (errs) => setBranchErrors(errs),
            preserveScroll: true,
        })
    }

    // ─── Hapus cabang dari area ───────────────────────────
    const deleteBranch = (branchId, branchName) => {
        if (!confirm(`Hapus cabang "${branchName}"? Data laporan yang terkait tidak akan terhapus.`)) return
        router.delete(`/branches/${branchId}`, { preserveScroll: true })
    }

    const inputStyle = {
        width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, boxSizing: 'border-box',
    }

    return (
        <AppLayout title="Manajemen Area">
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Manajemen Area</h1>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
                            {areas.length} area nasional · {areas.reduce((s, a) => s + a.branches_count, 0)} cabang terdaftar
                        </p>
                    </div>
                    <button onClick={() => setShowAdd(!showAdd)} style={{
                        background: '#166534', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                        + Tambah Area
                    </button>
                </div>

                {/* Form Tambah Area */}
                {showAdd && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                        <p style={{ fontWeight: 600, color: '#166534', margin: '0 0 12px' }}>Tambah Area Baru</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nama Area *</label>
                                <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Area Sulawesi" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Kode *</label>
                                <input value={addForm.code} onChange={e => setAddForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                    placeholder="SULAWESI" maxLength={20} style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Keterangan</label>
                                <input value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Opsional" style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={submitAdd} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Simpan</button>
                            <button onClick={() => setShowAdd(false)} style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Batal</button>
                        </div>
                    </div>
                )}

                {/* Tabel Area */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Nama Area', 'Kode', 'Cabang', 'Status', 'Aksi'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {areas.map((area, idx) => (
                                <>
                                    {/* Row Area */}
                                    <tr key={area.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none', background: editId === area.id ? '#fefce8' : '#fff' }}>

                                        {/* Nama */}
                                        <td style={{ padding: '12px 16px' }}>
                                            {editId === area.id ? (
                                                <input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                                                    style={{ ...inputStyle, width: 200 }} />
                                            ) : (
                                                <span style={{ fontWeight: 600, color: '#111827' }}>{area.name}</span>
                                            )}
                                        </td>

                                        {/* Kode */}
                                        <td style={{ padding: '12px 16px' }}>
                                            {editId === area.id ? (
                                                <input value={editData.code} onChange={e => setEditData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                                    maxLength={20} style={{ ...inputStyle, width: 100 }} />
                                            ) : (
                                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600 }}>
                                                    {area.code}
                                                </span>
                                            )}
                                        </td>

                                        {/* Jumlah Cabang */}
                                        <td style={{ padding: '12px 16px' }}>
                                            <button onClick={() => setExpandedArea(expandedArea === area.id ? null : area.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 13, fontWeight: 600, padding: 0 }}>
                                                {area.branches_count} cabang {expandedArea === area.id ? '▲' : '▼'}
                                            </button>
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '12px 16px' }}>{formatBadge(area.is_active)}</td>

                                        {/* Aksi */}
                                        <td style={{ padding: '12px 16px' }}>
                                            {editId === area.id ? (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button onClick={() => saveEdit(area.id)} style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>✓</button>
                                                    <button onClick={() => setEditId(null)} style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button onClick={() => startEdit(area)} style={{ background: '#eff6ff', color: '#1d4ed8', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Edit</button>
                                                    <button onClick={() => toggleActive(area.id)} style={{ background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>
                                                        {area.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                                    </button>
                                                    <button onClick={() => openAddBranch(area.id)} style={{ background: '#fefce8', color: '#854d0e', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>+ Cabang</button>
                                                    <button onClick={() => deleteArea(area.id, area.name)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Hapus</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Panel Tambah Cabang Baru */}
                                    {addingBranchArea === area.id && (
                                        <tr key={`add-branch-${area.id}`}>
                                            <td colSpan={5} style={{ padding: '0 16px 12px', background: '#fefce8' }}>
                                                <div style={{ border: '1px dashed #fbbf24', borderRadius: 8, padding: 14 }}>
                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#854d0e', margin: '0 0 10px' }}>
                                                        Tambah cabang baru ke <strong>{area.name}</strong>:
                                                    </p>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Nama Cabang *</label>
                                                            <input value={branchForm.name}
                                                                onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                                                                placeholder="SOLO BARU" style={inputStyle} />
                                                            {branchErrors.name && <p style={{ color: '#dc2626', fontSize: 10, margin: '2px 0 0' }}>{branchErrors.name}</p>}
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Kode *</label>
                                                            <input value={branchForm.code}
                                                                onChange={e => setBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                                                placeholder="SLB" maxLength={10} style={inputStyle} />
                                                            {branchErrors.code && <p style={{ color: '#dc2626', fontSize: 10, margin: '2px 0 0' }}>{branchErrors.code}</p>}
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Kota *</label>
                                                            <input value={branchForm.city}
                                                                onChange={e => setBranchForm(p => ({ ...p, city: e.target.value }))}
                                                                placeholder="Solo" style={inputStyle} />
                                                            {branchErrors.city && <p style={{ color: '#dc2626', fontSize: 10, margin: '2px 0 0' }}>{branchErrors.city}</p>}
                                                        </div>
                                                        <div>
                                                            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Provinsi *</label>
                                                            <input value={branchForm.province}
                                                                onChange={e => setBranchForm(p => ({ ...p, province: e.target.value }))}
                                                                placeholder="Jawa Tengah" style={inputStyle} />
                                                            {branchErrors.province && <p style={{ color: '#dc2626', fontSize: 10, margin: '2px 0 0' }}>{branchErrors.province}</p>}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button onClick={() => submitAddBranch(area.id)}
                                                            style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                                            Simpan Cabang
                                                        </button>
                                                        <button onClick={() => setAddingBranchArea(null)}
                                                            style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                                                            Batal
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Panel Daftar Cabang (expanded) */}
                                    {expandedArea === area.id && (
                                        <tr key={`branches-${area.id}`}>
                                            <td colSpan={5} style={{ padding: '0 16px 12px', background: '#f9fafb' }}>
                                                {area.branches.length === 0 ? (
                                                    <p style={{ fontSize: 13, color: '#9ca3af', margin: '8px 0' }}>Belum ada cabang. Klik "+ Cabang" untuk menambahkan.</p>
                                                ) : (
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr>
                                                                {['Cabang', 'Kode', 'Kota', 'Status', ''].map(h => (
                                                                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {area.branches.map(branch => (
                                                                <tr key={branch.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                                                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500, color: '#374151' }}>{branch.name}</td>
                                                                    <td style={{ padding: '8px 12px' }}>
                                                                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{branch.code}</span>
                                                                    </td>
                                                                    <td style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>{branch.city ?? '—'}</td>
                                                                    <td style={{ padding: '8px 12px' }}>{formatBadge(branch.is_active)}</td>
                                                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                                        <button onClick={() => deleteBranch(branch.id, branch.name)}
                                                                            style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                                                                            Hapus
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    )
}
