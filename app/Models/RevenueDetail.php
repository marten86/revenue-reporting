<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RevenueDetail extends Model
{
    use HasUuids;

    protected $fillable = [
        'monthly_report_id', 'date', 'channel',
        'source_label', 'sub_channel', 'amount', 'sort_order', 'notes',
    ];

    protected $casts = [
        'date'   => 'date',
        'amount' => 'integer',
    ];

    protected static function booted(): void
    {
        // Setiap perubahan satu baris detail → rebuild cache laporan induk.
        // Untuk operasi bulk (isi sepekan sekaligus), JANGAN andalkan hook ini —
        // gunakan RevenueDetail::withoutEvents(fn () => ...) lalu panggil
        // $report->recalculate() SEKALI di akhir (lihat controller fase berikutnya).
        static::saved(function (RevenueDetail $detail) {
            $detail->monthlyReport?->recalculate();
        });

        static::deleted(function (RevenueDetail $detail) {
            $detail->monthlyReport?->recalculate();
        });
    }

    public function monthlyReport(): BelongsTo
    {
        return $this->belongsTo(MonthlyReport::class);
    }
}