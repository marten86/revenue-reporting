<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasUuids, Notifiable, SoftDeletes;

    const ROLE_SUPER_ADMIN    = 'super_admin';
    const ROLE_AREA_MANAGER   = 'area_manager';
    const ROLE_ADMIN_NASIONAL = 'admin_nasional';  // NEW: input/target lintas cabang, TANPA approve & kelola user
    const ROLE_BRANCH_HEAD    = 'branch_head';
    const ROLE_STAFF          = 'staff';
    const ROLE_VIEWER         = 'viewer';           // NEW: read-only + export, lihat semua cabang

    protected $fillable = ['name', 'email', 'password', 'role', 'branch_id', 'area_id', 'phone'];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = ['password' => 'hashed'];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    // ── Identitas role ────────────────────────────────────────────────────────
    public function isSuperAdmin(): bool     { return $this->role === self::ROLE_SUPER_ADMIN; }
    public function isAreaManager(): bool    { return $this->role === self::ROLE_AREA_MANAGER; }
    public function isAdminNasional(): bool  { return $this->role === self::ROLE_ADMIN_NASIONAL; }  // NEW
    public function isBranchHead(): bool     { return $this->role === self::ROLE_BRANCH_HEAD; }
    public function isStaff(): bool          { return $this->role === self::ROLE_STAFF; }
    public function isViewer(): bool         { return $this->role === self::ROLE_VIEWER; }           // NEW

    // ── Visibilitas: siapa yang melihat SEMUA cabang secara nasional ──────────
    // Area Manager TIDAK termasuk — dia hanya areanya sendiri (di-scope di bawah).
    public function seesAllBranches(): bool  // NEW
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ADMIN_NASIONAL,
            self::ROLE_VIEWER,
        ]);
    }

    // ── Otoritas KELOLA (user/cabang/area) ────────────────────────────────────
    // SENGAJA tetap super_admin + area_manager saja. admin_nasional & viewer
    // TIDAK di sini — inilah yang mencegah mereka mengelola user/cabang.
    public function canManageAllBranches(): bool
    {
        return in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_AREA_MANAGER]);
    }

    // ── Cek kepemilikan objek (scope per-cabang) ──────────────────────────────
    public function canAccessBranch(Branch $branch): bool
    {
        if ($this->seesAllBranches()) return true;                 // super_admin, admin_nasional, viewer
        if ($this->isAreaManager()) return $branch->area_id === $this->area_id;
        return $branch->id === $this->branch_id;                   // branch_head, staff
    }

    // ── Input / edit data laporan (BUKAN kelola user) ─────────────────────────
    // Semua role KECUALI viewer. Scope tetap dibatasi canAccessBranch().
    // Dipakai controller write untuk MENGGANTIKAN canManageAllBranches() di titik
    // yang urusannya "input data", bukan "kelola user/cabang".
    public function canInputData(): bool  // NEW
    {
        return ! $this->isViewer();
    }

    // ── Set target (lintas cabang, tetap di-scope canAccessBranch) ────────────
    public function canManageTargets(): bool  // NEW
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_AREA_MANAGER,
            self::ROLE_ADMIN_NASIONAL,
        ]);
    }

    // ── Submit laporan (draft → submitted) ────────────────────────────────────
    // admin_nasional ditambahkan agar hasil backfill bisa naik ke "submitted"
    // untuk lalu di-approve AM/super_admin. (⚠️ KONFIRMASI — lihat catatan di bawah.)
    public function canSubmitReport(): bool
    {
        return in_array($this->role, [
            self::ROLE_BRANCH_HEAD,
            self::ROLE_STAFF,
            self::ROLE_ADMIN_NASIONAL,  // NEW
        ]);
    }

    // ── Approve / revise ──────────────────────────────────────────────────────
    // SENGAJA tetap super_admin + area_manager. admin_nasional TIDAK boleh approve
    // — sesuai keputusan: approve ditahan di AM sebagai penengah data.
    public function canApproveReport(): bool
    {
        return in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_AREA_MANAGER]);
    }

    // ── Read-only murni (tak ada aksi tulis sama sekali) ──────────────────────
    public function isReadOnly(): bool  // NEW — dipakai frontend untuk sembunyikan tombol aksi
    {
        return $this->isViewer();
    }

    // ── Routing dashboard saat login ──────────────────────────────────────────
    // true = ke area/national dashboard; false = branch dashboard.
    public function usesAreaDashboard(): bool  // NEW
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_AREA_MANAGER,
            self::ROLE_ADMIN_NASIONAL,
            self::ROLE_VIEWER,
        ]);
    }

    // ── Cakupan cabang untuk query ────────────────────────────────────────────
    public function accessibleBranches()
    {
        if ($this->seesAllBranches()) {           // super_admin, admin_nasional, viewer
            return Branch::query();
        }
        if ($this->isAreaManager()) {
            return Branch::where('area_id', $this->area_id);
        }
        return Branch::where('id', $this->branch_id);
    }
}