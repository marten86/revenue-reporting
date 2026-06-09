<?php

namespace App\Exports;

use App\Models\MonthlyReport;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class MonthlyReportExport implements WithMultipleSheets
{
    public function __construct(private MonthlyReport $report) {}

    public function sheets(): array
    {
        return [
            new RekapKanalSheet($this->report),
            new RekapTimSheet($this->report),
            new RincianRevenueSheet($this->report),
            new SafariDakwahSheet($this->report),
        ];
    }
}

// ── Sheet 1: Rekap Per Kanal (dari daily_revenues) ────────────────────────────
class RekapKanalSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle, WithColumnWidths
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'REKAP PER KANAL'; }

    public function headings(): array
    {
        return ['TGL', 'HARI', 'PRESENTASI', 'WGTS', 'GERAI', 'DFI (AR)', 'DFE (AE)', 'KOTAK & QRIS', 'KANTOR', 'TOTAL HARIAN', 'KUMULATIF'];
    }

    public function collection()
    {
        return $this->report->dailyRevenues()->orderBy('date')->get();
    }

    public function map($row): array
    {
        return [
            (new \DateTime($row->date))->format('d'),
            $row->day_name ?? '',
            (int)($row->presentasi ?? 0),
            (int)($row->wgts ?? 0),
            (int)($row->gerai ?? 0),
            (int)($row->dfi ?? 0),
            (int)($row->dfe ?? 0),
            (int)($row->kotak_qris ?? 0),
            (int)($row->kantor ?? 0),
            (int)($row->total_daily ?? 0),
            (int)($row->cumulative ?? 0),
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 6,  'B' => 14, 'C' => 16, 'D' => 16,
            'E' => 16, 'F' => 16, 'G' => 16, 'H' => 16,
            'I' => 16, 'J' => 16, 'K' => 16,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $count   = $this->report->dailyRevenues()->count();
        $lastRow = $count + 1; // +1 karena heading di row 1

        // Header
        $sheet->getStyle('A1:K1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
            'alignment' => ['horizontal' => 'center'],
        ]);

        // Format angka
        $sheet->getStyle("C2:K{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');

        // Grand total row
        $totalRow = $lastRow + 1;
        $dailies  = $this->report->dailyRevenues()->get();
        $sheet->setCellValue("A{$totalRow}", 'GRAND TOTAL');
        $sheet->setCellValue("C{$totalRow}", $dailies->sum('presentasi'));
        $sheet->setCellValue("D{$totalRow}", $dailies->sum('wgts'));
        $sheet->setCellValue("E{$totalRow}", $dailies->sum('gerai'));
        $sheet->setCellValue("F{$totalRow}", $dailies->sum('dfi'));
        $sheet->setCellValue("G{$totalRow}", $dailies->sum('dfe'));
        $sheet->setCellValue("H{$totalRow}", $dailies->sum('kotak_qris'));
        $sheet->setCellValue("I{$totalRow}", $dailies->sum('kantor'));
        $sheet->setCellValue("J{$totalRow}", (int)$this->report->total_revenue);
        $sheet->getStyle("C{$totalRow}:K{$totalRow}")->getNumberFormat()->setFormatCode('#,##0');

        $sheet->getStyle("A{$totalRow}:K{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        // Info cabang & periode di atas (baris A1 sudah heading, jadi insert di bawah data)
        // Freeze header row
        $sheet->freezePane('A2');

        return [];
    }
}

// ── Sheet 2: Rekap Per Tim (agregasi dari revenue_details) ────────────────────
class RekapTimSheet implements FromArray, WithHeadings, WithStyles, WithTitle, WithColumnWidths
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'REKAP PER TIM'; }

    public function headings(): array
    {
        return ['KANAL', 'SUMBER / TIM', 'TOTAL REVENUE'];
    }

    public function array(): array
    {
        $rows = [];

        $details = $this->report->revenueDetails()
            ->reorder()                          // ← clear default order dari relasi
            ->selectRaw('channel, source_label, SUM(amount) as total')
            ->groupBy('channel', 'source_label')
            ->orderBy('channel')
            ->orderByRaw('SUM(amount) DESC')
            ->get();

        $currentChannel = null;
        $channelTotal   = 0;

        foreach ($details as $d) {
            // Subtotal baris ketika channel berganti
            if ($currentChannel !== null && $currentChannel !== $d->channel) {
                $rows[] = ['', 'Subtotal ' . $currentChannel, $channelTotal];
                $rows[] = ['', '', ''];
                $channelTotal = 0;
            }
            $currentChannel  = $d->channel;
            $channelTotal   += (int)$d->total;
            $rows[]          = [$d->channel, $d->source_label ?? '—', (int)$d->total];
        }

        // Subtotal channel terakhir
        if ($currentChannel !== null) {
            $rows[] = ['', 'Subtotal ' . $currentChannel, $channelTotal];
        }

        // Grand total
        $rows[] = ['', '', ''];
        $rows[] = ['', 'GRAND TOTAL', (int)$this->report->total_revenue];

        return $rows;
    }

    public function columnWidths(): array
    {
        return ['A' => 22, 'B' => 32, 'C' => 22];
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $sheet->getHighestRow();

        // Header
        $sheet->getStyle('A1:C1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
        ]);

        // Format angka kolom C
        $sheet->getStyle("C2:C{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');

        // Style grand total (baris terakhir berisi data)
        $sheet->getStyle("A{$lastRow}:C{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        // Style baris subtotal — bold, bg abu muda
        for ($i = 2; $i <= $lastRow; $i++) {
            $cellB = $sheet->getCell("B{$i}")->getValue();
            if ($cellB && str_starts_with((string)$cellB, 'Subtotal')) {
                $sheet->getStyle("A{$i}:C{$i}")->applyFromArray([
                    'font' => ['bold' => true, 'italic' => true],
                    'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'F3F4F6']],
                ]);
            }
        }

        return [];
    }
}

