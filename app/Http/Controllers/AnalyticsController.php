<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchTarget;
use App\Models\MonthlyReport;
use App\Models\MonthlyCost;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class AnalyticsController extends Controller
{
    private array $channelColumns = [
        'Presentasi'   => 'presentasi',
        'WGTS'         => 'wgts',
        'Gerai'        => 'gerai',
        'DFI (AR)'     => 'dfi',
        'DFE (AE)'     => 'dfe',
        'Kotak & QRIS' => 'kotak_qris',
        'Kantor'       => 'kantor',
    ];

    private array $channelTargetCols = [
        'Presentasi'   => 'target_presentasi',
        'WGTS'         => 'target_wgts',
        'Gerai'        => 'target_gerai',
        'DFI (AR)'     => 'target_dfi',
        'DFE (AE)'     => 'target_dfe',
        'Kotak & QRIS' => 'target_kotak_qris',
        'Kantor'       => 'target_kantor',
    ];

    private array $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

    // ─── ENTRY POINT ─────────────────────────────────────────────────────────
    public function index(Request $request)
    {
        $user     = auth()->user();
        $period   = $request->get('period', 'monthly');
        $year     = (int) $request->get('year', now()->year);
        $month    = (int) $request->get('month', now()->month);
        $quarter  = (int) $request->get('quarter', (int) ceil(now()->month / 3));
        $branchId = $request->get('branch_id', 'all');
        $areaId   = $request->get('area_id', 'all');
        $channel  = $request->get('channel', 'all');

        $branches = $user->accessibleBranches()->where('is_active', true)->get();
        $allIds   = $branches->pluck('id')->toArray();

        if ($areaId !== 'all' && $user->isSuperAdmin()) {
            $areaFilteredIds = $branches->where('area_id', $areaId)->pluck('id')->toArray();
            $branchIds = ($branchId !== 'all' && in_array($branchId, $areaFilteredIds))
                ? [$branchId]
                : $areaFilteredIds;
        } else {
            $branchIds = ($branchId !== 'all' && in_array($branchId, $allIds))
                ? [$branchId]
                : $allIds;
        }

        $areas = [];
        if ($user->isSuperAdmin()) {
            $areas = \App\Models\Area::orderBy('name')->get(['id', 'name', 'code'])->toArray();
        }

        $empty = [
            'summary'   => ['total_revenue' => 0, 'target' => 0, 'achievement' => 0, 'growth' => null, 'total_cost' => 0, 'cost_ratio' => 0],
            'chartMain' => [],
            'byChannel' => [],
            'byBranch'  => [],
            'tableData' => [],
        ];

        if (empty($branchIds)) {
            return Inertia::render('Analytics/Index', array_merge([
                'branches'     => $branches,
                'areas'        => $areas,
                'channels'     => \App\Models\MonthlyReport::CHANNELS,
                'period'       => $period,
                'year'         => $year,
                'month'        => $month,
                'quarter'      => $quarter,
                'branchId'     => $branchId,
                'areaId'       => $areaId,
                'channel'      => $channel,
                'isSuperAdmin' => $user->isSuperAdmin(),
            ], $empty));
        }

        $data = match($period) {
            'weekly'    => $this->getWeeklyData($year, $month, $branchIds, $channel),
            'quarterly' => $this->getQuarterlyData($year, $quarter, $branchIds, $channel),
            'yearly'    => $this->getYearlyData($year, $branchIds, $channel),
            default     => $this->getMonthlyData($year, $month, $branchIds, $channel),
        };

        // ── Tambah data cost ke summary ──────────────────────────────────────
        // Tentukan range tanggal berdasarkan periode
        [$costStart, $costEnd] = $this->getCostDateRange($period, $year, $month, $quarter);
        $totalCost = $this->getTotalCost($costStart, $costEnd, $branchIds);
        $totalRevenue = $data['summary']['total_revenue'];
        $costRatio = $totalRevenue > 0 ? round($totalCost / $totalRevenue * 100, 1) : 0;

        $data['summary']['total_cost']  = $totalCost;
        $data['summary']['cost_ratio']  = $costRatio;

        return Inertia::render('Analytics/Index', [
            'branches'     => $branches,
            'areas'        => $areas,
            'channels'     => \App\Models\MonthlyReport::CHANNELS,
            'period'       => $period,
            'year'         => $year,
            'month'        => $month,
            'quarter'      => $quarter,
            'branchId'     => $branchId,
            'areaId'       => $areaId,
            'channel'      => $channel,
            'isSuperAdmin' => $user->isSuperAdmin(),
            'summary'      => $data['summary'],
            'chartMain'    => $data['chartMain'],
            'byChannel'    => $data['byChannel'],
            'byBranch'     => $data['byBranch'],
            'tableData'    => $data['tableData'],
        ]);
    }

    // ── Helper: date range untuk query cost per periode ──────────────────────
    private function getCostDateRange(string $period, int $year, int $month, int $quarter): array
    {
        return match($period) {
            'weekly', 'monthly' => [
                sprintf('%04d-%02d-01', $year, $month),
                Carbon::create($year, $month, 1)->endOfMonth()->format('Y-m-d'),
            ],
            'quarterly' => [
                sprintf('%04d-%02d-01', $year, ($quarter - 1) * 3 + 1),
                Carbon::create($year, ($quarter - 1) * 3 + 3, 1)->endOfMonth()->format('Y-m-d'),
            ],
            'yearly' => [
                "$year-01-01",
                "$year-12-31",
            ],
            default => [
                sprintf('%04d-%02d-01', $year, $month),
                Carbon::create($year, $month, 1)->endOfMonth()->format('Y-m-d'),
            ],
        };
    }

    // ── Helper: total cost untuk range & branchIds tertentu ─────────────────
    private function getTotalCost(string $start, string $end, array $branchIds): int
    {
        return (int) DB::table('monthly_costs')
            ->whereIn('branch_id', $branchIds)
            ->whereNull('deleted_at')
            ->whereBetween('period_month', [$start, $end])
            ->sum('total_cost');
    }

    // ─── MONTHLY ─────────────────────────────────────────────────────────────
    private function getMonthlyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $start       = Carbon::create($year, $month, 1)->startOfMonth();
        $end         = Carbon::create($year, $month, 1)->endOfMonth();
        $col         = $this->revenueCol($channel);
        $targetTotal = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $daysInMonth = $end->daysInMonth;
        $dailyTarget = $daysInMonth > 0 ? round($targetTotal / $daysInMonth) : 0;

        $rows = $this->queryDaily($start->toDateString(), $end->toDateString(), $branchIds, $col)->keyBy('date');

        $chartMain   = [];
        $actualTotal = 0;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $key    = $d->toDateString();
            $found  = $rows->get($key);
            $actual = $found ? (int) $found->total : 0;
            $chartMain[] = [
                'label'  => $d->format('d M'),
                'actual' => $actual,
                'target' => (int) $dailyTarget,
            ];
            $actualTotal += $actual;
        }

        return [
            'summary'   => $this->buildSummaryMonthly($actualTotal, $targetTotal, $year, $month, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start->toDateString(), $end->toDateString(), $branchIds),
            'byBranch'  => $this->getByBranch($start->toDateString(), $end->toDateString(), $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── WEEKLY ──────────────────────────────────────────────────────────────
    private function getWeeklyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $monthStart  = Carbon::create($year, $month, 1)->startOfMonth();
        $monthEnd    = Carbon::create($year, $month, 1)->endOfMonth();
        $col         = $this->revenueCol($channel);
        $targetTotal = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $daysInMonth = $monthEnd->daysInMonth;

        $dailyRows = $this->queryDaily($monthStart->toDateString(), $monthEnd->toDateString(), $branchIds, $col)->keyBy('date');

        $weeks = [];
        $d     = $monthStart->copy()->startOfWeek(Carbon::MONDAY);
        if ($d->lt($monthStart)) $d = $monthStart->copy();

        while ($d->lte($monthEnd)) {
            $wStart     = $d->copy();
            $wEnd       = $d->copy()->endOfWeek(Carbon::SUNDAY);
            if ($wEnd->gt($monthEnd)) $wEnd = $monthEnd->copy();

            $weekDays   = $wStart->diffInDays($wEnd) + 1;
            $weekTarget = $daysInMonth > 0 ? round(($targetTotal / $daysInMonth) * $weekDays) : 0;
            $weekActual = 0;

            for ($day = $wStart->copy(); $day->lte($wEnd); $day->addDay()) {
                $found       = $dailyRows->get($day->toDateString());
                $weekActual += $found ? (int) $found->total : 0;
            }

            $weeks[] = [
                'label'  => 'W' . (count($weeks) + 1) . ' (' . $wStart->format('d') . '–' . $wEnd->format('d M') . ')',
                'actual' => $weekActual,
                'target' => (int) $weekTarget,
            ];

            $d = $wEnd->copy()->addDay();
        }

        $actualTotal = array_sum(array_column($weeks, 'actual'));
        $summary     = $this->buildSummaryMonthly((float) $actualTotal, (float) $targetTotal, $year, $month, $branchIds, $channel);

        return [
            'summary'   => $summary,
            'chartMain' => $weeks,
            'byChannel' => $this->getByChannel($monthStart->toDateString(), $monthEnd->toDateString(), $branchIds),
            'byBranch'  => $this->getByBranch($monthStart->toDateString(), $monthEnd->toDateString(), $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── QUARTERLY ───────────────────────────────────────────────────────────
    private function getQuarterlyData(int $year, int $quarter, array $branchIds, string $channel): array
    {
        $months = [($quarter - 1) * 3 + 1, ($quarter - 1) * 3 + 2, ($quarter - 1) * 3 + 3];
        $start  = Carbon::create($year, $months[0], 1)->startOfMonth()->toDateString();
        $end    = Carbon::create($year, $months[2], 1)->endOfMonth()->toDateString();
        $col    = $this->revenueCol($channel);

        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select(DB::raw("TO_CHAR(daily_revenues.date, 'YYYY-MM') as ym"), DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('ym')->orderBy('ym')->get()->keyBy('ym');

        $chartMain = []; $actualTotal = 0; $targetTotal = 0;

        foreach ($months as $m) {
            $ym     = sprintf('%04d-%02d', $year, $m);
            $found  = $rows->get($ym);
            $actual = $found ? (int) $found->total : 0;
            $target = $this->getTargetTotal($year, $m, $branchIds, $channel);
            $chartMain[] = ['label' => $this->monthNames[$m - 1], 'actual' => $actual, 'target' => (int) $target];
            $actualTotal += $actual;
            $targetTotal += $target;
        }

        $prevQuarter = $quarter === 1 ? 4 : $quarter - 1;
        $prevYear    = $quarter === 1 ? $year - 1 : $year;
        $prevMonths  = [($prevQuarter - 1) * 3 + 1, ($prevQuarter - 1) * 3 + 2, ($prevQuarter - 1) * 3 + 3];
        $prevStart   = Carbon::create($prevYear, $prevMonths[0], 1)->startOfMonth()->toDateString();
        $prevEnd     = Carbon::create($prevYear, $prevMonths[2], 1)->endOfMonth()->toDateString();

        $prevActual = (float) DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$prevStart, $prevEnd])
            ->sum("daily_revenues.$col");

        $growth = $prevActual > 0 ? round(($actualTotal - $prevActual) / $prevActual * 100, 1) : null;
        $pct    = $targetTotal > 0 ? round($actualTotal / $targetTotal * 100, 1) : 0;

        return [
            'summary'   => ['total_revenue' => (int) $actualTotal, 'target' => (int) $targetTotal, 'achievement' => $pct, 'growth' => $growth],
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── YEARLY ──────────────────────────────────────────────────────────────
    private function getYearlyData(int $year, array $branchIds, string $channel): array
    {
        $start = "$year-01-01";
        $end   = "$year-12-31";
        $col   = $this->revenueCol($channel);

        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select(DB::raw("TO_CHAR(daily_revenues.date, 'YYYY-MM') as ym"), DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('ym')->orderBy('ym')->get()->keyBy('ym');

        $chartMain = []; $actualTotal = 0; $targetTotal = 0; $prevMonthly = null;

        for ($m = 1; $m <= 12; $m++) {
            $ym     = sprintf('%04d-%02d', $year, $m);
            $found  = $rows->get($ym);
            $actual = $found ? (int) $found->total : 0;
            $target = $this->getTargetTotal($year, $m, $branchIds, $channel);
            $growth = ($prevMonthly !== null && $prevMonthly > 0) ? round(($actual - $prevMonthly) / $prevMonthly * 100, 1) : null;

            $chartMain[] = ['label' => $this->monthNames[$m - 1], 'actual' => $actual, 'target' => (int) $target, 'growth' => $growth];
            $actualTotal += $actual;
            $targetTotal += $target;
            if ($actual > 0) $prevMonthly = $actual;
        }

        $prevYearTotal = (float) DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [($year - 1) . '-01-01', ($year - 1) . '-12-31'])
            ->sum("daily_revenues.$col");

        $yoyGrowth = $prevYearTotal > 0 ? round(($actualTotal - $prevYearTotal) / $prevYearTotal * 100, 1) : null;
        $pct       = $targetTotal > 0 ? round($actualTotal / $targetTotal * 100, 1) : 0;

        return [
            'summary'   => ['total_revenue' => (int) $actualTotal, 'target' => (int) $targetTotal, 'achievement' => $pct, 'growth' => $yoyGrowth],
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────

    private function revenueCol(string $channel): string
    {
        return $channel === 'all' ? 'total_daily' : ($this->channelColumns[$channel] ?? 'total_daily');
    }

    private function queryDaily(string $start, string $end, array $branchIds, string $col)
    {
        return DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select('daily_revenues.date', DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('daily_revenues.date')
            ->orderBy('daily_revenues.date')
            ->get();
    }

    private function getTargetTotal(int $year, int $month, array $branchIds, string $channel): float
    {
        $periodMonth = sprintf('%04d-%02d-01', $year, $month);
        $col = $channel === 'all' ? 'target_total' : ($this->channelTargetCols[$channel] ?? 'target_total');
        return (float) BranchTarget::whereIn('branch_id', $branchIds)->where('period_month', $periodMonth)->sum($col);
    }

    private function buildSummaryMonthly(float $actual, float $target, int $year, int $month, array $branchIds, string $channel): array
    {
        $pct       = $target > 0 ? round($actual / $target * 100, 1) : 0;
        $prevMonth = $month === 1 ? 12 : $month - 1;
        $prevYear  = $month === 1 ? $year - 1 : $year;
        $col       = $this->revenueCol($channel);

        $pStart = Carbon::create($prevYear, $prevMonth, 1)->startOfMonth()->toDateString();
        $pEnd   = Carbon::create($prevYear, $prevMonth, 1)->endOfMonth()->toDateString();

        $prevActual = (float) DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$pStart, $pEnd])
            ->sum("daily_revenues.$col");

        $growth = $prevActual > 0 ? round(($actual - $prevActual) / $prevActual * 100, 1) : null;

        return ['total_revenue' => (int) $actual, 'target' => (int) $target, 'achievement' => $pct, 'growth' => $growth];
    }

    private function getByChannel(string $start, string $end, array $branchIds): array
    {
        $cases = [];
        foreach ($this->channelColumns as $label => $col) {
            $cases[] = "SUM(daily_revenues.$col) as \"$col\"";
        }

        $row = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->selectRaw(implode(', ', $cases))
            ->first();

        if (!$row) return [];

        $results = [];
        foreach ($this->channelColumns as $label => $col) {
            $total = (int) ($row->$col ?? 0);
            if ($total > 0) $results[] = ['channel' => $label, 'total' => $total];
        }

        usort($results, fn($a, $b) => $b['total'] - $a['total']);
        return $results;
    }

    private function getByBranch(string $start, string $end, array $branchIds, string $channel): array
    {
        $col  = $this->revenueCol($channel);
        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->join('branches', 'monthly_reports.branch_id', '=', 'branches.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select('branches.id as branch_id', 'branches.name as branch_name', DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('branches.id', 'branches.name')
            ->orderBy('total', 'desc')
            ->get();

        return $rows->map(fn($r) => ['branch_id' => $r->branch_id, 'branch_name' => $r->branch_name, 'total' => (int) $r->total])->toArray();
    }

    private function getYearlyTable(int $year, array $branchIds, string $channel): array
    {
        $col = $this->revenueCol($channel);

        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->join('branches', 'monthly_reports.branch_id', '=', 'branches.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', ["$year-01-01", "$year-12-31"])
            ->select('branches.id as branch_id', 'branches.name as branch_name', DB::raw("TO_CHAR(daily_revenues.date, 'MM') as m"), DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('branches.id', 'branches.name', 'm')
            ->get();

        $targetCol = $channel === 'all' ? 'target_total' : ($this->channelTargetCols[$channel] ?? 'target_total');
        $targets   = DB::table('branch_targets')
            ->whereIn('branch_id', $branchIds)
            ->whereRaw("TO_CHAR(period_month, 'YYYY') = ?", [$year])
            ->select('branch_id', DB::raw("TO_CHAR(period_month, 'MM') as m"), "$targetCol as target")
            ->get();

        $revenueMap = [];
        foreach ($rows as $r) $revenueMap[$r->branch_id][(int) $r->m] = (int) $r->total;

        $targetMap = [];
        foreach ($targets as $t) $targetMap[$t->branch_id][(int) $t->m] = (float) $t->target;

        // Query cost per cabang per bulan
        $costRows = DB::table('monthly_costs')
            ->whereIn('branch_id', $branchIds)
            ->whereNull('deleted_at')
            ->whereRaw("TO_CHAR(period_month, 'YYYY') = ?", [$year])
            ->select('branch_id', DB::raw("TO_CHAR(period_month, 'MM') as m"), 'total_cost')
            ->get();

        $costMap = [];
        foreach ($costRows as $c) $costMap[$c->branch_id][(int) $c->m] = (int) $c->total_cost;

        $branchList = auth()->user()->accessibleBranches()->where('is_active', true)->get(['id', 'name']);
        $result     = [];

        foreach ($branchList as $branch) {
            $row = ['branch' => $branch->name, 'months' => [], 'total' => 0, 'total_cost' => 0];

            for ($m = 1; $m <= 12; $m++) {
                $actual = $revenueMap[$branch->id][$m] ?? 0;
                $target = $targetMap[$branch->id][$m] ?? 0;
                $cost   = $costMap[$branch->id][$m] ?? 0;
                $row['months'][] = [
                    'label'      => $this->monthNames[$m - 1],
                    'actual'     => $actual,
                    'target'     => (int) $target,
                    'cost'       => $cost,
                    'pct'        => $target > 0 ? round($actual / $target * 100, 1) : 0,
                    'cost_ratio' => $actual > 0 ? round($cost / $actual * 100, 1) : 0,
                ];
                $row['total']      += $actual;
                $row['total_cost'] += $cost;
            }

            $result[] = $row;
        }

        return $result;
    }
}