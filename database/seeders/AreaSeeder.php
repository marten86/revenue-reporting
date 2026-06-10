<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AreaSeeder extends Seeder
{
    public function run(): void
    {
        $areas = [
            ['code' => 'SUMATRA',  'name' => 'Area Sumatera', 'region' => 'Sumatera'],
            ['code' => 'JAKARTA',  'name' => 'Area Jakarta',  'region' => 'Jawa'],
            ['code' => 'JABAR1',   'name' => 'Area Jabar 1',  'region' => 'Jawa'],
            ['code' => 'JABAR2',   'name' => 'Area Jabar 2',  'region' => 'Jawa'],
            ['code' => 'JATENG',   'name' => 'Area Jateng',   'region' => 'Jawa'],
            ['code' => 'JATIM',    'name' => 'Area Jatim',    'region' => 'Jawa'],
            ['code' => 'INDOTIM',  'name' => 'Area Indotim',  'region' => 'Indonesia Timur'],
        ];

        foreach ($areas as $area) {
            DB::table('areas')->updateOrInsert(
                ['code' => $area['code']],
                [
                    'id'         => (string) Str::uuid(),
                    'name'       => $area['name'],
                    'code'       => $area['code'],
                    'region'     => $area['region'],
                    'is_active'  => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        // Ambil ID Area Indotim
        $indotimId = DB::table('areas')->where('code', 'INDOTIM')->value('id');

        // Map 7 cabang Indotim
        $indotimCodes = ['KDI', 'MKS', 'BPN', 'SMD', 'BJM', 'PNK', 'PLU'];
        DB::table('branches')
            ->whereIn('code', $indotimCodes)
            ->update(['area_id' => $indotimId]);

        // Map user Marten ke Area Indotim
        DB::table('users')
            ->where('email', 'marten@onebwa.my.id')
            ->update(['area_id' => $indotimId]);

        $this->command->info('✅ 7 area nasional berhasil di-seed.');
        $this->command->info('✅ 7 cabang Indotim di-mapping ke Area Indotim.');
        $this->command->info('✅ marten@onebwa.my.id di-set sebagai Area Manager Indotim.');
    }
}