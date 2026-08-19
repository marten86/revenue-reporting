<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\SafdakEvent;
use App\Models\Speaker;
use App\Support\PeriodRange;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * penanda versi: safdakevent-ctrl-avg-capaian-20260820
 */
class SafdakEventController extends Controller
{
    /** Nilai sentinel untuk memfilter kampanye yang dainya belum ditentukan */
    private const SPEAKER_NONE = '__none__';

    /**
     * Halaman pipeline: daftar kampanye SafDak dengan filter
     * status / cabang / periode / dai + peringkat dai.
     *
     * Scope baca mengikuti pola SafariCalendarController:
     * - seesAllBranches() -> semua cabang
     * - selain itu -> accessibleBranches() (AM: cabang areanya; BH/staff: cabang sendiri)
     *
     * CATATAN: pipeline TIDAK lagi terhubung ke laporan bulanan. Jembatan
     * "Catat Realisasi" (storeRealization + prop reports) dihapus 27 Juli 2026
     * atas keputusan Marten. Revenue di halaman ini murni angka manajerial;
     * angka resmi diinput terpisah lewat TabSafari di laporan bulanan.
     * Kolom safari_dakwah_logs.event_id SENGAJA dipertahankan (soft link,
     * CRM-ready) supaya log lama tetap punya jejak asal-usulnya.
     *
     * FILTER MANA YANG MASUK KE ANGKA MANA (ditetapkan 19 Agustus 2026):
     *
     *              | ringkasan/funnel | peringkat dai | daftar
     *   cabang     |       YA         |      YA       |  YA
     *   periode    |       YA         |      YA       |  YA
     *   dai        |       YA         |    TIDAK      |  YA
     *   status     |     TIDAK        |    TIDAK      |  YA
     *
     * Diwujudkan lewat TIGA builder bertingkat, bukan flag:
     *   $scoped    = cabang + periode                 -> sumber PERINGKAT
     *   $base      = $scoped + dai                    -> sumber RINGKASAN
     *   $listQuery = $base + status                   -> sumber DAFTAR
     *
     * Kenapa peringkat TIDAK ikut filter dai: kalau ikut, tabelnya menyusut
     * jadi satu baris dan kehilangan seluruh maknanya (peringkat butuh
     * pembanding). Dai yang sedang difilter di-highlight barisnya di frontend
     * supaya user tetap tahu posisinya.
     *
     * Kalau suatu saat dai dipindah ke $listQuery, ringkasan akan memakai
     * pembilang & penyebut dari scope berbeda -- bug yang sama persis dengan
     * "Analytics single-channel".
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $accessibleBranches = $user->seesAllBranches()
            ? Branch::orderBy('name')->get(['id', 'name', 'code'])
            : $user->accessibleBranches()->orderBy('name')->get(['id', 'name', 'code']);

        $branchIds = $accessibleBranches->pluck('id')->all();

        // -- Filter cabang ---------------------------------------
        $branchFilter = null;

        if ($request->filled('branch') && in_array($request->get('branch'), $branchIds, true)) {
            $branchFilter = $request->get('branch');
        }

        // -- Filter periode --------------------------------------
        // ?range= menerima 2026-08 / 2026-Q3 / 2026-S2 / 2026 / kosong.
        // ?month=YYYY-MM (skema lama) tetap diterima dan dipetakan ke range,
        // supaya tautan & bookmark yang sudah beredar tidak mati.
        $rangeParam = trim((string) $request->get('range', ''));

        if ($rangeParam === '' && $request->filled('month')) {
            $rangeParam = trim((string) $request->get('month'));
        }

        $period = PeriodRange::parse($rangeParam);

        // -- Filter dai ------------------------------------------
        $speakerParam = trim((string) $request->get('speaker', ''));

        // -- Builder 1: cabang + periode (TANPA dai, TANPA status) --
        // Ini scope terluas yang masih "yang sedang dilihat user". Dipakai
        // sebagai sumber peringkat dai.
        $scoped = SafdakEvent::query()->forBranches($branchIds);

        if ($branchFilter !== null) {
            $scoped->where('branch_id', $branchFilter);
        }

        if ($period !== null) {
            $scoped->overlapsRange($period['start'], $period['end']);
        }

        // -- Builder 2: + dai (dipakai list + summary) ------------
        $base = clone $scoped;

        if ($speakerParam === self::SPEAKER_NONE) {
            // Kampanye tanpa dai. Dicek null DAN string kosong: middleware
            // ConvertEmptyStringsToNull membuat entri baru tersimpan null,
            // tapi baris lama bisa saja menyimpan '' -- keduanya harus ikut.
            $base->where(function ($q) {
                $q->whereNull('speaker')->orWhere('speaker', '');
            });
        } elseif ($speakerParam !== '') {
            $base->where('speaker', $speakerParam);
        }

        // -- Builder 3: + status ---------------------------------
        $listQuery = (clone $base)
            ->with('branch:id,name,code')
            ->orderBy('start_date');

        if ($request->filled('status') && in_array($request->get('status'), SafdakEvent::STATUSES, true)) {
            $listQuery->status($request->get('status'));
        }

        $events = $listQuery->get();

        // -- Summary: TANPA filter status (angka funnel tetap utuh) --
        // Target min/ideal = turunan tanggal -> dijumlah via accessor di PHP
        // (bukan SQL), dari set yang sama dengan filter cabang+periode+dai.
        //
        // WAJIB: setiap kolom yang di-sum() HARUS ada di daftar select ini.
        // Kolom yang tidak di-select membuat sum() mengembalikan 0 secara
        // DIAM-DIAM (tanpa error) -- gejalanya cuma angka yang salah.
        $summaryEvents = (clone $base)->get([
            'id', 'start_date', 'end_date', 'custom_dates', 'status',
            'titik_deal', 'titik_eksekusi', 'total_cost',
            'revenue_komitmen', 'revenue_realisasi',
        ]);

        // revenue_komitmen / revenue_realisasi / total_cost dikirim sebagai
        // float; SEMUA persentase (capaian realisasi-vs-komitmen dan rasio
        // cost-vs-realisasi) dihitung di frontend. Penyebut 0 di frontend
        // ditampilkan "-", bukan 0% -- angka yang tidak bisa dihitung lebih
        // baik absen daripada berbohong.
        //
        // SATU PENGECUALIAN: avg_capaian_pct di bawah. Alasannya ditulis di
        // blok berikutnya.
        $summary = [
            'total'              => $summaryEvents->count(),
            'per_status'         => $summaryEvents->countBy('status'),
            'target_min'         => $summaryEvents->sum->target_min,
            'target_ideal'       => $summaryEvents->sum->target_ideal,
            'titik_deal'         => (int) $summaryEvents->sum('titik_deal'),
            'titik_eksekusi'     => (int) $summaryEvents->sum('titik_eksekusi'),
            'total_cost'         => (float) $summaryEvents->sum('total_cost'),
            'revenue_komitmen'   => (float) $summaryEvents->sum('revenue_komitmen'),
            'revenue_realisasi'  => (float) $summaryEvents->sum('revenue_realisasi'),
        ];

        // -- Rata-rata capaian per kampanye (20 Agustus 2026) -----
        //
        // BEDA MAKNA dengan capaian agregat (revenue_realisasi / komitmen):
        //   agregat   -> tertimbang nominal; kampanye besar mendominasi
        //   rata-rata -> setiap kampanye berbobot sama
        // Selisih keduanya justru informasi utamanya: agregat jauh di atas
        // rata-rata berarti hasil ditopang segelintir kampanye besar.
        //
        // KENAPA DI BACKEND, padahal persentase lain di frontend: angka ini
        // butuh persentase PER BARIS, dan satu-satunya koleksi per-baris yang
        // scope-nya SAMA dengan strip ringkasan adalah $summaryEvents. Prop
        // `events` di frontend datang dari $listQuery (ikut filter status) --
        // menghitungnya dari sana membuat rata-rata dan agregat yang bersanding
        // di kartu yang sama datang dari populasi berbeda, tanpa gejala apa pun.
        //
        // RUMUS WAJIB IDENTIK dengan pctCapaian() di SafdakPipeline/Index.jsx:
        //   komitmen <= 0 -> DIKECUALIKAN dari pembilang DAN penyebut
        //                    (bukan dihitung sebagai 0%)
        //   dibulatkan PER KAMPANYE dulu, baru dirata-rata -- supaya hasilnya
        //   benar-benar rata-rata dari angka yang terlihat di kolom Capaian,
        //   bukan angka lain yang kebetulan mirip.
        // Kalau pctCapaian() di JSX berubah, blok ini WAJIB ikut berubah.
        //
        // avg_capaian_n & avg_capaian_excluded dikirim supaya frontend bisa
        // menyebutkan penyebutnya. Rata-rata dari 3 kampanye dan rata-rata
        // dari 30 kampanye tidak boleh tampil dengan bobot visual yang sama.
        $capaianPerKampanye = $summaryEvents
            ->filter(fn ($e) => (float) $e->revenue_komitmen > 0)
            ->map(fn ($e) => (int) round(
                ((float) $e->revenue_realisasi / (float) $e->revenue_komitmen) * 100
            ))
            ->values();

        $summary['avg_capaian_pct'] = $capaianPerKampanye->isEmpty()
            ? null
            : (int) round($capaianPerKampanye->avg());

        $summary['avg_capaian_n'] = $capaianPerKampanye->count();

        $summary['avg_capaian_excluded'] = $summaryEvents->count() - $capaianPerKampanye->count();

        // -- Peringkat dai (ditambahkan 19 Agustus 2026) ----------
        //
        // Dikelompokkan per DAI PER CABANG, bukan per dai global. Nama yang
        // sama di dua cabang bisa jadi dua orang berbeda (prinsip yang sama
        // dengan dedup narasumber: "ASWIN" di KDI belum tentu "ASWIN" di BPN).
        // Menggabungkan keduanya akan melahirkan satu baris peringkat yang
        // tidak mewakili siapa pun -- diam-diam, tanpa error.
        //
        // 'speaker' dan 'branch_id' WAJIB ada di select ini: pengelompokan
        // dilakukan di level Collection, jadi kolom yang tidak di-select akan
        // membuat SEMUA baris ber-speaker null dan jatuh ke satu bucket.
        // Sama senyapnya dengan jebakan groupBy() di SQL.
        //
        // Semua status ikut (termasuk 'batal'), konsisten dengan ringkasan
        // yang memang sengaja tidak mengikuti filter status.
        $rankingEvents = (clone $scoped)->get([
            'id', 'speaker', 'branch_id', 'status',
            'titik_deal', 'titik_eksekusi', 'total_cost',
            'revenue_komitmen', 'revenue_realisasi',
        ]);

        $branchMeta = $accessibleBranches->keyBy('id');

        $ranking = $rankingEvents
            ->groupBy(fn ($e) => trim((string) $e->speaker) . '|' . $e->branch_id)
            ->map(function ($rows) use ($branchMeta) {
                $first  = $rows->first();
                $name   = trim((string) $first->speaker);
                $branch = $branchMeta->get($first->branch_id);

                // Rata-rata capaian per dai. Aturan pengecualian & pembulatan
                // PERSIS sama dengan $capaianPerKampanye di atas -- kalau yang
                // satu berubah, yang lain ikut. Sengaja tidak di-extract jadi
                // helper: dua-duanya pendek, dan penanda "harus sama" lebih
                // terbaca sebagai komentar berdampingan daripada sebagai
                // pemanggilan method yang mudah terlewat.
                $capaianRows = $rows
                    ->filter(fn ($e) => (float) $e->revenue_komitmen > 0)
                    ->map(fn ($e) => (int) round(
                        ((float) $e->revenue_realisasi / (float) $e->revenue_komitmen) * 100
                    ))
                    ->values();

                return [
                    'speaker'           => $name === '' ? null : $name,
                    'branch_id'         => $first->branch_id,
                    'branch_code'       => $branch->code ?? '-',
                    'branch_name'       => $branch->name ?? '',
                    'kampanye'          => $rows->count(),
                    'titik_deal'        => (int) $rows->sum('titik_deal'),
                    'titik_eksekusi'    => (int) $rows->sum('titik_eksekusi'),
                    'total_cost'        => (float) $rows->sum('total_cost'),
                    'revenue_komitmen'  => (float) $rows->sum('revenue_komitmen'),
                    'revenue_realisasi' => (float) $rows->sum('revenue_realisasi'),
                    'avg_capaian_pct'   => $capaianRows->isEmpty()
                        ? null
                        : (int) round($capaianRows->avg()),
                    'avg_capaian_n'     => $capaianRows->count(),
                ];
            })
            // Urutan awal = Rev. Realisasi (keputusan Marten). Frontend boleh
            // mengurutkan ulang per kolom; urutan di sini yang menentukan
            // tampilan pertama dan isi "5 besar" sebelum user menyentuh apa pun.
            ->sortByDesc('revenue_realisasi')
            ->values();

        // -- Opsi dropdown dai (distinct dari kampanye yang benar-benar ada)
        //
        // SENGAJA TIDAK ikut filter periode. Kalau opsinya menyusut mengikuti
        // periode aktif, dai yang sedang difilter bisa lenyap dari dropdown
        // saat user pindah bulan -- user terjebak tanpa cara mengembalikan.
        // Ikut filter cabang karena daftar dai per cabang memang berbeda.
        //
        // Sumbernya safdak_events, BUKAN master Speaker: yang berguna difilter
        // hanyalah dai yang punya kampanye. Konsekuensinya varian ejaan yang
        // belum dibersihkan ("Ustadz X" vs "Ust X") akan tampil sebagai dua
        // opsi -- itu memang kondisi datanya, dan justru jadi terlihat.
        // Di tabel peringkat konsekuensinya lebih tajam: satu orang terpecah
        // jadi dua baris, dua-duanya turun peringkat.
        $speakerQuery = SafdakEvent::query()->forBranches($branchIds);

        if ($branchFilter !== null) {
            $speakerQuery->where('branch_id', $branchFilter);
        }

        $rawSpeakers = $speakerQuery->select('speaker')
            ->distinct()
            ->orderBy('speaker')
            ->pluck('speaker');

        $hasUnnamedSpeaker = $rawSpeakers->contains(fn ($s) => $s === null || trim((string) $s) === '');

        $speakerOptions = $rawSpeakers
            ->reject(fn ($s) => $s === null || trim((string) $s) === '')
            ->values();

        // Narasumber (dai) untuk dropdown FORM - cabang accessible + nasional,
        // difilter per cabang terpilih di frontend. Ini master Speaker, beda
        // peran dengan $speakerOptions di atas (yang untuk filter daftar).
        $speakers = Speaker::query()
            ->active()
            ->where(function ($q) use ($branchIds) {
                $q->whereNull('branch_id')->orWhereIn('branch_id', $branchIds);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'branch_id']);

        return Inertia::render('SafdakPipeline/Index', [
            'events'            => $events,
            'branches'          => $accessibleBranches,
            'speakers'          => $speakers,
            'speakerOptions'    => $speakerOptions,
            'hasUnnamedSpeaker' => $hasUnnamedSpeaker,
            'statuses'          => SafdakEvent::STATUSES,
            'summary'           => $summary,
            'ranking'           => $ranking,

            // Navigasi periode dirakit di backend supaya frontend tidak perlu
            // menghitung kuartal/semester sendiri (sumber kebenaran ganda).
            'rangeNav'          => PeriodRange::nav($period),

            // periodPresets: kunci setara saat GANTI TIPE (jangkar = periode
            // aktif, jadi 2025-Q1 -> "Semester" mendarat di 2025-S1).
            // todayPresets  : untuk tombol "Periode ini" (jangkar = hari ini).
            // Keduanya dari backend supaya rumus kuartal/semester tidak hidup
            // lagi di JSX.
            'periodPresets'     => PeriodRange::presetsFor($period['start'] ?? null),
            'todayPresets'      => PeriodRange::presetsFor(null),

            'filters'   => [
                'status'  => $request->get('status'),
                'branch'  => $branchFilter,
                'range'   => $period['key'] ?? '',
                'speaker' => $speakerParam,
            ],
            'canWrite'  => $user->canInputData(),
        ]);
    }

    public function store(Request $request)
    {
        $this->authorizeWrite($request, $request->get('branch_id'));

        $data = $this->validateEvent($request);

        SafdakEvent::create($data);

        return back()->with('success', 'Kampanye Safari Dakwah berhasil ditambahkan.');
    }

    public function update(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        // Bila branch_id ikut diubah, pastikan cabang tujuan juga dalam scope
        if ($request->filled('branch_id') && $request->get('branch_id') !== $event->branch_id) {
            $this->authorizeWrite($request, $request->get('branch_id'));
        }

        $data = $this->validateEvent($request);

        $event->update($data);

        return back()->with('success', 'Kampanye Safari Dakwah berhasil diperbarui.');
    }

    /**
     * Update status saja (aksi cepat dari list: rencana -> berjalan -> selesai / batal).
     */
    public function updateStatus(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        $validated = $request->validate([
            'status' => ['required', Rule::in(SafdakEvent::STATUSES)],
        ]);

        $event->update($validated);

        return back()->with('success', 'Status kampanye diperbarui.');
    }

