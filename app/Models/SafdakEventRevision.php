<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * penanda versi: pipeline-riwayat-20260925
 *
 * Satu baris = satu perubahan pada kampanye SafDak. APPEND-ONLY:
 * update & delete lewat Eloquent dibatalkan di booted(). Riwayat yang bisa
 * diedit bukan riwayat.
 */
class SafdakEventRevision extends Model
{
    use HasUuids;

    // Hanya created_at — baris riwayat tidak pernah di-update
    public const UPDATED_AT = null;

    public const ACTIONS = ['created', 'updated', 'status', 'deleted'];

    protected $fillable = ['event_id', 'user_id', 'action', 'changes'];

    protected function casts(): array
    {
        return [
            'changes'    => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
