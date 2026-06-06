<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_sources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->constrained()->cascadeOnDelete();

            $table->string('name');               // "TIM 1 KENDARI", "Budi", dll
            $table->string('type');                // team | person
            $table->string('channel');             // presentasi | wgts | gerai | dfi | dfe
            $table->text('personnel')->nullable(); // Anggota tim (khusus type=team)
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['branch_id', 'channel', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_sources');
    }
};