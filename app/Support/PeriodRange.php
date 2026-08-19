<?php

namespace App\Support;

/**
 * PeriodRange - satu-satunya rumah definisi periode (bulan / kuartal /
 * semester / tahun) untuk seluruh aplikasi.
 * penanda versi: periodrange-20260819
 *
 * LATAR: definisi kuartal & semester sebelumnya hidup di dalam
 * AnalyticsController (getQuarterlyData / getSemesterData / getCostDateRange).
 * Menyalinnya ke SafdakEventController akan melahirkan sumber kebenaran ganda
 * -- penyakit yang sama dengan CHANNEL_COLORS <-> $channelLabels dan
 * CHANNEL_LABELS di dua file export. Kelas ini dibuat supaya penambahan
 * konsumen berikutnya tidak menyalin rumus lagi.
 *
 * UTANG YANG DISENGAJA: AnalyticsController BELUM di-refactor untuk memakai
 * kelas ini (di luar scope sesi filter pipeline, dan Analytics punya jalur
 * periode 'weekly' yang tidak dipakai pipeline). Definisi di sini SENGAJA
 * dibuat identik dengan Analytics:
 *   - Kuartal : Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Okt-Des
 *   - Semester: S1 Jan-Jun, S2 Jul-Des
 * Saat Analytics di-refactor, hapus rumus lamanya dan panggil kelas ini.
 *
 * FORMAT KUNCI (dipakai di query string ?range=):
 *   2026-08   -> bulan Agustus 2026
 *   2026-Q3   -> kuartal 3 2026
 *   2026-S2   -> semester 2 2026
 *   2026      -> sepanjang tahun 2026
 *   ''        -> semua periode (tanpa batas tanggal)
 *
 * Semua method statis & murni (tidak menyentuh DB / request).
 */
class PeriodRange
{
    public const TYPE_MONTH    = 'month';
    public const TYPE_QUARTER  = 'quarter';
    public const TYPE_SEMESTER = 'semester';
    public const TYPE_YEAR     = 'year';
    public const TYPE_ALL      = 'all';

    /** Batas tahun yang diterima - menjaga dari ?range=9999999 */
    public const YEAR_MIN = 2000;
    public const YEAR_MAX = 2100;

    private const MONTH_NAMES = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    /**
     * Urai string range menjadi rentang tanggal + label.
     *
     * Mengembalikan null untuk "semua periode" (string kosong ATAU format
     * tidak dikenal). Null di sini berarti "jangan batasi tanggal" -- caller
     * cukup melewatkan pemanggilan scope, tidak perlu menangani error.
     *
     * @return array{type:string,year:int,index:int,start:string,end:string,label:string,key:string}|null
     */
    public static function parse(?string $raw): ?array
    {
        $raw = trim((string) $raw);

        if ($raw === '') {
            return null;
        }

        // 2026-08 (bulan)
        if (preg_match('/^(\d{4})-(\d{2})$/', $raw, $m)) {
            $year  = (int) $m[1];
            $month = (int) $m[2];

            if (! self::validYear($year) || $month < 1 || $month > 12) {
                return null;
            }

            return self::build(self::TYPE_MONTH, $year, $month, $month, $month);
        }

        // 2026-Q3 (kuartal)
        if (preg_match('/^(\d{4})-Q([1-4])$/i', $raw, $m)) {
            $year    = (int) $m[1];
            $quarter = (int) $m[2];

            if (! self::validYear($year)) {
                return null;
            }

            $startMonth = ($quarter - 1) * 3 + 1;

            return self::build(self::TYPE_QUARTER, $year, $quarter, $startMonth, $startMonth + 2);
        }

        // 2026-S2 (semester)
        if (preg_match('/^(\d{4})-S([12])$/i', $raw, $m)) {
            $year     = (int) $m[1];
            $semester = (int) $m[2];

            if (! self::validYear($year)) {
                return null;
            }

            $startMonth = ($semester - 1) * 6 + 1;

            return self::build(self::TYPE_SEMESTER, $year, $semester, $startMonth, $startMonth + 5);
        }

        // 2026 (tahun)
        if (preg_match('/^(\d{4})$/', $raw, $m)) {
            $year = (int) $m[1];

            if (! self::validYear($year)) {
                return null;
            }

            return self::build(self::TYPE_YEAR, $year, $year, 1, 12);
        }

        return null;
    }

