<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyRevenue extends Model
{
    use HasUuids;

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

    protected static function booted(): void
    {
        static::saving(function (DailyRevenue $row) {
            $row->total_daily = $row->presentasi + $row->gerai + $row->wgts
                + $row->dfi + $row->dfe + $row->kotak_qris + $row->kantor;
        });

        static::saved(function (DailyRevenue $row) {
            $row->rebuildCumulatives();
            $row->monthlyReport->recalculate();
        });

        static::deleted(function (DailyRevenue $row) {
            $row->rebuildCumulatives();
            $row->monthlyReport->recalculate();
        });
    }

    public function rebuildCumulatives(): void
    {
        $rows = DailyRevenue::where('monthly_report_id', $this->monthly_report_id)
            ->orderBy('date')
            ->get();

        $running = 0;
        foreach ($rows as $r) {
            $running += $r->total_daily;
            if ($r->cumulative !== $running) {
                $r->timestamps = false;
                $r->update(['cumulative' => $running]);
            }
        }
    }
}