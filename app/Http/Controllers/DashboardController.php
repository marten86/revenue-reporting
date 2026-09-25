<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\MonthlyCost;
use App\Models\RevenueDetail;
use App\Models\DailyRevenue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Carbon\Carbon;

class DashboardController extends Controller
{
    // -
    // Dashboard Area Manager
    // v20260925-dashboard-null: capaian tanpa target & rasio tanpa revenue = null (UI "—")
    // -

    public function area(Request $request): Response
    {
        $user        = $request->user();
        $periodMonth = $request->get('month', now()->format('Y-m-01'));

        $branches = $user->accessibleBranches()->with([
            'monthlyReports' => fn($q) => $q->where('period_month', $periodMonth),
            'targets'        => fn($q) => $q->where('period_month', $periodMonth),
            'monthlyCosts'   => fn($q) => $q->where('period_month', $periodMonth),
        ])->get();

        $branchData = $branches->map(function (Branch $b) {
            $report       = $b->monthlyReports->first();
            $target       = $b->targets->first();
            $cost         = $b->monthlyCosts->first();
            $targetAmount = $target?->target_total ?? 0;
            $totalRevenue = $report?->total_revenue ?? 0;
            $totalCost    = $cost?->total_cost ?? 0;
            $costRatio    = $totalRevenue > 0 ? round($totalCost / $totalRevenue * 100, 1) : null;

            return [
                'id'              => $b->id,
                'name'            => $b->name,
                'code'            => $b->code,
                'city'            => $b->city,
                'report_id'       => $report?->id,
                'status'          => $report?->status ?? 'no_report',
                'target_amount'   => $targetAmount,
                'total_revenue'   => $totalRevenue,
                'total_cost'      => $totalCost,
                'cost_ratio'      => $costRatio,
                'achievement_pct' => $targetAmount > 0
                    ? round($totalRevenue / $targetAmount * 100, 2)
                    : null,
            ];
        })->sortByDesc('total_revenue')->values();

        $totalRevenue = $branchData->sum('total_revenue');
        $totalCost    = $branchData->sum('total_cost');
        $costRatio    = $totalRevenue > 0 ? round($totalCost / $totalRevenue * 100, 1) : null;

        $summary = [
            'total_revenue'     => $totalRevenue,
            'total_target'      => $branchData->sum('target_amount'),
            'total_cost'        => $totalCost,
            'cost_ratio'        => $costRatio,
            'achievement_pct'   => $branchData->sum('target_amount') > 0
                ? round($totalRevenue / $branchData->sum('target_amount') * 100, 2)
                : null,
            'reports_submitted' => $branchData->whereNotIn('status', ['no_report', 'draft'])->count(),
            'reports_total'     => $branches->count(),
        ];

        // - Super Admin: tambahkan data per area -
        $areaSummary = null;
        if ($user->isSuperAdmin()) {
            $areaSummary = $this->buildAreaSummary($periodMonth);
        }

        // - Area label untuk header -
        $areaLabel = $user->isSuperAdmin()
            ? 'Nasional'
            : ($user->area?->name ?? 'Area');

        $branchIds        = $branches->pluck('id')->toArray();
        $monthlyTrend     = $this->buildMonthlyTrend($periodMonth, 6, $branchIds);
        $channelBreakdown = $this->buildChannelBreakdown($periodMonth, $branchIds);
        $dailyProgress    = $this->buildDailyProgress($periodMonth, $summary['total_target'], $branchIds);
        $topPerformers    = $this->buildTopPerformers($periodMonth, 10, $branchIds);
        $channelPerBranch = $this->buildChannelPerBranch($periodMonth, $branchIds);

        // v20260925-proyeksi: kartu Proyeksi + Status Input (hanya bulan berjalan)
        $isCurrentMonth = Carbon::parse($periodMonth)->format('Y-m') === Carbon::today()->format('Y-m');
        [$projection, $inputStatus] = $isCurrentMonth
            ? $this->buildPacing($periodMonth, $branches, (int) $summary['total_revenue'], (int) $summary['total_target'])
            : [null, null];

        $availableMonths = MonthlyReport::whereIn('branch_id', $branchIds)
            ->select('period_month')
            ->distinct()
            ->orderByDesc('period_month')
            ->limit(12)
            ->pluck('period_month')
            ->map(fn($m) => Carbon::parse($m)->format('Y-m-01'));

        return Inertia::render('Dashboard/Area', [
            'branches'         => $branchData,
            'summary'          => $summary,
            'areaSummary'      => $areaSummary,
            'areaLabel'        => $areaLabel,
            'isSuperAdmin'     => $user->isSuperAdmin(),
            'currentMonth'     => $periodMonth,
            'monthlyTrend'     => $monthlyTrend,
            'channelBreakdown' => $channelBreakdown,
            'dailyProgress'    => $dailyProgress,
            'topPerformers'    => $topPerformers,
            'channelPerBranch' => $channelPerBranch,
            'availableMonths'  => $availableMonths,
            'isCurrentMonth'   => $isCurrentMonth,
            'projection'       => $projection,
            'inputStatus'      => $inputStatus,
        ]);
    }

