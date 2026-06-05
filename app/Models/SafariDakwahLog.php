<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SafariDakwahLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'monthly_report_id', 'date', 'day_name', 'time',
        'location', 'speaker',
        'target', 'commitment', 'realization',
        'achievement_pct', 'gap', 'notes',
    ];

    protected $casts = [
        'date'            => 'date',
        'achievement_pct' => 'decimal:4',
    ];

    protected static function booted(): void
    {
        static::saving(function (SafariDakwahLog $row) {
            $row->gap = $row->commitment - $row->realization;
            $row->achievement_pct = $row->target > 0
                ? round($row->realization / $row->target, 4)
                : null;
        });
    }

    public function monthlyReport(): BelongsTo
    {
        return $this->belongsTo(MonthlyReport::class);
    }
}