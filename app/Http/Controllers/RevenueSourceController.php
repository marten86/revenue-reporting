<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\RevenueSource;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\MonthlyReport;

class RevenueSourceController extends Controller
{
    // Tambah sumber baru (dipanggil dari form laporan)
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