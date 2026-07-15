<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\SafariDakwahLog;
use App\Models\SafdakEvent;
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

        // Cabang yang bisa diakses user: seesAllBranches() → semua; selain
        // itu → accessibleBranches() (AM: cabang areanya; BH/staff: cabang
        // sendiri). FIX: sebelumnya pakai $user->branch_id tunggal — kolom
        // ini NULL untuk Area Manager (mereka terikat area_id, bukan satu
        // branch_id), sehingga AM tidak pernah melihat data apa pun di
        // kalender (logs maupun events). Pola accessibleBranches() ini
        // sudah dipakai konsisten di SafdakEventController.
        $accessibleBranches = $user->seesAllBranches()
            ? Branch::orderBy('name')->get(['id', 'name'])
            : $user->accessibleBranches()->orderBy('name')->get(['id', 'name']);

        $branchIds = $accessibleBranches->pluck('id')->all();

        $query = SafariDakwahLog::query()
            ->with(['monthlyReport.branch:id,name'])
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->whereHas('monthlyReport', function ($q) use ($branchIds) {
                $q->whereIn('branch_id', $branchIds);
            });

        // Filter cabang opsional — berlaku untuk siapa pun yang accessible
        // branch-nya lebih dari satu (nasional ATAU area manager multi-cabang)
        $branchFilter = $request->input('branch_id');
        if ($branchFilter && in_array($branchFilter, $branchIds, true)) {
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

        // ── Sumber kedua: kampanye pipeline (safdak_events) ──────────
        // Kampanye yang bersinggungan dengan bulan aktif, scope cabang sama
        // ($branchIds) dengan logs. branch_id ada langsung di tabel (tanpa
        // via report).
        $eventQuery = SafdakEvent::query()
            ->with('branch:id,name')
            ->overlapsMonth((int) $start->year, (int) $start->month)
            ->whereIn('branch_id', $branchIds);

        if ($branchFilter && in_array($branchFilter, $branchIds, true)) {
            $eventQuery->where('branch_id', $branchFilter);
        }

        $events = $eventQuery
            ->orderBy('start_date')
            ->get()
            ->map(function ($ev) use ($start, $end) {
                // Tanggal aktif kampanye DI DALAM bulan tampil:
                // custom_dates → hanya yang jatuh di bulan ini;
                // rentang penuh → semua hari irisan [start_date, end_date] ∩ bulan.
                if (is_array($ev->custom_dates) && count($ev->custom_dates) > 0) {
                    $dates = array_values(array_filter(
                        $ev->custom_dates,
                        fn ($d) => $d >= $start->toDateString() && $d <= $end->toDateString()
                    ));
                } else {
                    $from  = $ev->start_date->greaterThan($start) ? $ev->start_date->copy() : $start->copy();
                    $to    = $ev->end_date->lessThan($end) ? $ev->end_date->copy() : $end->copy();
                    $dates = [];
                    for ($d = $from->copy(); $d->lessThanOrEqualTo($to); $d->addDay()) {
                        $dates[] = $d->toDateString();
                    }
                }

                return [
                    'id'                => $ev->id,
                    'title'             => $ev->title,
                    'speaker'           => $ev->speaker,
                    'grade'             => $ev->grade,
                    'status'            => $ev->status,
                    'start_date'        => $ev->start_date->toDateString(),
                    'end_date'          => $ev->end_date->toDateString(),
                    'dates'             => $dates,
                    'is_custom'         => is_array($ev->custom_dates) && count($ev->custom_dates) > 0,
                    'total_days'        => $ev->total_days,
                    'target_min'        => $ev->target_min,
                    'target_ideal'      => $ev->target_ideal,
                    'titik_deal'        => $ev->titik_deal,
                    'titik_eksekusi'    => $ev->titik_eksekusi,
                    'total_cost'        => (float) ($ev->total_cost ?? 0),
                    'revenue_komitmen'  => (float) ($ev->revenue_komitmen ?? 0),
                    'revenue_realisasi' => (float) ($ev->revenue_realisasi ?? 0),
                    'has_mou'           => (bool) $ev->has_mou,
                    'notes'             => $ev->notes,
                    'branch_id'         => $ev->branch_id,
                    'branch_name'       => $ev->branch?->name ?? '-',
                ];
            })
            ->values();

        return Inertia::render('SafariCalendar/Index', [
            'month'        => $start->format('Y-m'),
            'logs'         => $logs,
            'events'       => $events,
            'branches'     => $accessibleBranches,
            'branchFilter' => $branchFilter,
            // Tampilkan filter cabang & legenda bila user punya >1 cabang
            // accessible — sebelumnya hanya true untuk role nasional
            // (seesAllBranches), kini juga true untuk AM multi-cabang.
            'canSeeAll'    => $accessibleBranches->count() > 1,
        ]);
    }
}