<?php

namespace App\Console\Commands;

use App\Models\Speaker;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedSpeakersFromLogs extends Command
{
    protected $signature = 'speakers:seed-from-logs {--dry-run : Tampilkan hasil tanpa menyimpan}';

    protected $description = 'Backfill master data narasumber dari safari_dakwah_logs yang sudah ada. '
        . 'Narasumber yang muncul di >1 cabang otomatis dijadikan nasional (branch_id null).';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $rows = DB::table('safari_dakwah_logs as l')
            ->join('monthly_reports as r', 'r.id', '=', 'l.monthly_report_id')
            ->whereNotNull('l.speaker')
            ->where('l.speaker', '!=', '')
            ->select('r.branch_id', 'l.speaker')
            ->distinct()
            ->get();

        if ($rows->isEmpty()) {
            $this->info('Tidak ada data narasumber untuk di-backfill.');
            return self::SUCCESS;
        }

        // Kelompokkan per nama (case-insensitive, trim) → daftar cabang yang pernah memakainya
        $byName = [];
        foreach ($rows as $row) {
            $key = mb_strtolower(trim($row->speaker));
            if ($key === '') continue;
            $byName[$key]['name'] ??= trim($row->speaker);
            $byName[$key]['branches'][] = $row->branch_id;
        }

        $createdNational = 0;
        $createdBranch   = 0;
        $skipped         = 0;

        foreach ($byName as $entry) {
            $branches   = array_values(array_unique($entry['branches']));
            $isNational = count($branches) > 1;

            if ($isNational) {
                $exists = Speaker::whereNull('branch_id')
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($entry['name'])])
                    ->exists();

                if ($exists) { $skipped++; continue; }

                $this->line(($dryRun ? '[DRY] ' : '') . "Nasional: {$entry['name']} (dipakai di " . count($branches) . ' cabang)');
                if (!$dryRun) {
                    Speaker::create(['branch_id' => null, 'name' => $entry['name'], 'is_active' => true]);
                }
                $createdNational++;
                continue;
            }

            $branchId = $branches[0];
            $exists = Speaker::where('branch_id', $branchId)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($entry['name'])])
                ->exists();

            if ($exists) { $skipped++; continue; }

            $this->line(($dryRun ? '[DRY] ' : '') . "Cabang {$branchId}: {$entry['name']}");
            if (!$dryRun) {
                Speaker::create(['branch_id' => $branchId, 'name' => $entry['name'], 'is_active' => true]);
            }
            $createdBranch++;
        }

        $this->newLine();
        $this->info("Selesai. Nasional: {$createdNational} · Per cabang: {$createdBranch} · Dilewati (sudah ada): {$skipped}.");

        if ($dryRun) {
            $this->comment('Mode dry-run — tidak ada data yang disimpan. Jalankan tanpa --dry-run untuk eksekusi sungguhan.');
        }

        return self::SUCCESS;
    }
}