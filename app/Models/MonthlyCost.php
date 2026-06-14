<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MonthlyCost extends Model
{
    use HasUuids, SoftDeletes;

    const STATUS_DRAFT     = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_APPROVED  = 'approved';

    protected $fillable = [
        'branch_id', 'period_month', 'status', 'total_cost', 'evaluation',
        'submitted_by', 'submitted_at',
        'approved_by', 'approved_at',
        'revision_notes', 'revised_by', 'revised_at',
    ];

    protected $casts = [
        'period_month' => 'date',
        'submitted_at' => 'datetime',
        'approved_at'  => 'datetime',
        'revised_at'   => 'datetime',
    ];

    // ── Relasi ──────────────────────────────────────────────────────────────

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function costDetails(): HasMany
    {
        return $this->hasMany(CostDetail::class);
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

    // ── Status helpers ───────────────────────────────────────────────────────

    public function isDraft(): bool     { return $this->status === self::STATUS_DRAFT; }
    public function isSubmitted(): bool { return $this->status === self::STATUS_SUBMITTED; }
    public function isApproved(): bool  { return $this->status === self::STATUS_APPROVED; }
    public function isRevision(): bool  { return $this->revised_at !== null && $this->isDraft(); }

    // ── Actions ──────────────────────────────────────────────────────────────

    public function submit(User $user): void
    {
        $this->update([
            'status'       => self::STATUS_SUBMITTED,
            'submitted_by' => $user->id,
            'submitted_at' => now(),
        ]);
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
            'approved_by'    => null,
            'approved_at'    => null,
        ]);
    }

    // ── Recalculate total ─────────────────────────────────────────────────────

    public function recalculate(): void
    {
        $total = $this->costDetails()->sum('amount');
        $this->update(['total_cost' => $total]);
    }

    // ── Kategori ─────────────────────────────────────────────────────────────

    public static function categories(): array
    {
        return [
            'Operasional',
            'Gaji',
            'THR',
            'Bingkisan Lebaran',
            'Tunjangan Kesehatan',
            'Tunjangan Pendidikan',
            'Tunjangan Service',
            'Pinjam Pakai Rumah',
            "Ju'alah AE",
            "Ju'alah Cabang",
            'Uang Saku',
            'Tiket Perjalanan Dinas',
            'Safari Dakwah',
            'Biaya Brosur',
            'Biaya Kirim',
            'Sewa Gerai',
        ];
    }
}