import { useState, useMemo } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const thStyle = {
    padding: '8px 10px', fontSize: 11, fontWeight: 500,
    color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb', whiteSpace: 'nowrap', textAlign: 'left',
}
const tdStyle = {
    padding: '8px 10px', fontSize: 12,
    borderBottom: '1px solid #f3f4f6',
}
const inputStyle = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
}
const btnSmall = {
    padding: '4px 8px', fontSize: 11, border: 'none', borderRadius: 6,
    cursor: 'pointer', transition: 'all .15s',
}

const CHANNEL_LABELS = {
    presentasi: 'Presentasi',
    gerai: 'Gerai',
    wgts: 'WGTS',
    dfi: 'DFI (AR)',
    dfe: 'DFE (AE)',
    kotak_qris: 'Kotak/QRIS',
    kantor: 'Kantor',
}

const TYPE_LABELS = {
    team: 'Tim',
    person: 'Individu',
}

export default function RevenueSourceIndex({ branches, selectedBranchId, sources, channels }) {
    const [activeBranchId, setActiveBranchId] = useState(selectedBranchId)
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})

    // Form state
    const [formName, setFormName] = useState('')
    const [formType, setFormType] = useState('team')
    const [formChannel, setFormChannel] = useState(channels?.[0] ?? 'presentasi')
    const [formPersonnel, setFormPersonnel] = useState('')
    const [saving, setSaving] = useState(false)

    const handleBranchChange = (e) => {
        const branchId = e.target.value
        setActiveBranchId(branchId)
        // Reload page with new branch_id
        router.get('/revenue-sources', { branch_id: branchId }, {
            preserveState: true,
            preserveScroll: true,
        })
    }

    const handleAddSource = () => {
        if (!formName.trim()) return
        setSaving(true)

        router.post(`/branches/${activeBranchId}/sources`, {
            name: formName.trim(),
            type: formType,
            channel: formChannel,
            personnel: formPersonnel.trim() || null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setFormName('')
                setFormType('team')
                setFormChannel(channels?.[0] ?? 'presentasi')
                setFormPersonnel('')
            },
            onFinish: () => setSaving(false),
        })
    }

    const startEdit = (source) => {
        setEditId(source.id)
        setEditData({
            name: source.name,
            personnel: source.personnel || '',
            sort_order: source.sort_order || 0,
        })
    }

    const saveEdit = () => {
        setSaving(true)
        router.put(`/sources/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
            onFinish: () => setSaving(false),
        })
    }

    const toggleActive = (id) => {
        router.patch(`/sources/${id}/toggle`, {}, { preserveScroll: true })
    }

    const deleteSource = (id) => {
        if (!confirm('Hapus sumber ini?')) return
        router.delete(`/sources/${id}`, { preserveScroll: true })
    }

    // channels dari backend = array of strings: ['presentasi', 'gerai', ...]
    const channelList = channels ?? Object.keys(CHANNEL_LABELS)

    return (
        <AppLayout title="Kelola Sumber Revenue">
            <style>{`
                .src-row:hover { background: #f9fafb; }
                @media (max-width: 768px) {
                    table { font-size: 11px !important; }
                    table th, table td { padding: 6px 8px !important; }
                }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>Kelola Sumber Revenue</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                    Master data tim, karyawan, dan relawan per cabang
                </p>
            </div>

            {/* Branch selector */}
            {branches.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>
                        Pilih Cabang
                    </label>
                    <select value={activeBranchId} onChange={handleBranchChange}
                        style={{ ...inputStyle, maxWidth: 300 }}>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Sections per kanal */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 16 }}>
                {channelList.map((channelKey) => {
                    const channelSources = sources[channelKey] ?? []
                    const activeCount = channelSources.filter(s => s.is_active).length
                    const totalCount = channelSources.length
                    const label = CHANNEL_LABELS[channelKey] ?? channelKey

                    return (
                        <div key={channelKey} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            {/* Header section */}
                            <div style={{
                                padding: '12px 16px', background: '#f9fafb',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 12 }}>
                                        {activeCount} aktif dari {totalCount}
                                    </span>
                                </div>
                            </div>

                            {/* Tabel kanal */}
                            {channelSources.length === 0 ? (
                                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                                    Belum ada sumber untuk kanal {label.toLowerCase()}
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, width: 40 }}>Status</th>
                                            <th style={thStyle}>Nama</th>
                                            <th style={{ ...thStyle, width: 100 }}>Tipe</th>
                                            <th style={thStyle}>Personil</th>
                                            <th style={{ ...thStyle, width: 60 }}>Urutan</th>
                                            <th style={{ ...thStyle, width: 100 }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {channelSources.map(source => {
                                            const isEditing = editId === source.id

                                            return (
                                                <tr key={source.id} className="src-row"
                                                    style={{ background: isEditing ? '#f0fdf4' : undefined }}>
                                                    <td style={tdStyle}>
                                                        <button onClick={() => toggleActive(source.id)}
                                                            style={{
                                                                ...btnSmall,
                                                                background: source.is_active ? '#dcfce7' : '#f3f4f6',
                                                                color: source.is_active ? '#166534' : '#9ca3af',
                                                                border: `1px solid ${source.is_active ? '#bbf7d0' : '#d1d5db'}`,
                                                            }}>
                                                            {source.is_active ? '✓' : '○'}
                                                        </button>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {isEditing ? (
                                                            <input value={editData.name}
                                                                onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                                        ) : (
                                                            <span style={{ fontWeight: source.is_active ? 500 : 400, color: source.is_active ? '#111827' : '#9ca3af' }}>
                                                                {source.name}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{
                                                            display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                                                            background: source.type === 'team' ? '#dbeafe' : '#f3e8ff',
                                                            color: source.type === 'team' ? '#1d4ed8' : '#7c3aed',
                                                        }}>
                                                            {TYPE_LABELS[source.type] ?? source.type}
                                                        </span>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {isEditing ? (
                                                            <input value={editData.personnel}
                                                                onChange={e => setEditData(p => ({ ...p, personnel: e.target.value }))}
                                                                placeholder="Nama anggota (opsional)"
                                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                                        ) : (
                                                            <span style={{ color: source.personnel ? '#111827' : '#d1d5db', fontSize: 12 }}>
                                                                {source.personnel || '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {isEditing ? (
                                                            <input type="number" value={editData.sort_order}
                                                                onChange={e => setEditData(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', boxSizing: 'border-box' }} />
                                                        ) : (
                                                            <span style={{ fontSize: 12, color: '#9ca3af' }}>{source.sort_order || '—'}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                        {isEditing ? (
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button onClick={saveEdit} disabled={saving}
                                                                    style={{ ...btnSmall, background: '#166534', color: '#fff' }}>
                                                                    {saving ? '...' : '✓'}
                                                                </button>
                                                                <button onClick={() => setEditId(null)}
                                                                    style={{ ...btnSmall, background: '#f3f4f6' }}>✕</button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button onClick={() => startEdit(source)}
                                                                    style={{ ...btnSmall, background: '#dbeafe', color: '#1d4ed8' }}>
                                                                    Edit
                                                                </button>
                                                                <button onClick={() => deleteSource(source.id)}
                                                                    style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>
                                                                    Hapus
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Form tambah */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>
                    Tambah Sumber Baru
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            Nama
                        </label>
                        <input value={formName} onChange={e => setFormName(e.target.value)}
                            placeholder="Nama tim, karyawan, atau relawan"
                            style={inputStyle} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            Tipe
                        </label>
                        <select value={formType} onChange={e => setFormType(e.target.value)}
                            style={inputStyle}>
                            <option value="team">Tim</option>
                            <option value="person">Individu</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            Kanal
                        </label>
                        <select value={formChannel} onChange={e => setFormChannel(e.target.value)}
                            style={inputStyle}>
                            {channelList.map(ch => (
                                <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            Personil (opsional)
                        </label>
                        <input value={formPersonnel} onChange={e => setFormPersonnel(e.target.value)}
                            placeholder="Nama anggota tim"
                            style={inputStyle} />
                    </div>
                </div>

                <button disabled={saving || !formName.trim()}
                    onClick={handleAddSource}
                    style={{
                        background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8,
                        fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                        opacity: !formName.trim() ? .5 : 1,
                    }}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
            </div>
        </AppLayout>
    )
}
