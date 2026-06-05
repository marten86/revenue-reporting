import { Link, usePage } from '@inertiajs/react'
import { useState } from 'react'

export default function AppLayout({ title, children }) {
    const { auth, flash } = usePage().props
    const user = auth?.user
    const [mobileOpen, setMobileOpen] = useState(false)

    const path = window.location.pathname

    const navItems = [
        {
            section: 'Overview',
            links: [
                { href: '/dashboard/area',   label: 'Dashboard Area',   icon: '▦', roles: ['super_admin', 'area_manager'] },
                { href: '/dashboard/branch', label: 'Dashboard Cabang', icon: '⌂', roles: ['branch_head', 'staff'] },
            ],
        },
        {
            section: 'Laporan',
            links: [
                { href: '/reports',        label: 'Semua Laporan', icon: '≡' },
                { href: '/reports/create', label: 'Buat Laporan',  icon: '+', roles: ['branch_head', 'staff', 'area_manager', 'super_admin'] },
            ],
        },
        {
            section: 'Konfigurasi',
            links: [
                { href: '/targets', label: 'Target Cabang', icon: '◎', roles: ['super_admin', 'area_manager'] },
            ],
        },
    ]

    const isActive = (href) => path === href || path.startsWith(href + '/')

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* Sidebar */}
            <aside style={{
                width: 220, minHeight: '100vh', background: '#14532d',
                display: 'flex', flexDirection: 'column',
                position: 'fixed', top: 0, left: 0, zIndex: 40,
            }}>
                {/* Logo */}
                <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #166534' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, background: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>RB</div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>Revenue BWA</div>
                            <div style={{ color: '#4ade80', fontSize: 10, letterSpacing: '.05em' }}>INDOTIM</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
                    {navItems.map(section => {
                        const visibleLinks = section.links.filter(l =>
                            !l.roles || l.roles.includes(user?.role)
                        )
                        if (visibleLinks.length === 0) return null
                        return (
                            <div key={section.section}>
                                <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                                    {section.section}
                                </div>
                                {visibleLinks.map(link => (
                                    <Link key={link.href} href={link.href}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '7px 16px', margin: '1px 8px',
                                            borderRadius: 8, textDecoration: 'none',
                                            fontSize: 13, fontWeight: isActive(link.href) ? 600 : 400,
                                            background: isActive(link.href) ? '#166534' : 'transparent',
                                            color: isActive(link.href) ? '#fff' : '#86efac',
                                            transition: 'all .15s',
                                        }}>
                                        <span style={{ fontSize: 14, opacity: .8 }}>{link.icon}</span>
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        )
                    })}
                </nav>

                {/* User info + logout */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #166534' }}>
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{user?.name}</div>
                        <div style={{ fontSize: 11, color: '#4ade80', textTransform: 'capitalize' }}>
                            {user?.role?.replace('_', ' ')}
                        </div>
                    </div>
                    <Link href="/logout" method="post" as="button"
                        style={{ fontSize: 12, color: '#86efac', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⎋ Keluar
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* Topbar */}
                <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>

                {/* Flash messages */}
                {flash?.success && (
                    <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✓ {flash.success}
                    </div>
                )}
                {flash?.warning && (
                    <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚠ {flash.warning}
                    </div>
                )}
                {flash?.error && (
                    <div style={{ margin: '16px 24px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✕ {flash.error}
                    </div>
                )}

                {/* Page content */}
                <div style={{ padding: '20px 24px', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    )
}