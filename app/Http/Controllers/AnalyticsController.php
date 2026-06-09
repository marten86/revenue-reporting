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
    // Map nama channel (frontend) → kolom di daily_revenues
    private array $channelColumns = [
        'Presentasi'   => 'presentasi',
        'WGTS'         => 'wgts',
        'Gerai'        => 'gerai',
        'DFI (AR)'     => 'dfi',
        'DFE (AE)'     => 'dfe',
        'Kotak & QRIS' => 'kotak_qris',
        'Kantor'       => 'kantor',
    ];

    // Map nama channel (frontend) → kolom di branch_targets
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
        $channel  = $request->get('channel', 'all');

        // Ambil cabang yang bisa diakses user
        $branches  = $user->accessibleBranches()->where('is_active', true)->get();
        $allIds    = $branches->pluck('id')->toArray();

        // Filter branch jika dipilih spesifik
        $branchIds = ($branchId !== 'all' && in_array($branchId, $allIds))
            ? [$branchId]
            : $allIds;

        // Guard: jika tidak ada cabang, return data kosong
        if (empty($branchIds)) {
            return Inertia::render('Analytics/Index', [
                'branches'  => $branches,
                'channels'  => MonthlyReport::CHANNELS,
                'period'    => $period,
                'year'      => $year,
                'month'     => $month,
                'quarter'   => $quarter,
                'branchId'  => $branchId,
                'channel'   => $channel,
                'summary'   => ['total_revenue' => 0, 'target' => 0, 'achievement' => 0, 'growth' => null],
                'chartMain' => [],
                'byChannel' => [],
                'byBranch'  => [],
                'tableData' => [],
            ]);
        }

        $data = match($period) {
            'weekly'    => $this->getWeeklyData($year, $month, $branchIds, $channel),
            'quarterly' => $this->getQuarterlyData($year, $quarter, $branchIds, $channel),
            'yearly'    => $this->getYearlyData($year, $branchIds, $channel),
            default     => $this->getMonthlyData($year, $month, $branchIds, $channel),
        };

        return Inertia::render('Analytics/Index', [
            'branches'  => $branches,
            'channels'  => MonthlyReport::CHANNELS,
            'period'    => $period,
            'year'      => $year,
            'month'     => $month,
            'quarter'   => $quarter,
            'branchId'  => $branchId,
            'channel'   => $channel,
            'summary'   => $data['summary'],
            'chartMain' => $data['chartMain'],
            'byChannel' => $data['byChannel'],
            'byBranch'  => $data['byBranch'],
            'tableData' => $data['tableData'],
        ]);
    }

    // ─── MONTHLY ─────────────────────────────────────────────────────────────
    private function getMonthlyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
        $end   = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
        $col   = $this->revenueCol($channel);

        // Ambil semua data harian sekaligus (1 query)
        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select('daily_revenues.date', DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('daily_revenues.date')
            ->orderBy('daily_revenues.date')
            ->get();

        $targetTotal = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
        $dailyTarget = $daysInMonth > 0 ? round($targetTotal / $daysInMonth) : 0;

        $chartMain = $rows->map(fn($r) => [
            'label'  => Carbon::parse($r->date)->format('d M'),
            'actual' => (int) $r->total,
            'target' => (int) $dailyTarget,
        ])->values()->toArray();

        $actualTotal = $rows->sum('total');

        return [
            'summary'   => $this->buildSummary((float) $actualTotal, $targetTotal, $year, $month, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── WEEKLY ──────────────────────────────────────────────────────────────
    private function getWeeklyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $monthStart = Carbon::create($year, $month, 1)->startOfMonth();
        $monthEnd   = Carbon::create($year, $month, 1)->endOfMonth();

        $weekStart = now()->startOfWeek(Carbon::MONDAY);
        $weekEnd   = now()->endOfWeek(Carbon::SUNDAY);

        // Clamp ke batas bulan
        if ($weekStart->lt($monthStart)) $weekStart = $monthStart->copy();
        if ($weekEnd->gt($monthEnd))     $weekEnd   = $monthEnd->copy();

        $col = $this->revenueCol($channel);

        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->select('daily_revenues.date', DB::raw("SUM(daily_revenues.$col) as total"))
            ->groupBy('daily_revenues.date')
            ->orderBy('daily_revenues.date')
            ->get()
            ->keyBy('date');

        $targetTotal  = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $daysInMonth  = $monthEnd->daysInMonth;
        $weekDays     = $weekStart->diffInDays($weekEnd) + 1;
        $weeklyTarget = $daysInMonth > 0 ? round(($targetTotal / $daysInMonth) * $weekDays) : 0;
        $dailyTarget  = $weekDays > 0 ? round($weeklyTarget / $weekDays) : 0;

        $dayNames  = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
        $chartMain = [];
        for ($d = $weekStart->copy(); $d->lte($weekEnd); $d->addDay()) {
            $key    = $d->toDateString();
            $found  = $rows->get($key);
            $dow    = $d->dayOfWeek === 0 ? 6 : $d->dayOfWeek - 1;
            $chartMain[] = [
                'label'  => $dayNames[$dow] . ' ' . $d->format('d'),
                'actual' => $found ? (int) $found->total : 0,
                'target' => (int) $dailyTarget,
            ];
        }

        $actualTotal = $rows->sum('total');

        return [
            'summary'   => $this->buildSummary((float) $actualTotal, (float) $weeklyTarget, $year, $month, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($weekStart->toDateString(), $weekEnd->toDateString(), $branchIds),
            'byBranch'  => $this->getByBranch($weekStart->toDateString(), $weekEnd->toDateString(), $branchIds, $channel),
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

        // 1 query untuk seluruh kuartal, groupBy bulan
        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select(
                DB::raw("TO_CHAR(daily_revenues.date, 'YYYY-MM') as ym"),
                DB::raw("SUM(daily_revenues.$col) as total")
            )
            ->groupBy('ym')
            ->orderBy('ym')
            ->get()
            ->keyBy('ym');

        $chartMain   = [];
        $actualTotal = 0;
        $targetTotal = 0;

        foreach ($months as $m) {
            $ym     = sprintf('%04d-%02d', $year, $m);
            $found  = $rows->get($ym);
            $actual = $found ? (int) $found->total : 0;
            $target = $this->getTargetTotal($year, $m, $branchIds, $channel);

            $chartMain[] = [
                'label'  => $this->monthNames[$m - 1],
                'actual' => $actual,
                'target' => (int) $target,
            ];
            $actualTotal += $actual;
            $targetTotal += $target;
        }

        return [
            'summary'   => $this->buildSummary((float) $actualTotal, (float) $targetTotal, $year, $months[0], $branchIds, $channel),
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

        // 1 query untuk seluruh tahun, groupBy bulan
        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', [$start, $end])
            ->select(
                DB::raw("TO_CHAR(daily_revenues.date, 'YYYY-MM') as ym"),
                DB::raw("SUM(daily_revenues.$col) as total")
            )
            ->groupBy('ym')
            ->orderBy('ym')
            ->get()
            ->keyBy('ym');

        $chartMain   = [];
        $actualTotal = 0;
        $targetTotal = 0;
        $prevActual  = null;

        for ($m = 1; $m <= 12; $m++) {
            $ym     = sprintf('%04d-%02d', $year, $m);
            $found  = $rows->get($ym);
            $actual = $found ? (int) $found->total : 0;
            $target = $this->getTargetTotal($year, $m, $branchIds, $channel);
            $growth = ($prevActual !== null && $prevActual > 0)
                ? round(($actual - $prevActual) / $prevActual * 100, 1)
                : null;

            $chartMain[] = [
                'label'  => $this->monthNames[$m - 1],
                'actual' => $actual,
                'target' => (int) $target,
                'growth' => $growth,
            ];
            $actualTotal += $actual;
            $targetTotal += $target;
            if ($actual > 0) $prevActual = $actual;
        }

        return [
            'summary'   => $this->buildSummary((float) $actualTotal, (float) $targetTotal, $year, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────

    private function revenueCol(string $channel): string
    {
        return $channel === 'all'
            ? 'total_daily'
            : ($this->channelColumns[$channel] ?? 'total_daily');
    }

    private function getTargetTotal(int $year, int $month, array $branchIds, string $channel): float
    {
        $periodMonth = sprintf('%04d-%02d-01', $year, $month);
        $col = $channel === 'all'
            ? 'target_total'
            : ($this->channelTargetCols[$channel] ?? 'target_total');

        return (float) BranchTarget::whereIn('branch_id', $branchIds)
            ->where('period_month', $periodMonth)
            ->sum($col);
    }

    private function buildSummary(float $actual, float $target, int $year, ?int $month, array $branchIds, string $channel): array
    {
        $pct        = $target > 0 ? round($actual / $target * 100, 1) : 0;
        $prevActual = 0.0;

        if ($month !== null) {
            $prevMonth = $month === 1 ? 12 : $month - 1;
            $prevYear  = $month === 1 ? $year - 1 : $year;
            $pStart    = Carbon::create($prevYear, $prevMonth, 1)->startOfMonth()->toDateString();
            $pEnd      = Carbon::create($prevYear, $prevMonth, 1)->endOfMonth()->toDateString();
            $col       = $this->revenueCol($channel);

            $prevActual = (float) DB::table('daily_revenues')
                ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
                ->whereIn('monthly_reports.branch_id', $branchIds)
                ->whereNull('monthly_reports.deleted_at')
                ->whereBetween('daily_revenues.date', [$pStart, $pEnd])
                ->sum("daily_revenues.$col");
        }

        $growth = $prevActual > 0 ? round(($actual - $prevActual) / $prevActual * 100, 1) : null;

        return [
            'total_revenue' => (int) $actual,
            'target'        => (int) $target,
            'achievement'   => $pct,
            'growth'        => $growth,
        ];
    }

    private function getByChannel(string $start, string $end, array $branchIds): array
    {
        $results = [];
        foreach ($this->channelColumns as $label => $col) {
            $total = DB::table('daily_revenues')
                ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
                ->whereIn('monthly_reports.branch_id', $branchIds)
                ->whereNull('monthly_reports.deleted_at')
                ->whereBetween('daily_revenues.date', [$start, $end])
                ->sum("daily_revenues.$col");

            if ($total > 0) {
                $results[] = ['channel' => $label, 'total' => (int) $total];
            }
        }
        return $results;
    }

    private function getByBranch(string $start, string $end, array $branchIds, string $channel): array
    {
        $col = $this->revenueCol($channel);

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

        return $rows->map(fn($r) => [
            'branch_id'   => $r->branch_id,
            'branch_name' => $r->branch_name,
            'total'       => (int) $r->total,
        ])->toArray();
    }

    private function getYearlyTable(int $year, array $branchIds, string $channel): array
    {
        $col = $this->revenueCol($channel);

        // 1 query untuk semua cabang x 12 bulan sekaligus
        $rows = DB::table('daily_revenues')
            ->join('monthly_reports', 'daily_revenues.monthly_report_id', '=', 'monthly_reports.id')
            ->join('branches', 'monthly_reports.branch_id', '=', 'branches.id')
            ->whereIn('monthly_reports.branch_id', $branchIds)
            ->whereNull('monthly_reports.deleted_at')
            ->whereBetween('daily_revenues.date', ["$year-01-01", "$year-12-31"])
            ->select(
                'branches.id as branch_id',
                'branches.name as branch_name',
                DB::raw("TO_CHAR(daily_revenues.date, 'MM') as m"),
                DB::raw("SUM(daily_revenues.$col) as total")
            )
            ->groupBy('branches.id', 'branches.name', 'm')
            ->get();

        // 1 query untuk semua target sekaligus
        $targetCol = $channel === 'all' ? 'target_total' : ($this->channelTargetCols[$channel] ?? 'target_total');
        $targets = DB::table('branch_targets')
            ->whereIn('branch_id', $branchIds)
            ->whereRaw("TO_CHAR(period_month, 'YYYY') = ?", [$year])
            ->select('branch_id', DB::raw("TO_CHAR(period_month, 'MM') as m"), "$targetCol as target")
            ->get();

        // Index data untuk lookup cepat
        $revenueMap = [];
        foreach ($rows as $r) {
            $revenueMap[$r->branch_id][(int)$r->m] = (int) $r->total;
        }
        $targetMap = [];
        foreach ($targets as $t) {
            $targetMap[$t->branch_id][(int)$t->m] = (float) $t->target;
        }

        $branches = Branch::whereIn('id', $branchIds)->orderBy('name')->get();
        $result   = [];

        foreach ($branches as $branch) {
            $row = ['branch' => $branch->name, 'months' => [], 'total' => 0];

            for ($m = 1; $m <= 12; $m++) {
                $actual = $revenueMap[$branch->id][$m] ?? 0;
                $target = $targetMap[$branch->id][$m] ?? 0;
                $row['months'][] = [
                    'label'  => $this->monthNames[$m - 1],
                    'actual' => $actual,
                    'target' => (int) $target,
                    'pct'    => $target > 0 ? round($actual / $target * 100, 1) : 0,
                ];
                $row['total'] += $actual;
            }

            $result[] = $row;
        }

        return $result;
    }
}