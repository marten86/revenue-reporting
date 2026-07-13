<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Speaker extends Model
{
    use HasUuids;

    protected $fillable = [
        'branch_id',
        'name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Narasumber yang boleh dipilih untuk sebuah cabang: milik cabang itu sendiri
     * DITAMBAH narasumber nasional (branch_id null, lintas cabang).
     */
    public function scopeForBranch($query, $branchId)
    {
        return $query->where(function ($q) use ($branchId) {
            $q->whereNull('branch_id')->orWhere('branch_id', $branchId);
        });
    }
}