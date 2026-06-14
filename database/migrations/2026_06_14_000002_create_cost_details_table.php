<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cost_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('monthly_cost_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('category');
            $table->string('description')->nullable();
            $table->bigInteger('amount')->default(0);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cost_details');
    }
};