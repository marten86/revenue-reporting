<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Speaker;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SpeakerController extends Controller
{
    // Halaman kelola master data narasumber (mirror pola RevenueSourceController@index)
    public function index(Request $request): Response
    {
        $user = $request->user();

        $branches  = $user->accessibleBranches()->get(['id', 'name', 'code']);
        $branchIds = $branches->pluck('id')->toArray();

        $requested = $request->get('branch_id', $user->branch_id ?? $branches->first()?->id);

        $selectedBranchId = in_array($requested, $branchIds, true)
            ? $requested
            : ($branches->first()?->id);

        $branchSpeakers = $selectedBranchId
            ? Speaker::where('branch_id', $selectedBranchId)->orderBy('name')->get()
            : collect();

        $canManageNational = $this->canManageNational($user);

        $nationalSpeakers = $canManageNational
            ? Speaker::whereNull('branch_id')->orderBy('name')->get()
            : collect();

        return Inertia::render('Speakers/Index', [
            'branches'          => $branches,
            'selectedBranchId'  => $selectedBranchId,
            'branchSpeakers'    => $branchSpeakers,
            'nationalSpeakers'  => $nationalSpeakers,
            'canManageNational' => $canManageNational,
            'canEdit'           => $user->canInputData(),
        ]);
    }

    // Tambah narasumber baru — dipakai baik dari halaman kelola maupun quick-add di form Safari Dakwah
    public function store(Request $request)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ blokir viewer; admin_nasional lolos

        $data = $request->validate([
            'name'      => 'required|string|max:200',
            'branch_id' => 'nullable|uuid|exists:branches,id',
        ]);

        $name = trim($data['name']);
        $branchId = $data['branch_id'] ?? null;

        if ($branchId === null) {
            abort_unless($this->canManageNational($request->user()), 403,
                'Hanya Super Admin, Area Manager, atau Admin Nasional yang boleh menambah narasumber nasional.');
        } else {
            $branch = Branch::findOrFail($branchId);
            abort_unless($request->user()->canAccessBranch($branch), 403);
        }

        // Cegah duplikat (case-insensitive) dalam scope yang sama
        $duplicate = Speaker::where('branch_id', $branchId)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($duplicate) {
            return back()->withErrors(['name' => "Narasumber \"{$name}\" sudah ada di scope ini."])->withInput();
        }

        $speaker = Speaker::create([
            'branch_id' => $branchId,
            'name'      => $name,
            'is_active' => true,
        ]);

        return back()->with('success', "Narasumber \"{$speaker->name}\" berhasil ditambahkan.");
    }

    public function update(Request $request, Speaker $speaker)
    {
        abort_unless($request->user()->canInputData(), 403);
        $this->authorizeScope($request, $speaker);

        $data = $request->validate([
            'name' => 'required|string|max:200',
        ]);

        $speaker->update(['name' => trim($data['name'])]);

        return back()->with('success', "Narasumber \"{$speaker->name}\" berhasil diperbarui.");
    }

    public function toggleActive(Request $request, Speaker $speaker)
    {
        abort_unless($request->user()->canInputData(), 403);
        $this->authorizeScope($request, $speaker);

        $speaker->update(['is_active' => !$speaker->is_active]);

        $status = $speaker->is_active ? 'diaktifkan' : 'dinonaktifkan';
        return back()->with('success', "\"{$speaker->name}\" berhasil {$status}.");
    }

    public function destroy(Request $request, Speaker $speaker)
    {
        abort_unless($request->user()->canInputData(), 403);
        $this->authorizeScope($request, $speaker);

        // Aman dihapus: kolom `speaker` di safari_dakwah_logs adalah string bebas,
        // bukan foreign key — data historis tidak berubah.
        $speaker->delete();

        return back()->with('success', 'Narasumber berhasil dihapus.');
    }

    private function authorizeScope(Request $request, Speaker $speaker): void
    {
        if ($speaker->branch_id === null) {
            abort_unless($this->canManageNational($request->user()), 403);
        } else {
            abort_unless($request->user()->canAccessBranch($speaker->branch), 403);
        }
    }

    private function canManageNational($user): bool
    {
        return in_array($user->role, ['super_admin', 'area_manager', 'admin_nasional'], true);
    }
}