// ── Sheet 3: Rincian Revenue (raw revenue_details) ────────────────────────────
class RincianRevenueSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle, WithColumnWidths
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'RINCIAN REVENUE'; }

    public function headings(): array
    {
        return ['TANGGAL', 'KANAL', 'SUB KANAL', 'SUMBER / TIM', 'NOMINAL', 'CATATAN'];
    }

    public function collection()
    {
        return $this->report->revenueDetails()
            ->orderBy('date')
            ->orderBy('channel')
            ->get();
    }

    public function map($row): array
    {
        return [
            (new \DateTime($row->date))->format('d/m/Y'),
            $row->channel ?? '',
            $row->sub_channel ?? '—',
            $row->source_label ?? '—',
            (int)($row->amount ?? 0),
            $row->notes ?? '',
        ];
    }

    public function columnWidths(): array
    {
        return ['A' => 14, 'B' => 18, 'C' => 16, 'D' => 30, 'E' => 18, 'F' => 30];
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $sheet->getHighestRow();

        $sheet->getStyle('A1:F1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
        ]);

        $sheet->getStyle("E2:E{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');

        // Zebra stripe ringan
        for ($i = 2; $i <= $lastRow; $i++) {
            if ($i % 2 === 0) {
                $sheet->getStyle("A{$i}:F{$i}")->applyFromArray([
                    'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
        }

        $sheet->freezePane('A2');

        return [];
    }
}

// ── Sheet 4: Safari Dakwah ────────────────────────────────────────────────────
class SafariDakwahSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle, WithColumnWidths
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'REV SAFARI DAKWAH'; }

    public function headings(): array
    {
        return ['TANGGAL', 'HARI', 'LOKASI', 'NARASUMBER', 'TARGET', 'KOMITMEN', 'REALISASI', 'CAPAIAN %'];
    }

    public function collection()
    {
        return $this->report->safariDakwahLogs()->orderBy('date')->get();
    }

    public function map($row): array
    {
        $target      = (int)($row->target ?? 0);
        $realization = (int)($row->realization ?? 0);
        $pct         = $target > 0 ? round($realization / $target * 100, 2) : 0;

        return [
            (new \DateTime($row->date))->format('d/m/Y'),
            $row->day_name ?? '',
            $row->location ?? '—',
            $row->speaker ?? '—',
            $target,
            (int)($row->commitment ?? 0),
            $realization,
            $pct,
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 14, 'B' => 12, 'C' => 30,
            'D' => 30, 'E' => 16, 'F' => 18,
            'G' => 18, 'H' => 12,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $count   = $this->report->safariDakwahLogs()->count();
        $lastRow = $count + 1;

        // Header
        $sheet->getStyle('A1:H1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
        ]);

        if ($count > 0) {
            $sheet->getStyle("E2:G{$lastRow}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("H2:H{$lastRow}")->getNumberFormat()->setFormatCode('0.00"%"');

            // Total row
            $logs     = $this->report->safariDakwahLogs()->get();
            $totalRow = $lastRow + 1;
            $totalTarget = $logs->sum('target');
            $totalReal   = $logs->sum('realization');

            $sheet->setCellValue("A{$totalRow}", 'TOTAL');
            $sheet->setCellValue("E{$totalRow}", (int)$totalTarget);
            $sheet->setCellValue("F{$totalRow}", (int)$logs->sum('commitment'));
            $sheet->setCellValue("G{$totalRow}", (int)$totalReal);
            $sheet->setCellValue("H{$totalRow}", $totalTarget > 0 ? round($totalReal / $totalTarget * 100, 2) : 0);

            $sheet->getStyle("E{$totalRow}:G{$totalRow}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("H{$totalRow}")->getNumberFormat()->setFormatCode('0.00"%"');

            $sheet->getStyle("A{$totalRow}:H{$totalRow}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
            ]);
        }

        return [];
    }
}