<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('monthly_report_id')->constrained()->cascadeOnDelete();
            $table->date('date');

            // presentasi | gerai | wgts | dfi | dfe | kotak_qris | kantor
            $table->string('channel');

            // Nama tim (Presentasi) / karyawan (DFI) / relawan (DFE). Null utk kanal flat.
            $table->string('source_label')->nullable();

            // reguler | safdak | df  — hanya relevan utk Presentasi. Null utk lainnya.
            $table->string('sub_channel')->nullable();

            $table->bigInteger('amount')->default(0);
            $table->integer('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['monthly_report_id', 'date', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_details');
    }
};