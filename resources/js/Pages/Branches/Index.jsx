import { useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
const thStyle = { padding: '10px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' }
const tdStyle = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }

export default function BranchIndex({ branches, areas }) {
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})

    const { data, setData, post, processing, reset, errors } = useForm({
        name: '', code: '', city: '', province: '', area_id: areas[0]?.id ?? '',
    })

    const handleAdd = (e) => {
        e.preventDefault()
        post('/branches', { onSuccess: () => reset() })
    }

    const startEdit = (b) => {
        setEditId(b.id)
        setEditData({ name: b.name, code: b.code, city: b.city, province: b.province, area_id: b.area_id })
    }

    const saveEdit = () => {
        router.put(`/branches/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
        })
    }

    return (
        <AppLayout title="Manajemen Cabang">
            <style>{`
                .br-row:hover { background: #f9fafb; }
                .br-row td { transition: background .15s; }
            `}</style>

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Cabang</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{branches.length} cabang terdaftar</p>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Nama Cabang</th>
                            <th style={thStyle}>Kode</th>
                            <th style={thStyle}>Kota</th>
                            <th style={thStyle}>Provinsi</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>User</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                            <th style={{ ...thStyle, width: 140 }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {branches.map(b => {
                            const isEdit = editId === b.id
                            return (
                                <tr key={b.id} className="br-row">
                                    <td style={tdStyle}>
                                        {isEdit ? <input value={editData.name} onChange={e => setEditData(p => ({...p, name: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}} /> : <span style={{fontWeight: 500}}>{b.name}</span>}
                                    </td>
                                    <td style={tdStyle}>
                                        {isEdit ? <input value={editData.code} onChange={e => setEditData(p => ({...p, code: e.target.value.toUpperCase()}))} style={{...inputStyle, padding: '4px 8px', width: 70}} /> : <span style={{fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12}}>{b.code}</span>}
                                    </td>
                                    <td style={tdStyle}>
                                        {isEdit ? <input value={editData.city} onChange={e => setEditData(p => ({...p, city: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}} /> : b.city}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
    {isEdit ? (
        <select
            value={editData.area_id}
            onChange={e => setEditData(p => ({ ...p, area_id: e.target.value }))}
            style={{ ...inputStyle, padding: '4px 8px', minWidth: 120 }}
        >
            {(areas || []).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
            ))}
        </select>
    ) : (
        <span style={{ fontSize: 12, color: '#6b7280' }}>{b.area?.name ?? '—'}</span>
    )}
</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        <span style={{fontFamily: 'monospace', fontWeight: 500}}>{b.users_count}</span>
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>
                                        <button onClick={() => router.patch(`/branches/${b.id}/toggle`, {}, {preserveScroll: true})}
                                            style={{
                                                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                                                background: b.is_active ? '#dcfce7' : '#f3f4f6',
                                                color: b.is_active ? '#166534' : '#9ca3af',
                                            }}>
                                            {b.is_active ? 'Aktif' : 'Nonaktif'}
                                        </button>
                                    </td>
                                    <td style={tdStyle}>
                                        {isEdit ? (
                                            <div style={{display: 'flex', gap: 4}}>
                                                <button onClick={saveEdit} style={{background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12}}>✓</button>
                                                <button onClick={() => setEditId(null)} style={{background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12}}>✕</button>
                                            </div>
                                        ) : (
                                            <div style={{display: 'flex', gap: 8}}>
                                                <button onClick={() => startEdit(b)} style={{fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer'}}>Edit</button>
                                                <button onClick={() => { if (confirm(`Hapus cabang ${b.name}?`)) router.delete(`/branches/${b.id}`, {preserveScroll: true}) }}
                                                    style={{fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer'}}>Hapus</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add form */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Tambah Cabang Baru</div>
                <form onSubmit={handleAdd}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 1fr 140px', gap: 10, marginBottom: 14 }}>
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Nama Cabang</label>
                            <input value={data.name} onChange={e => setData('name', e.target.value)} placeholder="JAYAPURA" style={inputStyle} />
                            {errors.name && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.name}</p>}
                        </div>
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Kode</label>
                            <input value={data.code} onChange={e => setData('code', e.target.value.toUpperCase())} placeholder="JPR" style={inputStyle} />
                            {errors.code && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.code}</p>}
                        </div>
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Kota</label>
                            <input value={data.city} onChange={e => setData('city', e.target.value)} placeholder="Jayapura" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Provinsi</label>
                            <input value={data.province} onChange={e => setData('province', e.target.value)} placeholder="Papua" style={inputStyle} />
                        </div>
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Area</label>
                            <select value={data.area_id} onChange={e => setData('area_id', e.target.value)} style={inputStyle}>
                                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button type="submit" disabled={processing}
                        style={{ background: '#166534', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                        {processing ? 'Menyimpan...' : 'Tambah Cabang'}
                    </button>
                </form>
            </div>
        </AppLayout>
    )
}
