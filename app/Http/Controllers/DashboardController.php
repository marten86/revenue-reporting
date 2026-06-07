<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\RevenueDetail;
use App\Models\DailyRevenue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function area(Request $request): Response
    {
        $user        = $request->user();
        $periodMonth = $request->get('month', now()->format('Y-m-01'));

        // ── 1. Branch comparison (existing) ──
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

        // ── 2. Monthly trend (6 bulan terakhir) ──
        $monthlyTrend = $this->buildMonthlyTrend($periodMonth, 6);

        // ── 3. Channel breakdown (bulan ini, semua cabang) ──
        $channelBreakdown = $this->buildChannelBreakdown($periodMonth);

        // ── 4. Daily progress (bulan ini, semua cabang) ──
        $dailyProgress = $this->buildDailyProgress($periodMonth, $summary['total_target']);

        // ── 5. Top performers (bulan ini) ──
        $topPerformers = $this->buildTopPerformers($periodMonth);

        // ── 6. Channel per branch (bulan ini) ──
        $channelPerBranch = $this->buildChannelPerBranch($periodMonth);

        // ── 7. Available months for selector ──
        $availableMonths = MonthlyReport::select('period_month')
            ->distinct()
            ->orderByDesc('period_month')
            ->limit(12)
            ->pluck('period_month')
            ->map(fn($m) => Carbon::parse($m)->format('Y-m-01'));

        return Inertia::render('Dashboard/Area', [
            'branches'         => $branchData,
            'summary'          => $summary,
            'currentMonth'     => $periodMonth,
            'monthlyTrend'     => $monthlyTrend,
            'channelBreakdown' => $channelBreakdown,
            'dailyProgress'    => $dailyProgress,
            'topPerformers'    => $topPerformers,
            'channelPerBranch' => $channelPerBranch,
            'availableMonths'  => $availableMonths,
        ]);
    }

    /**
     * Tren revenue 6 bulan terakhir (semua cabang)
     */
    private function buildMonthlyTrend(string $currentMonth, int $months = 6): array
    {
        $trend = [];
        $date = Carbon::parse($currentMonth);

        for ($i = $months - 1; $i >= 0; $i--) {
            $month = $date->copy()->subMonths($i)->format('Y-m-01');

            $revenue = MonthlyReport::where('period_month', $month)->sum('total_revenue');

            $target = DB::table('branch_targets')
                ->where('period_month', $month)
                ->sum('target_total');

            $trend[] = [
                'month'   => $month,
                'label'   => Carbon::parse($month)->translatedFormat('M Y'),
                'revenue' => (int) $revenue,
                'target'  => (int) $target,
            ];
        }

        return $trend;
    }

    /**
     * Breakdown revenue per kanal (bulan tertentu, semua cabang)
     */
    private function buildChannelBreakdown(string $periodMonth): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)->pluck('id');

        if ($reportIds->isEmpty()) {
            return [];
        }

        $breakdown = RevenueDetail::whereIn('monthly_report_id', $reportIds)
            ->select('channel', DB::raw('SUM(amount) as total'))
            ->groupBy('channel')
            ->orderByDesc('total')
            ->get()
            ->map(fn($row) => [
                'channel' => $row->channel,
                'total'   => (int) $row->total,
            ])
            ->toArray();

        return $breakdown;
    }

    /**
     * Progress harian kumulatif (bulan tertentu, semua cabang)
     */
    private function buildDailyProgress(string $periodMonth, int $monthlyTarget): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)->pluck('id');

        if ($reportIds->isEmpty()) {
            return [];
        }

        $dailyTotals = DailyRevenue::whereIn('monthly_report_id', $reportIds)
            ->select('date', DB::raw('SUM(total_daily) as daily_total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $daysInMonth = Carbon::parse($periodMonth)->daysInMonth;
        $dailyTargetLine = $monthlyTarget > 0 ? round($monthlyTarget / $daysInMonth) : 0;

        $cumulative = 0;
        $cumulativeTarget = 0;
        $progress = [];

        foreach ($dailyTotals as $day) {
            $cumulative += (int) $day->daily_total;
            $dayNum = Carbon::parse($day->date)->day;
            $cumulativeTarget = $dailyTargetLine * $dayNum;

            $progress[] = [
                'date'              => $day->date,
                'day'               => $dayNum,
                'daily'             => (int) $day->daily_total,
                'cumulative'        => $cumulative,
                'cumulative_target' => $cumulativeTarget,
            ];
        }

        return $progress;
    }

    /**
     * Top performers — tim/sumber dengan revenue tertinggi
     */
    private function buildTopPerformers(string $periodMonth, int $limit = 10): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)->pluck('id');

        if ($reportIds->isEmpty()) {
            return [];
        }

        $performers = RevenueDetail::whereIn('monthly_report_id', $reportIds)
            ->whereNotNull('source_label')
            ->select(
                'source_label',
                'channel',
                DB::raw('SUM(amount) as total')
            )
            ->groupBy('source_label', 'channel')
            ->orderByDesc('total')
            ->limit($limit)
            ->get()
            ->map(fn($row) => [
                'source_label' => $row->source_label,
                'channel'      => $row->channel,
                'total'        => (int) $row->total,
            ])
            ->toArray();

        return $performers;
    }

    /**
     * Revenue per channel per branch (untuk stacked bar chart)
     */
    private function buildChannelPerBranch(string $periodMonth): array
    {
        $reports = MonthlyReport::where('period_month', $periodMonth)
            ->with('branch:id,name,code')
            ->get();

        if ($reports->isEmpty()) {
            return [];
        }

        $result = [];
        foreach ($reports as $report) {
            $channels = RevenueDetail::where('monthly_report_id', $report->id)
                ->select('channel', DB::raw('SUM(amount) as total'))
                ->groupBy('channel')
                ->pluck('total', 'channel')
                ->toArray();

            $row = [
                'branch'     => $report->branch?->name ?? 'Unknown',
                'branch_code' => $report->branch?->code ?? '',
            ];

            foreach (['presentasi', 'gerai', 'wgts', 'dfi', 'dfe', 'kotak_qris', 'kantor'] as $ch) {
                $row[$ch] = (int) ($channels[$ch] ?? 0);
            }

            $row['total'] = array_sum(array_slice($row, 2));
            $result[] = $row;
        }

        usort($result, fn($a, $b) => $b['total'] - $a['total']);

        return $result;
    }

    // ── Dashboard Branch Head (existing) ──
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