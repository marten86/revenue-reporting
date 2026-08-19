<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

/**
 * penanda versi: safdakevent-overlapsrange-20260819
 */
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
            'start_date'        => 'date:Y-m-d',
            'end_date'          => 'date:Y-m-d',
            'custom_dates'      => 'array',
            'has_mou'           => 'boolean',
            'total_cost'        => 'decimal:2',
            'revenue_komitmen'  => 'decimal:2',
            'revenue_realisasi' => 'decimal:2',
            'titik_deal'        => 'integer',
            'titik_eksekusi'    => 'integer',
        ];
    }

    // -- Turunan (dihitung, tidak disimpan) ---------------------

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

    // -- Relasi -------------------------------------------------

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Realisasi terkait - via soft link event_id di safari_dakwah_logs
     * (satu kampanye bisa punya banyak log titik).
     */
    public function logs()
    {
        return $this->hasMany(SafariDakwahLog::class, 'event_id');
    }

    // -- Scopes -------------------------------------------------

    public function scopeForBranches(Builder $query, array $branchIds): Builder
    {
        return $query->whereIn('branch_id', $branchIds);
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Kampanye yang BERSINGGUNGAN dengan rentang tanggal tertentu
     * (start <= akhir rentang DAN end >= awal rentang).
     *
     * Ditambahkan 19 Agustus 2026 sebagai generalisasi overlapsMonth(),
     * untuk mendukung filter kuartal / semester / tahun di /safari-pipeline.
     *
     * CATATAN SEMANTIK: "bersinggungan", bukan "termuat seluruhnya". Kampanye
     * 25 Jun - 5 Jul dihitung PENUH di Juni maupun Juli (dan penuh di Q2
     * maupun Q3). Konsekuensinya angka funnel antar-periode TIDAK boleh
     * dijumlahkan. Perilaku ini sengaja dipertahankan sama dengan sebelumnya
     * -- mengubahnya akan menggeser angka yang sudah dilihat tim selama ini.
     *
     * @param  string  $start  tanggal awal inklusif, format Y-m-d
     * @param  string  $end    tanggal akhir inklusif, format Y-m-d
     */
    public function scopeOverlapsRange(Builder $query, string $start, string $end): Builder
    {
        return $query->where('start_date', '<=', $end)
                     ->where('end_date', '>=', $start);
    }

    /**
     * Kampanye yang bersinggungan dengan bulan tertentu.
     *
     * Kini pembungkus tipis di atas overlapsRange(). SENGAJA dipertahankan:
     * SafariCalendarController masih memanggilnya, dan menghapusnya berarti
     * menyentuh halaman kalender tanpa alasan.
     */
    public function scopeOverlapsMonth(Builder $query, int $year, int $month): Builder
    {
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end   = date('Y-m-t', strtotime($start));

        return $query->overlapsRange($start, $end);
    }
}