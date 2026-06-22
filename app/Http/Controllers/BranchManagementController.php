<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Branch;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BranchManagementController extends Controller
{
    /**
     * Pastikan cabang berada dalam wewenang user (area-nya).
     * Super Admin: semua cabang. Area Manager: hanya cabang di areanya.
     */
    private function authorizeBranch(Request $request, Branch $branch): void
    {
        $allowed = $request->user()->accessibleBranches()->where('branches.id', $branch->id)->exists();
        abort_unless($allowed, 403, 'Cabang ini berada di luar wewenang Anda.');
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $branches = $request->user()->accessibleBranches()
            ->with('area')
            ->withCount('users')
            ->orderBy('name')
            ->get();

        $areas = $request->user()->isSuperAdmin()
            ? Area::orderBy('name')->get(['id', 'name'])
            : Area::where('id', $request->user()->area_id)->get(['id', 'name']);

        return Inertia::render('Branches/Index', [
            'branches' => $branches,
            'areas'    => $areas,
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'code'     => 'required|string|max:10|unique:branches,code',
            'city'     => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'area_id'  => 'required|uuid|exists:areas,id',
        ]);

        // Area Manager hanya boleh membuat cabang di areanya sendiri
        if (!$request->user()->isSuperAdmin() && $data['area_id'] !== $request->user()->area_id) {
            abort(403, 'Anda hanya dapat menambah cabang di area Anda sendiri.');
        }

        Branch::create([...$data, 'is_active' => true]);

        return back()->with('success', "Cabang \"{$data['name']}\" berhasil ditambahkan.");
    }

    public function update(Request $request, Branch $branch)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);
        $this->authorizeBranch($request, $branch);

        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'code'     => 'required|string|max:10|unique:branches,code,' . $branch->id,
            'city'     => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'area_id'  => 'required|uuid|exists:areas,id',
        ]);

        // Area Manager tidak boleh memindahkan cabang ke area di luar wewenangnya
        if (!$request->user()->isSuperAdmin() && $data['area_id'] !== $request->user()->area_id) {
            abort(403, 'Anda hanya dapat memindahkan cabang dalam area Anda sendiri.');
        }

        $branch->update($data);

        return back()->with('success', "Cabang \"{$branch->name}\" berhasil diperbarui.");
    }

    public function toggleActive(Request $request, Branch $branch)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);
        $this->authorizeBranch($request, $branch);

        $branch->update(['is_active' => !$branch->is_active]);
        $status = $branch->is_active ? 'diaktifkan' : 'dinonaktifkan';

        return back()->with('success', "Cabang \"{$branch->name}\" berhasil {$status}.");
    }

    public function destroy(Request $request, Branch $branch)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);
        $this->authorizeBranch($request, $branch);

        abort_if($branch->users()->count() > 0, 422, 'Cabang masih punya user. Pindahkan user dulu.');
        abort_if($branch->monthlyReports()->count() > 0, 422, 'Cabang masih punya laporan. Tidak bisa dihapus.');

        $branch->delete();

        return back()->with('success', "Cabang \"{$branch->name}\" berhasil dihapus.");
    }
}