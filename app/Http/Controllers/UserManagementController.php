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
    // ⬅ NEW: role tingkat nasional — hanya super_admin yang boleh buat/kelola,
    // dan tidak terikat cabang/area mana pun (branch_id & area_id = null).
    private const NATIONAL_ROLES = ['super_admin', 'admin_nasional', 'viewer'];

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
                WHEN 'super_admin'    THEN 1
                WHEN 'admin_nasional' THEN 2
                WHEN 'area_manager'   THEN 3
                WHEN 'branch_head'    THEN 4
                WHEN 'staff'          THEN 5
                ELSE 6 END")
            ->orderBy('name')
            ->get();

        $branches = $authUser->accessibleBranches()->where('is_active', true)->get(['id', 'name', 'code', 'area_id']);

        $areas = $authUser->isSuperAdmin()
            ? Area::where('is_active', true)->orderBy('name')->get(['id', 'name'])
            : Area::where('id', $authUser->area_id)->get(['id', 'name']);

        // Daftar role yang boleh dibuat.
        // Role nasional (Super Admin, Admin Nasional, Viewer) HANYA untuk Super Admin.
        $roles = [
            ['value' => 'area_manager', 'label' => 'Area Manager'],
            ['value' => 'branch_head',  'label' => 'Kepala Cabang'],
            ['value' => 'staff',        'label' => 'Staff'],
        ];
        if ($authUser->isSuperAdmin()) {
            array_unshift($roles,                                              // ⬅ CHANGED: +Admin Nasional
                ['value' => 'super_admin',    'label' => 'Super Admin'],
                ['value' => 'admin_nasional', 'label' => 'Admin Nasional'],
            );
            $roles[] = ['value' => 'viewer', 'label' => 'Viewer (Read-only)']; // ⬅ NEW
        }

        return Inertia::render('Users/Index', [
            'users'    => $users,
            'branches' => $branches,
            'areas'    => $areas,
            'roles'    => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $authUser = $request->user();
        abort_unless($authUser->canManageAllBranches(), 403);

        // Role yang diizinkan tergantung siapa yang login.
        // AM TIDAK bisa membuat role nasional apa pun (super_admin/admin_nasional/viewer).
        $allowedRoles = $authUser->isSuperAdmin()
            ? ['super_admin', 'admin_nasional', 'area_manager', 'branch_head', 'staff', 'viewer'] // ⬅ CHANGED
            : ['area_manager', 'branch_head', 'staff'];

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:6',
            'role'      => ['required', Rule::in($allowedRoles)],
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'area_id'   => 'nullable|uuid|exists:areas,id',
            'phone'     => 'nullable|string|max:20',
        ]);

        [$branchId, $areaId] = $this->resolveScope($data, $authUser->area_id); // ⬅ CHANGED

        User::create([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'password'  => $data['password'],
            'role'      => $data['role'],
            'branch_id' => $branchId,
            'area_id'   => $areaId,
            'phone'     => $data['phone'] ?? null,
        ]);

        return back()->with('success', "User \"{$data['name']}\" berhasil ditambahkan.");
    }

    public function update(Request $request, User $user)
    {
        $authUser = $request->user();
        abort_unless($authUser->canManageAllBranches(), 403);

        // AM tidak boleh mengelola akun tingkat nasional yang sudah ada. ⬅ CHANGED: dulu hanya super_admin
        abort_if(
            !$authUser->isSuperAdmin() && in_array($user->role, self::NATIONAL_ROLES, true),
            403,
            'Tidak berwenang mengelola akun tingkat nasional.'
        );

        $allowedRoles = $authUser->isSuperAdmin()
            ? ['super_admin', 'admin_nasional', 'area_manager', 'branch_head', 'staff', 'viewer'] // ⬅ CHANGED
            : ['area_manager', 'branch_head', 'staff'];

        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'email'     => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'role'      => ['required', Rule::in($allowedRoles)],
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'area_id'   => 'nullable|uuid|exists:areas,id',
            'phone'     => 'nullable|string|max:20',
        ]);

        [$branchId, $areaId] = $this->resolveScope($data, $user->area_id); // ⬅ CHANGED

        $user->update([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'role'      => $data['role'],
            'branch_id' => $branchId,
            'area_id'   => $areaId,
            'phone'     => $data['phone'] ?? null,
        ]);

        return back()->with('success', "User \"{$user->name}\" berhasil diperbarui.");
    }

    public function resetPassword(Request $request, User $user)
    {
        $authUser = $request->user();
        abort_unless($authUser->canManageAllBranches(), 403);

        // AM tidak boleh reset password akun nasional. ⬅ CHANGED
        abort_if(
            !$authUser->isSuperAdmin() && in_array($user->role, self::NATIONAL_ROLES, true),
            403,
            'Tidak berwenang mengelola akun tingkat nasional.'
        );

        $data = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $user->update(['password' => $data['password']]);

        return back()->with('success', "Password \"{$user->name}\" berhasil direset.");
    }

    public function destroy(Request $request, User $user)
    {
        $authUser = $request->user();
        abort_unless($authUser->canManageAllBranches(), 403);
        abort_if($user->id === $authUser->id, 422, 'Tidak bisa menghapus akun sendiri.');

        // AM tidak boleh menghapus akun nasional. ⬅ CHANGED
        abort_if(
            !$authUser->isSuperAdmin() && in_array($user->role, self::NATIONAL_ROLES, true),
            403,
            'Tidak berwenang mengelola akun tingkat nasional.'
        );

        $user->delete();

        return back()->with('success', "User \"{$user->name}\" berhasil dihapus.");
    }

    // ── Helper: tentukan branch_id & area_id sesuai role ────────────────────── ⬅ NEW
    // Menggantikan blok if/elseif yang tersebar di store() & update() agar konsisten.
    private function resolveScope(array $data, ?string $fallbackAreaId): array
    {
        // Role nasional: tidak terikat cabang/area mana pun.
        if (in_array($data['role'], self::NATIONAL_ROLES, true)) {
            return [null, null];
        }

        // branch_head / staff: area diturunkan dari cabang yang dipilih.
        if (!empty($data['branch_id'])) {
            return [$data['branch_id'], Branch::find($data['branch_id'])->area_id];
        }

        // area_manager: pakai area yang dipilih.
        if (!empty($data['area_id'])) {
            return [null, $data['area_id']];
        }

        // Fallback: area milik pembuat/user itu sendiri.
        return [null, $fallbackAreaId];
    }
}