    /**
     * Data navigasi untuk tombol prev/next + label di frontend.
     *
     * Frontend SENGAJA tidak menghitung periode sendiri: kalau tombol "<"
     * dihitung di JSX, definisi kuartal/semester akan hidup di dua tempat
     * lagi. Semua kunci periode dikirim jadi string siap pakai.
     *
     * @return array{type:string,key:string,label:string,prev:?string,next:?string}
     */
    public static function nav(?array $period): array
    {
        if ($period === null) {
            return [
                'type'  => self::TYPE_ALL,
                'key'   => '',
                'label' => 'Semua periode',
                'prev'  => null,
                'next'  => null,
            ];
        }

        return [
            'type'  => $period['type'],
            'key'   => $period['key'],
            'label' => $period['label'],
            'prev'  => self::shift($period, -1),
            'next'  => self::shift($period, 1),
        ];
    }

    /**
     * Kunci periode setara untuk setiap tipe, berdasarkan sebuah tanggal jangkar.
     *
     * Dipakai saat user berganti TIPE periode: kalau sedang melihat 2025-Q1
     * lalu memilih "Semester", yang wajar adalah pindah ke 2025-S1 (semester
     * yang memuat kuartal itu), bukan melompat ke semester berjalan hari ini.
     *
     * @return array{month:string,quarter:string,semester:string,year:string}
     */
    public static function presetsFor(?string $anchorDate = null): array
    {
        $ts = $anchorDate ? strtotime($anchorDate) : time();

        if ($ts === false) {
            $ts = time();
        }

        $year  = (int) date('Y', $ts);
        $month = (int) date('n', $ts);

        return [
            'month'    => sprintf('%04d-%02d', $year, $month),
            'quarter'  => sprintf('%04d-Q%d', $year, (int) ceil($month / 3)),
            'semester' => sprintf('%04d-S%d', $year, (int) ceil($month / 6)),
            'year'     => (string) $year,
        ];
    }

    // -- Internal -----------------------------------------------

    private static function validYear(int $year): bool
    {
        return $year >= self::YEAR_MIN && $year <= self::YEAR_MAX;
    }

    /**
     * Rakit hasil parse dari rentang bulan (inklusif).
     *
     * @return array{type:string,year:int,index:int,start:string,end:string,label:string,key:string}
     */
    private static function build(string $type, int $year, int $index, int $startMonth, int $endMonth): array
    {
        $start = sprintf('%04d-%02d-01', $year, $startMonth);

        // date('Y-m-t') = tanggal terakhir bulan itu; aman untuk Februari kabisat
        $end = date('Y-m-t', strtotime(sprintf('%04d-%02d-01', $year, $endMonth)));

        return [
            'type'  => $type,
            'year'  => $year,
            'index' => $index,
            'start' => $start,
            'end'   => $end,
            'label' => self::label($type, $year, $index),
            'key'   => self::key($type, $year, $index),
        ];
    }

    private static function key(string $type, int $year, int $index): string
    {
        return match ($type) {
            self::TYPE_MONTH    => sprintf('%04d-%02d', $year, $index),
            self::TYPE_QUARTER  => sprintf('%04d-Q%d', $year, $index),
            self::TYPE_SEMESTER => sprintf('%04d-S%d', $year, $index),
            self::TYPE_YEAR     => (string) $year,
            default             => '',
        };
    }

    private static function label(string $type, int $year, int $index): string
    {
        return match ($type) {
            self::TYPE_MONTH    => (self::MONTH_NAMES[$index] ?? '?') . ' ' . $year,
            self::TYPE_QUARTER  => 'Kuartal ' . $index . ' ' . $year,
            self::TYPE_SEMESTER => 'Semester ' . $index . ' ' . $year
                                   . ($index === 1 ? ' (Jan-Jun)' : ' (Jul-Des)'),
            self::TYPE_YEAR     => 'Tahun ' . $year,
            default             => 'Semua periode',
        };
    }

    /**
     * Geser periode maju/mundur satu satuan, menyeberang tahun bila perlu.
     */
    private static function shift(array $period, int $delta): ?string
    {
        $type  = $period['type'];
        $year  = $period['year'];
        $index = $period['index'];

        if ($type === self::TYPE_YEAR) {
            $newYear = $year + $delta;

            return self::validYear($newYear) ? (string) $newYear : null;
        }

        $perYear = match ($type) {
            self::TYPE_MONTH    => 12,
            self::TYPE_QUARTER  => 4,
            self::TYPE_SEMESTER => 2,
            default             => 0,
        };

        if ($perYear === 0) {
            return null;
        }

        // Aritmetika 0-based supaya penyeberangan tahun bekerja dua arah
        $zero  = ($index - 1) + $delta;
        $carry = (int) floor($zero / $perYear);

        $newYear  = $year + $carry;
        $newIndex = $zero - ($carry * $perYear) + 1;

        if (! self::validYear($newYear)) {
            return null;
        }

        return self::key($type, $newYear, $newIndex);
    }
}