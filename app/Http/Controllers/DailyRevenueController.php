<?php

namespace App\Http\Controllers;

use App\Models\DailyRevenue;
use App\Models\MonthlyReport;
use Illuminate\Http\Request;

class DailyRevenueController extends Controller
{
    public function store(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $data = $this->validateRow($request);

        DailyRevenue::updateOrCreate(
            ['monthly_report_id' => $report->id, 'date' => $data['date']],
            [...$data, 'monthly_report_id' => $report->id]
        );

        return back()->with('success', 'Data disimpan.');
    }

    public function update(Request $request, MonthlyReport $report, DailyRevenue $daily)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        $daily->update($this->validateRow($request));
        return back()->with('success', 'Data diperbarui.');
    }

    public function destroy(Request $request, MonthlyReport $report, DailyRevenue $daily)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        $daily->delete();
        return back()->with('success', 'Data dihapus.');
    }

    public function bulkUpsert(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $request->validate([
            'rows'                  => 'required|array|min:1|max:31',
            'rows.*.date'           => 'required|date',
            'rows.*.day_name'       => 'required|string',
            'rows.*.presentasi'     => 'nullable|integer|min:0',
            'rows.*.gerai'          => 'nullable|integer|min:0',
            'rows.*.wgts'           => 'nullable|integer|min:0',
            'rows.*.dfi'            => 'nullable|integer|min:0',
            'rows.*.dfe'            => 'nullable|integer|min:0',
            'rows.*.kotak_qris'     => 'nullable|integer|min:0',
            'rows.*.kantor'         => 'nullable|integer|min:0',
        ]);

        foreach ($request->rows as $row) {
            DailyRevenue::updateOrCreate(
                ['monthly_report_id' => $report->id, 'date' => $row['date']],
                [
                    'monthly_report_id' => $report->id,
                    'day_name'          => $row['day_name'],
                    'presentasi'        => $row['presentasi'] ?? 0,
                    'gerai'             => $row['gerai'] ?? 0,
                    'wgts'              => $row['wgts'] ?? 0,
                    'dfi'               => $row['dfi'] ?? 0,
                    'dfe'               => $row['dfe'] ?? 0,
                    'kotak_qris'        => $row['kotak_qris'] ?? 0,
                    'kantor'            => $row['kantor'] ?? 0,
                ]
            );
        }

        $first = DailyRevenue::where('monthly_report_id', $report->id)->first();
        $first?->rebuildCumulatives();
        $report->recalculate();

        return back()->with('success', count($request->rows) . ' baris data disimpan.');
    }

    private function validateRow(Request $request): array
    {
        return $request->validate([
            'date'       => 'required|date',
            'day_name'   => 'required|string|max:10',
            'presentasi' => 'nullable|integer|min:0',
            'gerai'      => 'nullable|integer|min:0',
            'wgts'       => 'nullable|integer|min:0',
            'dfi'        => 'nullable|integer|min:0',
            'dfe'        => 'nullable|integer|min:0',
            'kotak_qris' => 'nullable|integer|min:0',
            'kantor'     => 'nullable|integer|min:0',
            'notes'      => 'nullable|string|max:500',
        ]);
    }
}