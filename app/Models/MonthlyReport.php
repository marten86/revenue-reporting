<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MonthlyReport extends Model
{
    use HasUuids, SoftDeletes;

    const STATUS_DRAFT     = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_APPROVED  = 'approved';
    const STATUS_REVISION  = 'revision';

    protected $fillable = [
        'branch_id', 'period_month', 'status',
        'total_revenue', 'target_amount', 'achievement_pct', 'gap_amount',
        'total_presentasi', 'total_gerai', 'total_wgts',
        'total_dfi', 'total_dfe', 'total_kotak_qris', 'total_kantor',
        'evaluation', 'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
    ];

    protected $casts = [
        'period_month'    => 'date',
        'submitted_at'    => 'datetime',
        'approved_at'     => 'datetime',
        'achievement_pct' => 'decimal:4',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function dailyRevenues(): HasMany
    {
        return $this->hasMany(DailyRevenue::class)->orderBy('date');
    }

    public function teamRevenues(): HasMany
    {
        return $this->hasMany(TeamRevenue::class)->orderBy('sort_order');
    }

    public function safariDakwahLogs(): HasMany
    {
        return $this->hasMany(SafariDakwahLog::class)->orderBy('date');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function recalculate(): void
    {
        $daily = $this->dailyRevenues;

        $totals = [
            'total_presentasi' => $daily->sum('presentasi'),
            'total_gerai'      => $daily->sum('gerai'),
            'total_wgts'       => $daily->sum('wgts'),
            'total_dfi'        => $daily->sum('dfi'),
            'total_dfe'        => $daily->sum('dfe'),
            'total_kotak_qris' => $daily->sum('kotak_qris'),
            'total_kantor'     => $daily->sum('kantor'),
        ];

        $totalRevenue = array_sum($totals);
        $target       = $this->target_amount;

        $this->update([
            ...$totals,
            'total_revenue'   => $totalRevenue,
            'achievement_pct' => $target > 0 ? round($totalRevenue / $target, 4) : 0,
            'gap_amount'      => $totalRevenue - $target,
        ]);
    }

    public function submit(User $user): void
    {
        $target = $this->branch->targetForMonth(
            $this->period_month->format('Y-m-01')
        );

        $this->update([
            'status'        => self::STATUS_SUBMITTED,
            'submitted_by'  => $user->id,
            'submitted_at'  => now(),
            'target_amount' => $target?->target_total ?? $this->target_amount,
        ]);

        $this->recalculate();
    }

    public function approve(User $user): void
    {
        $this->update([
            'status'      => self::STATUS_APPROVED,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);
    }

    public function scopeForMonth($query, string $month)
    {
        return $query->where('period_month', $month);
    }

    public function isDraft(): bool     { return $this->status === self::STATUS_DRAFT; }
    public function isSubmitted(): bool { return $this->status === self::STATUS_SUBMITTED; }
    public function isApproved(): bool  { return $this->status === self::STATUS_APPROVED; }
}