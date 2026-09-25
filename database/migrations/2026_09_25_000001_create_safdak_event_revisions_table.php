<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * penanda versi: pipeline-riwayat-20260925
 *
 * Riwayat Update kampanye SafDak — APPEND-ONLY. Baris tidak pernah diubah
 * atau dihapus (dijaga juga di model SafdakEventRevision).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safdak_event_revisions', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // SENGAJA tanpa foreign key ke safdak_events: riwayat (termasuk
            // baris 'deleted') harus tetap ada setelah kampanyenya dihapus.
            $table->uuid('event_id');

            // Null = tidak diketahui (baris backfill, atau user sudah dihapus)
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('action', 20);            // created | updated | status | deleted
            // {field: [lama, baru]} — null pada baris backfill
            $table->jsonb('changes')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['event_id', 'created_at']);
        });

        // Backfill: satu baris 'created' per kampanye yang sudah ada, bertanggal
        // created_at kampanye. changes = null -> frontend menandainya sebagai
        // "dibuat sebelum riwayat dicatat". Tabel safdak_events TIDAK disentuh.
        DB::table('safdak_events')
            ->select('id', 'created_at')
            ->orderBy('id')
            ->chunk(200, function ($rows) {
                $insert = [];

                foreach ($rows as $row) {
                    $insert[] = [
                        'id'         => (string) Str::uuid(),
                        'event_id'   => $row->id,
                        'user_id'    => null,
                        'action'     => 'created',
                        'changes'    => null,
                        'created_at' => $row->created_at ?? now(),
                    ];
                }

                DB::table('safdak_event_revisions')->insert($insert);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('safdak_event_revisions');
    }
};
