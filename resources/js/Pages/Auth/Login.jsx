import { useForm } from '@inertiajs/react'

export default function Login() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        post('/login')
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 50%, #f0fdf4 100%)',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            padding: 16,
        }}>
            <style>{`
                .login-input { transition: border-color .2s, box-shadow .2s; }
                .login-input:focus { border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,.12) !important; outline: none; }
                .login-btn { transition: background .2s, transform .1s; }
                .login-btn:hover:not(:disabled) { background: #15803d !important; }
                .login-btn:active:not(:disabled) { transform: scale(.98); }
            `}</style>

            <div style={{
                background: '#fff', borderRadius: 16, padding: '44px 36px',
                width: '100%', maxWidth: 400,
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
                border: '1px solid #e5e7eb',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        width: 110, height: 110, margin: '0 auto 16px',
                        borderRadius: 18, background: '#fff',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                    }}>
                        <img
                            src="/images/one-bwa-logo.png"
                            alt="One BWA"
                            style={{ width: 90, height: 90, objectFit: 'contain' }}
                        />
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#14532d' }}>
                        One BWA
                    </h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5 }}>
                        Sistem Pelaporan Revenue INDOTIM
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 18 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: '#374151', marginBottom: 6,
                        }}>
                            Email
                        </label>
                        <input
                            className="login-input"
                            type="email"
                            value={data.email}
                            onChange={e => setData('email', e.target.value)}
                            placeholder="email@onebwa.my.id"
                            style={{
                                width: '100%', padding: '10px 14px',
                                border: errors.email ? '1px solid #dc2626' : '1px solid #d1d5db',
                                borderRadius: 10, fontSize: 14, outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        {errors.email && (
                            <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: 26 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: '#374151', marginBottom: 6,
                        }}>
                            Password
                        </label>
                        <input
                            className="login-input"
                            type="password"
                            value={data.password}
                            onChange={e => setData('password', e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%', padding: '10px 14px',
                                border: errors.password ? '1px solid #dc2626' : '1px solid #d1d5db',
                                borderRadius: 10, fontSize: 14, outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        {errors.password && (
                            <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>
                                {errors.password}
                            </p>
                        )}
                    </div>

                    <button
                        className="login-btn"
                        type="submit"
                        disabled={processing}
                        style={{
                            width: '100%', padding: '11px',
                            background: processing ? '#9ca3af' : '#166534',
                            color: '#fff', border: 'none', borderRadius: 10,
                            fontSize: 15, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {processing ? 'Masuk...' : 'Masuk'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24 }}>
                    Hubungi Area Manager untuk reset password
                </p>
            </div>
        </div>
    )
}
