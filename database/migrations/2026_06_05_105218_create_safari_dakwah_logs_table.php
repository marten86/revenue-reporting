<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safari_dakwah_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('monthly_report_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('day_name');
            $table->string('time')->nullable();
            $table->string('location')->nullable();
            $table->string('speaker')->nullable();
            $table->bigInteger('target')->default(0);
            $table->bigInteger('commitment')->default(0);
            $table->bigInteger('realization')->default(0);
            $table->decimal('achievement_pct', 8, 4)->nullable();
            $table->bigInteger('gap')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safari_dakwah_logs');
    }
};