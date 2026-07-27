<?php

namespace App\Http\Controllers;

use App\Models\Branch;
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
     * - seesAllBranches() -> semua cabang
     * - selain itu -> accessibleBranches() (AM: cabang areanya; BH/staff: cabang sendiri)
     *
     * CATATAN: pipeline TIDAK lagi terhubung ke laporan bulanan. Jembatan
     * "Catat Realisasi" (storeRealization + prop reports) dihapus 27 Juli 2026
     * atas keputusan Marten. Revenue di halaman ini murni angka manajerial;
     * angka resmi diinput terpisah lewat TabSafari di laporan bulanan.
     * Kolom safari_dakwah_logs.event_id SENGAJA dipertahankan (soft link,
     * CRM-ready) supaya log lama tetap punya jejak asal-usulnya.
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
        // Target min/ideal = turunan tanggal -> dijumlah via accessor di PHP
        // (bukan SQL), dari set yang sama dengan filter cabang+bulan.
        $summaryEvents = (clone $base)->get([
            'id', 'start_date', 'end_date', 'custom_dates', 'status',
            'titik_deal', 'titik_eksekusi', 'revenue_komitmen', 'revenue_realisasi',
        ]);

        // revenue_komitmen / revenue_realisasi dikirim sebagai float; persentase
        // capaian dihitung di frontend (realisasi / komitmen). Komitmen 0 di
        // frontend ditampilkan "-", bukan 0%.
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

        // Narasumber (dai) untuk dropdown form - cabang accessible + nasional,
        // difilter per cabang terpilih di frontend
        $speakers = Speaker::query()
            ->active()
            ->where(function ($q) use ($branchIds) {
                $q->whereNull('branch_id')->orWhereIn('branch_id', $branchIds);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'branch_id']);

        return Inertia::render('SafdakPipeline/Index', [
            'events'    => $events,
            'branches'  => $accessibleBranches,
            'speakers'  => $speakers,
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
     * Update status saja (aksi cepat dari list: rencana -> berjalan -> selesai / batal).
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

    // -- Helpers ------------------------------------------------

    private function authorizeWrite(Request $request, ?string $branchId): void
    {
        $user = $request->user();

        abort_unless($user->canInputData(), 403);
        abort_unless($branchId, 403);

        // canAccessBranch() di User.php mengharapkan objek Branch, bukan uuid
        // string - resolve dulu. 404 wajar bila branch_id kiriman tidak valid.
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

        // Rapikan custom_dates: buang duplikat, urutkan; kosong -> null
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