<?php

namespace App\Http\Controllers;

use App\Models\MonthlyReport;
use App\Models\SafariDakwahLog;
use Illuminate\Http\Request;

class SafariDakwahController extends Controller
{
    public function store(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $data = $request->validate([
            'date'        => 'required|date',
            'day_name'    => 'required|string|max:10',
            'time'        => 'nullable|string|max:20',
            'location'    => 'nullable|string|max:200',
            'speaker'     => 'nullable|string|max:200',
            'target'      => 'nullable|integer|min:0',
            'commitment'  => 'nullable|integer|min:0',
            'realization' => 'nullable|integer|min:0',
            'notes'       => 'nullable|string|max:500',
        ]);

        SafariDakwahLog::create([
            ...$data,
            'monthly_report_id' => $report->id,
            'target'            => $data['target'] ?? 0,
            'commitment'        => $data['commitment'] ?? 0,
            'realization'       => $data['realization'] ?? 0,
        ]);

        return back()->with('success', 'Data Safari Dakwah disimpan.');
    }

    public function update(Request $request, MonthlyReport $report, SafariDakwahLog $log)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $data = $request->validate([
            'date'        => 'required|date',
            'day_name'    => 'required|string|max:10',
            'time'        => 'nullable|string|max:20',
            'location'    => 'nullable|string|max:200',
            'speaker'     => 'nullable|string|max:200',
            'target'      => 'nullable|integer|min:0',
            'commitment'  => 'nullable|integer|min:0',
            'realization' => 'nullable|integer|min:0',
            'notes'       => 'nullable|string|max:500',
        ]);

        $log->update($data);

        return back()->with('success', 'Data diperbarui.');
    }

    public function destroy(Request $request, MonthlyReport $report, SafariDakwahLog $log)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        $log->delete();
        return back()->with('success', 'Data dihapus.');
    }
}