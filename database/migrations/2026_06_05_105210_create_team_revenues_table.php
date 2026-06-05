<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_revenues', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('monthly_report_id')->constrained()->cascadeOnDelete();
            $table->string('team_name');
            $table->string('team_code');
            $table->string('personnel')->nullable();
            $table->boolean('is_unit_cabang')->default(false);
            $table->bigInteger('reguler')->default(0);
            $table->bigInteger('safdak')->default(0);
            $table->bigInteger('df')->default(0);
            $table->bigInteger('total')->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['monthly_report_id', 'team_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_revenues');
    }
};