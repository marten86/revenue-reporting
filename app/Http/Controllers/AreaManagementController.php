<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AreaManagementController extends Controller
{
    public function index()
    {
        // Hanya Super Admin yang bisa akses halaman ini
        if (Auth::user()->role !== 'super_admin') {
            abort(403, 'Hanya Super Admin yang dapat mengakses halaman ini.');
        }

        $areas = Area::withCount('branches')
            ->with(['branches' => function ($q) {
                $q->select('id', 'area_id', 'name', 'code', 'is_active')
                  ->orderBy('name');
            }])
            ->orderBy('name')
            ->get();

        'unassignedBranches' => $unassignedBranches,

        return Inertia::render('Areas/Index', [
            'areas'              => $areas,
            'unassignedBranches' => $unassignedBranches,
        ]);
    }

    public function store(Request $request)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        $validated = $request->validate([
            'name'        => 'required|string|max:100',
            'code'        => 'required|string|max:20|unique:areas,code',
            'description' => 'nullable|string|max:255',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        Area::create($validated);

        return back()->with('success', 'Area berhasil ditambahkan.');
    }

    public function update(Request $request, Area $area)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        $validated = $request->validate([
            'name'        => 'required|string|max:100',
            'code'        => 'required|string|max:20|unique:areas,code,' . $area->id,
            'description' => 'nullable|string|max:255',
        ]);

        $validated['code'] = strtoupper($validated['code']);

        $area->update($validated);

        return back()->with('success', 'Area berhasil diperbarui.');
    }

    public function toggle(Area $area)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        $area->update(['is_active' => !$area->is_active]);

        return back()->with('success', 'Status area berhasil diubah.');
    }

    public function destroy(Area $area)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        if ($area->branches()->count() > 0) {
            return back()->withErrors(['error' => 'Area tidak bisa dihapus karena masih memiliki cabang.']);
        }

        $area->delete();

        return back()->with('success', 'Area berhasil dihapus.');
    }

    /**
     * Assign satu atau beberapa cabang ke area tertentu
     */
    public function assignBranches(Request $request, Area $area)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        $validated = $request->validate([
            'branch_ids'   => 'required|array',
            'branch_ids.*' => 'string|exists:branches,id',
        ]);

        Branch::whereIn('id', $validated['branch_ids'])
            ->update(['area_id' => $area->id]);

        return back()->with('success', 'Cabang berhasil di-assign ke area.');
    }

    /**
     * Lepas cabang dari area (set area_id = null)
     */
    public function unassignBranch(Area $area, Branch $branch)
    {
        if (Auth::user()->role !== 'super_admin') {
            abort(403);
        }

        if ($branch->area_id !== $area->id) {
            return back()->withErrors(['error' => 'Cabang tidak terdaftar di area ini.']);
        }

        $branch->update(['area_id' => null]);

        return back()->with('success', 'Cabang berhasil dilepas dari area.');
    }
}