    /**
     * Proyeksi akhir bulan + status input per cabang — v20260925-proyeksi
     *
     * N (pembagi) = tanggal data terakhir yang masuk di area (opsi B), bukan hari ini,
     * agar keterlambatan input tidak menekan proyeksi.
     * "Data terakhir" = MAX(daily_revenues.date) dengan total_daily > 0.
     * Semua turunan dihitung di sini; JSX hanya menampilkan.
     */
    private function buildPacing(string $periodMonth, $branches, int $totalRevenue, int $totalTarget): array
    {
        $freshDays   = 2;
        $branchIds   = $branches->pluck('id')->toArray();
        $monthStart  = Carbon::parse($periodMonth)->startOfMonth();
        $daysInMonth = $monthStart->daysInMonth;
        $today       = Carbon::today();

        $lastDates = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->where('monthly_reports.period_month', $monthStart->toDateString())
            ->whereNull('monthly_reports.deleted_at')
            ->where('daily_revenues.total_daily', '>', 0)
            ->groupBy('monthly_reports.branch_id')
            ->select('monthly_reports.branch_id', DB::raw('MAX(daily_revenues.date) as last_date'))
            ->pluck('last_date', 'monthly_reports.branch_id');

        // - Status input per cabang -
        $fresh = 0;
        $stale = [];
        foreach ($branches as $b) {
            $last = $lastDates->get($b->id);
            $days = $last ? (int) Carbon::parse($last)->startOfDay()->diffInDays($today) : null;
            if ($days !== null && $days <= $freshDays) {
                $fresh++;
            } else {
                $stale[] = ['code' => $b->code, 'days_since' => $days];
            }
        }
        // Paling lama tertinggal di depan; "belum ada data" (null) paling depan
        usort($stale, fn($a, $b) => ($b['days_since'] ?? PHP_INT_MAX) <=> ($a['days_since'] ?? PHP_INT_MAX));

        $inputStatus = [
            'fresh'      => $fresh,
            'total'      => count($branches),
            'fresh_days' => $freshDays,
            'stale'      => $stale,
        ];

        // - Proyeksi -
        $maxDate = $lastDates->max();
        if (!$maxDate || $totalRevenue <= 0) {
            return [null, $inputStatus];
        }

        $dataUntil    = Carbon::parse($maxDate);
        $n            = $dataUntil->day;
        $projected    = (int) round($totalRevenue / $n * $daysInMonth);
        $remainingDay = $daysInMonth - $n;
        $shortfall    = $totalTarget - $totalRevenue;

        $projection = [
            'projected'     => $projected,
            'projected_pct' => $totalTarget > 0 ? round($projected / $totalTarget * 100, 1) : null,
            'need_per_day'  => ($totalTarget > 0 && $shortfall > 0 && $remainingDay > 0)
                ? (int) ceil($shortfall / $remainingDay)
                : null,
            'target_met'    => $totalTarget > 0 && $shortfall <= 0,
            'data_until'    => $dataUntil->toDateString(),
            'days_elapsed'  => $n,
            'days_in_month' => $daysInMonth,
        ];

        return [$projection, $inputStatus];
    }

    // -
    // Dashboard Branch Head
    // -

