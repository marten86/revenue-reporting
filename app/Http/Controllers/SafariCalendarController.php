<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\SafariDakwahLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SafariCalendarController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Bulan aktif: ?month=YYYY-MM, default bulan berjalan
        $monthInput = $request->input('month', now()->format('Y-m'));
        try {
            $start = Carbon::createFromFormat('Y-m', $monthInput)->startOfMonth();
        } catch (\Exception $e) {
            $start = now()->startOfMonth();
        }
        $end = $start->copy()->endOfMonth();

        $query = SafariDakwahLog::query()
            ->with(['monthlyReport.branch:id,name'])
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()]);

        // Scope role: yang tidak melihat semua cabang dibatasi ke cabangnya sendiri
        if (! $user->seesAllBranches()) {
            $query->whereHas('monthlyReport', function ($q) use ($user) {
                $q->where('branch_id', $user->branch_id);
            });
        }

        // Filter cabang opsional (hanya berlaku untuk yang melihat semua cabang)
        $branchFilter = $request->input('branch_id');
        if ($branchFilter && $user->seesAllBranches()) {
            $query->whereHas('monthlyReport', function ($q) use ($branchFilter) {
                $q->where('branch_id', $branchFilter);
            });
        }

        $logs = $query
            ->orderBy('date')
            ->orderBy('time')
            ->get()
            ->map(function ($log) {
                return [
                    'id'           => $log->id,
                    'date'         => $log->date instanceof \Carbon\CarbonInterface
                        ? $log->date->toDateString()
                        : (string) $log->date,
                    'time'         => $log->time,
                    'speaker'      => $log->speaker,
                    'location'     => $log->location,
                    'level'        => $log->level,
                    'status'       => $log->status ?? 'done',
                    'commitment'   => (int) $log->commitment,
                    'realization'  => (int) $log->realization,
                    'cost'         => (int) ($log->cost ?? 0),
                    'has_mou'      => (bool) ($log->has_mou ?? false),
                    'notes'        => $log->notes,
                    'branch_id'    => $log->monthlyReport?->branch_id,
                    'branch_name'  => $log->monthlyReport?->branch?->name ?? '-',
                ];
            })
            ->values();

        $branches = $user->seesAllBranches()
            ? Branch::orderBy('name')->get(['id', 'name'])
            : Branch::where('id', $user->branch_id)->get(['id', 'name']);

        return Inertia::render('SafariCalendar/Index', [
            'month'        => $start->format('Y-m'),
            'logs'         => $logs,
            'branches'     => $branches,
            'branchFilter' => $branchFilter,
            'canSeeAll'    => $user->seesAllBranches(),
        ]);
    }
}