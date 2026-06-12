<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserManagementController extends Controller
{
    public function index(Request $request)
    {
        $authUser = $request->user();
        abort_unless($authUser->canManageAllBranches(), 403);

        $users = User::with(['branch', 'area'])
            ->when(!$authUser->isSuperAdmin(), fn ($q) =>
                $q->whereHas('branch', fn ($b) => $b->where('area_id', $authUser->area_id))
                  ->orWhere('area_id', $authUser->area_id)
            )
            ->orderByRaw("CASE role
                WHEN 'super_admin' THEN 1
                WHEN 'area_manager' THEN 2
                WHEN 'branch_head' THEN 3
                ELSE 4 END")
            ->orderBy('name')
            ->get();

        $branches = $authUser->accessibleBranches()->where('is_active', true)->get(['id', 'name', 'code', 'area_id']);

        $areas = $authUser->isSuperAdmin()
            ? Area::where('is_active', true)->orderBy('name')->get(['id', 'name'])
            : Area::where('id', $authUser->area_id)->get(['id', 'name']);

        return Inertia::render('Users/Index', [
            'users'    => $users,
            'branches' => $branches,
            'areas'    => $areas,
            'roles'    => [
                ['value' => 'super_admin',  'label' => 'Super Admin'],
                ['value' => 'area_manager', 'label' => 'Area Manager'],
                ['value' => 'branch_head',  'label' => 'Kepala Cabang'],
                ['value' => 'staff',        'label' => 'Staff'],
            ],
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:6',
            'role'      => ['required', Rule::in(['super_admin', 'area_manager', 'branch_head', 'staff'])],
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'area_id'   => 'nullable|uuid|exists:areas,id',
            'phone'     => 'nullable|string|max:20',
        ]);

        if ($data['branch_id']) {
            $areaId = Branch::find($data['branch_id'])->area_id;
        } elseif (!empty($data['area_id'])) {
            $areaId = $data['area_id'];
        } elseif ($data['role'] === 'super_admin') {
            $areaId = null;
        } else {
            $areaId = $request->user()->area_id;
        }

        User::create([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'password'  => $data['password'],
            'role'      => $data['role'],
            'branch_id' => $data['branch_id'] ?? null,
            'area_id'   => $areaId,
            'phone'     => $data['phone'] ?? null,
        ]);

        return back()->with('success', "User \"{$data['name']}\" berhasil ditambahkan.");
    }

    public function update(Request $request, User $user)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'email'     => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'role'      => ['required', Rule::in(['super_admin', 'area_manager', 'branch_head', 'staff'])],
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'area_id'   => 'nullable|uuid|exists:areas,id',
            'phone'     => 'nullable|string|max:20',
        ]);

        if ($data['branch_id']) {
            $areaId = Branch::find($data['branch_id'])->area_id;
        } elseif (!empty($data['area_id'])) {
            $areaId = $data['area_id'];
        } elseif ($data['role'] === 'super_admin') {
            $areaId = null;
        } else {
            $areaId = $user->area_id;
        }

        $user->update([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'role'      => $data['role'],
            'branch_id' => $data['branch_id'] ?? null,
            'area_id'   => $areaId,
            'phone'     => $data['phone'] ?? null,
        ]);

        return back()->with('success', "User \"{$user->name}\" berhasil diperbarui.");
    }

    public function resetPassword(Request $request, User $user)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $data = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $user->update(['password' => $data['password']]);

        return back()->with('success', "Password \"{$user->name}\" berhasil direset.");
    }

    public function destroy(Request $request, User $user)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);
        abort_if($user->id === $request->user()->id, 422, 'Tidak bisa menghapus akun sendiri.');

        $user->delete();

        return back()->with('success', "User \"{$user->name}\" berhasil dihapus.");
    }
}