import { useState } from 'react'
import { Link, router } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'

const formatRpShort = (n) => {
    if (!n) return 'Rp 0'
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
        no_report: { label: 'Belum Ada', bg: '#f3f4f6', color: '#9ca3af' },
    }
    const s = map[status] ?? map.no_report
    return (
        <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>
            {s.label}
        </span>
    )
}

export default function AreaDashboard({ branches, summary, currentMonth }) {
    const pct = summary.achievement_pct ?? 0
    const periodLabel = new Date(currentMonth)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    return (
        <AppLayout title="Dashboard Area">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Ringkasan Area — INDOTIM</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{periodLabel}</p>
                </div>
                <Link href="/targets"
                    style={{ fontSize: 13, color: '#166534', border: '1px solid #166534', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>
                    Set Target →
                </Link>
            </div>

            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Total Revenue Area', value: formatRpShort(summary.total_revenue), sub: `Target: ${formatRpShort(summary.total_target)}` },
                    { label: 'Capaian Target', value: `${pct.toFixed(1)}%`, sub: pct >= 85 ? '✓ On track' : `Kurang ${formatRpShort(summary.total_target - summary.total_revenue)}`, valueColor: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626' },
                    { label: 'Laporan Masuk', value: `${summary.reports_submitted} / ${summary.reports_total}`, sub: summary.reports_submitted < summary.reports_total ? `${summary.reports_total - summary.reports_submitted} cabang belum submit` : 'Semua sudah submit ✓' },
                    { label: 'Cabang Aktif', value: summary.reports_total, sub: 'Indonesia Timur' },
                ].map((m, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{m.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: m.valueColor ?? '#111827', lineHeight: 1 }}>{m.value}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tabel cabang */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Perbandingan Cabang</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{periodLabel}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Cabang', 'Target', 'Realisasi', 'Capaian', 'Progress', 'Status', ''].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', textAlign: ['Target','Realisasi','Capaian'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {branches.map(b => (
                                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 500 }}>{b.name}</div>
                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{b.city}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(b.target_amount)}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>
                                        {b.total_revenue ? formatRpShort(b.total_revenue) : <span style={{ color: '#d1d5db' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: b.achievement_pct >= 85 ? '#166534' : b.achievement_pct >= 60 ? '#d97706' : b.total_revenue ? '#dc2626' : '#d1d5db' }}>
                                        {b.total_revenue ? `${b.achievement_pct.toFixed(1)}%` : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', minWidth: 120 }}>
                                        <div style={{ background: '#e5e7eb', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(b.achievement_pct, 100)}%`, background: b.achievement_pct >= 85 ? '#16a34a' : b.achievement_pct >= 60 ? '#d97706' : '#dc2626' }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}><StatusBadge status={b.status} /></td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {b.report_id && (
                                            <Link href={`/reports/${b.report_id}`} style={{ fontSize: 12, color: '#166534', textDecoration: 'none', fontWeight: 500 }}>Detail →</Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    )
}