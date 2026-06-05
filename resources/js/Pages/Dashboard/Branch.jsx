import { Link } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const formatRp = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(n ?? 0)

const formatRpShort = (n) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

export default function BranchDashboard({ branch, report, target, recentMonths, currentMonth }) {
    const totalRevenue = report?.total_revenue ?? 0
    const targetAmt    = target?.target_total ?? 0
    const pct          = targetAmt > 0 ? (totalRevenue / targetAmt * 100) : 0
    const periodLabel  = new Date(currentMonth)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    return (
        <AppLayout title={`Dashboard — ${branch?.name}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{branch?.name}</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{periodLabel}</p>
                </div>
                {!report ? (
                    <Link href="/reports/create" style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                        + Buat Laporan
                    </Link>
                ) : (
                    <Link href={`/reports/${report.id}`} style={{ background: '#166534', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                        Isi Laporan →
                    </Link>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Realisasi Bulan Ini', value: formatRpShort(totalRevenue), sub: `dari ${formatRpShort(targetAmt)}` },
                    { label: 'Capaian Target', value: `${pct.toFixed(1)}%`, sub: pct >= 85 ? '✓ On track' : 'Perlu ditingkatkan', valueColor: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626' },
                    { label: 'Status Laporan', value: report?.status ?? 'Belum Ada', sub: report ? 'Klik untuk edit' : 'Buat laporan baru' },
                ].map((m, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{m.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: m.valueColor ?? '#111827', lineHeight: 1, textTransform: 'capitalize' }}>{m.value}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Histori Laporan</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#f9fafb' }}>
                            {['Periode', 'Target', 'Realisasi', 'Capaian', 'Status', ''].map(h => (
                                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(!recentMonths || recentMonths.length === 0) && (
                            <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Belum ada histori laporan.</td></tr>
                        )}
                        {recentMonths?.map(r => {
                            const p = r.achievement_pct ? r.achievement_pct * 100 : 0
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 14px' }}>{new Date(r.period_month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(r.target_amount)}</td>
                                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{formatRpShort(r.total_revenue)}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 12, color: p >= 85 ? '#166534' : p >= 60 ? '#d97706' : '#dc2626' }}>{p.toFixed(1)}%</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: r.status === 'approved' ? '#dcfce7' : '#f3f4f6', color: r.status === 'approved' ? '#166534' : '#6b7280', textTransform: 'capitalize' }}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <Link href={`/reports/${r.id}`} style={{ fontSize: 12, color: '#166534', textDecoration: 'none', fontWeight: 500 }}>Detail →</Link>
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