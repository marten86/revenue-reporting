<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchTarget;
use App\Models\DailyRevenue;
use App\Models\MonthlyReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $period = $request->get('period', 'monthly');
        $year = (int) $request->get('year', now()->year);
        $month = (int) $request->get('month', now()->month);
        $quarter = (int) $request->get('quarter', ceil(now()->month / 3));
        $branchId = $request->get('branch_id', 'all');
        $channel = $request->get('channel', 'all');

        // Accessible branches per role
        $branches = $user->accessibleBranches()->where('is_active', true)->get();
        $branchIds = $branches->pluck('id')->toArray();

        // Filter branch
        $filteredBranchIds = ($branchId !== 'all' && in_array($branchId, $branchIds))
            ? [$branchId]
            : $branchIds;

        $data = match($period) {
            'weekly'    => $this->getWeeklyData($year, $month, $filteredBranchIds, $channel),
            'quarterly' => $this->getQuarterlyData($year, $quarter, $filteredBranchIds, $channel),
            'yearly'    => $this->getYearlyData($year, $filteredBranchIds, $channel),
            default     => $this->getMonthlyData($year, $month, $filteredBranchIds, $channel),
        };

        return Inertia::render('Analytics/Index', [
            'branches'   => $branches,
            'channels'   => \App\Models\MonthlyReport::CHANNELS,
            'period'     => $period,
            'year'       => $year,
            'month'      => $month,
            'quarter'    => $quarter,
            'branchId'   => $branchId,
            'channel'    => $channel,
            'summary'    => $data['summary'],
            'chartMain'  => $data['chartMain'],
            'byChannel'  => $data['byChannel'],
            'byBranch'   => $data['byBranch'],
            'tableData'  => $data['tableData'],
        ]);
    }

    // ─── MONTHLY ────────────────────────────────────────────────────────────
    private function getMonthlyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth();

        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$startDate, $endDate]);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        $dailyData = $query->select('date', DB::raw('SUM(total_amount) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Weekly grouping
        $weeklyData = $dailyData->groupBy(fn($d) => Carbon::parse($d->date)->weekOfMonth);

        // Target per day (monthly target / days in month)
        $targetTotal = $this->getTargetTotal($year, $month, null, $branchIds, $channel);
        $daysInMonth = $endDate->day;
        $dailyTarget = $daysInMonth > 0 ? $targetTotal / $daysInMonth : 0;

        $chartMain = $dailyData->map(fn($d) => [
            'date'   => Carbon::parse($d->date)->format('d'),
            'label'  => Carbon::parse($d->date)->translatedFormat('d M'),
            'actual' => (int) $d->total,
            'target' => (int) $dailyTarget,
        ])->values()->toArray();

        return [
            'summary'   => $this->buildSummary($dailyData->sum('total'), $targetTotal, $year, $month, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($year, $month, null, $branchIds),
            'byBranch'  => $this->getByBranch($year, $month, null, $branchIds, $channel),
            'tableData' => $this->getMonthlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── WEEKLY ─────────────────────────────────────────────────────────────
    private function getWeeklyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth();

        // Get current week range within the month
        $weekStart = now()->startOfWeek(Carbon::MONDAY);
        $weekEnd   = now()->endOfWeek(Carbon::SUNDAY);

        // Clamp to month boundaries
        $weekStart = $weekStart->lt($startDate) ? $startDate->copy() : $weekStart;
        $weekEnd   = $weekEnd->gt($endDate) ? $endDate->copy() : $weekEnd;

        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$weekStart, $weekEnd]);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        $dailyData = $query->select('date', DB::raw('SUM(total_amount) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $targetTotal  = $this->getTargetTotal($year, $month, null, $branchIds, $channel);
        $daysInMonth  = $endDate->day;
        $weekDays     = $weekStart->diffInDays($weekEnd) + 1;
        $weeklyTarget = $daysInMonth > 0 ? ($targetTotal / $daysInMonth) * $weekDays : 0;

        $dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
        $chartMain = [];
        for ($d = $weekStart->copy(); $d->lte($weekEnd); $d->addDay()) {
            $found = $dailyData->firstWhere('date', $d->format('Y-m-d'));
            $chartMain[] = [
                'label'  => $dayNames[$d->dayOfWeek === 0 ? 6 : $d->dayOfWeek - 1],
                'date'   => $d->format('d M'),
                'actual' => $found ? (int) $found->total : 0,
                'target' => (int) ($weeklyTarget / $weekDays),
            ];
        }

        $actualTotal = $dailyData->sum('total');

        return [
            'summary'   => $this->buildSummary($actualTotal, $weeklyTarget, $year, $month, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($year, $month, null, $branchIds),
            'byBranch'  => $this->getByBranch($year, $month, null, $branchIds, $channel),
            'tableData' => $this->getMonthlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── QUARTERLY ──────────────────────────────────────────────────────────
    private function getQuarterlyData(int $year, int $quarter, array $branchIds, string $channel): array
    {
        $months     = [($quarter - 1) * 3 + 1, ($quarter - 1) * 3 + 2, ($quarter - 1) * 3 + 3];
        $startDate  = Carbon::create($year, $months[0], 1)->startOfMonth();
        $endDate    = Carbon::create($year, $months[2], 1)->endOfMonth();

        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$startDate, $endDate]);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        $monthlyData = $query->select(
                DB::raw("TO_CHAR(date, 'YYYY-MM') as month"),
                DB::raw('SUM(total_amount) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $chartMain  = [];

        foreach ($months as $m) {
            $key   = Carbon::create($year, $m, 1)->format('Y-m');
            $found = $monthlyData->firstWhere('month', $key);
            $target = $this->getTargetTotal($year, $m, null, $branchIds, $channel);
            $chartMain[] = [
                'label'  => $monthNames[$m - 1],
                'actual' => $found ? (int) $found->total : 0,
                'target' => (int) $target,
            ];
        }

        $actualTotal = $monthlyData->sum('total');
        $targetTotal = array_sum(array_map(fn($m) => $this->getTargetTotal($year, $m, null, $branchIds, $channel), $months));

        return [
            'summary'   => $this->buildSummary($actualTotal, $targetTotal, $year, null, $quarter, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannelRange($startDate, $endDate, $branchIds),
            'byBranch'  => $this->getByBranchRange($startDate, $endDate, $branchIds, $channel),
            'tableData' => $this->getMonthlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── YEARLY ─────────────────────────────────────────────────────────────
    private function getYearlyData(int $year, array $branchIds, string $channel): array
    {
        $startDate = Carbon::create($year, 1, 1)->startOfYear();
        $endDate   = Carbon::create($year, 12, 31)->endOfYear();

        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$startDate, $endDate]);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        $monthlyData = $query->select(
                DB::raw("TO_CHAR(date, 'YYYY-MM') as month"),
                DB::raw('SUM(total_amount) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $chartMain  = [];
        $prevTotal  = null;

        for ($m = 1; $m <= 12; $m++) {
            $key    = Carbon::create($year, $m, 1)->format('Y-m');
            $found  = $monthlyData->firstWhere('month', $key);
            $actual = $found ? (int) $found->total : 0;
            $target = $this->getTargetTotal($year, $m, null, $branchIds, $channel);
            $growth = ($prevTotal && $prevTotal > 0) ? round(($actual - $prevTotal) / $prevTotal * 100, 1) : null;

            $chartMain[] = [
                'label'  => $monthNames[$m - 1],
                'actual' => $actual,
                'target' => (int) $target,
                'growth' => $growth,
            ];
            $prevTotal = $actual ?: $prevTotal;
        }

        $actualTotal = $monthlyData->sum('total');
        $targetTotal = array_sum(array_map(fn($m) => $this->getTargetTotal($year, $m, null, $branchIds, $channel), range(1, 12)));

        return [
            'summary'   => $this->buildSummary($actualTotal, $targetTotal, $year, null, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannelRange($startDate, $endDate, $branchIds),
            'byBranch'  => $this->getByBranchRange($startDate, $endDate, $branchIds, $channel),
            'tableData' => $this->getMonthlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── HELPERS ────────────────────────────────────────────────────────────
    private function getTargetTotal(int $year, int $month, ?int $quarter, array $branchIds, string $channel): float
    {
        $query = BranchTarget::whereIn('branch_id', $branchIds)
            ->where('year', $year)
            ->where('month', $month);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        return (float) $query->sum('target_amount');
    }

    private function buildSummary(float $actual, float $target, int $year, ?int $month, ?int $quarter, array $branchIds, string $channel): array
    {
        $pct = $target > 0 ? round($actual / $target * 100, 1) : 0;

        // Growth: compare with previous period
        $prevActual = 0;
        if ($month) {
            $prevMonth  = $month === 1 ? 12 : $month - 1;
            $prevYear   = $month === 1 ? $year - 1 : $year;
            $prevStart  = Carbon::create($prevYear, $prevMonth, 1)->startOfMonth();
            $prevEnd    = Carbon::create($prevYear, $prevMonth, 1)->endOfMonth();
            $prevActual = $this->sumRevenue($prevStart, $prevEnd, $branchIds, $channel);
        }

        $growth = $prevActual > 0 ? round(($actual - $prevActual) / $prevActual * 100, 1) : null;

        return [
            'total_revenue' => (int) $actual,
            'target'        => (int) $target,
            'achievement'   => $pct,
            'growth'        => $growth,
        ];
    }

    private function sumRevenue(Carbon $start, Carbon $end, array $branchIds, string $channel): float
    {
        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$start, $end]);

        if ($channel !== 'all') {
            $query->where('channel', $channel);
        }

        return (float) $query->sum('total_amount');
    }

    private function getByChannel(int $year, int $month, ?int $quarter, array $branchIds): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth();
        return $this->getByChannelRange($startDate, $endDate, $branchIds);
    }

    private function getByChannelRange(Carbon $start, Carbon $end, array $branchIds): array
    {
        return DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$start, $end])
            ->select('channel', DB::raw('SUM(total_amount) as total'))
            ->groupBy('channel')
            ->get()
            ->map(fn($r) => ['channel' => $r->channel, 'total' => (int) $r->total])
            ->toArray();
    }

    private function getByBranch(int $year, int $month, ?int $quarter, array $branchIds, string $channel): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate   = Carbon::create($year, $month, 1)->endOfMonth();
        return $this->getByBranchRange($startDate, $endDate, $branchIds, $channel);
    }

    private function getByBranchRange(Carbon $start, Carbon $end, array $branchIds, string $channel): array
    {
        $query = DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds))
            ->whereBetween('date', [$start, $end])
            ->select(
                'monthly_reports.branch_id',
                DB::raw('SUM(daily_revenues.total_amount) as total')
            )
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->groupBy('monthly_reports.branch_id');

        if ($channel !== 'all') {
            $query->where('daily_revenues.channel', $channel);
        }

        $results  = $query->get();
        $branches = Branch::whereIn('id', $branchIds)->get()->keyBy('id');

        return $results->map(fn($r) => [
            'branch_id'   => $r->branch_id,
            'branch_name' => $branches[$r->branch_id]->name ?? '?',
            'total'       => (int) $r->total,
        ])->toArray();
    }

    private function getMonthlyTable(int $year, array $branchIds, string $channel): array
    {
        $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $branches   = Branch::whereIn('id', $branchIds)->get();
        $rows       = [];

        foreach ($branches as $branch) {
            $row = ['branch' => $branch->name, 'months' => [], 'total' => 0];

            for ($m = 1; $m <= 12; $m++) {
                $start  = Carbon::create($year, $m, 1)->startOfMonth();
                $end    = Carbon::create($year, $m, 1)->endOfMonth();
                $actual = $this->sumRevenue($start, $end, [$branch->id], $channel);
                $target = $this->getTargetTotal($year, $m, null, [$branch->id], $channel);

                $row['months'][] = [
                    'label'  => $monthNames[$m - 1],
                    'actual' => (int) $actual,
                    'target' => (int) $target,
                    'pct'    => $target > 0 ? round($actual / $target * 100, 1) : 0,
                ];
                $row['total'] += $actual;
            }

            $rows[] = $row;
        }

        return $rows;
    }
}