<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MonthlyReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    // Dashboard Area Manager
    public function area(Request $request): Response
    {
        $user        = $request->user();
        $periodMonth = now()->format('Y-m-01');

        $branches = Branch::with([
            'monthlyReports' => fn($q) => $q->where('period_month', $periodMonth),
            'targets'        => fn($q) => $q->where('period_month', $periodMonth),
        ])->get();

        $branchData = $branches->map(function (Branch $b) {
            $report       = $b->monthlyReports->first();
            $target       = $b->targets->first();
            $targetAmount = $target?->target_total ?? 0;
            $totalRevenue = $report?->total_revenue ?? 0;

            return [
                'id'              => $b->id,
                'name'            => $b->name,
                'code'            => $b->code,
                'city'            => $b->city,
                'report_id'       => $report?->id,
                'status'          => $report?->status ?? 'no_report',
                'target_amount'   => $targetAmount,
                'total_revenue'   => $totalRevenue,
                'achievement_pct' => $targetAmount > 0
                    ? round($totalRevenue / $targetAmount * 100, 2)
                    : 0,
            ];
        })->sortByDesc('total_revenue')->values();

        $summary = [
            'total_revenue'     => $branchData->sum('total_revenue'),
            'total_target'      => $branchData->sum('target_amount'),
            'achievement_pct'   => $branchData->sum('target_amount') > 0
                ? round($branchData->sum('total_revenue') / $branchData->sum('target_amount') * 100, 2)
                : 0,
            'reports_submitted' => $branchData->whereNotIn('status', ['no_report', 'draft'])->count(),
            'reports_total'     => $branches->count(),
        ];

        return Inertia::render('Dashboard/Area', [
            'branches'     => $branchData,
            'summary'      => $summary,
            'currentMonth' => $periodMonth,
        ]);
    }

    // Dashboard Branch Head
    public function branch(Request $request): Response
    {
        $user        = $request->user();
        $branch      = $user->branch;
        $periodMonth = now()->format('Y-m-01');

        $report = $branch?->reportForMonth($periodMonth);
        $target = $branch?->targetForMonth($periodMonth);

        $recentMonths = MonthlyReport::where('branch_id', $branch?->id)
            ->orderByDesc('period_month')
            ->limit(6)
            ->get();

        return Inertia::render('Dashboard/Branch', [
            'branch'       => $branch?->load('area'),
            'report'       => $report,
            'target'       => $target,
            'recentMonths' => $recentMonths,
            'currentMonth' => $periodMonth,
        ]);
    }
}