    public function destroy(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        $event->delete();

        return back()->with('success', 'Kampanye Safari Dakwah dihapus.');
    }

    // -- Helpers ------------------------------------------------

    private function authorizeWrite(Request $request, ?string $branchId): void
    {
        $user = $request->user();

        abort_unless($user->canInputData(), 403);
        abort_unless($branchId, 403);

        // canAccessBranch() di User.php mengharapkan objek Branch, bukan uuid
        // string - resolve dulu. 404 wajar bila branch_id kiriman tidak valid.
        $branch = Branch::findOrFail($branchId);

        abort_unless($user->canAccessBranch($branch), 403);
    }

    private function validateEvent(Request $request): array
    {
        $validated = $request->validate([
            'branch_id'         => ['required', 'uuid', 'exists:branches,id'],
            'title'             => ['nullable', 'string', 'max:255'],
            'start_date'        => ['required', 'date'],
            'end_date'          => ['required', 'date', 'after_or_equal:start_date'],
            'custom_dates'      => ['nullable', 'array'],
            'custom_dates.*'    => ['date', 'after_or_equal:start_date', 'before_or_equal:end_date'],
            'speaker'           => ['nullable', 'string', 'max:255'],
            'grade'             => ['nullable', 'string', 'max:100'],
            'status'            => ['required', Rule::in(SafdakEvent::STATUSES)],
            'titik_deal'        => ['nullable', 'integer', 'min:0'],
            'titik_eksekusi'    => ['nullable', 'integer', 'min:0'],
            'total_cost'        => ['nullable', 'numeric', 'min:0'],
            'revenue_komitmen'  => ['nullable', 'numeric', 'min:0'],
            'revenue_realisasi' => ['nullable', 'numeric', 'min:0'],
            'has_mou'           => ['boolean'],
            'notes'             => ['nullable', 'string', 'max:2000'],
        ]);

        // Rapikan custom_dates: buang duplikat, urutkan; kosong -> null
        if (! empty($validated['custom_dates'])) {
            $dates = array_values(array_unique($validated['custom_dates']));
            sort($dates);
            $validated['custom_dates'] = $dates;
        } else {
            $validated['custom_dates'] = null;
        }

        return $validated;
    }
}