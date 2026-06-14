<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\CostDetail;
use App\Models\MonthlyCost;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CostController extends Controller
{
    // ── Index ────────────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $user  = $request->user();
        $month = $request->get('month', now()->format('Y-m-01'));

        $branchIds = $user->accessibleBranches()->pluck('id');

        $costs = MonthlyCost::with(['branch.area'])
            ->whereIn('branch_id', $branchIds)
            ->where('period_month', $month)
            ->orderByRaw("CASE status
                WHEN 'submitted' THEN 1
                WHEN 'approved'  THEN 2
                WHEN 'draft'     THEN 3
                ELSE 4 END")
            ->get();

        return Inertia::render('Costs/Index', [
            'costs'        => $costs,
            'currentMonth' => $month,
        ]);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function create(Request $request): Response
    {
        $user     = $request->user();
        $branches = $user->accessibleBranches()->get(['id', 'name', 'code']);

        return Inertia::render('Costs/Create', [
            'branches' => $branches,
        ]);
    }

    // ── Store ────────────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'branch_id'    => 'required|uuid|exists:branches,id',
            'period_month' => 'required|date_format:Y-m-d',
        ]);

        $branch = Branch::findOrFail($data['branch_id']);
        abort_unless($request->user()->canAccessBranch($branch), 403);

        $existing = MonthlyCost::where('branch_id', $data['branch_id'])
            ->where('period_month', $data['period_month'])
            ->first();

        if ($existing) {
            return redirect()->route('costs.show', $existing)
                ->with('warning', 'Laporan biaya periode ini sudah ada.');
        }

        $cost = MonthlyCost::create([
            'branch_id'    => $data['branch_id'],
            'period_month' => $data['period_month'],
            'status'       => MonthlyCost::STATUS_DRAFT,
            'total_cost'   => 0,
        ]);

        // Inisialisasi 16 baris kategori dengan amount 0
        $categories = MonthlyCost::categories();
        foreach ($categories as $i => $category) {
            $cost->costDetails()->create([
                'category'   => $category,
                'description' => null,
                'amount'     => 0,
                'sort_order' => $i + 1,
            ]);
        }

        return redirect()->route('costs.show', $cost)
            ->with('success', 'Laporan biaya berhasil dibuat.');
    }

    // ── Show ─────────────────────────────────────────────────────────────────

    public function show(Request $request, MonthlyCost $cost): Response
    {
        abort_unless($request->user()->canAccessBranch($cost->branch), 403);

        $cost->load([
            'branch.area',
            'costDetails' => fn($q) => $q->orderBy('sort_order'),
            'submittedBy',
            'approvedBy',
            'revisedBy',
        ]);

        $user = $request->user();

        // Pastikan semua 16 kategori ada
        $existingCategories = $cost->costDetails->pluck('category')->toArray();
        $allCategories      = MonthlyCost::categories();
        foreach ($allCategories as $i => $category) {
            if (!in_array($category, $existingCategories)) {
                $cost->costDetails()->create([
                    'category'   => $category,
                    'description' => null,
                    'amount'     => 0,
                    'sort_order' => $i + 1,
                ]);
            }
        }

        // Reload setelah sync
        $cost->load(['costDetails' => fn($q) => $q->orderBy('sort_order')]);

        return Inertia::render('Costs/Show', [
            'cost'       => $cost,
            'categories' => $allCategories,
            'canSubmit'  => ($user->canSubmitReport() || $user->canManageAllBranches()) && $cost->isDraft(),
            'canApprove' => $user->isAreaManager() && $cost->isSubmitted(),
            'canRevise'  => $user->isAreaManager() && $cost->isSubmitted(),
        ]);
    }

    // ── Grid Save (upsert semua kategori sekaligus) ──────────────────────────

    public function saveGrid(Request $request, MonthlyCost $cost)
    {
        abort_unless($request->user()->canAccessBranch($cost->branch), 403);
        abort_unless($cost->isDraft(), 422, 'Laporan sudah disubmit.');

        $request->validate([
            'items'               => 'required|array',
            'items.*.category'    => 'required|string',
            'items.*.amount'      => 'required|integer|min:0',
            'items.*.description' => 'nullable|string|max:255',
        ]);

        foreach ($request->items as $i => $item) {
            $cost->costDetails()->updateOrCreate(
                ['category' => $item['category']],
                [
                    'amount'      => $item['amount'],
                    'description' => $item['description'] ?? null,
                    'sort_order'  => $i + 1,
                ]
            );
        }

        $cost->recalculate();

        return back()->with('success', 'Data biaya berhasil disimpan.');
    }

    // ── Workflow ─────────────────────────────────────────────────────────────

    public function submit(Request $request, MonthlyCost $cost)
    {
        abort_unless($request->user()->canAccessBranch($cost->branch), 403);
        abort_unless($cost->isDraft(), 422, 'Laporan sudah disubmit.');

        $cost->submit($request->user());

        return back()->with('success', 'Laporan biaya berhasil disubmit.');
    }

    public function approve(Request $request, MonthlyCost $cost)
    {
        abort_unless($request->user()->isAreaManager(), 403);
        abort_unless($cost->isSubmitted(), 422, 'Laporan belum disubmit.');

        $request->validate(['evaluation' => 'nullable|string|max:2000']);

        $cost->approve($request->user());

        if ($request->filled('evaluation')) {
            $cost->update(['evaluation' => $request->evaluation]);
        }

        return back()->with('success', 'Laporan biaya berhasil disetujui.');
    }

    public function revise(Request $request, MonthlyCost $cost)
    {
        abort_unless($request->user()->isAreaManager(), 403);
        abort_unless($cost->isSubmitted(), 422, 'Hanya laporan yang sudah disubmit yang bisa direvisi.');

        $request->validate([
            'revision_notes' => 'required|string|max:2000',
        ]);

        $cost->revise($request->user(), $request->revision_notes);

        return back()->with('success', 'Laporan dikembalikan untuk revisi.');
    }
}