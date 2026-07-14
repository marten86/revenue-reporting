<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Melengkapi safari_dakwah_logs agar bisa menggantikan pencatatan Notion
     * sepenuhnya, sekaligus CRM-ready (kolom event_id) untuk sinkronisasi
     * ke crm.onebwa.my.id di masa depan. Additive murni - tidak menyentuh
     * kolom atau perilaku yang sudah ada.
     */
    public function up(): void
    {
        Schema::table('safari_dakwah_logs', function (Blueprint $table) {
            // Klasifikasi talent: Internal | Lokal | Nasional Grade A | Nasional Grade B
            $table->string('level')->nullable()->after('speaker');

            // Status kegiatan: done | failed (validasi nilai di FormRequest, bukan enum DB)
            $table->string('status')->default('done')->after('level');

            // Biaya penyelenggaraan kegiatan SafDak
            $table->bigInteger('cost')->default(0)->after('realization');

            // Funnel titik: Target -> Deal -> Eksekusi (data asli, bukan turunan formula)
            $table->integer('target_titik')->default(0)->after('gap');
            $table->integer('titik_deal')->default(0)->after('target_titik');
            $table->integer('titik_eksekusi')->default(0)->after('titik_deal');

            // Dokumen MOU
            $table->boolean('has_mou')->default(false)->after('notes');
            $table->string('mou_file_path')->nullable()->after('has_mou');

            // Soft reference ke events di crm.onebwa.my.id (database terpisah,
            // sengaja TANPA foreign key - validasi di application layer saat sinkronisasi)
            $table->uuid('event_id')->nullable()->after('mou_file_path');
        });
    }

    public function down(): void
    {
        Schema::table('safari_dakwah_logs', function (Blueprint $table) {
            $table->dropColumn([
                'level',
                'status',
                'cost',
                'target_titik',
                'titik_deal',
                'titik_eksekusi',
                'has_mou',
                'mou_file_path',
                'event_id',
            ]);
        });
    }
};