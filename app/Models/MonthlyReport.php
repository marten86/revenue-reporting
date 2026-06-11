<?php

namespace App\Models;

use Carbon\Carbon;
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

    const CHANNELS     = ['presentasi', 'gerai', 'wgts', 'dfi', 'dfe', 'kotak_qris', 'kantor'];
    const SUB_CHANNELS = ['reguler', 'safdak', 'df'];

    protected $fillable = [
        'branch_id', 'period_month', 'status',
        'total_revenue', 'target_amount', 'achievement_pct', 'gap_amount',
        'total_presentasi', 'total_gerai', 'total_wgts',
        'total_dfi', 'total_dfe', 'total_kotak_qris', 'total_kantor',
        'evaluation', 'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'revision_notes', 'revised_by', 'revised_at',
    ];

    protected $casts = [
        'period_month'    => 'date',
        'submitted_at'    => 'datetime',
        'approved_at'     => 'datetime',
        'revised_at'      => 'datetime',
        'achievement_pct' => 'decimal:4',
    ];

    // ── Relasi ──────────────────────────────────────────────

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function revenueDetails(): HasMany
    {
        return $this->hasMany(RevenueDetail::class)
            ->orderBy('date')
            ->orderBy('sort_order');
    }

    public function dailyRevenues(): HasMany
    {
        return $this->hasMany(DailyRevenue::class)->orderBy('date');
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

    public function revisedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revised_by');
    }

    // ── Recalculate (inti arsitektur baru) ───────────────────

    public function recalculate(): void
    {
        // Langkah 1: bangun ulang cache harian dari revenue_details
        $details = $this->revenueDetails()->get();
        $byDate  = $details->groupBy(fn ($d) => $d->date->toDateString());

        $dayNames = [
            0 => 'Ahad', 1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu',
            4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];

        $start      = Carbon::parse($this->period_month)->startOfMonth();
        $end        = Carbon::parse($this->period_month)->endOfMonth();
        $cumulative = 0;

        // withoutEvents → mencegah hook DailyRevenue memicu
        // recalculate() balik (pengaman anti-infinite-loop).
        DailyRevenue::withoutEvents(function () use ($byDate, $dayNames, $start, $end, &$cumulative) {
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $key     = $date->toDateString();
                $dayRows = $byDate->get($key, collect());

                $channelSums = [];
                foreach (self::CHANNELS as $channel) {
                    $channelSums[$channel] = (int) $dayRows->where('channel', $channel)->sum('amount');
                }

                $totalDaily  = array_sum($channelSums);
                $cumulative += $totalDaily;

                DailyRevenue::updateOrCreate(
                    ['monthly_report_id' => $this->id, 'date' => $key],
                    array_merge($channelSums, [
                        'day_name'    => $dayNames[$date->dayOfWeek],
                        'total_daily' => $totalDaily,
                        'cumulative'  => $cumulative,
                    ])
                );
            }
        });

        // Langkah 2: hitung total bulanan dari cache yang baru dibangun
        $daily = $this->dailyRevenues()->get();

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

    // ── Workflow ─────────────────────────────────────────────

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

    public function revise(User $user, string $notes): void
    {
        $this->update([
            'status'         => self::STATUS_DRAFT,
            'revision_notes' => $notes,
            'revised_by'     => $user->id,
            'revised_at'     => now(),
            // Reset approval fields
            'approved_by'    => null,
            'approved_at'    => null,
            'evaluation'     => null,
        ]);
    }

    // ── Scopes & Helpers ────────────────────────────────────

    public function scopeForMonth($query, string $month)
    {
        return $query->where('period_month', $month);
    }

    public function isDraft(): bool     { return $this->status === self::STATUS_DRAFT; }
    public function isSubmitted(): bool { return $this->status === self::STATUS_SUBMITTED; }
    public function isApproved(): bool  { return $this->status === self::STATUS_APPROVED; }
    public function isRevision(): bool  { return $this->revised_at !== null && $this->status === self::STATUS_DRAFT; }
}