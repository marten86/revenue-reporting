import { useState } from 'react'
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
    gerai:      'Gerai',
    wgts:       'WGTS',
    dfi:        'DFI (AR)',
    dfe:        'DFE (AE)',
    kotak_qris: 'Kotak/QRIS',
    kantor:     'Kantor',
}

const TYPE_LABELS = {
    team:   'Tim',
    person: 'Individu',
}

// Label kolom dinamis per channel
const CHANNEL_COL_LABELS = {
    gerai: { name: 'Lokasi Gerai', personnel: 'Petugas', namePlaceholder: 'Nama lokasi gerai', personnelPlaceholder: 'Nama petugas gerai' },
    dfi:   { name: 'Nama Karyawan', personnel: 'Keterangan', namePlaceholder: 'Nama karyawan', personnelPlaceholder: 'Keterangan (opsional)' },
    dfe:   { name: 'Nama Relawan', personnel: 'Keterangan', namePlaceholder: 'Nama relawan', personnelPlaceholder: 'Keterangan (opsional)' },
}
const DEFAULT_COL_LABELS = { name: 'Nama Tim', personnel: 'Personil', namePlaceholder: 'Nama tim', personnelPlaceholder: 'Nama anggota tim (opsional)' }

const getColLabels = (channelKey) => CHANNEL_COL_LABELS[channelKey] ?? DEFAULT_COL_LABELS

export default function RevenueSourceIndex({ branches, selectedBranchId, sources, channels }) {
    const [activeBranchId, setActiveBranchId] = useState(selectedBranchId)
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})

    const [formName, setFormName] = useState('')
    const [formType, setFormType] = useState('team')
    const [formChannel, setFormChannel] = useState(channels?.[0] ?? 'presentasi')
    const [formPersonnel, setFormPersonnel] = useState('')
    const [saving, setSaving] = useState(false)

    const channelList = channels ?? Object.keys(CHANNEL_LABELS)
    const formColLabels = getColLabels(formChannel)

    const handleBranchChange = (e) => {
        const branchId = e.target.value
        setActiveBranchId(branchId)
        router.get('/revenue-sources', { branch_id: branchId }, { preserveState: true, preserveScroll: true })
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
        setEditData({ name: source.name, personnel: source.personnel || '', sort_order: source.sort_order || 0 })
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

    return (
        <AppLayout title="Kelola Sumber Revenue">
            <style>{`
                .src-row:hover { background: #f9fafb; }
                @media (max-width: 768px) {
                    table { font-size: 11px !important; }
                    table th, table td { padding: 6px 8px !important; }
                }
            `}</style>

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>Kelola Sumber Revenue</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Master data tim, karyawan, relawan, dan lokasi gerai per cabang</p>
            </div>

            {branches.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Pilih Cabang</label>
                    <select value={activeBranchId} onChange={handleBranchChange} style={{ ...inputStyle, maxWidth: 300 }}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                    </select>
                </div>
            )}

            {/* Sections per kanal */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
                {channelList.map((channelKey, idx) => {
                    const channelSources = sources[channelKey] ?? []
                    const activeCount = channelSources.filter(s => s.is_active).length
                    const totalCount = channelSources.length
                    const label = CHANNEL_LABELS[channelKey] ?? channelKey
                    const colLabels = getColLabels(channelKey)
                    const isGerai = channelKey === 'gerai'

                    return (
                        <div key={channelKey} style={{ borderBottom: idx < channelList.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <div style={{ padding: '10px 16px', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{activeCount} aktif dari {totalCount}</span>
                                    {isGerai && (
                                        <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4 }}>
                                            Nama = Lokasi · Personil = Petugas
                                        </span>
                                    )}
                                </div>
                            </div>

                            {channelSources.length === 0 ? (
                                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                                    Belum ada sumber untuk kanal {label.toLowerCase()}
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: 52 }} />
                                        <col style={{ width: 220 }} />
                                        <col style={{ width: 90 }} />
                                        <col />
                                        <col style={{ width: 70 }} />
                                        <col style={{ width: 110 }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                                            <th style={thStyle}>{colLabels.name}</th>
                                            <th style={thStyle}>Tipe</th>
                                            <th style={thStyle}>{colLabels.personnel}</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Urutan</th>
                                            <th style={{ ...thStyle, textAlign: 'center' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {channelSources.map(source => {
                                            const isEditing = editId === source.id
                                            return (
                                                <tr key={source.id} className="src-row"
                                                    style={{ background: isEditing ? '#f0fdf4' : undefined }}>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
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
                                                                placeholder={colLabels.personnelPlaceholder}
                                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                                        ) : (
                                                            <span style={{ color: source.personnel ? '#111827' : '#d1d5db', fontSize: 12 }}>
                                                                {source.personnel || '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                        {isEditing ? (
                                                            <input type="number" value={editData.sort_order}
                                                                onChange={e => setEditData(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, textAlign: 'right', boxSizing: 'border-box' }} />
                                                        ) : (
                                                            <span style={{ fontSize: 12, color: '#9ca3af' }}>{source.sort_order || '—'}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        {isEditing ? (
                                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                                <button onClick={saveEdit} disabled={saving}
                                                                    style={{ ...btnSmall, background: '#166534', color: '#fff' }}>
                                                                    {saving ? '...' : '✓'}
                                                                </button>
                                                                <button onClick={() => setEditId(null)}
                                                                    style={{ ...btnSmall, background: '#f3f4f6' }}>✕</button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                                <button onClick={() => startEdit(source)}
                                                                    style={{ ...btnSmall, background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                                                                <button onClick={() => deleteSource(source.id)}
                                                                    style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>Hapus</button>
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
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah Sumber Baru</div>

                {/* Pilih kanal dulu supaya label form menyesuaikan */}
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Kanal</label>
                    <select value={formChannel} onChange={e => { setFormChannel(e.target.value); setFormType(e.target.value === 'presentasi' || e.target.value === 'wgts' ? 'team' : 'person') }}
                        style={{ ...inputStyle, maxWidth: 200 }}>
                        {channelList.map(ch => <option key={ch} value={ch}>{CHANNEL_LABELS[ch] ?? ch}</option>)}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            {formColLabels.name}
                        </label>
                        <input value={formName} onChange={e => setFormName(e.target.value)}
                            placeholder={formColLabels.namePlaceholder} style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Tipe</label>
                        <select value={formType} onChange={e => setFormType(e.target.value)} style={inputStyle}>
                            <option value="team">Tim</option>
                            <option value="person">Individu</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>
                            {formColLabels.personnel}
                        </label>
                        <input value={formPersonnel} onChange={e => setFormPersonnel(e.target.value)}
                            placeholder={formColLabels.personnelPlaceholder} style={inputStyle} />
                    </div>
                </div>

                <button disabled={saving || !formName.trim()} onClick={handleAddSource}
                    style={{ background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: !formName.trim() ? .5 : 1 }}>
                    {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
            </div>
        </AppLayout>
    )
}
