<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * v20261001-target-kotak-qris
 * Pisah target Kotak Infak & QRIS (mengikuti split kanal Juli 2026).
 * Kolom lama target_kotak_qris TIDAK di-drop dan TIDAK disentuh (data historis).
 * Kolom baru default 0 = "belum diset" -> Analytics menampilkan capaian "—".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branch_targets', function (Blueprint $table) {
            $table->bigInteger('target_kotak')->default(0)->after('target_kotak_qris');
            $table->bigInteger('target_qris')->default(0)->after('target_kotak');
        });
    }

    public function down(): void
    {
        Schema::table('branch_targets', function (Blueprint $table) {
            $table->dropColumn(['target_kotak', 'target_qris']);
        });
    }
};
