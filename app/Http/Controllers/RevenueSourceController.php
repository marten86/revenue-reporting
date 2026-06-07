<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\RevenueSource;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\MonthlyReport;
use Inertia\Inertia;
use Inertia\Response;

class RevenueSourceController extends Controller
{
    // Tampilkan halaman kelola master data per cabang
    public function index(Request $request): Response
    {
        $user = $request->user();
        
        // Ambil cabang yang accessible untuk user
        $branches = $user->accessibleBranches()->get(['id', 'name', 'code']);
        
        // Default: cabang pertama (jika ada), atau user's branch jika tidak admin
        $selectedBranchId = $request->get('branch_id', $user->branch_id ?? $branches->first()?->id);
        
        $sources = RevenueSource::where('branch_id', $selectedBranchId)
            ->orderBy('channel')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->groupBy('channel');

        return Inertia::render('RevenueSource/Index', [
            'branches'     => $branches,
            'selectedBranchId' => $selectedBranchId,
            'sources'      => $sources,
            'channels'     => MonthlyReport::CHANNELS,
        ]);
    }

    // Tambah sumber baru (dari form laporan atau halaman master data)
    public function store(Request $request, Branch $branch)
    {
        abort_unless($request->user()->canAccessBranch($branch), 403);

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'type'      => ['required', Rule::in(['team', 'person'])],
            'channel'   => ['required', Rule::in(MonthlyReport::CHANNELS)],
            'personnel' => 'nullable|string|max:500',
        ]);

        $source = RevenueSource::create([
            'branch_id' => $branch->id,
            ...$data,
        ]);

        return back()->with('success', "Sumber \"{$source->name}\" berhasil ditambahkan.");
    }

    // Update nama / personil
    public function update(Request $request, RevenueSource $source)
    {
        abort_unless($request->user()->canAccessBranch($source->branch), 403);

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'personnel' => 'nullable|string|max:500',
            'sort_order' => 'integer|min:0',
        ]);

        $source->update($data);

        return back()->with('success', "Sumber \"{$source->name}\" berhasil diperbarui.");
    }

    // Aktifkan / nonaktifkan (soft toggle, bukan hapus)
    public function toggleActive(RevenueSource $source)
    {
        $source->update(['is_active' => !$source->is_active]);

        $status = $source->is_active ? 'diaktifkan' : 'dinonaktifkan';
        return back()->with('success', "\"{$source->name}\" berhasil {$status}.");
    }

    // Hapus permanen (hanya jika belum pernah dipakai)
    public function destroy(Request $request, RevenueSource $source)
    {
        abort_unless($request->user()->canAccessBranch($source->branch), 403);
        $source->delete();

        return back()->with('success', 'Sumber berhasil dihapus.');
    }
}