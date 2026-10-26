<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * penanda versi: pipeline-grade-export-20261026
 *
 * Export /safari-pipeline: 3 sheet (Daftar, Peringkat, Ringkasan).
 * Datanya berasal dari SafdakEventController::buildPipeline() -- builder yang
 * sama dengan halaman -- jadi export ini TIDAK menghitung ulang agregat apa
 * pun. Yang dihitung di sini hanya persentase per baris, dengan rumus yang
 * WAJIB identik dengan helper di SafdakPipeline/Index.jsx:
 *   pctCapaian() / rasioCost() / perTitik()
 * Kalau rumus di JSX berubah, tiga method statis di bawah ikut berubah.
 *
 * Nominal ditulis sebagai ANGKA (bukan teks "Rp ...") supaya bisa dijumlah
 * dan disaring di Excel. Nilai yang tidak bisa dihitung ditulis "—",
 * bukan 0 -- prinsip yang sama dengan tampilan layar.
 */
class SafdakPipelineExport implements WithMultipleSheets
{
    public const DASH = "\u{2014}";

    public function __construct(private array $data, private array $ctx) {}

    public function sheets(): array
    {
        return [
            new PipelineDaftarSheet($this->data['events'], $this->ctx),
            new PipelinePeringkatSheet($this->data['ranking'], $this->ctx),
            new PipelineRingkasanSheet($this->data['summary'], $this->ctx),
        ];
    }

    // -- Rumus (cermin JSX) ------------------------------------------

    /** Realisasi / komitmen, dibulatkan. Komitmen <= 0 -> null. */
    public static function pctCapaian($komitmen, $realisasi): ?int
    {
        $k = (float) ($komitmen ?? 0);
        $r = (float) ($realisasi ?? 0);

        return $k > 0 ? (int) round(($r / $k) * 100) : null;
    }

    /** Cost / realisasi, dibulatkan. Realisasi <= 0 ATAU cost <= 0 -> null. */
    public static function rasioCost($cost, $realisasi): ?int
    {
        $c = (float) ($cost ?? 0);
        $r = (float) ($realisasi ?? 0);

        if ($r <= 0 || $c <= 0) {
            return null;
        }

        return (int) round(($c / $r) * 100);
    }

    /** Nominal per titik eksekusi. Penyebut atau pembilang <= 0 -> null. */
    public static function perTitik($nominal, $titik): ?float
    {
        $n = (float) ($nominal ?? 0);
        $t = (float) ($titik ?? 0);

        return ($t > 0 && $n > 0) ? $n / $t : null;
    }

    /** null -> "—" ; dipakai untuk sel angka yang tidak bisa dihitung. */
    public static function orDash($v)
    {
        return $v === null ? self::DASH : $v;
    }

    /** Format rupiah untuk PDF (Excel memakai format sel, bukan teks). */
    public static function rp($v): string
    {
        $n = (float) ($v ?? 0);

        return $n > 0 ? 'Rp ' . number_format($n, 0, ',', '.') : self::DASH;
    }

    /** Baris konteks filter -- sama di tiap sheet supaya file tetap jelas saat diteruskan. */
    public static function contextLine(array $ctx): string
    {
        return "Periode: {$ctx['periode']}  |  Cabang: {$ctx['cabang']}  |  Da'i: {$ctx['dai']}"
            . "  |  {$ctx['grade']}  |  Status: {$ctx['status']}";
    }

    /** Judul + konteks di baris 1-2, header tabel di baris 4. */
    public static function styleHeader(Worksheet $sheet, string $lastCol): void
    {
        $sheet->mergeCells("A1:{$lastCol}1");
        $sheet->mergeCells("A2:{$lastCol}2");
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13)->getColor()->setRGB('166534');
        $sheet->getStyle('A2')->getFont()->setSize(9)->getColor()->setRGB('6B7280');

        $head = $sheet->getStyle("A4:{$lastCol}4");
        $head->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
        $head->getFill()->setFillType('solid')->getStartColor()->setRGB('166534');
        $sheet->freezePane('A5');
    }
}

