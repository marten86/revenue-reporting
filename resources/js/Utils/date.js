// Tanggal kalender dalam zona waktu PERANGKAT pengguna, bukan UTC.
// Jangan pakai toISOString().slice(...) untuk tanggal kalender:
// di WITA hasilnya mundur satu hari antara pukul 00:00 dan 07:59.

export const toYmd = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayYmd = () => toYmd(new Date());

export const monthStartYmd = (d = new Date()) => `${toYmd(d).slice(0, 7)}-01`;