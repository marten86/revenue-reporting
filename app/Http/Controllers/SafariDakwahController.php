<?php

namespace App\Http\Controllers;

use App\Models\MonthlyReport;
use App\Models\SafariDakwahLog;
use Illuminate\Http\Request;

class SafariDakwahController extends Controller
{
    // v20261001-batas-bulan: tanggal sesi wajib di dalam bulan laporan
    private function rules(MonthlyReport $report): array
    {
        $start = $report->period_month->copy()->startOfMonth()->toDateString();
        $end   = $report->period_month->copy()->endOfMonth()->toDateString();

        return [
            'date'        => ['required', 'date', "after_or_equal:{$start}", "before_or_equal:{$end}"],
            'day_name'    => 'required|string|max:10',
            'time'        => 'nullable|string|max:20',
            'location'    => 'nullable|string|max:200',
            'speaker'     => 'nullable|string|max:200',
            'target'      => 'nullable|integer|min:0',
            'commitment'  => 'nullable|integer|min:0',
            'realization' => 'nullable|integer|min:0',
            'notes'       => 'nullable|string|max:500',
        ];
    }

    public function store(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer (admin_nasional lolos)
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $data = $request->validate($this->rules($report), [
            'date.after_or_equal'  => 'Tanggal harus berada di dalam bulan laporan ini.',
            'date.before_or_equal' => 'Tanggal harus berada di dalam bulan laporan ini.',
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
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($log->monthly_report_id === $report->id, 404);

        $data = $request->validate($this->rules($report), [
            'date.after_or_equal'  => 'Tanggal harus berada di dalam bulan laporan ini.',
            'date.before_or_equal' => 'Tanggal harus berada di dalam bulan laporan ini.',
        ]);

        $log->update($data);

        return back()->with('success', 'Data diperbarui.');
    }

    public function destroy(Request $request, MonthlyReport $report, SafariDakwahLog $log)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($log->monthly_report_id === $report->id, 404);

        $log->delete();

        return back()->with('success', 'Data dihapus.');
    }
}