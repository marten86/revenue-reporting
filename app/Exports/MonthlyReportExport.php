<?php

namespace App\Exports;

use App\Models\MonthlyReport;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class MonthlyReportExport implements WithMultipleSheets
{
    public function __construct(private MonthlyReport $report) {}

    public function sheets(): array
    {
        return [
            new RekapKanalSheet($this->report),
            new RincianTimSheet($this->report),
            new SafariDakwahSheet($this->report),
        ];
    }
}

// ── Sheet 1: Rekap Per Kanal ──────────────────────────────────────────────────
class RekapKanalSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'REKAP PER KANAL'; }

    public function headings(): array
    {
        return ['TGL', 'HARI', 'PRESENTASI', 'GERAI', 'WGTS', 'DFI (AR)', 'DFE (AE)', 'KOTAK & QRIS', 'KANTOR', 'TOTAL HARIAN', 'KUMULATIF'];
    }

    public function collection()
    {
        return $this->report->dailyRevenues;
    }

    public function map($row): array
    {
        return [
            (new \DateTime($row->date))->format('d'),
            $row->day_name,
            $row->presentasi,
            $row->gerai,
            $row->wgts,
            $row->dfi,
            $row->dfe,
            $row->kotak_qris,
            $row->kantor,
            $row->total_daily,
            $row->cumulative,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $this->report->dailyRevenues->count() + 2;

        // Header style
        $sheet->getStyle('A1:K1')->applyFromArray([
            'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill'      => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
            'alignment' => ['horizontal' => 'center'],
        ]);

        // Number format kolom angka (C sampai K)
        $sheet->getStyle("C2:K{$lastRow}")->getNumberFormat()
            ->setFormatCode('#,##0');

        // Total row di bawah
        $totalRow = $lastRow + 1;
        $sheet->setCellValue("A{$totalRow}", 'GRAND TOTAL');
        $sheet->setCellValue("C{$totalRow}", $this->report->total_presentasi);
        $sheet->setCellValue("D{$totalRow}", $this->report->total_gerai);
        $sheet->setCellValue("E{$totalRow}", $this->report->total_wgts);
        $sheet->setCellValue("F{$totalRow}", $this->report->total_dfi);
        $sheet->setCellValue("G{$totalRow}", $this->report->total_dfe);
        $sheet->setCellValue("H{$totalRow}", $this->report->total_kotak_qris);
        $sheet->setCellValue("I{$totalRow}", $this->report->total_kantor);
        $sheet->setCellValue("J{$totalRow}", $this->report->total_revenue);

        $sheet->getStyle("A{$totalRow}:K{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        // Auto width
        foreach (range('A', 'K') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return [];
    }
}

// ── Sheet 2: Rincian Tim ──────────────────────────────────────────────────────
class RincianTimSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'RINCIAN REVENUE'; }

    public function headings(): array
    {
        return ['TIM / UNIT', 'PERSONIL', 'REGULER', 'SAFDAK', 'DF', 'TOTAL'];
    }

    public function collection()
    {
        return $this->report->teamRevenues;
    }

    public function map($row): array
    {
        return [
            $row->team_name,
            $row->personnel ?? '',
            $row->reguler,
            $row->safdak,
            $row->df,
            $row->total,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $this->report->teamRevenues->count() + 2;

        $sheet->getStyle('A1:F1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
        ]);

        $sheet->getStyle("C2:F{$lastRow}")->getNumberFormat()
            ->setFormatCode('#,##0');

        $totalRow = $lastRow + 1;
        $sheet->setCellValue("A{$totalRow}", 'GRAND TOTAL');
        $sheet->setCellValue("C{$totalRow}", $this->report->teamRevenues->sum('reguler'));
        $sheet->setCellValue("D{$totalRow}", $this->report->teamRevenues->sum('safdak'));
        $sheet->setCellValue("E{$totalRow}", $this->report->teamRevenues->sum('df'));
        $sheet->setCellValue("F{$totalRow}", $this->report->teamRevenues->sum('total'));

        $sheet->getStyle("A{$totalRow}:F{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        foreach (range('A', 'F') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return [];
    }
}

// ── Sheet 3: Safari Dakwah ────────────────────────────────────────────────────
class SafariDakwahSheet implements FromCollection, WithHeadings, WithMapping, WithStyles, WithTitle
{
    public function __construct(private MonthlyReport $report) {}

    public function title(): string { return 'REV SAFARI DAKWAH'; }

    public function headings(): array
    {
        return ['TANGGAL', 'HARI', 'LOKASI', 'NARASUMBER', 'TARGET', 'KOMITMEN', 'REALISASI', 'CAPAIAN %'];
    }

    public function collection()
    {
        return $this->report->safariDakwahLogs;
    }

    public function map($row): array
    {
        return [
            (new \DateTime($row->date))->format('d/m/Y'),
            $row->day_name,
            $row->location ?? '',
            $row->speaker ?? '',
            $row->target,
            $row->commitment,
            $row->realization,
            $row->target > 0 ? round($row->realization / $row->target * 100, 2) : 0,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $this->report->safariDakwahLogs->count() + 2;

        $sheet->getStyle('A1:H1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '166534']],
        ]);

        $sheet->getStyle("E2:G{$lastRow}")->getNumberFormat()
            ->setFormatCode('#,##0');

        $sheet->getStyle("H2:H{$lastRow}")->getNumberFormat()
            ->setFormatCode('0.00"%"');

        $logs = $this->report->safariDakwahLogs;
        $totalRow = $lastRow + 1;
        $sheet->setCellValue("A{$totalRow}", 'TOTAL');
        $sheet->setCellValue("E{$totalRow}", $logs->sum('target'));
        $sheet->setCellValue("F{$totalRow}", $logs->sum('commitment'));
        $sheet->setCellValue("G{$totalRow}", $logs->sum('realization'));

        $totalTarget = $logs->sum('target');
        $totalReal   = $logs->sum('realization');
        $sheet->setCellValue("H{$totalRow}", $totalTarget > 0 ? round($totalReal / $totalTarget * 100, 2) : 0);

        $sheet->getStyle("A{$totalRow}:H{$totalRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        foreach (range('A', 'H') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return [];
    }
}