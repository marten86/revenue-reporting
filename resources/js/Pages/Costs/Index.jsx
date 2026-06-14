import { useState } from 'react'
import { Link, router } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const formatRpShort = (n) => {
    if (!n) return '—'
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
    return (
        <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>
            {s.label}
        </span>
    )
}

export default function CostsIndex({ costs, currentMonth }) {
    const [month, setMonth] = useState(currentMonth.slice(0, 7))

    const handleMonth = (e) => {
        setMonth(e.target.value)
        router.get('/costs', { month: e.target.value + '-01' }, { preserveState: true })
    }

    return (
        <AppLayout title="Laporan Biaya">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Laporan Biaya</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{costs.length} laporan ditemukan</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input type="month" value={month} onChange={handleMonth}
                        style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                    <Link href="/costs/create"
                        style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                        + Buat Laporan
                    </Link>
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Cabang', 'Periode', 'Total Biaya', 'Jumlah Item', 'Status', 'Disubmit', ''].map(h => (
                                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {costs.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                Belum ada laporan biaya untuk periode ini.
                            </td></tr>
                        )}
                        {costs.map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 500 }}>{c.branch?.name}</div>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.branch?.area?.name}</div>
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12 }}>
                                    {new Date(c.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>
                                    {formatRpShort(c.total_cost)}
                                </td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>
                                    {c.cost_details_count > 0
                                    ? `${c.filled_details_count ?? 0} / ${c.cost_details_count} item`
                                    : '— item'}
                                </td>
                                <td style={{ padding: '10px 14px' }}><StatusBadge status={c.status} /></td>
                                <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
                                    {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <Link href={`/costs/${c.id}`} style={{ fontSize: 12, color: '#166534', textDecoration: 'none', fontWeight: 500 }}>Buka →</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    )
}
