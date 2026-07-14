<?php

namespace App\Console\Commands;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\SafariDakwahLog;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportSafdakFromCsv extends Command
{
    /**
     * Import log Safari Dakwah dari export CSV Notion (SAFDAK INDOTIM 2026).
     *
     * Contoh:
     *   php artisan safdak:import storage/app/safdak_notion.csv --dry-run
     *   php artisan safdak:import storage/app/safdak_notion.csv --create-reports
     *
     * Kolom CSV yang dikenali (header baris pertama, tidak case-sensitive):
     *   TANGGAL, CABANG, NAMA, LEVEL, Status, Komitmen (REV), Realisasi (REV),
     *   Cost SafDak, T, D, E, MOU, LOKASI/Location (opsional), WAKTU/Time (opsional),
     *   CATATAN/Notes (opsional)
     */
    protected $signature = 'safdak:import
        {file : Path file CSV hasil export Notion}
        {--dry-run : Tampilkan apa yang akan terjadi tanpa menulis ke database}
        {--create-reports : Auto-create MonthlyReport berstatus Draft jika belum ada}';

    protected $description = 'Import log Safari Dakwah dari CSV Notion ke safari_dakwah_logs';

    private const DAY_NAMES = [
        'Sunday'    => 'Ahad',
        'Monday'    => 'Senin',
        'Tuesday'   => 'Selasa',
        'Wednesday' => 'Rabu',
        'Thursday'  => 'Kamis',
        'Friday'    => 'Jumat',
        'Saturday'  => 'Sabtu',
    ];

    public function handle(): int
    {
        $path = $this->argument('file');
        $dryRun = (bool) $this->option('dry-run');

        if (! file_exists($path)) {
            $this->error("File tidak ditemukan: {$path}");
            return self::FAILURE;
        }

        $rows = $this->readCsv($path);
        if (empty($rows)) {
            $this->error('CSV kosong atau header tidak terbaca.');
            return self::FAILURE;
        }

        $this->info(($dryRun ? '[DRY RUN] ' : '') . count($rows) . ' baris terbaca dari CSV.');

        // Cache cabang: nama lowercase => id
        $branches = Branch::all(['id', 'name']);

        $stats = [
            'inserted'        => 0,
            'skipped_dupe'    => 0,
            'skipped_nobranch'=> 0,
            'skipped_noreport'=> 0,
            'skipped_baddate' => 0,
            'reports_created' => 0,
        ];
        $unmatchedBranches = [];

        DB::beginTransaction();

        foreach ($rows as $i => $row) {
            $line = $i + 2; // +2: header + index mulai 0

            // ── Tanggal ──
            $date = $this->parseDate($this->col($row, ['tanggal', 'date']));
            if (! $date) {
                $stats['skipped_baddate']++;
                $this->warn("Baris {$line}: tanggal tidak valid, dilewati.");
                continue;
            }

            // ── Cabang ──
            $branchName = trim((string) $this->col($row, ['cabang', 'branch']));
            $branch = $this->matchBranch($branches, $branchName);
            if (! $branch) {
                $stats['skipped_nobranch']++;
                $unmatchedBranches[$branchName] = true;
                continue;
            }

            // ── MonthlyReport (folder induk) ──
            $periodMonth = $date->copy()->startOfMonth()->toDateString(); // YYYY-MM-01
            $report = MonthlyReport::where('branch_id', $branch->id)
                ->where('period_month', $periodMonth)
                ->first();

            if (! $report) {
                if ($this->option('create-reports')) {
                    if (! $dryRun) {
                        $report = MonthlyReport::create([
                            'branch_id'    => $branch->id,
                            'period_month' => $periodMonth,
                            'status'       => 'Draft',
                        ]);
                    }
                    $stats['reports_created']++;
                    $this->line("Baris {$line}: MonthlyReport Draft dibuat untuk {$branch->name} {$periodMonth}.");
                } else {
                    $stats['skipped_noreport']++;
                    $this->warn("Baris {$line}: MonthlyReport {$branch->name} {$periodMonth} belum ada (pakai --create-reports untuk auto-create).");
                    continue;
                }
            }

            $speaker = trim((string) $this->col($row, ['nama', 'speaker', 'talent']));

            // ── Idempotensi: kombinasi tanggal + speaker + cabang dianggap unik ──
            $exists = SafariDakwahLog::where('date', $date->toDateString())
                ->where('speaker', $speaker)
                ->when($report, fn ($q) => $q->where('monthly_report_id', $report->id))
                ->exists();

            if ($exists) {
                $stats['skipped_dupe']++;
                continue;
            }

            $commitment  = $this->toInt($this->col($row, ['komitmen (rev)', 'komitmen', 'commitment']));
            $realization = $this->toInt($this->col($row, ['realisasi (rev)', 'realisasi', 'realization']));

            $payload = [
                'monthly_report_id' => $report?->id,
                'date'              => $date->toDateString(),
                'day_name'          => self::DAY_NAMES[$date->format('l')] ?? $date->format('l'),
                'time'              => $this->col($row, ['waktu', 'time']) ?: null,
                'location'          => $this->col($row, ['lokasi', 'location']) ?: null,
                'speaker'           => $speaker ?: null,
                'level'             => $this->col($row, ['level']) ?: null,
                'status'            => $this->mapStatus($this->col($row, ['status'])),
                'target'            => 0,
                'commitment'        => $commitment,
                'realization'       => $realization,
                'cost'              => $this->toInt($this->col($row, ['cost safdak', 'cost'])),
                'gap'               => $realization - $commitment,
                'target_titik'      => $this->toInt($this->col($row, ['t', 'target titik'])),
                'titik_deal'        => $this->toInt($this->col($row, ['d', 'titik deal'])),
                'titik_eksekusi'    => $this->toInt($this->col($row, ['e', 'titik eksekusi'])),
                'has_mou'           => $this->toBool($this->col($row, ['mou'])),
                'notes'             => $this->col($row, ['catatan', 'notes']) ?: null,
            ];

            if (! $dryRun && $report) {
                SafariDakwahLog::create($payload);
            }
            $stats['inserted']++;
        }

        $dryRun ? DB::rollBack() : DB::commit();

        // ── Ringkasan ──
        $this->newLine();
        $this->info(($dryRun ? '[DRY RUN] ' : '') . 'Ringkasan import:');
        $this->table(
            ['Hasil', 'Jumlah'],
            [
                ['Akan diinsert' . ($dryRun ? '' : ' (tersimpan)'), $stats['inserted']],
                ['Dilewati - duplikat', $stats['skipped_dupe']],
                ['Dilewati - cabang tak dikenali', $stats['skipped_nobranch']],
                ['Dilewati - MonthlyReport belum ada', $stats['skipped_noreport']],
                ['Dilewati - tanggal tidak valid', $stats['skipped_baddate']],
                ['MonthlyReport Draft dibuat', $stats['reports_created']],
            ]
        );

        if (! empty($unmatchedBranches)) {
            $this->warn('Nama cabang di CSV yang tidak cocok dengan tabel branches:');
            foreach (array_keys($unmatchedBranches) as $name) {
                $this->line("  - \"{$name}\"");
            }
            $this->line('Samakan penulisan nama di CSV, atau sesuaikan matchBranch().');
        }

        return self::SUCCESS;
    }

