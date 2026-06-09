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
    private array $channelColumns = [
        'Presentasi'  => 'presentasi',
        'WGTS'        => 'wgts',
        'Gerai'       => 'gerai',
        'DFI (AR)'    => 'dfi',
        'DFE (AE)'    => 'dfe',
        'Kotak & QRIS'=> 'kotak_qris',
        'Kantor'      => 'kantor',
    ];

    public function index(Request $request)
    {
        $user     = auth()->user();
        $period   = $request->get('period', 'monthly');
        $year     = (int) $request->get('year', now()->year);
        $month    = (int) $request->get('month', now()->month);
        $quarter  = (int) $request->get('quarter', (int) ceil(now()->month / 3));
        $branchId = $request->get('branch_id', 'all');
        $channel  = $request->get('channel', 'all');

        $branches       = $user->accessibleBranches()->where('is_active', true)->get();
        $branchIds      = $branches->pluck('id')->toArray();
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

    // ─── SUM KOLOM SESUAI CHANNEL ────────────────────────────────────────────
    private function sumCol(string $channel): string
    {
        if ($channel === 'all') {
            return 'total_daily';
        }
        return $this->channelColumns[$channel] ?? 'total_daily';
    }

    private function baseQuery(array $branchIds): \Illuminate\Database\Eloquent\Builder
    {
        return DailyRevenue::query()
            ->whereHas('monthlyReport', fn($q) => $q->whereIn('branch_id', $branchIds));
    }

    private function sumRevenue(Carbon $start, Carbon $end, array $branchIds, string $channel): float
    {
        $col = $this->sumCol($channel);
        return (float) $this->baseQuery($branchIds)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->sum($col);
    }

    // ─── MONTHLY ─────────────────────────────────────────────────────────────
    private function getMonthlyData(int $year, int $month, array $branchIds, string $channel): array
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end   = Carbon::create($year, $month, 1)->endOfMonth();
        $col   = $this->sumCol($channel);

        $dailyData = $this->baseQuery($branchIds)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->select('date', DB::raw("SUM($col) as total"))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $targetTotal = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $dailyTarget = $end->day > 0 ? $targetTotal / $end->day : 0;

        $chartMain = $dailyData->map(fn($d) => [
            'label'  => Carbon::parse($d->date)->format('d M'),
            'actual' => (int) $d->total,
            'target' => (int) $dailyTarget,
        ])->values()->toArray();

        return [
            'summary'   => $this->buildSummary($dailyData->sum('total'), $targetTotal, $year, $month, null, $branchIds, $channel),
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
        $weekStart  = now()->startOfWeek(Carbon::MONDAY);
        $weekEnd    = now()->endOfWeek(Carbon::SUNDAY);
        $weekStart  = $weekStart->lt($monthStart) ? $monthStart->copy() : $weekStart;
        $weekEnd    = $weekEnd->gt($monthEnd) ? $monthEnd->copy() : $weekEnd;

        $col = $this->sumCol($channel);

        $dailyData = $this->baseQuery($branchIds)
            ->whereBetween('date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->select('date', DB::raw("SUM($col) as total"))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $targetTotal  = $this->getTargetTotal($year, $month, $branchIds, $channel);
        $daysInMonth  = $monthEnd->day;
        $weekDays     = $weekStart->diffInDays($weekEnd) + 1;
        $weeklyTarget = $daysInMonth > 0 ? ($targetTotal / $daysInMonth) * $weekDays : 0;
        $dailyTarget  = $weekDays > 0 ? $weeklyTarget / $weekDays : 0;

        $dayNames  = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
        $chartMain = [];
        for ($d = $weekStart->copy(); $d->lte($weekEnd); $d->addDay()) {
            $found = $dailyData->firstWhere('date', $d->toDateString());
            $chartMain[] = [
                'label'  => $dayNames[$d->dayOfWeek === 0 ? 6 : $d->dayOfWeek - 1] . ' ' . $d->format('d'),
                'actual' => $found ? (int) $found->total : 0,
                'target' => (int) $dailyTarget,
            ];
        }

        return [
            'summary'   => $this->buildSummary($dailyData->sum('total'), $weeklyTarget, $year, $month, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($weekStart, $weekEnd, $branchIds),
            'byBranch'  => $this->getByBranch($weekStart, $weekEnd, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── QUARTERLY ───────────────────────────────────────────────────────────
    private function getQuarterlyData(int $year, int $quarter, array $branchIds, string $channel): array
    {
        $months = [($quarter - 1) * 3 + 1, ($quarter - 1) * 3 + 2, ($quarter - 1) * 3 + 3];
        $start  = Carbon::create($year, $months[0], 1)->startOfMonth();
        $end    = Carbon::create($year, $months[2], 1)->endOfMonth();
        $col    = $this->sumCol($channel);

        $monthNames  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $chartMain   = [];
        $actualTotal = 0;
        $targetTotal = 0;

        foreach ($months as $m) {
            $mStart  = Carbon::create($year, $m, 1)->startOfMonth();
            $mEnd    = Carbon::create($year, $m, 1)->endOfMonth();
            $actual  = $this->sumRevenue($mStart, $mEnd, $branchIds, $channel);
            $target  = $this->getTargetTotal($year, $m, $branchIds, $channel);
            $chartMain[] = [
                'label'  => $monthNames[$m - 1],
                'actual' => (int) $actual,
                'target' => (int) $target,
            ];
            $actualTotal += $actual;
            $targetTotal += $target;
        }

        return [
            'summary'   => $this->buildSummary($actualTotal, $targetTotal, $year, $months[0], null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── YEARLY ──────────────────────────────────────────────────────────────
    private function getYearlyData(int $year, array $branchIds, string $channel): array
    {
        $monthNames  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $chartMain   = [];
        $actualTotal = 0;
        $targetTotal = 0;
        $prevActual  = null;

        for ($m = 1; $m <= 12; $m++) {
            $mStart = Carbon::create($year, $m, 1)->startOfMonth();
            $mEnd   = Carbon::create($year, $m, 1)->endOfMonth();
            $actual = $this->sumRevenue($mStart, $mEnd, $branchIds, $channel);
            $target = $this->getTargetTotal($year, $m, $branchIds, $channel);
            $growth = ($prevActual !== null && $prevActual > 0)
                ? round(($actual - $prevActual) / $prevActual * 100, 1)
                : null;

            $chartMain[] = [
                'label'  => $monthNames[$m - 1],
                'actual' => (int) $actual,
                'target' => (int) $target,
                'growth' => $growth,
            ];
            $actualTotal += $actual;
            $targetTotal += $target;
            if ($actual > 0) $prevActual = $actual;
        }

        $start = Carbon::create($year, 1, 1);
        $end   = Carbon::create($year, 12, 31);

        return [
            'summary'   => $this->buildSummary($actualTotal, $targetTotal, $year, null, null, $branchIds, $channel),
            'chartMain' => $chartMain,
            'byChannel' => $this->getByChannel($start, $end, $branchIds),
            'byBranch'  => $this->getByBranch($start, $end, $branchIds, $channel),
            'tableData' => $this->getYearlyTable($year, $branchIds, $channel),
        ];
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    private function getTargetTotal(int $year, int $month, array $branchIds, string $channel): float
{
    $periodMonth = sprintf('%04d-%02d', $year, $month);

    $channelTargetCols = [
        'Presentasi'   => 'target_presentasi',
        'WGTS'         => 'target_wgts',
        'Gerai'        => 'target_gerai',
        'DFI (AR)'     => 'target_dfi',
        'DFE (AE)'     => 'target_dfe',
        'Kotak & QRIS' => 'target_kotak_qris',
        'Kantor'       => 'target_kantor',
    ];

    $col = $channel === 'all'
        ? 'target_total'
        : ($channelTargetCols[$channel] ?? 'target_total');

    return (float) BranchTarget::whereIn('branch_id', $branchIds)
        ->where('period_month', $periodMonth)
        ->sum($col);
    }

    private function buildSummary(float $actual, float $target, int $year, ?int $month, ?int $quarter, array $branchIds, string $channel): array
    {
        $pct        = $target > 0 ? round($actual / $target * 100, 1) : 0;
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

    private function getByChannel(Carbon $start, Carbon $end, array $branchIds): array
    {
        $results = [];
        foreach ($this->channelColumns as $label => $col) {
            $total = $this->baseQuery($branchIds)
                ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                ->sum($col);
            if ($total > 0) {
                $results[] = ['channel' => $label, 'total' => (int) $total];
            }
        }
        return $results;
    }

    private function getByBranch(Carbon $start, Carbon $end, array $branchIds, string $channel): array
    {
        $col      = $this->sumCol($channel);
        $branches = Branch::whereIn('id', $branchIds)->get();
        $results  = [];

        foreach ($branches as $branch) {
            $total = $this->baseQuery([$branch->id])
                ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
                ->sum($col);
            $results[] = [
                'branch_id'   => $branch->id,
                'branch_name' => $branch->name,
                'total'       => (int) $total,
            ];
        }

        return $results;
    }

    private function getYearlyTable(int $year, array $branchIds, string $channel): array
    {
        $monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        $branches   = Branch::whereIn('id', $branchIds)->get();
        $rows       = [];

        foreach ($branches as $branch) {
            $row = ['branch' => $branch->name, 'months' => [], 'total' => 0];

            for ($m = 1; $m <= 12; $m++) {
                $mStart = Carbon::create($year, $m, 1)->startOfMonth();
                $mEnd   = Carbon::create($year, $m, 1)->endOfMonth();
                $actual = $this->sumRevenue($mStart, $mEnd, [$branch->id], $channel);
                $target = $this->getTargetTotal($year, $m, [$branch->id], $channel);

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