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

    const ROLE_SUPER_ADMIN  = 'super_admin';
    const ROLE_AREA_MANAGER = 'area_manager';
    const ROLE_BRANCH_HEAD  = 'branch_head';
    const ROLE_STAFF        = 'staff';

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

    public function isSuperAdmin(): bool  { return $this->role === self::ROLE_SUPER_ADMIN; }
    public function isAreaManager(): bool { return $this->role === self::ROLE_AREA_MANAGER; }
    public function isBranchHead(): bool  { return $this->role === self::ROLE_BRANCH_HEAD; }
    public function isStaff(): bool       { return $this->role === self::ROLE_STAFF; }

    public function canManageAllBranches(): bool
    {
        return in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_AREA_MANAGER]);
    }

    public function canAccessBranch(Branch $branch): bool
    {
        if ($this->isSuperAdmin()) return true;
        if ($this->isAreaManager()) return $branch->area_id === $this->area_id;
        return $branch->id === $this->branch_id;
    }

    public function canSubmitReport(): bool
    {
        return in_array($this->role, [self::ROLE_BRANCH_HEAD, self::ROLE_STAFF]);
    }

    public function canApproveReport(): bool
    {
        return in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_AREA_MANAGER]);
    }

    public function accessibleBranches()
    {
        if ($this->isSuperAdmin()) {
            return Branch::query();
        }
        if ($this->isAreaManager()) {
            return Branch::where('area_id', $this->area_id);
        }
        return Branch::where('id', $this->branch_id);
    }
}