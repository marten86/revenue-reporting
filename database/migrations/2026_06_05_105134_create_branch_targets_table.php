<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_targets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->constrained()->cascadeOnDelete();
            $table->date('period_month');
            $table->bigInteger('target_total')->default(0);
            $table->bigInteger('target_presentasi')->default(0);
            $table->bigInteger('target_gerai')->default(0);
            $table->bigInteger('target_wgts')->default(0);
            $table->bigInteger('target_dfi')->default(0);
            $table->bigInteger('target_dfe')->default(0);
            $table->bigInteger('target_kotak_qris')->default(0);
            $table->bigInteger('target_kantor')->default(0);
            $table->text('notes')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['branch_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_targets');
    }
};