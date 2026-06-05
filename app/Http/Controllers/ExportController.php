<?php

namespace App\Http\Controllers;

use App\Exports\MonthlyReportExport;
use App\Models\MonthlyReport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    public function excel(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $report->load(['dailyRevenues', 'teamRevenues', 'safariDakwahLogs']);

        $filename = 'REV_' . $report->branch->code . '_'
            . \Carbon\Carbon::parse($report->period_month)->format('M_Y')
            . '.xlsx';

        return Excel::download(new MonthlyReportExport($report), $filename);
    }

    public function pdf(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $report->load([
            'branch.area',
            'dailyRevenues',
            'teamRevenues',
            'safariDakwahLogs',
            'approvedBy',
        ]);

        $pdf = Pdf::loadView('pdf.report', ['report' => $report])
            ->setPaper('a4', 'landscape');

        $filename = 'REV_' . $report->branch->code . '_'
            . \Carbon\Carbon::parse($report->period_month)->format('M_Y')
            . '.pdf';

        return $pdf->download($filename);
    }
}