<?php

namespace App\Console\Commands;

use App\Models\Branch;
use App\Models\User;
use App\Services\FonnteService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendWeeklyReminder extends Command
{
    protected $signature   = 'reminder:weekly-fill';
    protected $description = 'Kirim reminder WA setiap Senin ke Kepala Cabang untuk mengisi laporan harian';

    // Kumpulan hadits motivasi kerja — dipilih acak setiap pengiriman
    protected array $hadits = [
        [
            'text' => 'إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ',
            'arti' => 'Sesungguhnya Allah mencintai seseorang yang apabila bekerja, ia melakukannya dengan itqan (profesional/sungguh-sungguh).',
            'rawi' => 'HR. Baihaqi',
        ],
        [
            'text' => 'مَا أَكَلَ أَحَدٌ طَعَامًا قَطُّ خَيْرًا مِنْ أَنْ يَأْكُلَ مِنْ عَمَلِ يَدِهِ',
            'arti' => 'Tidaklah seseorang memakan makanan yang lebih baik daripada memakan hasil jerih payah tangannya sendiri.',
            'rawi' => 'HR. Bukhari',
        ],
        [
            'text' => 'إِنَّ اللَّهَ كَتَبَ الْإِحْسَانَ عَلَى كُلِّ شَيْءٍ',
            'arti' => 'Sesungguhnya Allah mewajibkan ihsan (berbuat baik/optimal) dalam segala sesuatu.',
            'rawi' => 'HR. Muslim',
        ],
        [
            'text' => 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ',
            'arti' => 'Barangsiapa menempuh jalan untuk mencari ilmu, Allah akan mudahkan baginya jalan menuju surga.',
            'rawi' => 'HR. Muslim',
        ],
        [
            'text' => 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ',
            'arti' => 'Mukmin yang kuat lebih baik dan lebih dicintai Allah daripada mukmin yang lemah, namun keduanya tetap baik.',
            'rawi' => 'HR. Muslim',
        ],
        [
            'text' => 'احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلَا تَعْجَزْ',
            'arti' => 'Bersungguh-sungguhlah dalam hal yang bermanfaat bagimu, mintalah pertolongan kepada Allah, dan janganlah bersikap lemah.',
            'rawi' => 'HR. Muslim',
        ],
        [
            'text' => 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ',
            'arti' => 'Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain.',
            'rawi' => 'HR. Ahmad & Thabrani',
        ],
        [
            'text' => 'إِنَّ مِنْ أَطْيَبِ مَا أَكَلَ الرَّجُلُ مِنْ كَسْبِهِ وَإِنَّ وَلَدَهُ مِنْ كَسْبِهِ',
            'arti' => 'Sesungguhnya sebaik-baik yang dimakan seseorang adalah hasil usahanya sendiri.',
            'rawi' => 'HR. Abu Dawud & Tirmidzi',
        ],
    ];

    public function handle(FonnteService $fonnte): int
    {
        $periodMonth = Carbon::now()->startOfMonth()->format('Y-m-d');
        $periodLabel = Carbon::now()->translatedFormat('F Y');

        // Pilih hadits secara acak
        $hadits = $this->hadits[array_rand($this->hadits)];

        $this->info("Mengirim reminder mingguan untuk periode: {$periodLabel}");
        Log::info("SendWeeklyReminder: Mulai untuk periode {$periodLabel}");

        $sentCount = 0;
        $skipCount = 0;

        $branches = Branch::where('is_active', true)
            ->with([
                'users' => fn($q) => $q->where('role', User::ROLE_BRANCH_HEAD)->whereNotNull('phone'),
            ])
            ->get();

        foreach ($branches as $branch) {
            foreach ($branch->users as $kacab) {
                if (empty($kacab->phone)) {
                    $skipCount++;
                    continue;
                }

                $message = "Assalamu'alaikum Kak {$kacab->name},\n\n"
                    . "🔔 *Reminder Mingguan*\n\n"
                    . "Jangan lupa update laporan revenue harian cabang *{$branch->name}* untuk minggu ini ya.\n\n"
                    . "Link sistem: https://onebwa.my.id\n\n"
                    . "---\n"
                    . "💡 *Hadits Motivasi*\n\n"
                    . "_{$hadits['text']}_\n\n"
                    . "*\"{$hadits['arti']}\"*\n"
                    . "_{$hadits['rawi']}_\n\n"
                    . "Semangat bekerja! 💪\n\n"
                    . "Terima kasih 🙏\n"
                    . "_Tim SIM BWA Indotim_";

                $ok = $fonnte->send($kacab->phone, $message);
                if ($ok) {
                    $this->info("  ✓ Terkirim → {$kacab->name} ({$branch->name})");
                    $sentCount++;
                } else {
                    $this->error("  ✗ Gagal → {$kacab->name} ({$branch->name})");
                }

                sleep(1);
            }
        }

        $this->info("\nSelesai. Terkirim: {$sentCount}, Skip (no phone): {$skipCount}");
        Log::info("SendWeeklyReminder: Selesai. Terkirim={$sentCount}, Skip={$skipCount}");

        return Command::SUCCESS;
    }
}