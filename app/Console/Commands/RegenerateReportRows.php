<?php

namespace App\Console\Commands;

use App\Models\MonthlyReport;
use Illuminate\Console\Command;

class RegenerateReportRows extends Command
{
    protected $signature   = 'reports:generate-rows {--id= : UUID laporan tertentu}';
    protected $description = 'Generate baris harian untuk laporan yang belum memiliki baris harian';

    public function handle(): int
    {
        $query = MonthlyReport::query();

        if ($id = $this->option('id')) {
            $query->where('id', $id);
        }

        $reports = $query->get();

        if ($reports->isEmpty()) {
            $this->error('Tidak ada laporan yang ditemukan.');
            return self::FAILURE;
        }

        $this->info("Memproses {$reports->count()} laporan...");
        $bar = $this->output->createProgressBar($reports->count());
        $bar->start();

        $totalCreated = 0;

        foreach ($reports as $report) {
            $created = $report->generateDailyRows();
            $totalCreated += $created;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Selesai! Total {$totalCreated} baris harian dibuat.");

        return self::SUCCESS;
    }
}