    public function branch(Request $request): Response
    {
        $user        = $request->user();
        $branch      = $user->branch;
        $periodMonth = $request->get('month', now()->format('Y-m-01'));

        if (!$branch) {
            return Inertia::render('Dashboard/Branch', [
                'branch' => null, 'report' => null, 'target' => null,
                'recentMonths' => [], 'currentMonth' => $periodMonth,
                'monthlyTrend' => [], 'channelBreakdown' => [],
                'dailyProgress' => [], 'topPerformers' => [],
                'availableMonths' => [],
            ]);
        }

        $report = $branch->reportForMonth($periodMonth);
        $target = $branch->targetForMonth($periodMonth);
        $cost   = $branch->costForMonth($periodMonth);

        $totalRevenue = $report?->total_revenue ?? 0;
        $targetAmount = $target?->target_total ?? 0;
        $totalCost    = $cost?->total_cost ?? 0;
        $costRatio    = $totalRevenue > 0 ? round($totalCost / $totalRevenue * 100, 1) : 0;

        $recentMonths = MonthlyReport::where('branch_id', $branch->id)
            ->orderByDesc('period_month')
            ->limit(6)
            ->get();

        $monthlyTrend = $this->buildBranchMonthlyTrend($branch->id, $periodMonth, 6);

        $channelBreakdown = [];
        if ($report) {
            $channelBreakdown = RevenueDetail::where('monthly_report_id', $report->id)
                ->select('channel', DB::raw('SUM(amount) as total'))
                ->groupBy('channel')
                ->orderByDesc('total')
                ->get()
                ->map(fn($r) => ['channel' => $r->channel, 'total' => (int) $r->total])
                ->toArray();
        }

        $dailyProgress = [];
        if ($report) {
            $dailyTotals = DailyRevenue::where('monthly_report_id', $report->id)
                ->orderBy('date')
                ->get();

            $daysInMonth     = Carbon::parse($periodMonth)->daysInMonth;
            $dailyTargetLine = $targetAmount > 0 ? round($targetAmount / $daysInMonth) : 0;
            $cumulative      = 0;

            foreach ($dailyTotals as $day) {
                $cumulative += (int) $day->total_daily;
                $dayNum = Carbon::parse($day->date)->day;
                $dailyProgress[] = [
                    'date'              => $day->date,
                    'day'               => $dayNum,
                    'daily'             => (int) $day->total_daily,
                    'cumulative'        => $cumulative,
                    'cumulative_target' => $dailyTargetLine * $dayNum,
                ];
            }
        }

        $topPerformers = [];
        if ($report) {
            $topPerformers = RevenueDetail::where('monthly_report_id', $report->id)
                ->whereNotNull('source_label')
                ->select('source_label', 'channel', DB::raw('SUM(amount) as total'))
                ->groupBy('source_label', 'channel')
                ->orderByDesc('total')
                ->limit(10)
                ->get()
                ->map(fn($r) => [
                    'source_label' => $r->source_label,
                    'channel'      => $r->channel,
                    'total'        => (int) $r->total,
                ])
                ->toArray();
        }

        $availableMonths = MonthlyReport::where('branch_id', $branch->id)
            ->select('period_month')
            ->distinct()
            ->orderByDesc('period_month')
            ->limit(12)
            ->pluck('period_month')
            ->map(fn($m) => Carbon::parse($m)->format('Y-m-01'));

        return Inertia::render('Dashboard/Branch', [
            'branch'           => $branch->load('area'),
            'report'           => $report,
            'target'           => $target,
            'recentMonths'     => $recentMonths,
            'currentMonth'     => $periodMonth,
            'monthlyTrend'     => $monthlyTrend,
            'channelBreakdown' => $channelBreakdown,
            'dailyProgress'    => $dailyProgress,
            'topPerformers'    => $topPerformers,
            'availableMonths'  => $availableMonths,
            'costData'         => [
                'total_cost'  => $totalCost,
                'cost_ratio'  => $costRatio,
            ],
        ]);
    }

    // -
    // Helper: Area Summary (Super Admin only)
    // -

