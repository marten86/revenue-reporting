<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Branch extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = ['area_id', 'name', 'code', 'city', 'province', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function monthlyReports(): HasMany
    {
        return $this->hasMany(MonthlyReport::class);
    }

    public function monthlyCosts(): HasMany
    {
        return $this->hasMany(MonthlyCost::class);
    }

    public function targets(): HasMany
    {
        return $this->hasMany(BranchTarget::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function reportForMonth(string $month): ?MonthlyReport
    {
        return $this->monthlyReports()
            ->where('period_month', $month)
            ->first();
    }

    public function targetForMonth(string $month): ?BranchTarget
    {
        return $this->targets()
            ->where('period_month', $month)
            ->first();
    }

    public function costForMonth(string $month): ?MonthlyCost
    {
        return $this->monthlyCosts()
            ->where('period_month', $month)
            ->first();
    }
}