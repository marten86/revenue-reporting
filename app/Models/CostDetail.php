<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CostDetail extends Model
{
    use HasUuids;

    protected $fillable = [
        'monthly_cost_id', 'category', 'description', 'amount', 'sort_order',
    ];

    protected $casts = [
        'amount' => 'integer',
    ];

    public function monthlyCost(): BelongsTo
    {
        return $this->belongsTo(MonthlyCost::class);
    }

    protected static function booted(): void
    {
        static::saved(function (CostDetail $detail) {
            $detail->monthlyCost->recalculate();
        });

        static::deleted(function (CostDetail $detail) {
            $detail->monthlyCost->recalculate();
        });
    }
}