// == Sheet 1: Daftar kampanye (ikut SEMUA filter, termasuk status) ===========
class PipelineDaftarSheet implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    private const HEADINGS = [
        'No', 'Cabang', 'Kampanye', 'Mulai', 'Selesai', 'Hari', "Da'i", 'Grade', 'Status',
        'Target Min', 'Target Ideal', 'Titik Deal', 'Titik Eksekusi',
        'Cost', 'Komitmen', 'Realisasi', 'Capaian %', 'Rasio Cost %', 'Realisasi/Titik',
        'MoU', 'Catatan',
    ];

    private int $rowCount = 0;

    public function __construct(private $events, private array $ctx) {}

    public function title(): string
    {
        return 'Daftar Kampanye';
    }

    public function array(): array
    {
        $rows = [
            ['Daftar Kampanye Safari Dakwah'],
            [SafdakPipelineExport::contextLine($this->ctx) . '  |  Dicetak: ' . $this->ctx['dicetak']],
            [],
            self::HEADINGS,
        ];

        $t = ['min' => 0, 'ideal' => 0, 'deal' => 0, 'eks' => 0, 'cost' => 0.0, 'kom' => 0.0, 'real' => 0.0];

        foreach ($this->events as $i => $e) {
            $speaker = trim((string) $e->speaker);
            $grade   = trim((string) $e->grade);

            $rows[] = [
                $i + 1,
                $e->branch->code ?? '-',
                $e->title,
                $e->start_date?->format('Y-m-d'),
                $e->end_date?->format('Y-m-d'),
                $e->total_days,
                $speaker !== '' ? $speaker : SafdakPipelineExport::DASH,
                $grade !== '' ? mb_strtoupper($grade) : SafdakPipelineExport::DASH,
                ucfirst((string) $e->status),
                $e->target_min,
                $e->target_ideal,
                (int) $e->titik_deal,
                (int) $e->titik_eksekusi,
                (float) $e->total_cost,
                (float) $e->revenue_komitmen,
                (float) $e->revenue_realisasi,
                SafdakPipelineExport::orDash(SafdakPipelineExport::pctCapaian($e->revenue_komitmen, $e->revenue_realisasi)),
                SafdakPipelineExport::orDash(SafdakPipelineExport::rasioCost($e->total_cost, $e->revenue_realisasi)),
                SafdakPipelineExport::orDash(SafdakPipelineExport::perTitik($e->revenue_realisasi, $e->titik_eksekusi)),
                $e->has_mou ? 'Ya' : 'Tidak',
                (string) ($e->notes ?? ''),
            ];

            $t['min']   += $e->target_min;
            $t['ideal'] += $e->target_ideal;
            $t['deal']  += (int) $e->titik_deal;
            $t['eks']   += (int) $e->titik_eksekusi;
            $t['cost']  += (float) $e->total_cost;
            $t['kom']   += (float) $e->revenue_komitmen;
            $t['real']  += (float) $e->revenue_realisasi;
        }

        $this->rowCount = count($this->events);

        if ($this->rowCount > 0) {
            $rows[] = [
                'TOTAL', '', $this->rowCount . ' kampanye', '', '', '', '', '', '',
                $t['min'], $t['ideal'], $t['deal'], $t['eks'],
                $t['cost'], $t['kom'], $t['real'],
                SafdakPipelineExport::orDash(SafdakPipelineExport::pctCapaian($t['kom'], $t['real'])),
                SafdakPipelineExport::orDash(SafdakPipelineExport::rasioCost($t['cost'], $t['real'])),
                SafdakPipelineExport::orDash(SafdakPipelineExport::perTitik($t['real'], $t['eks'])),
                '', '',
            ];
        } else {
            $rows[] = ['Tidak ada kampanye pada filter ini.'];
        }

        return $rows;
    }

    public function styles(Worksheet $sheet)
    {
        SafdakPipelineExport::styleHeader($sheet, 'U');

        if ($this->rowCount > 0) {
            $first = 5;
            $last  = 4 + $this->rowCount + 1; // + baris TOTAL

            $sheet->getStyle("N{$first}:P{$last}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("S{$first}:S{$last}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("Q{$first}:R{$last}")->getNumberFormat()->setFormatCode('0"%"');
            $sheet->getStyle("Q{$first}:S{$last}")->getAlignment()->setHorizontal('right');

            $total = $sheet->getStyle("A{$last}:U{$last}");
            $total->getFont()->setBold(true);
            $total->getFill()->setFillType('solid')->getStartColor()->setRGB('DCFCE7');
        }

        return [];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 5, 'B' => 8, 'C' => 32, 'D' => 11, 'E' => 11, 'F' => 6, 'G' => 22, 'H' => 7,
            'I' => 10, 'J' => 10, 'K' => 11, 'L' => 10, 'M' => 13, 'N' => 14, 'O' => 15,
            'P' => 15, 'Q' => 10, 'R' => 12, 'S' => 15, 'T' => 7, 'U' => 40,
        ];
    }
}

