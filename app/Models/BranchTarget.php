<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchTarget extends Model
{
    use HasUuids;

    protected $fillable = [
        'branch_id', 'period_month',
        'target_total', 'target_presentasi', 'target_gerai',
        'target_wgts', 'target_dfi', 'target_dfe',
        'target_kotak_qris', 'target_kantor',
        'notes', 'created_by',
    ];

    protected $casts = ['period_month' => 'date'];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}