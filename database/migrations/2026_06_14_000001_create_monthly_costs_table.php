<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_costs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->constrained()->cascadeOnDelete();
            $table->date('period_month');
            $table->string('status')->default('draft'); // draft, submitted, approved
            $table->bigInteger('total_cost')->default(0);
            $table->text('evaluation')->nullable();
            $table->foreignUuid('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('revision_notes')->nullable();
            $table->foreignUuid('revised_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revised_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['branch_id', 'period_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_costs');
    }
};