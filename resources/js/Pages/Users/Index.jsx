import { useState } from 'react'
import { router, useForm } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }
const thStyle = { padding: '10px 12px', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left' }
const tdStyle = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6' }

const roleLabels = {
    super_admin: 'Super Admin', area_manager: 'Area Manager',
    branch_head: 'Kepala Cabang', staff: 'Staff',
}
const roleColors = {
    super_admin: { bg: '#fef3c7', color: '#d97706' },
    area_manager: { bg: '#dbeafe', color: '#1d4ed8' },
    branch_head: { bg: '#dcfce7', color: '#166534' },
    staff: { bg: '#f3f4f6', color: '#6b7280' },
}

const needsBranch = (role) => ['branch_head', 'staff'].includes(role)
const needsArea = (role) => ['area_manager'].includes(role)

export default function UserIndex({ users, branches, areas, roles }) {
    const [editId, setEditId] = useState(null)
    const [editData, setEditData] = useState({})
    const [resetId, setResetId] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [resetting, setResetting] = useState(false)

    const { data, setData, post, processing, reset, errors } = useForm({
        name: '', email: '', password: '', role: 'branch_head', branch_id: '', area_id: '', phone: '',
    })

    const handleAdd = (e) => {
        e.preventDefault()
        post('/users', { onSuccess: () => reset() })
    }

    const startEdit = (u) => {
        setEditId(u.id)
        setEditData({
            name: u.name,
            email: u.email,
            role: u.role,
            branch_id: u.branch_id ?? '',
            area_id: u.area_id ?? '',
            phone: u.phone ?? '',
        })
    }

    const saveEdit = () => {
        router.put(`/users/${editId}`, editData, {
            preserveScroll: true,
            onSuccess: () => setEditId(null),
        })
    }

    const handleResetPassword = () => {
        setResetting(true)
        router.patch(`/users/${resetId}/password`, { password: newPassword }, {
            preserveScroll: true,
            onSuccess: () => { setResetId(null); setNewPassword('') },
            onFinish: () => setResetting(false),
        })
    }

    const renderAssignment = (u) => {
        if (needsBranch(u.role)) return u.branch?.name ?? <span style={{color:'#d97706',fontSize:11}}>⚠ Belum ada cabang</span>
        if (needsArea(u.role)) return u.area?.name ?? <span style={{color:'#d97706',fontSize:11}}>⚠ Belum ada area</span>
        return <span style={{color:'#9ca3af'}}>—</span>
    }

    return (
        <AppLayout title="Manajemen User">
            <style>{`
                .usr-row:hover { background: #f9fafb; }
                .usr-row td { transition: background .15s; }
            `}</style>

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>User</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{users.length} user terdaftar</p>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Nama</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>No. WA</th>
                            <th style={thStyle}>Role</th>
                            <th style={thStyle}>Area / Cabang</th>
                            <th style={{ ...thStyle, width: 200 }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => {
                            const isEdit = editId === u.id
                            const rc = roleColors[u.role] ?? roleColors.staff
                            return (
                                <tr key={u.id} className="usr-row">
                                    {/* Nama */}
                                    <td style={tdStyle}>
                                        {isEdit
                                            ? <input value={editData.name} onChange={e => setEditData(p => ({...p, name: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}} />
                                            : <span style={{fontWeight: 500}}>{u.name}</span>}
                                    </td>

                                    {/* Email */}
                                    <td style={tdStyle}>
                                        {isEdit
                                            ? <input value={editData.email} onChange={e => setEditData(p => ({...p, email: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}} />
                                            : <span style={{fontSize: 12, color: '#6b7280'}}>{u.email}</span>}
                                    </td>

                                    {/* No. WA */}
                                    <td style={tdStyle}>
                                        {isEdit
                                            ? <input
                                                value={editData.phone}
                                                onChange={e => setEditData(p => ({...p, phone: e.target.value}))}
                                                placeholder="628xxxxxxxxxx"
                                                style={{...inputStyle, padding: '4px 8px', width: 150}}
                                              />
                                            : <span style={{fontSize: 12, color: u.phone ? '#374151' : '#d1d5db', fontFamily: u.phone ? 'monospace' : 'inherit'}}>
                                                {u.phone ?? '—'}
                                              </span>
                                        }
                                    </td>

                                    {/* Role */}
                                    <td style={tdStyle}>
                                        {isEdit ? (
                                            <select
                                                value={editData.role}
                                                onChange={e => setEditData(p => ({
                                                    ...p,
                                                    role: e.target.value,
                                                    branch_id: '',
                                                    area_id: '',
                                                }))}
                                                style={{...inputStyle, padding: '4px 8px'}}
                                            >
                                                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                            </select>
                                        ) : (
                                            <span style={{padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: rc.bg, color: rc.color}}>
                                                {roleLabels[u.role]}
                                            </span>
                                        )}
                                    </td>

                                    {/* Area / Cabang */}
                                    <td style={tdStyle}>
                                        {isEdit ? (
                                            needsBranch(editData.role) ? (
                                                <select value={editData.branch_id} onChange={e => setEditData(p => ({...p, branch_id: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}}>
                                                    <option value="">— Pilih Cabang —</option>
                                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            ) : needsArea(editData.role) ? (
                                                <select value={editData.area_id} onChange={e => setEditData(p => ({...p, area_id: e.target.value}))} style={{...inputStyle, padding: '4px 8px'}}>
                                                    <option value="">— Pilih Area —</option>
                                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            ) : (
                                                <span style={{fontSize: 12, color: '#9ca3af'}}>—</span>
                                            )
                                        ) : (
                                            <span style={{fontSize: 12}}>{renderAssignment(u)}</span>
                                        )}
                                    </td>

                                    {/* Aksi */}
                                    <td style={tdStyle}>
                                        {isEdit ? (
                                            <div style={{display: 'flex', gap: 4}}>
                                                <button onClick={saveEdit} style={{background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12}}>✓</button>
                                                <button onClick={() => setEditId(null)} style={{background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12}}>✕</button>
                                            </div>
                                        ) : (
                                            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                                                <button onClick={() => startEdit(u)} style={{fontSize: 12, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer'}}>Edit</button>
                                                <button onClick={() => { setResetId(u.id); setNewPassword('') }} style={{fontSize: 12, color: '#d97706', background: 'none', border: 'none', cursor: 'pointer'}}>Reset PW</button>
                                                <button onClick={() => { if (confirm(`Hapus user ${u.name}?`)) router.delete(`/users/${u.id}`, {preserveScroll: true}) }}
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

            {/* Reset password modal */}
            {resetId && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16}}
                    onClick={() => setResetId(null)}>
                    <div onClick={e => e.stopPropagation()}
                        style={{background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,.15)'}}>
                        <div style={{fontWeight: 600, fontSize: 15, marginBottom: 4}}>Reset Password</div>
                        <p style={{fontSize: 13, color: '#6b7280', margin: '0 0 16px'}}>{users.find(u => u.id === resetId)?.name}</p>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            placeholder="Password baru (min. 6 karakter)" style={{...inputStyle, marginBottom: 14}} autoFocus />
                        <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                            <button onClick={() => setResetId(null)}
                                style={{padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer'}}>Batal</button>
                            <button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}
                                style={{padding: '8px 16px', background: '#166534', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: newPassword.length < 6 ? .5 : 1}}>
                                {resetting ? '...' : 'Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add form */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Tambah User Baru</div>
                <form onSubmit={handleAdd}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 130px 140px 1fr', gap: 10, marginBottom: 14 }}>
                        {/* Nama */}
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Nama</label>
                            <input value={data.name} onChange={e => setData('name', e.target.value)} placeholder="Nama lengkap" style={inputStyle} />
                            {errors.name && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.name}</p>}
                        </div>

                        {/* Email */}
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Email</label>
                            <input type="email" value={data.email} onChange={e => setData('email', e.target.value)} placeholder="email@onebwa.my.id" style={inputStyle} />
                            {errors.email && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Password</label>
                            <input type="password" value={data.password} onChange={e => setData('password', e.target.value)} placeholder="Min. 6 karakter" style={inputStyle} />
                            {errors.password && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.password}</p>}
                        </div>

                        {/* Role */}
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Role</label>
                            <select value={data.role} onChange={e => setData(d => ({...d, role: e.target.value, branch_id: '', area_id: ''}))} style={inputStyle}>
                                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {/* No. WA */}
                        <div>
                            <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>No. WA</label>
                            <input value={data.phone} onChange={e => setData('phone', e.target.value)} placeholder="628xxxxxxxxxx" style={inputStyle} />
                            {errors.phone && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.phone}</p>}
                        </div>

                        {/* Area atau Cabang — kondisional */}
                        <div>
                            {needsBranch(data.role) ? (
                                <>
                                    <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Cabang</label>
                                    <select value={data.branch_id} onChange={e => setData('branch_id', e.target.value)} style={inputStyle}>
                                        <option value="">— Pilih Cabang —</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                    {errors.branch_id && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.branch_id}</p>}
                                </>
                            ) : needsArea(data.role) ? (
                                <>
                                    <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Area</label>
                                    <select value={data.area_id} onChange={e => setData('area_id', e.target.value)} style={inputStyle}>
                                        <option value="">— Pilih Area —</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                    {errors.area_id && <p style={{color: '#dc2626', fontSize: 11, margin: '2px 0 0'}}>{errors.area_id}</p>}
                                </>
                            ) : (
                                <>
                                    <label style={{display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: '#374151'}}>Area / Cabang</label>
                                    <input disabled value="— Tidak perlu —" style={{...inputStyle, background: '#f9fafb', color: '#9ca3af'}} />
                                </>
                            )}
                        </div>
                    </div>

                    <button type="submit" disabled={processing}
                        style={{ background: '#166534', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                        {processing ? 'Menyimpan...' : 'Tambah User'}
                    </button>
                </form>
            </div>
        </AppLayout>
    )
}
