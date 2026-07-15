<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\SafariDakwahLog;
use App\Models\SafdakEvent;
use App\Models\Speaker;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SafdakEventController extends Controller
{
    /**
     * Halaman pipeline: daftar kampanye SafDak dengan filter status/cabang/bulan.
     * Scope baca mengikuti pola SafariCalendarController:
     * - seesAllBranches() → semua cabang
     * - selain itu → accessibleBranches() (AM: cabang areanya; BH/staff: cabang sendiri)
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $accessibleBranches = $user->seesAllBranches()
            ? Branch::orderBy('name')->get(['id', 'name', 'code'])
            : $user->accessibleBranches()->orderBy('name')->get(['id', 'name', 'code']);

        $branchIds = $accessibleBranches->pluck('id')->all();

        // Builder dasar sesuai filter cabang & bulan (dipakai list + summary)
        $base = SafdakEvent::query()->forBranches($branchIds);

        if ($request->filled('branch') && in_array($request->get('branch'), $branchIds, true)) {
            $base->where('branch_id', $request->get('branch'));
        }

        if (preg_match('/^\d{4}-\d{2}$/', (string) $request->get('month'))) {
            [$year, $month] = explode('-', $request->get('month'));
            $base->overlapsMonth((int) $year, (int) $month);
        }

        // List: + filter status
        $listQuery = (clone $base)
            ->with('branch:id,name,code')
            ->orderBy('start_date');

        if ($request->filled('status') && in_array($request->get('status'), SafdakEvent::STATUSES, true)) {
            $listQuery->status($request->get('status'));
        }

        $events = $listQuery->get();

        // Summary: TANPA filter status (angka funnel tetap utuh).
        // Target min/ideal = turunan tanggal → dijumlah via accessor di PHP
        // (bukan SQL), dari set yang sama dengan filter cabang+bulan.
        $summaryEvents = (clone $base)->get([
            'id', 'start_date', 'end_date', 'custom_dates', 'status',
            'titik_deal', 'titik_eksekusi', 'revenue_komitmen', 'revenue_realisasi',
        ]);

        $summary = [
            'total'              => $summaryEvents->count(),
            'per_status'         => $summaryEvents->countBy('status'),
            'target_min'         => $summaryEvents->sum->target_min,
            'target_ideal'       => $summaryEvents->sum->target_ideal,
            'titik_deal'         => (int) $summaryEvents->sum('titik_deal'),
            'titik_eksekusi'     => (int) $summaryEvents->sum('titik_eksekusi'),
            'revenue_komitmen'   => (float) $summaryEvents->sum('revenue_komitmen'),
            'revenue_realisasi'  => (float) $summaryEvents->sum('revenue_realisasi'),
        ];

        // Narasumber (dai) untuk dropdown form — cabang accessible + nasional,
        // difilter per cabang terpilih di frontend
        $speakers = Speaker::query()
            ->active()
            ->where(function ($q) use ($branchIds) {
                $q->whereNull('branch_id')->orWhereIn('branch_id', $branchIds);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'branch_id']);

        // Laporan bulanan kandidat tujuan "Catat Realisasi" — 6 bulan terakhir
        // pada cabang accessible. TIDAK pernah auto-create report (pelajaran
        // insiden import); kalau laporan bulan berjalan belum ada, tim membuat
        // dulu lewat halaman Laporan seperti biasa.
        $reports = MonthlyReport::query()
            ->whereIn('branch_id', $branchIds)
            ->where('period_month', '>=', now()->subMonths(6)->startOfMonth()->format('Y-m-d'))
            ->orderByDesc('period_month')
            ->get(['id', 'branch_id', 'period_month', 'status'])
            ->map(fn ($r) => [
                'id'           => $r->id,
                'branch_id'    => $r->branch_id,
                'period_month' => $r->period_month instanceof \Carbon\CarbonInterface
                    ? $r->period_month->format('Y-m-d')
                    : (string) $r->period_month,
                'status'       => $r->status,
            ])
            ->values();

        return Inertia::render('SafdakPipeline/Index', [
            'events'    => $events,
            'branches'  => $accessibleBranches,
            'speakers'  => $speakers,
            'reports'   => $reports,
            'statuses'  => SafdakEvent::STATUSES,
            'summary'   => $summary,
            'filters'   => [
                'status' => $request->get('status'),
                'branch' => $request->get('branch'),
                'month'  => $request->get('month'),
            ],
            'canWrite'  => $user->canInputData(),
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeWrite($request, $request->get('branch_id'));

        $data = $this->validateEvent($request);

        SafdakEvent::create($data);

        return back()->with('success', 'Kampanye Safari Dakwah berhasil ditambahkan.');
    }

    public function update(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        // Bila branch_id ikut diubah, pastikan cabang tujuan juga dalam scope
        if ($request->filled('branch_id') && $request->get('branch_id') !== $event->branch_id) {
            $this->authorizeWrite($request, $request->get('branch_id'));
        }

        $data = $this->validateEvent($request);

        $event->update($data);

        return back()->with('success', 'Kampanye Safari Dakwah berhasil diperbarui.');
    }

    /**
     * Update status saja (aksi cepat dari list: rencana → berjalan → selesai / batal).
     */
    public function updateStatus(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        $validated = $request->validate([
            'status' => ['required', Rule::in(SafdakEvent::STATUSES)],
        ]);

        $event->update($validated);

        return back()->with('success', 'Status kampanye diperbarui.');
    }

    public function destroy(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        $event->delete();

        return back()->with('success', 'Kampanye Safari Dakwah dihapus.');
    }

    /**
     * Jembatan kampanye → realisasi: buat entri safari_dakwah_logs dari
     * kampanye ini, menempel ke laporan bulanan PILIHAN user (tidak pernah
     * auto-create report). date = tanggal kegiatan asli (boleh bulan lampau,
     * mengikuti kebiasaan tim), event_id terisi sebagai soft link.
     */
    public function storeRealization(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        $validated = $request->validate([
            'monthly_report_id' => ['required', 'uuid', 'exists:monthly_reports,id'],
            'date'              => ['required', 'date'],
            'time'              => ['nullable', 'string', 'max:20'],
            'location'          => ['nullable', 'string', 'max:255'],
            'commitment'        => ['nullable', 'numeric', 'min:0'],
            'realization'       => ['nullable', 'numeric', 'min:0'],
            'cost'              => ['nullable', 'numeric', 'min:0'],
            'notes'             => ['nullable', 'string', 'max:2000'],
        ]);

        // Laporan tujuan harus milik cabang yang sama dengan kampanye
        $report = MonthlyReport::findOrFail($validated['monthly_report_id']);
        abort_unless($report->branch_id === $event->branch_id, 422,
            'Laporan tujuan bukan milik cabang kampanye ini.');

        // Assignment eksplisit per kolom (bukan mass-assignment) supaya tidak
        // bergantung pada $fillable SafariDakwahLog yang mungkin belum memuat
        // kolom-kolom baru (event_id, cost, has_mou, dst).
        $log = new SafariDakwahLog();
        $log->monthly_report_id = $report->id;
        $log->date        = $validated['date'];
        // day_name NOT NULL tanpa default — nama hari Indonesia dari tanggal
        // (pola yang sama dengan input TabSafari)
        $log->day_name    = [
            'Sunday'    => 'Ahad',
            'Monday'    => 'Senin',
            'Tuesday'   => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday'  => 'Kamis',
            'Friday'    => 'Jumat',
            'Saturday'  => 'Sabtu',
        ][\Carbon\Carbon::parse($validated['date'])->format('l')];
        $log->time        = $validated['time'] ?? null;
        $log->speaker     = $event->speaker;
        $log->location    = $validated['location'] ?? null;
        $log->status      = 'done';
        // safari_dakwah_logs.commitment/realization/cost bertipe BIGINT — tidak
        // menerima string berformat desimal ("450000000.00", hasil decimal:2
        // cast di SafdakEvent). Bulatkan ke integer dulu. cost NOT NULL
        // default 0 — jangan assign null.
        $log->commitment  = isset($validated['commitment']) ? (int) round((float) $validated['commitment']) : 0;
        $log->realization = isset($validated['realization']) ? (int) round((float) $validated['realization']) : 0;
        $log->cost        = isset($validated['cost']) ? (int) round((float) $validated['cost']) : 0;
        $log->has_mou     = (bool) $event->has_mou;
        $log->notes       = $validated['notes'] ?? null;
        $log->event_id    = $event->id;
        $log->save();

        return back()->with('success', 'Realisasi tercatat ke laporan bulanan. Kegiatan kini muncul sebagai Realisasi di kalender.');
    }

    // ── Helpers ────────────────────────────────────────────────

    private function authorizeWrite(Request $request, ?string $branchId): void
    {
        $user = $request->user();

        abort_unless($user->canInputData(), 403);
        abort_unless($branchId, 403);

        // canAccessBranch() di User.php mengharapkan objek Branch, bukan uuid
        // string — resolve dulu. 404 wajar bila branch_id kiriman tidak valid.
        $branch = Branch::findOrFail($branchId);

        abort_unless($user->canAccessBranch($branch), 403);
    }

    private function validateEvent(Request $request): array
    {
        $validated = $request->validate([
            'branch_id'         => ['required', 'uuid', 'exists:branches,id'],
            'title'             => ['nullable', 'string', 'max:255'],
            'start_date'        => ['required', 'date'],
            'end_date'          => ['required', 'date', 'after_or_equal:start_date'],
            'custom_dates'      => ['nullable', 'array'],
            'custom_dates.*'    => ['date', 'after_or_equal:start_date', 'before_or_equal:end_date'],
            'speaker'           => ['nullable', 'string', 'max:255'],
            'grade'             => ['nullable', 'string', 'max:100'],
            'status'            => ['required', Rule::in(SafdakEvent::STATUSES)],
            'titik_deal'        => ['nullable', 'integer', 'min:0'],
            'titik_eksekusi'    => ['nullable', 'integer', 'min:0'],
            'total_cost'        => ['nullable', 'numeric', 'min:0'],
            'revenue_komitmen'  => ['nullable', 'numeric', 'min:0'],
            'revenue_realisasi' => ['nullable', 'numeric', 'min:0'],
            'has_mou'           => ['boolean'],
            'notes'             => ['nullable', 'string', 'max:2000'],
        ]);

        // Rapikan custom_dates: buang duplikat, urutkan; kosong → null
        if (! empty($validated['custom_dates'])) {
            $dates = array_values(array_unique($validated['custom_dates']));
            sort($dates);
            $validated['custom_dates'] = $dates;
        } else {
            $validated['custom_dates'] = null;
        }

        return $validated;
    }
}