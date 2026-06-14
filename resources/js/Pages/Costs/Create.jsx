import { useForm } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }

export default function CostsCreate({ branches }) {
    const { data, setData, post, processing, errors } = useForm({
        branch_id: branches[0]?.id ?? '',
        period_month: new Date().toISOString().slice(0, 7) + '-01',
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        post('/costs')
    }

    return (
        <AppLayout title="Buat Laporan Biaya">
            <div style={{ maxWidth: 480 }}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 4px' }}>Buat Laporan Biaya</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Pilih cabang dan periode laporan biaya</p>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24 }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Cabang</label>
                            <select value={data.branch_id} onChange={e => setData('branch_id', e.target.value)} style={inputStyle}>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                            </select>
                            {errors.branch_id && <p style={{ color: '#dc2626', fontSize: 11, margin: '4px 0 0' }}>{errors.branch_id}</p>}
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#374151' }}>Periode</label>
                            <input
                                type="month"
                                value={data.period_month.slice(0, 7)}
                                onChange={e => setData('period_month', e.target.value + '-01')}
                                style={inputStyle}
                            />
                            {errors.period_month && <p style={{ color: '#dc2626', fontSize: 11, margin: '4px 0 0' }}>{errors.period_month}</p>}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" disabled={processing}
                                style={{ background: '#166534', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                                {processing ? 'Membuat...' : 'Buat Laporan'}
                            </button>
                            <a href="/costs"
                                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#374151', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                                Batal
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    )
}
