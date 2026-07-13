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

function SpeakerTable({ title, badge, speakers, canEdit, editId, editData, setEditId, setEditData, onSave, onToggle, onDelete, saving }) {
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
                {badge && (
                    <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4 }}>{badge}</span>
                )}
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {speakers.filter(s => s.is_active).length} aktif dari {speakers.length}
                </span>
            </div>

            {speakers.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    Belum ada narasumber.
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Status</th>
                            <th style={thStyle}>Nama</th>
                            {canEdit && <th style={{ ...thStyle, width: 110, textAlign: 'center' }}>Aksi</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {speakers.map(s => {
                            const isEditing = editId === s.id
                            return (
                                <tr key={s.id} style={{ background: isEditing ? '#f0fdf4' : undefined }}>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button onClick={() => onToggle(s.id)} disabled={!canEdit}
                                            style={{
                                                ...btnSmall,
                                                background: s.is_active ? '#dcfce7' : '#f3f4f6',
                                                color: s.is_active ? '#166534' : '#9ca3af',
                                                border: `1px solid ${s.is_active ? '#bbf7d0' : '#d1d5db'}`,
                                                cursor: canEdit ? 'pointer' : 'default',
                                            }}>
                                            {s.is_active ? '✓' : '○'}
                                        </button>
                                    </td>
                                    <td style={tdStyle}>
                                        {isEditing ? (
                                            <input value={editData.name}
                                                onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                                                style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                                        ) : (
                                            <span style={{ fontWeight: s.is_active ? 500 : 400, color: s.is_active ? '#111827' : '#9ca3af' }}>
                                                {s.name}
                                            </span>
                                        )}
                                    </td>
                                    {canEdit && (
                                        <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    <button onClick={onSave} disabled={saving}
                                                        style={{ ...btnSmall, background: '#166534', color: '#fff' }}>
                                                        {saving ? '...' : '✓'}
                                                    </button>
                                                    <button onClick={() => setEditId(null)} style={{ ...btnSmall, background: '#f3f4f6' }}>✕</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    <button onClick={() => { setEditId(s.id); setEditData({ name: s.name }) }}
                                                        style={{ ...btnSmall, background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                                                    <button onClick={() => onDelete(s.id)}
                                                        style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>Hapus</button>
                                                </div>
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
    )
}

export default function SpeakersIndex({ branches, selectedBranchId, branchSpeakers, nationalSpeakers, canManageNational, canEdit }) {
    const [activeBranchId, setActiveBranchId] = useState(selectedBranchId)
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})
    const [saving, setSaving] = useState(false)

    const [formName, setFormName] = useState('')
    const [formNational, setFormNational] = useState(false)
    const [savingNew, setSavingNew] = useState(false)

    const handleBranchChange = (e) => {
        const branchId = e.target.value
        setActiveBranchId(branchId)
        router.get('/speakers', { branch_id: branchId }, { preserveState: true, preserveScroll: true })
    }

    const handleAdd = () => {
        if (!formName.trim()) return
        setSavingNew(true)
        router.post('/speakers', {
            name: formName.trim(),
            branch_id: formNational ? null : activeBranchId,
        }, {
            preserveScroll: true,
            onSuccess: () => { setFormName(''); setFormNational(false) },
            onFinish: () => setSavingNew(false),
        })
    }

    const saveEdit = () => {
        setSaving(true)
        router.put(`/speakers/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
            onFinish: () => setSaving(false),
        })
    }

    const toggleActive = (id) => router.patch(`/speakers/${id}/toggle`, {}, { preserveScroll: true })

    const deleteSpeaker = (id) => {
        if (!confirm('Hapus narasumber ini? Data historis pada laporan lama tidak akan berubah.')) return
        router.delete(`/speakers/${id}`, { preserveScroll: true })
    }

    return (
        <AppLayout title="Kelola Narasumber">
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px 0' }}>Kelola Narasumber</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Master data narasumber Safari Dakwah — per cabang dan nasional (lintas cabang)</p>
            </div>

            {branches.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Pilih Cabang</label>
                    <select value={activeBranchId} onChange={handleBranchChange} style={{ ...inputStyle, maxWidth: 300 }}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                    </select>
                </div>
            )}

            {canManageNational && (
                <SpeakerTable
                    title="Narasumber Nasional" badge="Tampil di semua cabang" speakers={nationalSpeakers}
                    canEdit={canEdit} editId={editId} editData={editData} setEditId={setEditId} setEditData={setEditData}
                    onSave={saveEdit} onToggle={toggleActive} onDelete={deleteSpeaker} saving={saving}
                />
            )}

            <SpeakerTable
                title="Narasumber Cabang" speakers={branchSpeakers}
                canEdit={canEdit} editId={editId} editData={editData} setEditId={setEditId} setEditData={setEditData}
                onSave={saveEdit} onToggle={toggleActive} onDelete={deleteSpeaker} saving={saving}
            />

            {canEdit && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Tambah Narasumber Baru</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151' }}>Nama</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama narasumber" style={inputStyle} />
                        </div>
                        {canManageNational && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', paddingBottom: 9 }}>
                                <input type="checkbox" checked={formNational} onChange={e => setFormNational(e.target.checked)} />
                                Nasional
                            </label>
                        )}
                        <button disabled={savingNew || !formName.trim()} onClick={handleAdd}
                            style={{ background: '#166534', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: !formName.trim() ? .5 : 1 }}>
                            {savingNew ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </div>
            )}
        </AppLayout>
    )
}
