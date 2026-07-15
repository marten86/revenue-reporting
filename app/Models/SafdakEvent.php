<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class SafdakEvent extends Model
{
    use HasUuids;

    public const STATUSES = ['rencana', 'berjalan', 'selesai', 'batal'];

    // Rumus target titik per hari safari
    public const TARGET_MIN_PER_DAY   = 2;
    public const TARGET_IDEAL_PER_DAY = 3;

    protected $fillable = [
        'branch_id',
        'title',
        'start_date',
        'end_date',
        'custom_dates',
        'speaker',
        'grade',
        'status',
        'titik_deal',
        'titik_eksekusi',
        'total_cost',
        'revenue_komitmen',
        'revenue_realisasi',
        'has_mou',
        'mou_file_path',
        'notes',
    ];

    // Turunan yang dihitung selalu ikut terkirim ke frontend
    protected $appends = ['total_days', 'target_min', 'target_ideal'];

    protected function casts(): array
    {
        return [
            'start_date'        => 'date',
            'end_date'          => 'date',
            'custom_dates'      => 'array',
            'has_mou'           => 'boolean',
            'total_cost'        => 'decimal:2',
            'revenue_komitmen'  => 'decimal:2',
            'revenue_realisasi' => 'decimal:2',
            'titik_deal'        => 'integer',
            'titik_eksekusi'    => 'integer',
        ];
    }

    // ── Turunan (dihitung, tidak disimpan) ─────────────────────

    public function getTotalDaysAttribute(): int
    {
        if (is_array($this->custom_dates) && count($this->custom_dates) > 0) {
            return count($this->custom_dates);
        }

        if (! $this->start_date || ! $this->end_date) {
            return 0;
        }

        return $this->start_date->diffInDays($this->end_date) + 1;
    }

    public function getTargetMinAttribute(): int
    {
        return $this->total_days * self::TARGET_MIN_PER_DAY;
    }

    public function getTargetIdealAttribute(): int
    {
        return $this->total_days * self::TARGET_IDEAL_PER_DAY;
    }

    // ── Relasi ─────────────────────────────────────────────────

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Realisasi terkait — via soft link event_id di safari_dakwah_logs
     * (satu kampanye bisa punya banyak log titik).
     */
    public function logs()
    {
        return $this->hasMany(SafariDakwahLog::class, 'event_id');
    }

    // ── Scopes ─────────────────────────────────────────────────

    public function scopeForBranches(Builder $query, array $branchIds): Builder
    {
        return $query->whereIn('branch_id', $branchIds);
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Kampanye yang BERSINGGUNGAN dengan bulan tertentu
     * (start <= akhir bulan DAN end >= awal bulan).
     */
    public function scopeOverlapsMonth(Builder $query, int $year, int $month): Builder
    {
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end   = date('Y-m-t', strtotime($start));

        return $query->where('start_date', '<=', $end)
                     ->where('end_date', '>=', $start);
    }
}