// == Sheet 2: Peringkat da'i (TIDAK ikut filter da'i & status) ==============
class PipelinePeringkatSheet implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    private const HEADINGS = [
        'No', "Da'i", 'Cabang', 'Kampanye', 'Titik Deal', 'Titik Eksekusi',
        'Cost', 'Komitmen', 'Realisasi', 'Capaian %', 'Rata-rata Capaian %',
        'n (rata-rata)', 'Rasio Cost %', 'Realisasi/Titik',
    ];

    private int $rowCount = 0;

    /** Nomor baris Excel milik da'i yang sedang difilter (di-highlight amber). */
    private array $activeRows = [];

    public function __construct(private $ranking, private array $ctx) {}

    public function title(): string
    {
        return "Peringkat Da'i";
    }

    public function array(): array
    {
        $rows = [
            ["Peringkat Da'i (per da'i per cabang, urut Realisasi)"],
            ['Ikut filter periode, cabang & grade -- TIDAK ikut filter da\'i & status.  |  '
                . SafdakPipelineExport::contextLine($this->ctx)],
            [],
            self::HEADINGS,
        ];

        $active = (string) ($this->ctx['dai_raw'] ?? '');

        foreach (collect($this->ranking)->values() as $i => $r) {
            $isActive = $active !== '' && (
                ($active === '__none__' && empty($r['speaker'])) || $active === ($r['speaker'] ?? null)
            );

            if ($isActive) {
                $this->activeRows[] = 5 + $i;
            }

            $rows[] = [
                $i + 1,
                $r['speaker'] ?? '(Belum ditentukan)',
                $r['branch_code'],
                $r['kampanye'],
                $r['titik_deal'],
                $r['titik_eksekusi'],
                $r['total_cost'],
                $r['revenue_komitmen'],
                $r['revenue_realisasi'],
                SafdakPipelineExport::orDash(SafdakPipelineExport::pctCapaian($r['revenue_komitmen'], $r['revenue_realisasi'])),
                SafdakPipelineExport::orDash($r['avg_capaian_pct']),
                $r['avg_capaian_n'],
                SafdakPipelineExport::orDash(SafdakPipelineExport::rasioCost($r['total_cost'], $r['revenue_realisasi'])),
                SafdakPipelineExport::orDash(SafdakPipelineExport::perTitik($r['revenue_realisasi'], $r['titik_eksekusi'])),
            ];
        }

        $this->rowCount = count($rows) - 4;

        if ($this->rowCount === 0) {
            $rows[] = ['Belum ada data peringkat pada filter ini.'];
        }

        return $rows;
    }

    public function styles(Worksheet $sheet)
    {
        SafdakPipelineExport::styleHeader($sheet, 'N');

        if ($this->rowCount > 0) {
            $last = 4 + $this->rowCount;

            $sheet->getStyle("G5:I{$last}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("N5:N{$last}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("J5:K{$last}")->getNumberFormat()->setFormatCode('0"%"');
            $sheet->getStyle("M5:M{$last}")->getNumberFormat()->setFormatCode('0"%"');
            $sheet->getStyle("J5:N{$last}")->getAlignment()->setHorizontal('right');

            foreach ($this->activeRows as $row) {
                $sheet->getStyle("A{$row}:N{$row}")->getFill()
                    ->setFillType('solid')->getStartColor()->setRGB('FEF3C7');
            }
        }

        return [];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 5, 'B' => 26, 'C' => 8, 'D' => 10, 'E' => 10, 'F' => 13, 'G' => 14,
            'H' => 15, 'I' => 15, 'J' => 10, 'K' => 18, 'L' => 12, 'M' => 12, 'N' => 15,
        ];
    }
}

