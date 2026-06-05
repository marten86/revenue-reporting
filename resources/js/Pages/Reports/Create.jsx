import { Link, useForm, usePage } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

export default function ReportCreate({ branches }) {
    const { auth } = usePage().props
    const user = auth?.user

    const { data, setData, post, processing, errors } = useForm({
        branch_id:    user?.branch_id ?? '',
        period_month: new Date().toISOString().slice(0, 7) + '-01',
    })

    return (
        <AppLayout title="Buat Laporan Baru">
            <div style={{ maxWidth: 480 }}>
                <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Buat Laporan Baru</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Satu laporan per cabang per bulan.</p>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Cabang</label>
                        {user?.role === 'branch_head' || user?.role === 'staff' ? (
                            <div style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#f9fafb', color: '#6b7280' }}>
                                {branches.find(b => b.id === data.branch_id)?.name ?? 'Cabang Anda'}
                            </div>
                        ) : (
                            <select value={data.branch_id} onChange={e => setData('branch_id', e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                                <option value="">— Pilih Cabang —</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                        {errors.branch_id && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{errors.branch_id}</p>}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Periode</label>
                        <input type="month" value={data.period_month.slice(0, 7)}
                            onChange={e => setData('period_month', e.target.value + '-01')}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                        {errors.period_month && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{errors.period_month}</p>}
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '5px 0 0' }}>
                            Laporan untuk: <strong>{new Date(data.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong>
                        </p>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#166534', marginBottom: 16 }}>
                        <strong>Setelah dibuat:</strong> isi data harian, rincian tim, dan safari dakwah di halaman laporan, lalu submit ke Area Manager.
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => post('/reports')} disabled={processing || !data.branch_id}
                            style={{ background: '#166534', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', opacity: (!data.branch_id || processing) ? .5 : 1 }}>
                            {processing ? 'Membuat...' : 'Buat Laporan'}
                        </button>
                        <Link href="/reports" style={{ padding: '9px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
                            Batal
                        </Link>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}