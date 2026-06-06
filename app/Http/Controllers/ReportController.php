<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\RevenueSource;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user  = $request->user();
        $month = $request->get('month', now()->format('Y-m-01'));

        $reports = MonthlyReport::with(['branch.area'])
            ->whereHas('branch', function ($q) use ($user) {
                if (!$user->canManageAllBranches()) {
                    $q->where('id', $user->branch_id);
                }
            })
            ->where('period_month', $month)
            ->orderByRaw("CASE status
                WHEN 'submitted' THEN 1
                WHEN 'approved'  THEN 2
                WHEN 'draft'     THEN 3
                ELSE 4 END")
            ->get();

        return Inertia::render('Reports/Index', [
            'reports'      => $reports,
            'currentMonth' => $month,
        ]);
    }

    public function create(Request $request): Response
    {
        $user     = $request->user();
        $branches = $user->accessibleBranches()->get(['id', 'name', 'code']);

        return Inertia::render('Reports/Create', [
            'branches' => $branches,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'branch_id'    => 'required|uuid|exists:branches,id',
            'period_month' => 'required|date_format:Y-m-d',
        ]);

        $branch = Branch::findOrFail($data['branch_id']);
        abort_unless($request->user()->canAccessBranch($branch), 403);

        $existing = MonthlyReport::where('branch_id', $data['branch_id'])
            ->where('period_month', $data['period_month'])
            ->first();

        if ($existing) {
            return redirect()->route('reports.show', $existing)
                ->with('warning', 'Laporan periode ini sudah ada.');
        }

        $target = $branch->targetForMonth($data['period_month']);

        $report = MonthlyReport::create([
            'branch_id'     => $data['branch_id'],
            'period_month'  => $data['period_month'],
            'status'        => MonthlyReport::STATUS_DRAFT,
            'target_amount' => $target?->target_total ?? 0,
        ]);

        // Inisialisasi cache harian (30/31 baris kosong) agar
        // tab Rekap langsung menampilkan grid tanggal lengkap.
        $report->recalculate();

        $jumlahHari = $report->dailyRevenues()->count();

        return redirect()->route('reports.show', $report)
            ->with('success', "Laporan berhasil dibuat. {$jumlahHari} baris harian telah disiapkan.");
    }

    public function show(Request $request, MonthlyReport $report): Response
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $report->load([
            'branch.area',
            'dailyRevenues',
            'revenueDetails',
            'safariDakwahLogs',
            'submittedBy',
            'approvedBy',
        ]);

        $weeklyBreakdown = $this->buildWeeklyBreakdown($report->dailyRevenues);

        // Master data sumber (tim/karyawan) per cabang, grouped by channel
        $sources = RevenueSource::where('branch_id', $report->branch_id)
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->groupBy('channel');

        return Inertia::render('Reports/Show', [
            'report'          => $report,
            'weeklyBreakdown' => $weeklyBreakdown,
            'channels'        => MonthlyReport::CHANNELS,
            'subChannels'     => MonthlyReport::SUB_CHANNELS,
            'sources'         => $sources,
            'canSubmit' => ($request->user()->canSubmitReport() || $request->user()->canManageAllBranches()) && $report->isDraft(),
            'canApprove'      => $request->user()->canApproveReport() && $report->isSubmitted(),
        ]);
    }

    public function submit(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit.');

        $report->submit($request->user());

        return back()->with('success', 'Laporan berhasil disubmit.');
    }

    public function approve(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canApproveReport(), 403);
        abort_unless($report->isSubmitted(), 422, 'Laporan belum disubmit.');

        $report->approve($request->user());

        return back()->with('success', 'Laporan berhasil disetujui.');
    }

    public function updateEvaluation(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        $request->validate(['evaluation' => 'nullable|string|max:2000']);
        $report->update(['evaluation' => $request->evaluation]);
        return back()->with('success', 'Evaluasi disimpan.');
    }

    private function buildWeeklyBreakdown($dailyRevenues): array
    {
        $weeks       = [];
        $currentWeek = [];
        $days        = ['ahad', 'minggu'];

        foreach ($dailyRevenues as $day) {
            $currentWeek[] = $day;
            if (in_array(strtolower($day->day_name), $days) || $day === $dailyRevenues->last()) {
                $weeks[] = [
                    'days'             => $currentWeek,
                    'total_presentasi' => collect($currentWeek)->sum('presentasi'),
                    'total_gerai'      => collect($currentWeek)->sum('gerai'),
                    'total_wgts'       => collect($currentWeek)->sum('wgts'),
                    'total_dfi'        => collect($currentWeek)->sum('dfi'),
                    'total_dfe'        => collect($currentWeek)->sum('dfe'),
                    'total_kotak_qris' => collect($currentWeek)->sum('kotak_qris'),
                    'total_kantor'     => collect($currentWeek)->sum('kantor'),
                    'total'            => collect($currentWeek)->sum('total_daily'),
                ];
                $currentWeek = [];
            }
        }

        return $weeks;
    }
}