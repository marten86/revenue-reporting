import React, { useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Components/AppLayout'
import {
    ComposedChart, BarChart, Bar, PieChart, Pie, Cell,
    Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts'

const COLORS = ['#16a34a','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']
const CHANNEL_COLORS = {
    'Presentasi':   '#16a34a',
    'WGTS':         '#2563eb',
    'Gerai':        '#d97706',
    'DFI (AR)':     '#dc2626',
    'DFE (AE)':     '#7c3aed',
    'Kotak & QRIS': '#0891b2',
    'Kantor':       '#be185d',
}

const PERIOD_OPTIONS = [
    { value: 'weekly',    label: 'Mingguan' },
    { value: 'monthly',   label: 'Bulanan' },
    { value: 'quarterly', label: 'Kuartalan' },
    { value: 'yearly',    label: 'Tahunan' },
]

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const formatRp = (v) => {
    if (!v || v === 0) return 'Rp 0'
    if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
    if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)}jt`
    if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)}rb`
    return `Rp ${v}`
}

const formatRpFull = (v) => 'Rp ' + (v || 0).toLocaleString('id-ID')

const ratioColor = (r) => r <= 30 ? '#166534' : r <= 50 ? '#d97706' : '#dc2626'
const ratioLabel = (r) => r <= 30 ? 'Sehat' : r <= 50 ? 'Perhatian' : 'Tinggi'

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 14px',boxShadow:'0 4px 12px rgba(0,0,0,.1)'}}>
            <p style={{fontWeight:600,marginBottom:4,color:'#374151',fontSize:13}}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{color:p.color,fontSize:12,margin:'2px 0'}}>
                    {p.name}: {p.name === 'Growth %' || p.name === 'Rasio %'
                        ? `${p.value}%`
                        : formatRpFull(p.value)}
                </p>
            ))}
        </div>
    )
}