    private function buildAreaSummary(string $periodMonth): array
    {
        $areas = Area::with([
            'branches.monthlyReports' => fn($q) => $q->where('period_month', $periodMonth),
            'branches.targets'        => fn($q) => $q->where('period_month', $periodMonth),
            'branches.monthlyCosts'   => fn($q) => $q->where('period_month', $periodMonth),
        ])->orderBy('name')->get();

        return $areas->map(function (Area $area) {
            $branches     = $area->branches;
            $totalRevenue = 0;
            $totalTarget  = 0;
            $totalCost    = 0;
            $statusCounts = ['no_report' => 0, 'draft' => 0, 'submitted' => 0, 'approved' => 0];

            foreach ($branches as $branch) {
                $report = $branch->monthlyReports->first();
                $target = $branch->targets->first();
                $cost   = $branch->monthlyCosts->first();

                $totalRevenue += $report?->total_revenue ?? 0;
                $totalTarget  += $target?->target_total ?? 0;
                $totalCost    += $cost?->total_cost ?? 0;

                $status = $report?->status ?? 'no_report';
                $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
            }

            $achievement = $totalTarget > 0
                ? round($totalRevenue / $totalTarget * 100, 1)
                : null;

            $costRatio = $totalRevenue > 0
                ? round($totalCost / $totalRevenue * 100, 1)
                : null;

            return [
                'id'             => $area->id,
                'name'           => $area->name,
                'code'           => $area->code,
                'branch_count'   => $branches->count(),
                'total_revenue'  => $totalRevenue,
                'total_target'   => $totalTarget,
                'total_cost'     => $totalCost,
                'cost_ratio'     => $costRatio,
                'achievement'    => $achievement,
                'status_counts'  => $statusCounts,
                'is_active'      => $area->is_active,
            ];
        })->toArray();
    }

    // -
    // Helper methods - AREA (scoped by branchIds)
    // -

    private function buildMonthlyTrend(string $currentMonth, int $months = 6, array $branchIds = []): array
    {
        $trend = [];
        $date  = Carbon::parse($currentMonth);

        for ($i = $months - 1; $i >= 0; $i--) {
            $month = $date->copy()->subMonths($i)->format('Y-m-01');

            $revenueQuery = MonthlyReport::where('period_month', $month);
            $targetQuery  = DB::table('branch_targets')->where('period_month', $month);
            $costQuery    = DB::table('monthly_costs')->where('period_month', $month)->whereNull('deleted_at');

            if (!empty($branchIds)) {
                $revenueQuery->whereIn('branch_id', $branchIds);
                $targetQuery->whereIn('branch_id', $branchIds);
                $costQuery->whereIn('branch_id', $branchIds);
            }

            $revenue = (int) $revenueQuery->sum('total_revenue');
            $cost    = (int) $costQuery->sum('total_cost');

            $trend[] = [
                'month'      => $month,
                'label'      => Carbon::parse($month)->translatedFormat('M Y'),
                'revenue'    => $revenue,
                'target'     => (int) $targetQuery->sum('target_total'),
                'cost'       => $cost,
                'cost_ratio' => $revenue > 0 ? round($cost / $revenue * 100, 1) : null,
            ];
        }

        return $trend;
    }

