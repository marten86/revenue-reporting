import { Link, usePage } from '@inertiajs/react'
import { useState, useEffect } from 'react'

function useIsMobile(bp = 768) {
    const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false)
    useEffect(() => {
        const h = () => setM(window.innerWidth < bp)
        window.addEventListener('resize', h)
        return () => window.removeEventListener('resize', h)
    }, [bp])
    return m
}

export default function AppLayout({ title, children }) {
    const { auth, flash } = usePage().props
    const user = auth?.user
    const isMobile = useIsMobile()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Tutup sidebar saat navigasi (mobile)
    useEffect(() => { setSidebarOpen(false) }, [title])

    // Lock body scroll saat sidebar terbuka di mobile
    useEffect(() => {
        if (isMobile && sidebarOpen) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [isMobile, sidebarOpen])

    const path = window.location.pathname

    const navItems = [
        {
            section: 'Overview',
            links: [
                { href: '/dashboard/area',   label: 'Dashboard Area',   icon: '📊', roles: ['super_admin', 'area_manager'] },
                { href: '/dashboard/branch', label: 'Dashboard Cabang', icon: '🏢', roles: ['branch_head', 'staff'] },
            ],
        },
        {
            section: 'Laporan',
            links: [
                { href: '/reports',        label: 'Semua Laporan', icon: '📋' },
                { href: '/reports/create', label: 'Buat Laporan',  icon: '✚', roles: ['branch_head', 'staff', 'area_manager', 'super_admin'] },
            ],
        },
        {
            section: 'Konfigurasi',
            links: [
                { href: '/targets',          label: 'Target Cabang',    icon: '🎯', roles: ['super_admin', 'area_manager'] },
                { href: '/branches',         label: 'Kelola Cabang',    icon: '🏢', roles: ['super_admin', 'area_manager'] },
                { href: '/revenue-sources',  label: 'Kelola Sumber',    icon: '👥', roles: ['super_admin', 'area_manager'] },
                { href: '/users',            label: 'Kelola User',      icon: '👤', roles: ['super_admin', 'area_manager'] },
            ],
        },
    ]

    const isActive = (href) => path === href || (href !== '/' && path.startsWith(href + '/'))

    const roleLabels = {
        super_admin:  'Super Admin',
        area_manager: 'Area Manager',
        branch_head:  'Kepala Cabang',
        staff:        'Staff',
    }

    const sidebarWidth = 260

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

            <style>{`
                .nav-link { transition: all .15s ease; }
                .nav-link:hover { background: rgba(255,255,255,.1) !important; }
                .sidebar-overlay { transition: opacity .25s ease; }
                .sidebar-panel { transition: transform .25s ease; }
                .flash-msg { animation: flashIn .3s ease; }
                @keyframes flashIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ── Overlay (mobile only) ── */}
            {isMobile && sidebarOpen && (
                <div className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
                        zIndex: 45,
                    }} />
            )}

            {/* ── Sidebar ── */}
            <aside className="sidebar-panel" style={{
                width: sidebarWidth, minHeight: '100vh',
                background: 'linear-gradient(180deg, #14532d 0%, #1a3a2a 100%)',
                display: 'flex', flexDirection: 'column',
                position: 'fixed', top: 0, left: 0, zIndex: 50,
                transform: isMobile && !sidebarOpen ? `translateX(-${sidebarWidth}px)` : 'translateX(0)',
                boxShadow: sidebarOpen && isMobile ? '4px 0 24px rgba(0,0,0,.2)' : 'none',
            }}>
                {/* Logo */}
                <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 42, height: 42, borderRadius: 10,
                            background: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
                        }}>
                            <img src="/images/one-bwa-logo.png" alt="One BWA" style={{ width: 34, height: 34, objectFit: 'contain' }} />
                        </div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>One BWA</div>
                            <div style={{ color: '#4ade80', fontSize: 11, letterSpacing: '.08em', fontWeight: 500 }}>INDOTIM</div>
                        </div>
                        {/* Close button (mobile) */}
                        {isMobile && (
                            <button onClick={() => setSidebarOpen(false)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#86efac', fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '14px 0', overflowY: 'auto' }}>
                    {navItems.map(section => {
                        const visibleLinks = section.links.filter(l =>
                            !l.roles || l.roles.includes(user?.role)
                        )
                        if (visibleLinks.length === 0) return null
                        return (
                            <div key={section.section} style={{ marginBottom: 6 }}>
                                <div style={{ padding: '12px 18px 6px', fontSize: 11, fontWeight: 600, color: 'rgba(74,222,128,.7)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                                    {section.section}
                                </div>
                                {visibleLinks.map(link => (
                                    <Link key={link.href} href={link.href}
                                        className="nav-link"
                                        onClick={() => isMobile && setSidebarOpen(false)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 16px', margin: '2px 10px',
                                            borderRadius: 8, textDecoration: 'none',
                                            fontSize: 14, fontWeight: isActive(link.href) ? 600 : 400,
                                            background: isActive(link.href) ? 'rgba(255,255,255,.12)' : 'transparent',
                                            color: isActive(link.href) ? '#fff' : '#a7f3d0',
                                            borderLeft: isActive(link.href) ? '3px solid #4ade80' : '3px solid transparent',
                                        }}>
                                        <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{link.icon}</span>
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )
                    })}
                </nav>

                {/* User info + logout */}
                <div style={{ padding: '16px 18px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 99,
                            background: 'rgba(255,255,255,.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#4ade80', fontSize: 14, fontWeight: 600, flexShrink: 0,
                        }}>
                            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                            <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>
                                {roleLabels[user?.role] ?? user?.role}
                            </div>
                        </div>
                    </div>
                    <Link href="/logout" method="post" as="button"
                        style={{
                            fontSize: 13, color: '#fca5a5', background: 'rgba(239,68,68,.1)',
                            border: '1px solid rgba(239,68,68,.2)', borderRadius: 8,
                            cursor: 'pointer', padding: '7px 14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, width: '100%', transition: 'all .15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,.2)' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)' }}>
                        🚪 Keluar
                    </Link>
                </div>
            </aside>

            {/* ── Main content ── */}
            <div style={{
                marginLeft: isMobile ? 0 : sidebarWidth,
                flex: 1, display: 'flex', flexDirection: 'column',
                transition: 'margin-left .25s ease',
            }}>

                {/* Topbar */}
                <div style={{
                    background: '#fff', borderBottom: '1px solid #e5e7eb',
                    padding: isMobile ? '0 16px' : '0 24px',
                    height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'sticky', top: 0, zIndex: 30,
                    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Hamburger (mobile) */}
                        {isMobile && (
                            <button onClick={() => setSidebarOpen(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 20, lineHeight: 1, color: '#374151' }}>
                                ☰
                            </button>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#9ca3af', display: isMobile ? 'none' : 'block' }}>
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>

                {/* Flash messages */}
                {flash?.success && (
                    <div className="flash-msg" style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✓ {flash.success}
                    </div>
                )}
                {flash?.warning && (
                    <div className="flash-msg" style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠ {flash.warning}
                    </div>
                )}
                {flash?.error && (
                    <div className="flash-msg" style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✕ {flash.error}
                    </div>
                )}

                {/* Page content */}
                <div style={{ padding: isMobile ? '16px' : '20px 24px', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    )
}
