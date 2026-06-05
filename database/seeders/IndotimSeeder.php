<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class IndotimSeeder extends Seeder
{
    public function run(): void
    {
        // Area
        $area = Area::create([
            'name'   => 'INDOTIM',
            'code'   => 'INDOTIM',
            'region' => 'Indonesia Timur',
        ]);

        // 7 Cabang
        $branches = [
            ['name' => 'KENDARI',  'code' => 'KDI', 'city' => 'Kendari',  'province' => 'Sulawesi Tenggara'],
            ['name' => 'BAU-BAU',  'code' => 'BBA', 'city' => 'Bau-Bau',  'province' => 'Sulawesi Tenggara'],
            ['name' => 'MAKASSAR', 'code' => 'MKS', 'city' => 'Makassar', 'province' => 'Sulawesi Selatan'],
            ['name' => 'MANADO',   'code' => 'MDO', 'city' => 'Manado',   'province' => 'Sulawesi Utara'],
            ['name' => 'AMBON',    'code' => 'AMB', 'city' => 'Ambon',    'province' => 'Maluku'],
            ['name' => 'SORONG',   'code' => 'SRG', 'city' => 'Sorong',   'province' => 'Papua Barat Daya'],
            ['name' => 'JAYAPURA', 'code' => 'JPR', 'city' => 'Jayapura', 'province' => 'Papua'],
        ];

        $createdBranches = [];
        foreach ($branches as $b) {
            $createdBranches[$b['code']] = Branch::create([
                ...$b,
                'area_id' => $area->id,
            ]);
        }

        // Super Admin
        User::create([
            'name'     => 'Super Admin',
            'email'    => 'admin@onebwa.my.id',
            'password' => Hash::make('password'),
            'role'     => User::ROLE_SUPER_ADMIN,
        ]);

        // Area Manager (Marten)
        User::create([
            'name'     => 'Marten',
            'email'    => 'marten@onebwa.my.id',
            'password' => Hash::make('password'),
            'role'     => User::ROLE_AREA_MANAGER,
            'area_id'  => $area->id,
        ]);

        // Kepala Cabang per cabang
        $kepala = [
            'KDI' => ['name' => 'Kepala Kendari',  'email' => 'kdi@onebwa.my.id'],
            'BBA' => ['name' => 'Kepala Bau-Bau',  'email' => 'bba@onebwa.my.id'],
            'MKS' => ['name' => 'Kepala Makassar', 'email' => 'mks@onebwa.my.id'],
            'MDO' => ['name' => 'Kepala Manado',   'email' => 'mdo@onebwa.my.id'],
            'AMB' => ['name' => 'Kepala Ambon',    'email' => 'amb@onebwa.my.id'],
            'SRG' => ['name' => 'Kepala Sorong',   'email' => 'srg@onebwa.my.id'],
            'JPR' => ['name' => 'Kepala Jayapura', 'email' => 'jpr@onebwa.my.id'],
        ];

        foreach ($kepala as $code => $u) {
            User::create([
                'name'      => $u['name'],
                'email'     => $u['email'],
                'password'  => Hash::make('password'),
                'role'      => User::ROLE_BRANCH_HEAD,
                'branch_id' => $createdBranches[$code]->id,
                'area_id'   => $area->id,
            ]);
        }

        $this->command->info('✅ Seeded: 1 area, 7 cabang, 9 user');
    }
}