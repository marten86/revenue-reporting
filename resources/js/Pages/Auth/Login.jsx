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
            justifyContent: 'center', background: '#f0fdf4',
            fontFamily: "'Segoe UI', sans-serif",
        }}>
            <div style={{
                background: '#fff', borderRadius: 12, padding: '40px 36px',
                width: '100%', maxWidth: 400,
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb',
            }}>
                {/* Logo / Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: '#166534', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 12,
                    }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>RB</span>
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#111827' }}>
                        Revenue BWA
                    </h1>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                        Sistem Pelaporan Revenue INDOTIM
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: '#374151', marginBottom: 6,
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={e => setData('email', e.target.value)}
                            placeholder="email@onebwa.my.id"
                            style={{
                                width: '100%', padding: '9px 12px',
                                border: errors.email ? '1px solid #dc2626' : '1px solid #d1d5db',
                                borderRadius: 8, fontSize: 14, outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                        {errors.email && (
                            <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{
                            display: 'block', fontSize: 13, fontWeight: 500,
                            color: '#374151', marginBottom: 6,
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={data.password}
                            onChange={e => setData('password', e.target.value)}
                            placeholder="••••••••"
                            style={{
                                width: '100%', padding: '9px 12px',
                                border: errors.password ? '1px solid #dc2626' : '1px solid #d1d5db',
                                borderRadius: 8, fontSize: 14, outline: 'none',
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
                        type="submit"
                        disabled={processing}
                        style={{
                            width: '100%', padding: '10px',
                            background: processing ? '#6b7280' : '#166534',
                            color: '#fff', border: 'none', borderRadius: 8,
                            fontSize: 14, fontWeight: 500, cursor: processing ? 'not-allowed' : 'pointer',
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