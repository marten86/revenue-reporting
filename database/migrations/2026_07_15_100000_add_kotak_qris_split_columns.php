<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tambah kolom baru di daily_revenues
        Schema::table('daily_revenues', function (Blueprint $table) {
            $table->bigInteger('kotak')->default(0)->after('kotak_qris');
            $table->bigInteger('qris')->default(0)->after('kotak');
        });

        // 2. Tambah kolom baru di monthly_reports
        Schema::table('monthly_reports', function (Blueprint $table) {
            $table->bigInteger('total_kotak')->default(0)->after('total_kotak_qris');
            $table->bigInteger('total_qris')->default(0)->after('total_kotak');
        });

        // Catatan: kolom lama kotak_qris / total_kotak_qris TIDAK di-drop.
        // Data historis tetap terbaca dari revenue_details (sumber kebenaran).
        // Kolom cache lama dibiarkan nol untuk laporan baru ke depan.
    }

    public function down(): void
    {
        Schema::table('daily_revenues', function (Blueprint $table) {
            $table->dropColumn(['kotak', 'qris']);
        });

        Schema::table('monthly_reports', function (Blueprint $table) {
            $table->dropColumn(['total_kotak', 'total_qris']);
        });
    }
};