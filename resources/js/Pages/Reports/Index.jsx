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
        revision:  { label: 'Revisi',    bg: '#fef3c7', color: '#d97706' },
    }
    const s = map[status] ?? map.draft
    return (
        <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>
            {s.label}
        </span>
    )
}

export default function ReportsIndex({ reports, currentMonth }) {
    const [month, setMonth] = useState(currentMonth.slice(0, 7))

    const handleMonth = (e) => {
        setMonth(e.target.value)
        router.get('/reports', { month: e.target.value + '-01' }, { preserveState: true })
    }

    return (
        <AppLayout title="Laporan Bulanan">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Laporan Bulanan</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{reports.length} laporan ditemukan</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input type="month" value={month} onChange={handleMonth}
                        style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
                    <Link href="/reports/create"
                        style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                        + Buat Laporan
                    </Link>
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Cabang', 'Periode', 'Target', 'Realisasi', 'Capaian', 'Status', 'Disubmit', ''].map(h => (
                                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length === 0 && (
                            <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                Belum ada laporan untuk periode ini.
                            </td></tr>
                        )}
                        {reports.map(r => {
                            const pct = r.target_amount > 0 ? (r.total_revenue / r.target_amount * 100) : 0
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 500 }}>{r.branch?.name}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.branch?.area?.name}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                                        {new Date(r.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(r.target_amount)}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{formatRpShort(r.total_revenue)}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12, color: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626' }}>
                                        {r.target_amount > 0 ? `${pct.toFixed(1)}%` : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}><StatusBadge status={r.status} /></td>
                                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#9ca3af' }}>
                                        {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <Link href={`/reports/${r.id}`} style={{ fontSize: 12, color: '#166534', textDecoration: 'none', fontWeight: 500 }}>Buka →</Link>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    )
}