<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyRevenue extends Model
{
    use HasUuids;

    // Model ini sekarang CACHE — ditulis sepenuhnya oleh
    // MonthlyReport::recalculate(). Tidak boleh ada hook
    // yang memanggil recalculate() balik (infinite loop).

    protected $fillable = [
        'monthly_report_id', 'date', 'day_name',
        'presentasi', 'gerai', 'wgts', 'dfi', 'dfe', 'kotak_qris', 'kantor',
        'total_daily', 'cumulative', 'notes',
    ];

    protected $casts = ['date' => 'date'];

    public function monthlyReport(): BelongsTo
    {
        return $this->belongsTo(MonthlyReport::class);
    }
}