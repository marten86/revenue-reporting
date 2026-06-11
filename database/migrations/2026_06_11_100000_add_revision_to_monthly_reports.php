<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monthly_reports', function (Blueprint $table) {
            $table->text('revision_notes')->nullable()->after('evaluation');
            $table->uuid('revised_by')->nullable()->after('revision_notes');
            $table->timestamp('revised_at')->nullable()->after('revised_by');

            $table->foreign('revised_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('monthly_reports', function (Blueprint $table) {
            $table->dropForeign(['revised_by']);
            $table->dropColumn(['revision_notes', 'revised_by', 'revised_at']);
        });
    }
};