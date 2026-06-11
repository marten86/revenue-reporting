<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NationalBranchSeeder extends Seeder
{
    public function run(): void
    {
        $branches = [
            // ── Area Sumatera (7 cabang) ──
            ['area_code' => 'SUMATRA', 'name' => 'MEDAN',       'code' => 'MDN', 'city' => 'Medan',       'province' => 'Sumatera Utara'],
            ['area_code' => 'SUMATRA', 'name' => 'PADANG',      'code' => 'PDG', 'city' => 'Padang',      'province' => 'Sumatera Barat'],
            ['area_code' => 'SUMATRA', 'name' => 'BATAM',       'code' => 'BTM', 'city' => 'Batam',       'province' => 'Kepulauan Riau'],
            ['area_code' => 'SUMATRA', 'name' => 'BUKITTINGGI', 'code' => 'BKT', 'city' => 'Bukittinggi', 'province' => 'Sumatera Barat'],
            ['area_code' => 'SUMATRA', 'name' => 'PEKANBARU',   'code' => 'PKU', 'city' => 'Pekanbaru',   'province' => 'Riau'],
            ['area_code' => 'SUMATRA', 'name' => 'PALEMBANG',   'code' => 'PLM', 'city' => 'Palembang',   'province' => 'Sumatera Selatan'],
            ['area_code' => 'SUMATRA', 'name' => 'LAMPUNG',     'code' => 'LPG', 'city' => 'Bandar Lampung', 'province' => 'Lampung'],

            // ── Area Jakarta (1 cabang) ──
            ['area_code' => 'JAKARTA', 'name' => 'JAKARTA',     'code' => 'JKT', 'city' => 'Jakarta',     'province' => 'DKI Jakarta'],

            // ── Area Jabar 1 (3 cabang) ──
            ['area_code' => 'JABAR1',  'name' => 'KARAWANG',    'code' => 'KRW', 'city' => 'Karawang',    'province' => 'Jawa Barat'],
            ['area_code' => 'JABAR1',  'name' => 'BEKASI',      'code' => 'BKS', 'city' => 'Bekasi',      'province' => 'Jawa Barat'],
            ['area_code' => 'JABAR1',  'name' => 'CIREBON',     'code' => 'CRB', 'city' => 'Cirebon',     'province' => 'Jawa Barat'],

            // ── Area Jabar 2 (3 cabang) ──
            ['area_code' => 'JABAR2',  'name' => 'BANDUNG',     'code' => 'BDG', 'city' => 'Bandung',     'province' => 'Jawa Barat'],
            ['area_code' => 'JABAR2',  'name' => 'BOGOR',       'code' => 'BGR', 'city' => 'Bogor',       'province' => 'Jawa Barat'],
            ['area_code' => 'JABAR2',  'name' => 'TANGERANG',   'code' => 'TNG', 'city' => 'Tangerang',   'province' => 'Banten'],

            // ── Area Jateng (5 cabang) ──
            ['area_code' => 'JATENG',  'name' => 'SOLO',        'code' => 'SLO', 'city' => 'Solo',        'province' => 'Jawa Tengah'],
            ['area_code' => 'JATENG',  'name' => 'PURWOKERTO',  'code' => 'PWK', 'city' => 'Purwokerto',  'province' => 'Jawa Tengah'],
            ['area_code' => 'JATENG',  'name' => 'DIY',         'code' => 'DIY', 'city' => 'Yogyakarta',  'province' => 'DI Yogyakarta'],
            ['area_code' => 'JATENG',  'name' => 'TEGAL',       'code' => 'TGL', 'city' => 'Tegal',       'province' => 'Jawa Tengah'],
            ['area_code' => 'JATENG',  'name' => 'SEMARANG',    'code' => 'SMG', 'city' => 'Semarang',    'province' => 'Jawa Tengah'],

            // ── Area Jatim (4 cabang) ──
            ['area_code' => 'JATIM',   'name' => 'SURABAYA',    'code' => 'SBY', 'city' => 'Surabaya',    'province' => 'Jawa Timur'],
            ['area_code' => 'JATIM',   'name' => 'MALANG',      'code' => 'MLG', 'city' => 'Malang',      'province' => 'Jawa Timur'],
            ['area_code' => 'JATIM',   'name' => 'GRESIK',      'code' => 'GRS', 'city' => 'Gresik',      'province' => 'Jawa Timur'],
            ['area_code' => 'JATIM',   'name' => 'MADIUN',      'code' => 'MDU', 'city' => 'Madiun',      'province' => 'Jawa Timur'],
        ];

        // Ambil semua area ID sekali
        $areaIds = DB::table('areas')
            ->whereIn('code', array_unique(array_column($branches, 'area_code')))
            ->pluck('id', 'code');

        $inserted = 0;
        $skipped  = 0;

        foreach ($branches as $branch) {
            $areaId = $areaIds[$branch['area_code']] ?? null;

            if (!$areaId) {
                $this->command->warn("⚠️  Area {$branch['area_code']} tidak ditemukan, skip {$branch['name']}");
                $skipped++;
                continue;
            }

            // Skip kalau kode sudah ada
            $exists = DB::table('branches')->where('code', $branch['code'])->exists();
            if ($exists) {
                $this->command->line("⏭  Skip {$branch['name']} ({$branch['code']}) — sudah ada");
                $skipped++;
                continue;
            }

            DB::table('branches')->insert([
                'id'         => (string) Str::uuid(),
                'area_id'    => $areaId,
                'name'       => $branch['name'],
                'code'       => $branch['code'],
                'city'       => $branch['city'],
                'province'   => $branch['province'],
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->command->info("✅ {$branch['name']} ({$branch['code']}) → {$branch['area_code']}");
            $inserted++;
        }

        $this->command->newLine();
        $this->command->info("Selesai: {$inserted} cabang ditambahkan, {$skipped} dilewati.");
    }
}