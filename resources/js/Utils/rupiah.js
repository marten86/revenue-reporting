// v20260926-rupiah — satu sumber format Rupiah (pola Utils/channels.js)
// Aturan: koma desimal, 3 angka penting, ",0" dibuang, satuan diberi spasi.
// null/''/NaN -> '—' (data kosong ≠ nol). Nol -> 'Rp 0' kecuali { zero: '—' }.

const UNITS = [
    [1e9, 'M'],
    [1e6, 'jt'],
    [1e3, 'rb'],
];

const toNumber = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const num = (v, dec = 0) => v.toLocaleString('id-ID', { maximumFractionDigits: dec });

// 1.155.441.723 -> "1,16 M" · 192.000.000 -> "192 jt" · 1.900.000 -> "1,9 jt"
const compact = (abs) => {
    for (let i = 0; i < UNITS.length; i++) {
        const [div, suf] = UNITS[i];
        if (abs < div) continue;
        const v = abs / div;
        const dec = v >= 100 ? 0 : v >= 10 ? 1 : 2;
        const r = Number(v.toFixed(dec));
        // 999,6 jt dibulatkan jadi 1.000 jt -> naik satuan: "1 M"
        if (r >= 1000 && i > 0) {
            const [div2, suf2] = UNITS[i - 1];
            return `${num(Number((abs / div2).toFixed(2)), 2)} ${suf2}`;
        }
        return `${num(r, dec)} ${suf}`;
    }
    return num(Math.round(abs));
};

const withSign = (n, body) => (n < 0 ? '-' : '') + body;

// Penuh: "Rp 1.155.441.723"
export const formatRp = (value, { zero = 'Rp 0', empty = '—' } = {}) => {
    const n = toNumber(value);
    if (n === null) return empty;
    if (n === 0) return zero;
    return withSign(n, 'Rp ' + num(Math.round(Math.abs(n))));
};

// Ringkas: "Rp 1,16 M", "Rp 192 jt", "Rp 1,9 jt", "Rp 200 rb", "-Rp 3,5 jt"
export const formatRpShort = (value, { zero = 'Rp 0', empty = '—' } = {}) => {
    const n = toNumber(value);
    if (n === null) return empty;
    if (n === 0) return zero;
    return withSign(n, 'Rp ' + compact(Math.abs(n)));
};

// Sumbu grafik (tanpa "Rp"): "1,5 M", "200 jt", "0"
export const formatRpAxis = (value) => {
    const n = toNumber(value);
    if (!n) return '0';
    return withSign(n, compact(Math.abs(n)));
};