// == Sheet 3: Ringkasan (ikut semua filter KECUALI status) ==================
class PipelineRingkasanSheet implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    /** Baris judul seksi (di-bold). Diisi saat array() dirakit. */
    private array $sectionRows = [];

    public function __construct(private $summary, private array $ctx) {}

    public function title(): string
    {
        return 'Ringkasan';
    }

    public function array(): array
    {
        $s    = $this->summary;
        $dash = SafdakPipelineExport::DASH;
        $ps   = $s['per_status'] ?? [];

        $avgNote = ($s['avg_capaian_pct'] ?? null) === null
            ? $dash
            : $s['avg_capaian_pct'] . '%  (dari ' . $s['avg_capaian_n'] . ' kampanye; '
                . $s['avg_capaian_excluded'] . ' dikecualikan karena komitmen kosong)';

        $pct   = SafdakPipelineExport::pctCapaian($s['revenue_komitmen'], $s['revenue_realisasi']);
        $rasio = SafdakPipelineExport::rasioCost($s['total_cost'], $s['revenue_realisasi']);

        $rows = [
            ['Ringkasan Pipeline Safari Dakwah'],
            ['Dicetak: ' . $this->ctx['dicetak'] . '  |  oleh ' . $this->ctx['oleh']],
            [],
            ['FILTER', ''],
            ['Periode', $this->ctx['periode']],
            ['Cabang', $this->ctx['cabang']],
            ["Da'i", $this->ctx['dai']],
            ['Grade', $this->ctx['grade']],
            ['Status', $this->ctx['status'] . '  (hanya berlaku untuk sheet Daftar)'],
            [],
            ['ANGKA (ikut semua filter kecuali status)', ''],
            ['Total kampanye', $s['total']],
        ];

        foreach (['rencana', 'berjalan', 'selesai', 'batal'] as $st) {
            $rows[] = ['  ' . ucfirst($st), $ps[$st] ?? 0];
        }

        $rows = array_merge($rows, [
            ['Target titik (min / ideal)', $s['target_min'] . ' / ' . $s['target_ideal']],
            ['Titik deal', $s['titik_deal']],
            ['Titik eksekusi', $s['titik_eksekusi']],
            ['Cost', $s['total_cost']],
            ['Komitmen', $s['revenue_komitmen']],
            ['Realisasi', $s['revenue_realisasi']],
            ['Capaian (agregat)', $pct === null ? $dash : $pct . '%'],
            ['Rata-rata capaian per kampanye', $avgNote],
            ['Rasio cost', $rasio === null ? $dash : $rasio . '%'],
            ['Realisasi per titik eksekusi', SafdakPipelineExport::orDash(
                SafdakPipelineExport::perTitik($s['revenue_realisasi'], $s['titik_eksekusi'])
            )],
            [],
            ['CATATAN', ''],
            ['1', 'Angka pipeline bersifat manajerial -- TIDAK dijumlahkan ke rekap penghimpunan resmi.'],
            ['2', 'Kampanye yang melintasi batas periode dihitung penuh di setiap periode yang disinggungnya; angka antar-periode jangan dijumlahkan.'],
            ['3', "Sheet Peringkat tidak mengikuti filter da'i & status (butuh pembanding). Da'i yang difilter ditandai kuning."],
            ['4', "Grade dicatat per kampanye. Saat filter grade aktif, baris da'i di Peringkat hanya berisi kampanye dengan grade tersebut."],
        ]);

        foreach ($rows as $i => $r) {
            if (in_array($r[0] ?? null, ['FILTER', 'ANGKA (ikut semua filter kecuali status)', 'CATATAN'], true)) {
                $this->sectionRows[] = $i + 1;
            }
        }

        return $rows;
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13)->getColor()->setRGB('166534');
        $sheet->getStyle('A2')->getFont()->setSize(9)->getColor()->setRGB('6B7280');

        foreach ($this->sectionRows as $row) {
            $style = $sheet->getStyle("A{$row}:B{$row}");
            $style->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
            $style->getFill()->setFillType('solid')->getStartColor()->setRGB('166534');
        }

        // Kolom B: nominal ditulis angka -> format ribuan; teks tidak terpengaruh
        $sheet->getStyle('B5:B60')->getNumberFormat()->setFormatCode('#,##0');
        $sheet->getStyle('B5:B60')->getAlignment()->setHorizontal('left')->setWrapText(true);

        return [];
    }

    public function columnWidths(): array
    {
        return ['A' => 36, 'B' => 95];
    }
}
