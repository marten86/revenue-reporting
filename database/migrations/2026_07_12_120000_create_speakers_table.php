<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Master data narasumber Safari Dakwah.
     * branch_id = null  → narasumber nasional (tampil di semua cabang, lintas cabang)
     * branch_id = uuid  → narasumber khusus cabang tersebut
     *
     * Catatan: kolom `speaker` di safari_dakwah_logs TETAP string bebas (tidak diubah,
     * tidak ada FK). Tabel ini murni sumber pilihan (dropdown), bukan pengganti kolom lama.
     * Additive — tidak menyentuh tabel/kolom yang sudah ada.
     */
    public function up(): void
    {
        Schema::create('speakers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('name', 200);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['branch_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('speakers');
    }
};