const SummaryCard = ({ title, value, sub, color, icon }) => (
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',flex:1,minWidth:150}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
                <p style={{fontSize:11,color:'#6b7280',marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>{title}</p>
                <p style={{fontSize:20,fontWeight:700,color:color||'#111827',margin:0}}>{value}</p>
                {sub && <p style={{fontSize:12,color:'#6b7280',marginTop:4}}>{sub}</p>}
            </div>
            <span style={{fontSize:22}}>{icon}</span>
        </div>
    </div>
)

export default function AnalyticsIndex({
    branches, areas, channels, period, year, month, quarter,
    branchId, areaId, channel, isSuperAdmin,
    summary, chartMain, byChannel, byBranch, tableData
}) {
    const [localPeriod,  setLocalPeriod]  = useState(period)
    const [localYear,    setLocalYear]    = useState(year)
    const [localMonth,   setLocalMonth]   = useState(month)
    const [localQuarter, setLocalQuarter] = useState(quarter)
    const [localBranch,  setLocalBranch]  = useState(branchId)
    const [localAreaId,  setLocalAreaId]  = useState(areaId ?? 'all')
    const [localChannel, setLocalChannel] = useState(channel)

    const applyFilter = () => {
        router.get('/analytics', {
            period:    localPeriod,
            year:      localYear,
            month:     localMonth,
            quarter:   localQuarter,
            branch_id: localBranch,
            area_id:   localAreaId,
            channel:   localChannel,
        }, { preserveState: false })
    }

    const yearOptions = []
    for (let y = 2024; y <= new Date().getFullYear() + 1; y++) yearOptions.push(y)

    const achievementColor = summary.achievement >= 100 ? '#16a34a' : summary.achievement >= 75 ? '#d97706' : '#dc2626'
    const growthColor      = (summary.growth ?? 0) >= 0 ? '#16a34a' : '#dc2626'
    const showGrowth       = period === 'yearly'
    const costRatio        = summary.cost_ratio ?? 0

    const filteredBranches = (branches || []).filter(b => localAreaId === 'all' || b.area_id === localAreaId)

    const selectedAreaLabel = localAreaId === 'all'
        ? 'Semua Area'
        : (areas || []).find(a => a.id === localAreaId)?.name ?? 'Area'

    const chartTitle = {
        weekly:    '📅 Revenue Minggu Ini per Hari',
        monthly:   '📅 Revenue Harian Bulan Ini',
        quarterly: '📅 Revenue per Bulan (Kuartal)',
        yearly:    '📅 Trend Revenue Tahunan',
    }[period] ?? '📅 Revenue'

    return (
        <AppLayout title="Analytics">
            <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto'}}>

                {/* Header */}
                <div style={{marginBottom:24}}>
                    <h1 style={{fontSize:24,fontWeight:700,color:'#111827',margin:0}}>📈 Analytics Revenue</h1>
                    <p style={{color:'#6b7280',marginTop:4,fontSize:14}}>
                        Analisis performa revenue BWA
                        {isSuperAdmin && localAreaId !== 'all' && (
                            <span style={{marginLeft:6,background:'#eff6ff',color:'#1d4ed8',padding:'1px 8px',borderRadius:6,fontSize:12,fontWeight:600}}>
                                {selectedAreaLabel}
                            </span>
                        )}
                    </p>
                </div>

                {/* Filter Bar */}
                <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',marginBottom:24,display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end'}}>
                    <div>
                        <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Periode</label>
                        <select value={localPeriod} onChange={e => setLocalPeriod(e.target.value)}
                            style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14,minWidth:130}}>
                            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Tahun</label>
                        <select value={localYear} onChange={e => setLocalYear(Number(e.target.value))}
                            style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14}}>
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    {(localPeriod === 'weekly' || localPeriod === 'monthly') && (
                        <div>
                            <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Bulan</label>
                            <select value={localMonth} onChange={e => setLocalMonth(Number(e.target.value))}
                                style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14}}>
                                {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
                            </select>
                        </div>
                    )}
                    {localPeriod === 'quarterly' && (
                        <div>
                            <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Kuartal</label>
                            <select value={localQuarter} onChange={e => setLocalQuarter(Number(e.target.value))}
                                style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14}}>
                                <option value={1}>Q1 (Jan–Mar)</option>
                                <option value={2}>Q2 (Apr–Jun)</option>
                                <option value={3}>Q3 (Jul–Sep)</option>
                                <option value={4}>Q4 (Okt–Des)</option>
                            </select>
                        </div>
                    )}
                    {isSuperAdmin && (
                        <div>
                            <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Area</label>
                            <select value={localAreaId} onChange={e => { setLocalAreaId(e.target.value); setLocalBranch('all') }}
                                style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14,minWidth:150}}>
                                <option value="all">Semua Area</option>
                                {(areas || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Cabang</label>
                        <select value={localBranch} onChange={e => setLocalBranch(e.target.value)}
                            style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14,minWidth:160}}>
                            <option value="all">Semua Cabang</option>
                            {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{fontSize:11,color:'#6b7280',display:'block',marginBottom:4}}>Kanal</label>
                        <select value={localChannel} onChange={e => setLocalChannel(e.target.value)}
                            style={{border:'1px solid #d1d5db',padding:'8px 12px',borderRadius:8,fontSize:14,minWidth:160}}>
                            <option value="all">Semua Kanal</option>
                            {(channels || []).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button onClick={applyFilter}
                        style={{background:'#166534',color:'#fff',border:'none',padding:'8px 20px',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                        Terapkan
                    </button>
                </div>

                {/* Summary Cards — 6 cards */}
                <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
                    <SummaryCard title="Total Revenue" icon="💰"
                        value={formatRp(summary.total_revenue)}
                        sub={formatRpFull(summary.total_revenue)} />
                    <SummaryCard title="Target" icon="🎯"
                        value={formatRp(summary.target)}
                        sub={formatRpFull(summary.target)} />
                    <SummaryCard title="Capaian" icon="📊" color={achievementColor}
                        value={`${summary.achievement}%`}
                        sub={summary.achievement >= 100 ? '✅ Target tercapai' : `Kurang ${formatRp(summary.target - summary.total_revenue)}`} />
                    <SummaryCard title="Total Biaya" icon="💸"
                        value={formatRp(summary.total_cost ?? 0)}
                        sub={formatRpFull(summary.total_cost ?? 0)} />
                    <SummaryCard title="Rasio Biaya" icon="📉"
                        color={ratioColor(costRatio)}
                        value={summary.total_revenue > 0 ? `${costRatio}%` : '—'}
                        sub={summary.total_revenue > 0 ? ratioLabel(costRatio) : 'Belum ada data'} />
                    <SummaryCard title="Growth vs Lalu" icon="📈"
                        color={summary.growth !== null ? growthColor : '#6b7280'}
                        value={summary.growth !== null ? `${summary.growth > 0 ? '+' : ''}${summary.growth}%` : '—'}
                        sub={summary.growth !== null ? (summary.growth >= 0 ? 'Naik dari periode lalu' : 'Turun dari periode lalu') : 'Data tidak cukup'} />
                </div>

                {/* Row 1: Chart Utama + Pie */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,marginBottom:20}}>
                    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20}}>
                        <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:600,color:'#374151'}}>{chartTitle}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={chartMain || []} margin={{top:5,right:showGrowth?50:20,left:10,bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="label" tick={{fontSize:11,fill:'#6b7280'}} />
                                <YAxis yAxisId="left" tickFormatter={v => formatRp(v)} tick={{fontSize:10,fill:'#6b7280'}} width={72} />
                                {showGrowth && <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{fontSize:10,fill:'#f59e0b'}} width={45} />}
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize:12}} />
                                <Bar yAxisId="left" dataKey="actual" name="Aktual" fill="#16a34a" radius={[4,4,0,0]} maxBarSize={40} />
                                <Line yAxisId="left" dataKey="target" name="Target" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                {showGrowth && <Line yAxisId="right" dataKey="growth" name="Growth %" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} connectNulls />}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20}}>
                        <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:600,color:'#374151'}}>🍩 Komposisi per Kanal</h3>
                        {(byChannel || []).length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie data={byChannel} dataKey="total" nameKey="channel" cx="50%" cy="50%" outerRadius={75} innerRadius={35} paddingAngle={3}>
                                            {byChannel.map((entry, i) => <Cell key={i} fill={CHANNEL_COLORS[entry.channel] || COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={v => formatRpFull(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8}}>
                                    {byChannel.map((c, i) => (
                                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                                            <div style={{width:10,height:10,borderRadius:'50%',flexShrink:0,background:CHANNEL_COLORS[c.channel]||COLORS[i%COLORS.length]}} />
                                            <span style={{color:'#374151',flex:1}}>{c.channel}</span>
                                            <span style={{color:'#6b7280',fontWeight:500}}>{formatRp(c.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{textAlign:'center',color:'#9ca3af',paddingTop:60}}>Belum ada data</div>
                        )}
                    </div>
                </div>

                {/* Row 2: Bar Cabang + Capaian */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,marginBottom:20}}>
                    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20}}>
                        <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:600,color:'#374151'}}>🏢 Perbandingan per Cabang</h3>
                        {(byBranch || []).length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={byBranch} margin={{top:5,right:20,left:10,bottom:5}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis dataKey="branch_name" tick={{fontSize:11,fill:'#6b7280'}} />
                                    <YAxis tickFormatter={v => formatRp(v)} tick={{fontSize:10,fill:'#6b7280'}} width={72} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="total" name="Revenue" radius={[6,6,0,0]}>
                                        {byBranch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{textAlign:'center',color:'#9ca3af',paddingTop:80}}>Pilih "Semua Cabang" untuk melihat perbandingan</div>
                        )}
                    </div>

                    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20}}>
                        <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:600,color:'#374151'}}>🎯 % Capaian per Cabang</h3>
                        {(byBranch || []).length > 0 ? (
                            <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:8}}>
                                {byBranch.map((b, i) => {
                                    const target = (tableData||[]).find(r => r.branch === b.branch_name)
                                    const monthTotal = target ? target.months.reduce((s,m) => s + (m.target||0), 0) : 0
                                    const pct = monthTotal > 0 ? Math.min(Math.round(b.total / monthTotal * 100), 150) : 0
                                    const color = pct >= 100 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626'
                                    return (
                                        <div key={i}>
                                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                                                <span style={{fontWeight:600,color:'#374151'}}>{b.branch_name}</span>
                                                <span style={{color,fontWeight:700}}>{pct}% &nbsp;{formatRp(b.total)}</span>
                                            </div>
                                            <div style={{background:'#f3f4f6',borderRadius:999,height:8,overflow:'hidden'}}>
                                                <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:color,borderRadius:999,transition:'width 0.5s ease'}} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{textAlign:'center',color:'#9ca3af',paddingTop:80}}>Pilih "Semua Cabang" untuk melihat capaian</div>
                        )}
                    </div>
                </div>

                {/* Tabel Breakdown Tahunan — dengan kolom Cost & Rasio */}
                <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:20}}>
                    <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:600,color:'#374151'}}>
                        📋 Tabel Breakdown Bulanan {year}
                        {isSuperAdmin && localAreaId !== 'all' && (
                            <span style={{marginLeft:8,fontSize:12,color:'#6b7280',fontWeight:400}}>— {selectedAreaLabel}</span>
                        )}
                    </h3>
                    <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                            <thead>
                                <tr style={{background:'#f9fafb'}}>
                                    <th style={{padding:'8px 12px',textAlign:'left',color:'#6b7280',fontWeight:600,borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>Cabang</th>
                                    {MONTH_SHORT.map(m => (
                                        <th key={m} style={{padding:'8px 6px',textAlign:'right',color:'#6b7280',fontWeight:600,borderBottom:'1px solid #e5e7eb',minWidth:72}}>{m}</th>
                                    ))}
                                    <th style={{padding:'8px 12px',textAlign:'right',color:'#6b7280',fontWeight:600,borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>Total</th>
                                    <th style={{padding:'8px 12px',textAlign:'right',color:'#6b7280',fontWeight:600,borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>Total Biaya</th>
                                    <th style={{padding:'8px 12px',textAlign:'right',color:'#6b7280',fontWeight:600,borderBottom:'1px solid #e5e7eb',whiteSpace:'nowrap'}}>Rasio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(tableData || []).map((row, ri) => {
                                    const totalCost = row.total_cost ?? 0
                                    const ratio = row.total > 0 ? (totalCost / row.total * 100).toFixed(1) : 0
                                    return (
                                        <tr key={ri} style={{borderBottom:'1px solid #f3f4f6'}}
                                            onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                            <td style={{padding:'8px 12px',fontWeight:600,color:'#374151',whiteSpace:'nowrap'}}>{row.branch}</td>
                                            {(row.months || []).map((m, mi) => (
                                                <td key={mi} style={{padding:'6px 6px',textAlign:'right'}}>
                                                    <div style={{color:m.actual>0?'#111827':'#d1d5db'}}>{formatRp(m.actual)}</div>
                                                    {m.target > 0 && (
                                                        <div style={{fontSize:10,color:m.pct>=100?'#16a34a':m.pct>=75?'#d97706':'#dc2626'}}>{m.pct}%</div>
                                                    )}
                                                    {m.cost > 0 && (
                                                        <div style={{fontSize:10,color:'#9ca3af'}}>B:{formatRp(m.cost)}</div>
                                                    )}
                                                </td>
                                            ))}
                                            <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#166534'}}>{formatRp(row.total)}</td>
                                            <td style={{padding:'8px 12px',textAlign:'right',color:'#374151'}}>{totalCost > 0 ? formatRp(totalCost) : <span style={{color:'#d1d5db'}}>—</span>}</td>
                                            <td style={{padding:'8px 12px',textAlign:'right'}}>
                                                {totalCost > 0 ? (
                                                    <span style={{padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:600,
                                                        background: ratio <= 30 ? '#dcfce7' : ratio <= 50 ? '#fef3c7' : '#fee2e2',
                                                        color: ratioColor(ratio)}}>
                                                        {ratio}%
                                                    </span>
                                                ) : <span style={{color:'#d1d5db'}}>—</span>}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {/* Baris Total */}
                                <tr style={{background:'#f0fdf4',fontWeight:700}}>
                                    <td style={{padding:'10px 12px',color:'#166534'}}>TOTAL</td>
                                    {MONTH_SHORT.map((_, mi) => {
                                        const tot = (tableData||[]).reduce((s,r) => s+(r.months?.[mi]?.actual||0), 0)
                                        const costTot = (tableData||[]).reduce((s,r) => s+(r.months?.[mi]?.cost||0), 0)
                                        return (
                                            <td key={mi} style={{padding:'10px 6px',textAlign:'right',color:'#166534'}}>
                                                <div>{formatRp(tot)}</div>
                                                {costTot > 0 && <div style={{fontSize:10,color:'#9ca3af'}}>B:{formatRp(costTot)}</div>}
                                            </td>
                                        )
                                    })}
                                    <td style={{padding:'10px 12px',textAlign:'right',color:'#166534'}}>
                                        {formatRp((tableData||[]).reduce((s,r) => s+r.total, 0))}
                                    </td>
                                    <td style={{padding:'10px 12px',textAlign:'right',color:'#374151'}}>
                                        {formatRp((tableData||[]).reduce((s,r) => s+(r.total_cost||0), 0))}
                                    </td>
                                    <td style={{padding:'10px 12px',textAlign:'right'}}>
                                        {(() => {
                                            const rev  = (tableData||[]).reduce((s,r) => s+r.total, 0)
                                            const cost = (tableData||[]).reduce((s,r) => s+(r.total_cost||0), 0)
                                            const r    = rev > 0 ? (cost/rev*100).toFixed(1) : 0
                                            return rev > 0 ? (
                                                <span style={{padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:600,
                                                    background: r <= 30 ? '#dcfce7' : r <= 50 ? '#fef3c7' : '#fee2e2',
                                                    color: ratioColor(r)}}>
                                                    {r}%
                                                </span>
                                            ) : <span style={{color:'#d1d5db'}}>—</span>
                                        })()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Legend rasio */}
                    <div style={{display:'flex',gap:16,fontSize:11,color:'#6b7280',marginTop:12}}>
                        <span><span style={{display:'inline-block',width:8,height:8,borderRadius:99,background:'#166534',marginRight:4}}></span>Sehat (≤30%)</span>
                        <span><span style={{display:'inline-block',width:8,height:8,borderRadius:99,background:'#d97706',marginRight:4}}></span>Perhatian (31–50%)</span>
                        <span><span style={{display:'inline-block',width:8,height:8,borderRadius:99,background:'#dc2626',marginRight:4}}></span>Tinggi (&gt;50%)</span>
                        <span style={{color:'#9ca3af'}}>B: = Total Biaya per bulan</span>
                    </div>
                </div>

            </div>
        </AppLayout>
    )
}