    /** Baca CSV jadi array asosiatif dengan header lowercase. */
    private function readCsv(string $path): array
    {
        $rows = [];
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return [];
        }
        // Buang UTF-8 BOM yang sering menempel di kolom pertama hasil export Notion/Windows
        if (isset($header[0])) {
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        }
        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $header);

        while (($data = fgetcsv($handle)) !== false) {
            if (count(array_filter($data, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue; // baris kosong
            }
            $row = [];
            foreach ($header as $idx => $key) {
                $row[$key] = $data[$idx] ?? null;
            }
            $rows[] = $row;
        }
        fclose($handle);

        return $rows;
    }

    /** Ambil nilai kolom dengan beberapa kemungkinan nama header. */
    private function col(array $row, array $keys): ?string
    {
        foreach ($keys as $key) {
            if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
                return trim((string) $row[$key]);
            }
        }
        return null;
    }

    /** Notion export bisa "January 5, 2026", "2026-01-05", "05/01/2026", atau rentang "January 2, 2026 → January 21, 2026". */
    private function parseDate(?string $raw): ?Carbon
    {
        if (! $raw) {
            return null;
        }
        // Kolom TANGGAL bertipe date range di Notion diekspor dengan simbol panah - ambil tanggal mulai saja
        $raw = trim(explode('→', $raw)[0]);
        $raw = trim(explode('->', $raw)[0]);

        foreach (['Y-m-d', 'F j, Y', 'd/m/Y', 'm/d/Y', 'd-m-Y'] as $format) {
            try {
                return Carbon::createFromFormat($format, $raw)->startOfDay();
            } catch (\Exception $e) {
                // coba format berikutnya
            }
        }
        try {
            return Carbon::parse($raw)->startOfDay();
        } catch (\Exception $e) {
            return null;
        }
    }

    /** Cocokkan nama cabang: exact dulu, lalu contains (dua arah), case-insensitive. */
    private function matchBranch($branches, string $name): ?Branch
    {
        if ($name === '') {
            return null;
        }
        $needle = strtolower($name);

        foreach ($branches as $branch) {
            if (strtolower($branch->name) === $needle) {
                return $branch;
            }
        }
        foreach ($branches as $branch) {
            $b = strtolower($branch->name);
            if (str_contains($b, $needle) || str_contains($needle, $b)) {
                return $branch;
            }
        }
        return null;
    }

    private function mapStatus(?string $raw): string
    {
        $val = strtolower(trim((string) $raw));
        return in_array($val, ['failed', 'gagal', 'batal'], true) ? 'failed' : 'done';
    }

    private function toInt(?string $raw): int
    {
        if ($raw === null) {
            return 0;
        }
        // Buang "IDR"/"Rp"/pemisah ribuan (koma), TAPI pertahankan titik desimal
        // supaya "IDR 282,698,000.00" tidak salah jadi 28269800000 (inflasi 100x)
        $clean = preg_replace('/[^\d.\-]/', '', $raw);
        if ($clean === '' || $clean === '-' || $clean === '.') {
            return 0;
        }
        return (int) round((float) $clean);
    }

    private function toBool(?string $raw): bool
    {
        $val = strtolower(trim((string) $raw));
        return in_array($val, ['yes', 'true', '1', 'ya', 'checked', '✓', 'v'], true);
    }
}