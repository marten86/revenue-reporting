<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safdak_events', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Kampanye selalu milik satu cabang
            $table->foreignUuid('branch_id')->constrained('branches')->cascadeOnDelete();

            $table->string('title')->nullable();              // Label opsional (default: "SafDak {dai} {periode}")

            // Periode kampanye
            $table->date('start_date');
            $table->date('end_date');
            // Mode custom: daftar tanggal terpilih (mis. akhir pekan saja).
            // Null = mode rentang penuh (semua hari start→end dihitung).
            $table->json('custom_dates')->nullable();

            $table->string('speaker')->nullable();            // Nama dai
            $table->string('grade')->nullable();              // Grade dai

            // Siklus hidup kampanye
            $table->string('status')->default('rencana');     // rencana | berjalan | selesai | batal

            // CATATAN: target titik TIDAK disimpan — dihitung via accessor model
            // (total_days × 2 minimal, × 3 ideal). Lihat pelajaran achievement_pct.

            // Input progres oleh tim
            $table->unsignedInteger('titik_deal')->nullable();
            $table->unsignedInteger('titik_eksekusi')->nullable();
            $table->decimal('total_cost', 15, 2)->nullable();
            $table->decimal('revenue_komitmen', 15, 2)->nullable();
            // Informasional/manajerial saja — angka resmi keuangan tetap di
            // laporan bulanan (TabSafari). JANGAN pernah dijumlahkan ke rekap revenue.
            $table->decimal('revenue_realisasi', 15, 2)->nullable();

            $table->boolean('has_mou')->default(false);
            $table->string('mou_file_path')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safdak_events');
    }
};