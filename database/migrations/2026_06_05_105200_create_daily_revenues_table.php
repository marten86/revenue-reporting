<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_revenues', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('monthly_report_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('day_name');
            $table->bigInteger('presentasi')->default(0);
            $table->bigInteger('gerai')->default(0);
            $table->bigInteger('wgts')->default(0);
            $table->bigInteger('dfi')->default(0);
            $table->bigInteger('dfe')->default(0);
            $table->bigInteger('kotak_qris')->default(0);
            $table->bigInteger('kantor')->default(0);
            $table->bigInteger('total_daily')->default(0);
            $table->bigInteger('cumulative')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['monthly_report_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_revenues');
    }
};