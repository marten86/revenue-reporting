import { Link, router } from '@inertiajs/react'
import AppLayout from '../../Components/AppLayout'
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Utilitas ──

const formatRp = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
}).format(n ?? 0)

const formatRpShort = (n) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    return `Rp ${(n / 1_000).toFixed(0)} rb`
}

const formatRpAxis = (n) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}M`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
    return n
}

const CHANNEL_LABELS = {
    presentasi: 'Presentasi', gerai: 'Gerai', wgts: 'WGTS',
    dfi: 'DFI', dfe: 'DFE', kotak_qris: 'Kotak/QRIS', kantor: 'Kantor',
}

const CHANNEL_COLORS = {
    presentasi: '#16a34a', gerai: '#2563eb', wgts: '#9333ea',
    dfi: '#ea580c', dfe: '#0891b2', kotak_qris: '#d97706', kantor: '#6b7280',
}

const PIE_COLORS = ['#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0891b2', '#d97706', '#6b7280']

// ── Components ──

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,.1)', fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>{label}</div>
            {payload.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />
                    <span style={{ color: '#6b7280' }}>{entry.name}:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatRpShort(entry.value)}</span>
                </div>
            ))}
        </div>
    )
}

const ChartCard = ({ title, subtitle, children, style: extraStyle }) => (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', ...extraStyle }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
)

// ══════════════════════════════════════════════════════════
// Dashboard Branch
// ══════════════════════════════════════════════════════════

export default function BranchDashboard({
    branch, report, target, recentMonths, currentMonth,
    monthlyTrend, channelBreakdown, dailyProgress,
    topPerformers, availableMonths,
}) {
    const totalRevenue = report?.total_revenue ?? 0
    const targetAmt    = target?.target_total ?? 0
    const pct          = targetAmt > 0 ? (totalRevenue / targetAmt * 100) : 0
    const periodLabel  = new Date(currentMonth)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

    const handleMonthChange = (e) => {
        router.get('/dashboard/branch', { month: e.target.value }, {
            preserveState: true,
            preserveScroll: true,
        })
    }

    // Pie data
    const pieData = (channelBreakdown ?? []).map((item, i) => ({
        name: CHANNEL_LABELS[item.channel] ?? item.channel,
        value: item.total,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0)

    if (!branch) {
        return (
            <AppLayout title="Dashboard">
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                    Anda belum ditetapkan ke cabang manapun.
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout title={`Dashboard — ${branch?.name}`}>
            <style>{`
                .metric-card { transition: box-shadow .2s, transform .15s; }
                .metric-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.06); transform: translateY(-1px); }
                @media (max-width: 768px) {
                    .grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
                    .grid-2 { grid-template-columns: 1fr !important; }
                }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{branch?.name}</h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{periodLabel}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {(availableMonths ?? []).length > 0 && (
                        <select value={currentMonth} onChange={handleMonthChange}
                            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    {new Date(m).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    )}
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
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                    { label: 'Realisasi Bulan Ini', value: formatRpShort(totalRevenue), sub: `Target: ${formatRpShort(targetAmt)}`, icon: '💰' },
                    { label: 'Capaian Target', value: `${pct.toFixed(1)}%`, sub: pct >= 85 ? '✓ On track' : 'Perlu ditingkatkan', valueColor: pct >= 85 ? '#166534' : pct >= 60 ? '#d97706' : '#dc2626', icon: '🎯' },
                    { label: 'Selisih', value: formatRpShort(totalRevenue - targetAmt), sub: totalRevenue >= targetAmt ? 'Melebihi target' : 'Di bawah target', valueColor: totalRevenue >= targetAmt ? '#166534' : '#dc2626', icon: '📊' },
                    { label: 'Status Laporan', value: report ? report.status.charAt(0).toUpperCase() + report.status.slice(1) : 'Belum Ada', sub: report ? 'Klik untuk edit' : 'Buat laporan baru', icon: '📋' },
                ].map((m, i) => (
                    <div key={i} className="metric-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</div>
                            <span style={{ fontSize: 20 }}>{m.icon}</span>
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: m.valueColor ?? '#111827', lineHeight: 1, marginTop: 8, textTransform: 'capitalize' }}>{m.value}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{m.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Row 1: Trend + Channel Pie ── */}
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Monthly Trend */}
                <ChartCard title="Tren Revenue Cabang" subtitle="6 bulan terakhir — realisasi vs target">
                    {(monthlyTrend ?? []).length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={monthlyTrend}>
                                <defs>
                                    <linearGradient id="gradBranchRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <YAxis tickFormatter={formatRpAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area type="monotone" dataKey="revenue" name="Realisasi" stroke="#16a34a" strokeWidth={2.5} fill="url(#gradBranchRevenue)" />
                                <Line type="monotone" dataKey="target" name="Target" stroke="#d1d5db" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data tren.</div>
                    )}
                </ChartCard>

                {/* Channel Pie */}
                <ChartCard title="Distribusi Kanal" subtitle={periodLabel}>
                    {pieData.length > 0 ? (
                        <div>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatRpShort(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                                {pieData.map((d, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                                        <span style={{ color: '#6b7280' }}>{d.name}</span>
                                        <span style={{ fontWeight: 600, color: '#374151' }}>{pieTotal > 0 ? `${(d.value / pieTotal * 100).toFixed(0)}%` : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data.</div>
                    )}
                </ChartCard>
            </div>

            {/* ── Row 2: Daily Progress + Channel Bar ── */}
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Daily Progress */}
                <ChartCard title="Progress Harian" subtitle="Kumulatif realisasi vs target">
                    {(dailyProgress ?? []).length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={dailyProgress}>
                                <defs>
                                    <linearGradient id="gradBranchCumulative" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <YAxis tickFormatter={formatRpAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area type="monotone" dataKey="cumulative" name="Realisasi" stroke="#2563eb" strokeWidth={2} fill="url(#gradBranchCumulative)" />
                                <Line type="monotone" dataKey="cumulative_target" name="Target" stroke="#d1d5db" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data harian.</div>
                    )}
                </ChartCard>

                {/* Channel Bar */}
                <ChartCard title="Revenue per Kanal" subtitle={periodLabel}>
                    {(channelBreakdown ?? []).length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={(channelBreakdown ?? []).map(d => ({ name: CHANNEL_LABELS[d.channel] ?? d.channel, total: d.total, fill: CHANNEL_COLORS[d.channel] ?? '#6b7280' }))} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis type="number" tickFormatter={formatRpAxis} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#374151' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="total" name="Revenue" radius={[0, 4, 4, 0]}>
                                    {(channelBreakdown ?? []).map((d, i) => (
                                        <Cell key={i} fill={CHANNEL_COLORS[d.channel] ?? '#6b7280'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Belum ada data.</div>
                    )}
                </ChartCard>
            </div>

            {/* ── Row 3: Top Performers + Histori ── */}
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 14, marginBottom: 14 }}>
                {/* Top Performers */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>🏆 Top Performers</span>
                    </div>
                    {(topPerformers ?? []).length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Belum ada data.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: '#f9fafb' }}>
                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>#</th>
                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Nama</th>
                                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Kanal</th>
                                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topPerformers.map((p, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '9px 14px', fontWeight: 700, color: i < 3 ? '#d97706' : '#9ca3af' }}>
                                            {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                        </td>
                                        <td style={{ padding: '9px 14px', fontWeight: 500 }}>{p.source_label}</td>
                                        <td style={{ padding: '9px 14px' }}>
                                            <span style={{
                                                padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                background: CHANNEL_COLORS[p.channel] ? `${CHANNEL_COLORS[p.channel]}15` : '#f3f4f6',
                                                color: CHANNEL_COLORS[p.channel] ?? '#6b7280',
                                            }}>
                                                {CHANNEL_LABELS[p.channel] ?? p.channel}
                                            </span>
                                        </td>
                                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                            {formatRpShort(p.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Histori Laporan */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Histori Laporan</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                {['Periode', 'Target', 'Realisasi', 'Capaian', 'Status', ''].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', textAlign: ['Target', 'Realisasi', 'Capaian'].includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(!recentMonths || recentMonths.length === 0) && (
                                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada histori.</td></tr>
                            )}
                            {recentMonths?.map(r => {
                                const p = r.target_amount > 0 ? (r.total_revenue / r.target_amount * 100) : 0
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 14px' }}>{new Date(r.period_month).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatRpShort(r.target_amount)}</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{formatRpShort(r.total_revenue)}</td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: p >= 85 ? '#166534' : p >= 60 ? '#d97706' : '#dc2626' }}>{p.toFixed(1)}%</td>
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
            </div>
        </AppLayout>
    )
}