    private function buildChannelBreakdown(string $periodMonth, array $branchIds = []): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)
            ->when(!empty($branchIds), fn($q) => $q->whereIn('branch_id', $branchIds))
            ->pluck('id');

        if ($reportIds->isEmpty()) return [];

        return RevenueDetail::whereIn('monthly_report_id', $reportIds)
            ->select('channel', DB::raw('SUM(amount) as total'))
            ->groupBy('channel')
            ->orderByDesc('total')
            ->get()
            ->map(fn($r) => ['channel' => $r->channel, 'total' => (int) $r->total])
            ->toArray();
    }

    private function buildDailyProgress(string $periodMonth, int $monthlyTarget, array $branchIds = []): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)
            ->when(!empty($branchIds), fn($q) => $q->whereIn('branch_id', $branchIds))
            ->pluck('id');

        if ($reportIds->isEmpty()) return [];

        $dailyTotals = DailyRevenue::whereIn('monthly_report_id', $reportIds)
            ->select('date', DB::raw('SUM(total_daily) as daily_total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $daysInMonth     = Carbon::parse($periodMonth)->daysInMonth;
        $dailyTargetLine = $monthlyTarget > 0 ? round($monthlyTarget / $daysInMonth) : 0;
        $cumulative      = 0;
        $progress        = [];

        foreach ($dailyTotals as $day) {
            $cumulative += (int) $day->daily_total;
            $dayNum = Carbon::parse($day->date)->day;

            $progress[] = [
                'date'              => $day->date,
                'day'               => $dayNum,
                'daily'             => (int) $day->daily_total,
                'cumulative'        => $cumulative,
                'cumulative_target' => $dailyTargetLine * $dayNum,
            ];
        }

        return $progress;
    }

    private function buildTopPerformers(string $periodMonth, int $limit = 10, array $branchIds = []): array
    {
        $reportIds = MonthlyReport::where('period_month', $periodMonth)
            ->when(!empty($branchIds), fn($q) => $q->whereIn('branch_id', $branchIds))
            ->pluck('id');

        if ($reportIds->isEmpty()) return [];

        return RevenueDetail::whereIn('monthly_report_id', $reportIds)
            ->whereNotNull('source_label')
            ->select('source_label', 'channel', DB::raw('SUM(amount) as total'))
            ->groupBy('source_label', 'channel')
            ->orderByDesc('total')
            ->limit($limit)
            ->get()
            ->map(fn($r) => [
                'source_label' => $r->source_label,
                'channel'      => $r->channel,
                'total'        => (int) $r->total,
            ])
            ->toArray();
    }

    private function buildChannelPerBranch(string $periodMonth, array $branchIds = []): array
    {
        $reports = MonthlyReport::where('period_month', $periodMonth)
            ->when(!empty($branchIds), fn($q) => $q->whereIn('branch_id', $branchIds))
            ->with('branch:id,name,code')
            ->get();

        if ($reports->isEmpty()) return [];

        $result = [];
        foreach ($reports as $report) {
            $channels = RevenueDetail::where('monthly_report_id', $report->id)
                ->select('channel', DB::raw('SUM(amount) as total'))
                ->groupBy('channel')
                ->pluck('total', 'channel')
                ->toArray();

            $row = [
                'branch'      => $report->branch?->name ?? 'Unknown',
                'branch_code' => $report->branch?->code ?? '',
            ];

            // Kanal aktif baru (kotak & qris dipisah)
            foreach (['presentasi', 'gerai', 'wgts', 'dfi', 'dfe', 'kotak', 'qris', 'kantor'] as $ch) {
                $row[$ch] = (int) ($channels[$ch] ?? 0);
            }

            // Kanal lama - gabungkan ke kotak untuk total (agar data historis tetap terhitung)
            // Ditampilkan terpisah jika frontend butuh, tapi tidak dobel-hitung di total
            $row['kotak_qris_legacy'] = (int) ($channels['kotak_qris'] ?? 0);

            $row['total'] = $row['presentasi'] + $row['gerai'] + $row['wgts']
                + $row['dfi'] + $row['dfe'] + $row['kotak'] + $row['qris']
                + $row['kotak_qris_legacy'] + $row['kantor'];

            $result[] = $row;
        }

        usort($result, fn($a, $b) => $b['total'] - $a['total']);
        return $result;
    }

    // -
    // Helper methods - BRANCH (1 cabang)
    // -

    private function buildBranchMonthlyTrend(string $branchId, string $currentMonth, int $months = 6): array
    {
        $trend = [];
        $date  = Carbon::parse($currentMonth);

        for ($i = $months - 1; $i >= 0; $i--) {
            $month = $date->copy()->subMonths($i)->format('Y-m-01');

            $report = MonthlyReport::where('branch_id', $branchId)
                ->where('period_month', $month)
                ->first();

            $target = DB::table('branch_targets')
                ->where('branch_id', $branchId)
                ->where('period_month', $month)
                ->value('target_total');

            $cost = DB::table('monthly_costs')
                ->where('branch_id', $branchId)
                ->where('period_month', $month)
                ->whereNull('deleted_at')
                ->value('total_cost');

            $revenue   = (int) ($report?->total_revenue ?? 0);
            $costTotal = (int) ($cost ?? 0);

            $trend[] = [
                'month'      => $month,
                'label'      => Carbon::parse($month)->translatedFormat('M Y'),
                'revenue'    => $revenue,
                'target'     => (int) ($target ?? 0),
                'cost'       => $costTotal,
                'cost_ratio' => $revenue > 0 ? round($costTotal / $revenue * 100, 1) : 0,
            ];
        }

        return $trend;
    }
}