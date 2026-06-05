<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->constrained()->cascadeOnDelete();
            $table->date('period_month');
            $table->string('status')->default('draft');
            $table->bigInteger('total_revenue')->default(0);
            $table->bigInteger('target_amount')->default(0);
            $table->decimal('achievement_pct', 8, 4)->default(0);
            $table->bigInteger('gap_amount')->default(0);
            $table->bigInteger('total_presentasi')->default(0);
            $table->bigInteger('total_gerai')->default(0);
            $table->bigInteger('total_wgts')->default(0);
            $table->bigInteger('total_dfi')->default(0);
            $table->bigInteger('total_dfe')->default(0);
            $table->bigInteger('total_kotak_qris')->default(0);
            $table->bigInteger('total_kantor')->default(0);
            $table->text('evaluation')->nullable();
            $table->foreignUuid('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['branch_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_reports');
    }
};