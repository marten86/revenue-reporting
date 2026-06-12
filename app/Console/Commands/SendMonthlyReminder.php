<?php

namespace App\Console\Commands;

use App\Models\Branch;
use App\Models\MonthlyReport;
use App\Models\User;
use App\Services\FonnteService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendMonthlyReminder extends Command
{
    protected $signature   = 'reminder:monthly-submit {--month= : Periode bulan (Y-m-d), default bulan lalu}';
    protected $description = 'Kirim reminder WA ke Kepala Cabang dan Area Manager untuk submit laporan bulanan';

    public function handle(FonnteService $fonnte): int
    {
        // Periode yang di-reminder: bulan lalu (default)
        $monthInput  = $this->option('month');
        $periodMonth = $monthInput
            ? Carbon::parse($monthInput)->startOfMonth()->format('Y-m-d')
            : Carbon::now()->subMonth()->startOfMonth()->format('Y-m-d');

        $periodLabel = Carbon::parse($periodMonth)->translatedFormat('F Y');

        $this->info("Mengirim reminder untuk periode: {$periodLabel}");
        Log::info("SendMonthlyReminder: Mulai untuk periode {$periodLabel}");

        $branches = Branch::where('is_active', true)
            ->with([
                'area',
                'monthlyReports' => fn($q) => $q->where('period_month', $periodMonth),
                'users'          => fn($q) => $q->where('role', User::ROLE_BRANCH_HEAD)->whereNotNull('phone'),
            ])
            ->get();

        $sentCount   = 0;
        $skipCount   = 0;
        $areaRekap   = []; // Untuk pesan Area Manager: area_id → ['name', 'am', 'submitted', 'not_submitted']

        // ── Kirim ke Kepala Cabang ──────────────────────────────────────────
        foreach ($branches as $branch) {
            $report   = $branch->monthlyReports->first();
            $status   = $report?->status ?? 'no_report';
            $isSubmit = in_array($status, [MonthlyReport::STATUS_SUBMITTED, MonthlyReport::STATUS_APPROVED]);

            // Rekap per area untuk AM
            $areaId = $branch->area_id;
            if (!isset($areaRekap[$areaId])) {
                $areaRekap[$areaId] = [
                    'area_name'     => $branch->area?->name ?? 'Area',
                    'submitted'     => [],
                    'not_submitted' => [],
                ];
            }

            if ($isSubmit) {
                $areaRekap[$areaId]['submitted'][] = $branch->name;
            } else {
                $areaRekap[$areaId]['not_submitted'][] = $branch->name;
            }

            // Kirim ke semua Kepala Cabang yang punya nomor WA
            foreach ($branch->users as $kacab) {
                if (empty($kacab->phone)) {
                    $this->warn("  Skip {$branch->name}: {$kacab->name} belum punya nomor WA");
                    $skipCount++;
                    continue;
                }

                $statusText = $isSubmit
                    ? "sudah disubmit ✅. Terima kasih telah menyelesaikan laporan tepat waktu."
                    : "belum disubmit ⏳. Mohon segera disubmit melalui sistem SIM BWA Indotim.";

                $message = "Assalamu'alaikum Kak {$kacab->name},\n\n"
                    . "Reminder laporan revenue bulan *{$periodLabel}* cabang *{$branch->name}* {$statusText}\n\n"
                    . "Link sistem: https://onebwa.my.id\n\n"
                    . "Terima kasih 🙏\n"
                    . "_Tim SIM BWA Indotim_";

                $ok = $fonnte->send($kacab->phone, $message);
                if ($ok) {
                    $this->info("  ✓ Terkirim → {$kacab->name} ({$branch->name})");
                    $sentCount++;
                } else {
                    $this->error("  ✗ Gagal → {$kacab->name} ({$branch->name})");
                }

                // Jeda 1 detik antar pesan agar tidak rate-limited
                sleep(1);
            }
        }

        // ── Kirim ke Area Manager ───────────────────────────────────────────
        $areaManagers = User::where('role', User::ROLE_AREA_MANAGER)
            ->whereNotNull('phone')
            ->whereNotNull('area_id')
            ->get();

        foreach ($areaManagers as $am) {
            $rekap = $areaRekap[$am->area_id] ?? null;

            if (!$rekap) {
                $this->warn("  Skip AM {$am->name}: tidak ada data area");
                continue;
            }

            $submitList    = !empty($rekap['submitted'])
                ? implode(', ', $rekap['submitted'])
                : '—';
            $notSubmitList = !empty($rekap['not_submitted'])
                ? implode(', ', $rekap['not_submitted'])
                : '—';

            $totalCabang   = count($rekap['submitted']) + count($rekap['not_submitted']);
            $totalSubmit   = count($rekap['submitted']);

            $message = "Assalamu'alaikum Kak {$am->name},\n\n"
                . "Rekapitulasi status laporan bulan *{$periodLabel}* Area *{$rekap['area_name']}*:\n\n"
                . "✅ Sudah submit ({$totalSubmit}/{$totalCabang}):\n{$submitList}\n\n"
                . "⏳ Belum submit:\n{$notSubmitList}\n\n"
                . "Mohon follow up cabang yang belum submit.\n\n"
                . "Terima kasih 🙏\n"
                . "_Tim SIM BWA Indotim_";

            $ok = $fonnte->send($am->phone, $message);
            if ($ok) {
                $this->info("  ✓ Terkirim → AM {$am->name} ({$rekap['area_name']})");
                $sentCount++;
            } else {
                $this->error("  ✗ Gagal → AM {$am->name} ({$rekap['area_name']})");
            }

            sleep(1);
        }

        $this->info("\nSelesai. Terkirim: {$sentCount}, Skip (no phone): {$skipCount}");
        Log::info("SendMonthlyReminder: Selesai. Terkirim={$sentCount}, Skip={$skipCount}");

        return Command::SUCCESS;
    }
}