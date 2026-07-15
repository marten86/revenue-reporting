<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\RevenueSource;
use App\Models\Speaker;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;


class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user  = $request->user();
        $month = $request->get('month', now()->format('Y-m-01'));

        $branchIds = $user->accessibleBranches()->pluck('id');

        // Subquery: last_input_at = MAX(updated_at) dari revenue_details + safari_dakwah_logs
        $detailMax = \DB::table('revenue_details')
            ->select('monthly_report_id', \DB::raw('MAX(updated_at) as last_ts'))
            ->groupBy('monthly_report_id');

        $safariMax = \DB::table('safari_dakwah_logs')
            ->select('monthly_report_id', \DB::raw('MAX(updated_at) as last_ts'))
            ->groupBy('monthly_report_id');

        $lastInputSub = \DB::table(
            $detailMax->unionAll($safariMax),
            'combined'
        )
            ->select('monthly_report_id', \DB::raw('MAX(last_ts) as last_input_at'))
            ->groupBy('monthly_report_id');

        $reports = MonthlyReport::with(['branch.area'])
            ->whereIn('branch_id', $branchIds)
            ->where('period_month', $month)
            ->leftJoinSub($lastInputSub, 'last_input', function ($join) {
                $join->on('monthly_reports.id', '=', 'last_input.monthly_report_id');
            })
            ->select('monthly_reports.*', 'last_input.last_input_at')
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
        abort_unless($request->user()->canInputData(), 403);

        $user     = $request->user();
        $branches = $user->accessibleBranches()->get(['id', 'name', 'code']);

        return Inertia::render('Reports/Create', [
            'branches' => $branches,
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canInputData(), 403);

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

        $report->recalculate();

        $jumlahHari = $report->dailyRevenues()->count();

        return redirect()->route('reports.show', $report)
            ->with('success', "Laporan berhasil dibuat. {$jumlahHari} baris harian telah disiapkan.");
    }

    public function show(Request $request, MonthlyReport $report): Response
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $latestTarget = $report->branch->targetForMonth(
            $report->period_month->format('Y-m-d')
        );
        if ($latestTarget && (int) $latestTarget->target_total !== (int) $report->target_amount) {
            $report->update(['target_amount' => $latestTarget->target_total]);
            $report->recalculate();
        }

        $report->load([
            'branch.area',
            'dailyRevenues',
            'revenueDetails',
            'safariDakwahLogs',
            'submittedBy',
            'approvedBy',
            'revisedBy',
        ]);

        $weeklyBreakdown = $this->buildWeeklyBreakdown($report->dailyRevenues);

        $sources = RevenueSource::where('branch_id', $report->branch_id)
            ->active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->groupBy('channel');

        $narasumberList = Speaker::forBranch($report->branch_id)
            ->active()
            ->orderBy('name')
            ->get(['id', 'name', 'branch_id']);

        $canManage = $request->user()->canApproveReport()
            && $request->user()->canAccessBranch($report->branch);

        return Inertia::render('Reports/Show', [
            'report'          => $report,
            'weeklyBreakdown' => $weeklyBreakdown,
            'channels'        => MonthlyReport::CHANNELS,
            'subChannels'     => MonthlyReport::SUB_CHANNELS,
            'sources'         => $sources,
            'rekapPerTim'     => $this->buildRekapPerTim($report),
            'canSubmit'       => ($request->user()->canSubmitReport() || $request->user()->canManageAllBranches()) && $report->isDraft(),
            'canApprove'      => $canManage && $report->isSubmitted(),
            'canRevise'       => $canManage && $report->isSubmitted(),
            'isReadOnly'      => $request->user()->isReadOnly(),
            'narasumberList'  => $narasumberList,
        ]);
    }

    public function exportExcel(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $filename = 'Laporan_' . $report->branch->code . '_'
            . \Carbon\Carbon::parse($report->period_month)->format('Y-m') . '.xlsx';

        return \Maatwebsite\Excel\Facades\Excel::download(
            new \App\Exports\MonthlyReportExport($report),
            $filename
        );
    }

    public function exportPdf(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $dailies = $report->dailyRevenues()->orderBy('date')->get();
        $safaris = $report->safariDakwahLogs()->orderBy('date')->get();

        $details = \Illuminate\Support\Facades\DB::table('revenue_details')
            ->where('monthly_report_id', $report->id)
            ->selectRaw('channel, source_label, SUM(amount) as total')
            ->groupBy('channel', 'source_label')
            ->orderBy('channel')
            ->orderByRaw('SUM(amount) DESC')
            ->get();

        $byTeam         = [];
        $currentChannel = null;
        $channelTotal   = 0;

        foreach ($details as $d) {
            if ($currentChannel !== null && $currentChannel !== $d->channel) {
                $byTeam[] = [
                    'channel'     => '',
                    'source'      => 'Subtotal ' . $currentChannel,
                    'total'       => $channelTotal,
                    'is_subtotal' => true,
                ];
                $channelTotal = 0;
            }
            $currentChannel  = $d->channel;
            $channelTotal   += (int) $d->total;
            $byTeam[]        = [
                'channel'     => $d->channel,
                'source'      => $d->source_label ?? '—',
                'total'       => (int) $d->total,
                'is_subtotal' => false,
            ];
        }

        if ($currentChannel !== null) {
            $byTeam[] = [
                'channel'     => '',
                'source'      => 'Subtotal ' . $currentChannel,
                'total'       => $channelTotal,
                'is_subtotal' => true,
            ];
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView(
            'exports.laporan-bulanan',
            compact('report', 'dailies', 'safaris', 'byTeam')
        )->setPaper('a4', 'landscape');

        $filename = 'Laporan_' . $report->branch->code . '_'
            . \Carbon\Carbon::parse($report->period_month)->format('Y-m') . '.pdf';

        return $pdf->download($filename);
    }

    public function submit(Request $request, MonthlyReport $report)
    {
        abort_unless(
            $request->user()->canSubmitReport() || $request->user()->canManageAllBranches(),
            403
        );
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit.');

        $report->submit($request->user());

        return back()->with('success', 'Laporan berhasil disubmit.');
    }

    public function approve(Request $request, MonthlyReport $report)
    {
        abort_unless(
            $request->user()->canApproveReport() && $request->user()->canAccessBranch($report->branch),
            403
        );
        abort_unless($report->isSubmitted(), 422, 'Laporan belum disubmit.');

        $request->validate(['evaluation' => 'nullable|string|max:2000']);

        $report->approve($request->user());

        if ($request->filled('evaluation')) {
            $report->update(['evaluation' => $request->evaluation]);
        }

        return back()->with('success', 'Laporan berhasil disetujui.');
    }

    public function revise(Request $request, MonthlyReport $report)
    {
        abort_unless(
            $request->user()->canApproveReport() && $request->user()->canAccessBranch($report->branch),
            403
        );
        abort_unless($report->isSubmitted(), 422, 'Hanya laporan yang sudah disubmit yang bisa direvisi.');

        $request->validate([
            'revision_notes' => 'required|string|max:2000',
        ]);

        $report->revise($request->user(), $request->revision_notes);

        return back()->with('success', 'Laporan dikembalikan untuk revisi.');
    }

    public function updateEvaluation(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canInputData(), 403);
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
                    'days'              => $currentWeek,
                    'total_presentasi'  => collect($currentWeek)->sum('presentasi'),
                    'total_gerai'       => collect($currentWeek)->sum('gerai'),
                    'total_wgts'        => collect($currentWeek)->sum('wgts'),
                    'total_dfi'         => collect($currentWeek)->sum('dfi'),
                    'total_dfe'         => collect($currentWeek)->sum('dfe'),
                    'total_kotak'       => collect($currentWeek)->sum('kotak'),
                    'total_qris'        => collect($currentWeek)->sum('qris'),
                    'total_kotak_qris'  => collect($currentWeek)->sum('kotak_qris'), // legacy
                    'total_kantor'      => collect($currentWeek)->sum('kantor'),
                    'total'             => collect($currentWeek)->sum('total_daily'),
                ];
                $currentWeek = [];
            }
        }

        return $weeks;
    }

    private function buildRekapPerTim($report, ?string $selectedChannel = null): array
    {
        $allDetails = $report->revenueDetails ?? [];

        if ($selectedChannel) {
            $allDetails = array_filter($allDetails, fn($d) => $d['channel'] === $selectedChannel);
        }

        $byChannel = [];
        foreach ($allDetails as $detail) {
            $channel = $detail['channel'];
            if (!isset($byChannel[$channel])) {
                $byChannel[$channel] = [];
            }
            $byChannel[$channel][] = $detail;
        }

        $result = [];
        foreach ($byChannel as $channel => $details) {
            $bySource = [];

            foreach ($details as $d) {
                $sourceLabel = $d['source_label'] ?? 'Tanpa Sumber';

                if (!isset($bySource[$sourceLabel])) {
                    $bySource[$sourceLabel] = [
                        'source_label' => $sourceLabel,
                        'subtotal'     => 0,
                        'details'      => [],
                    ];
                }

                if ($d['sub_channel']) {
                    $existing = false;
                    foreach ($bySource[$sourceLabel]['details'] as &$detail) {
                        if ($detail['sub_channel'] === $d['sub_channel']) {
                            $detail['amount'] += $d['amount'];
                            $existing = true;
                            break;
                        }
                    }
                    unset($detail);

                    if (!$existing) {
                        $bySource[$sourceLabel]['details'][] = [
                            'sub_channel' => $d['sub_channel'],
                            'amount'      => $d['amount'],
                        ];
                    }
                } else {
                    $bySource[$sourceLabel]['details'][] = [
                        'sub_channel' => null,
                        'amount'      => $d['amount'],
                    ];
                }

                $bySource[$sourceLabel]['subtotal'] += $d['amount'];
            }

            usort($bySource, fn($a, $b) => $b['subtotal'] <=> $a['subtotal']);

            $result[$channel] = [
                'channel' => $channel,
                'sources' => array_values($bySource),
                'total'   => array_sum(array_column($bySource, 'subtotal')),
            ];
        }

        return $result;
    }
}