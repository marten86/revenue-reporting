<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamRevenue extends Model
{
    use HasUuids;

    protected $fillable = [
        'monthly_report_id', 'team_name', 'team_code',
        'personnel', 'is_unit_cabang',
        'reguler', 'safdak', 'df', 'total', 'sort_order',
    ];

    protected $casts = ['is_unit_cabang' => 'boolean'];

    protected static function booted(): void
    {
        static::saving(function (TeamRevenue $row) {
            $row->total = $row->reguler + $row->safdak + $row->df;
        });
    }

    public function monthlyReport(): BelongsTo
    {
        return $this->belongsTo(MonthlyReport::class);
    }
}