<?php

namespace App\Http\Controllers;

use App\Exports\SafdakPipelineExport;
use App\Models\Branch;
use App\Models\SafdakEvent;
use App\Models\SafdakEventRevision;
use App\Models\Speaker;
use App\Support\PeriodRange;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

/**
 * penanda versi: pipeline-grade-export-20261026 (sebelumnya: pipeline-riwayat-20260925)
 *
 * FILTER GRADE + DOWNLOAD (26 Oktober 2026):
 * - Isi index() dipindah ke buildPipeline(). index(), exportExcel() dan
 *   exportPdf() memanggil builder yang SAMA, jadi angka di file download
 *   identik dengan yang tampil di layar -- tidak ada rumus kedua.
 * - Filter grade masuk ke $scoped (ikut ke peringkat, ringkasan, daftar).
 *   Lihat tabel filter di docblock buildPipeline().
 *
 * RIWAYAT UPDATE (25 September 2026): store / update / updateStatus / destroy
 * masing-masing menulis satu baris ke safdak_event_revisions, di dalam
 * transaksi yang sama dengan perubahannya. Simpan tanpa perubahan nilai
 * TIDAK menulis riwayat. Dibaca lewat revisions() sebagai JSON.
 *
 * CATATAN: blok avg_capaian_* di index() masih dihitung tapi tidak lagi
 * dibaca frontend (dibatalkan 20 Agustus). Dibiarkan -- backlog pembersihan.
 */
class SafdakEventController extends Controller
{
    /** Nilai sentinel untuk memfilter kampanye yang dainya belum ditentukan */
    private const SPEAKER_NONE = '__none__';

    /** Nilai sentinel untuk memfilter kampanye yang gradenya kosong */
    private const GRADE_NONE = '__none__';

    /**
     * Halaman pipeline. Seluruh logika data ada di buildPipeline() supaya
     * bisa dipakai ulang oleh export tanpa menduplikasi rumus.
     */
    public function index(Request $request)
    {
        return Inertia::render('SafdakPipeline/Index', $this->buildPipeline($request));
    }

    /**
     * Download Excel (3 sheet: Daftar, Peringkat, Ringkasan) -- mengikuti
     * SEMUA filter aktif di layar, dengan aturan scope yang sama persis.
     * Hak baca = hak baca halaman (viewer boleh); scope cabang sudah dijaga
     * di buildPipeline() lewat accessibleBranches().
     */
    public function exportExcel(Request $request)
    {
        $data = $this->buildPipeline($request);
        $ctx  = $this->exportContext($request, $data);

        return Excel::download(
            new SafdakPipelineExport($data, $ctx),
            $this->exportFilename($data, 'xlsx')
        );
    }

    /** Download PDF -- isi sama dengan Excel, tata letak A4 landscape. */
    public function exportPdf(Request $request)
    {
        $data = $this->buildPipeline($request);
        $ctx  = $this->exportContext($request, $data);

        $pdf = Pdf::loadView('exports.pipeline-safdak', [
            'events'  => $data['events'],
            'ranking' => $data['ranking'],
            'summary' => $data['summary'],
            'ctx'     => $ctx,
        ])->setPaper('a4', 'landscape');

        return $pdf->download($this->exportFilename($data, 'pdf'));
    }

    /**
     * Label filter yang dibaca manusia, untuk kepala file export.
     * Status disertakan karena hanya sheet Daftar yang mengikutinya --
     * pembaca file perlu tahu itu tanpa membuka aplikasi.
     */
    private function exportContext(Request $request, array $data): array
    {
        $f = $data['filters'];

        $branchLabel = 'Semua cabang (sesuai akses)';
        if ($f['branch']) {
            $b = $data['branches']->firstWhere('id', $f['branch']);
            $branchLabel = $b ? "{$b->code} - {$b->name}" : $f['branch'];
        }

        $speakerLabel = match (true) {
            $f['speaker'] === self::SPEAKER_NONE => 'Belum ditentukan',
            $f['speaker'] !== ''                 => $f['speaker'],
            default                              => 'Semua da\'i',
        };

        $gradeLabel = match (true) {
            $f['grade'] === self::GRADE_NONE => 'Tanpa grade',
            $f['grade'] !== ''               => 'Grade ' . $f['grade'],
            default                          => 'Semua grade',
        };

        return [
            'periode'   => $data['rangeNav']['label'] ?? 'Semua periode',
            'cabang'    => $branchLabel,
            'dai'       => $speakerLabel,
            'dai_raw'   => $f['speaker'],
            'grade'     => $gradeLabel,
            'status'    => $f['status'] ? ucfirst($f['status']) : 'Semua status',
            'showBranch'=> ! $f['branch'],
            'dicetak'   => now('Asia/Makassar')->format('d/m/Y H:i') . ' WITA',
            'oleh'      => $request->user()->name ?? '-',
        ];
    }

    /** Pipeline_SafDak_2026-Q3_MKS_GradeA.xlsx -- hanya karakter aman. */
    private function exportFilename(array $data, string $ext): string
    {
        $f     = $data['filters'];
        $parts = ['Pipeline_SafDak', $f['range'] !== '' ? $f['range'] : 'Semua'];

        if ($f['branch']) {
            $b = $data['branches']->firstWhere('id', $f['branch']);
            $parts[] = $b->code ?? 'Cabang';
        }

        if ($f['grade'] === self::GRADE_NONE) {
            $parts[] = 'TanpaGrade';
        } elseif ($f['grade'] !== '') {
            $parts[] = 'Grade' . $f['grade'];
        }

        $name = preg_replace('/[^A-Za-z0-9_\-]/', '', implode('_', $parts));

        return $name . '.' . $ext;
    }

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
     *   grade      |       YA         |      YA       |  YA   (26 Okt 2026)
     *   dai        |       YA         |    TIDAK      |  YA
     *   status     |     TIDAK        |    TIDAK      |  YA
     *
     * Kenapa grade IKUT peringkat (beda dengan dai): grade adalah SEGMEN
     * pembanding, bukan satu orang. "Peringkat antar dai grade A" tetap punya
     * banyak baris dan justru perbandingan yang adil. Keputusan Marten.
     *
     * KONSEKUENSI yang perlu disadari: grade disimpan PER KAMPANYE, bukan per
     * dai. Dai yang pernah tercatat grade A dan grade B, saat difilter grade A,
     * barisnya di peringkat hanya berisi kampanye grade A-nya saja.
     *
     * Grade adalah teks bebas di form, jadi pencocokan memakai UPPER(TRIM()):
     * "a", " A" dan "A" dianggap sama. Varian lain ("Grade A") TIDAK disatukan
     * -- akan tampil sebagai opsi terpisah, sama dengan perlakuan ejaan dai.
     *
     * Diwujudkan lewat TIGA builder bertingkat, bukan flag:
     *   $scoped    = cabang + periode + grade         -> sumber PERINGKAT
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
     *
     * Mengembalikan array props Inertia. Dipakai index() dan export*().
     */
    private function buildPipeline(Request $request): array
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

        // -- Filter grade (26 Okt 2026) ---------------------------
        // Dinormalisasi ke huruf besar supaya cocok dengan UPPER(TRIM(grade))
        // di SQL dan dengan opsi dropdown yang juga sudah dinormalisasi.
        $gradeParam = trim((string) $request->get('grade', ''));

        if ($gradeParam !== self::GRADE_NONE) {
            $gradeParam = mb_strtoupper($gradeParam);
        }

        // -- Builder 1: cabang + periode + grade (TANPA dai, TANPA status)
        // Ini scope terluas yang masih "yang sedang dilihat user". Dipakai
        // sebagai sumber peringkat dai.
        $scoped = SafdakEvent::query()->forBranches($branchIds);

        if ($branchFilter !== null) {
            $scoped->where('branch_id', $branchFilter);
        }

        if ($period !== null) {
            $scoped->overlapsRange($period['start'], $period['end']);
        }

        if ($gradeParam === self::GRADE_NONE) {
            // null DAN string kosong/spasi -- alasan sama dengan SPEAKER_NONE
            $scoped->where(function ($q) {
                $q->whereNull('grade')->orWhereRaw("TRIM(grade) = ''");
            });
        } elseif ($gradeParam !== '') {
            $scoped->whereRaw('UPPER(TRIM(grade)) = ?', [$gradeParam]);
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

        // -- Opsi filter grade (26 Okt 2026) ----------------------
        // Aturan sama dengan opsi dai: distinct dari kampanye yang ada,
        // ikut filter cabang, TIDAK ikut periode (supaya grade aktif tidak
        // lenyap saat user pindah bulan). Dinormalisasi UPPER(TRIM()).
        $gradeQuery = SafdakEvent::query()->forBranches($branchIds);

        if ($branchFilter !== null) {
            $gradeQuery->where('branch_id', $branchFilter);
        }

        $rawGrades = $gradeQuery
            ->selectRaw('DISTINCT UPPER(TRIM(grade)) AS g')
            ->pluck('g');

        $hasUngraded = $rawGrades->contains(fn ($g) => $g === null || $g === '');

        $gradeOptions = $rawGrades
            ->reject(fn ($g) => $g === null || $g === '')
            ->sort(SORT_NATURAL)
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

        return [
            'events'            => $events,
            'branches'          => $accessibleBranches,
            'speakers'          => $speakers,
            'speakerOptions'    => $speakerOptions,
            'hasUnnamedSpeaker' => $hasUnnamedSpeaker,
            'gradeOptions'      => $gradeOptions,
            'hasUngraded'       => $hasUngraded,
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
                'grade'   => $gradeParam,
            ],
            'canWrite'  => $user->canInputData(),
        ];
    }

    public function store(Request $request)
    {
        $this->authorizeWrite($request, $request->get('branch_id'));

        $data = $this->validateEvent($request);

        DB::transaction(function () use ($request, $data) {
            $event = SafdakEvent::create($data);
            $this->logRevision($request, $event->id, 'created', $this->snapshot($event, true));
        });

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

        DB::transaction(function () use ($request, $event, $data) {
            $event->fill($data);
            $changes = $this->diff($event);   // WAJIB sebelum save(): getDirty() kosong setelahnya
            $event->save();

            if ($changes) {
                $this->logRevision($request, $event->id, 'updated', $changes);
            }
        });

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

        DB::transaction(function () use ($request, $event, $validated) {
            $event->fill($validated);
            $changes = $this->diff($event);
            $event->save();

            if ($changes) {
                $this->logRevision($request, $event->id, 'status', $changes);
            }
        });

        return back()->with('success', 'Status kampanye diperbarui.');
    }

    public function destroy(Request $request, SafdakEvent $event)
    {
        $this->authorizeWrite($request, $event->branch_id);

        DB::transaction(function () use ($request, $event) {
            // Snapshot ditulis SEBELUM delete -- setelahnya nilai sudah hilang
            $this->logRevision($request, $event->id, 'deleted', $this->snapshot($event, false));
            $event->delete();
        });

        return back()->with('success', 'Kampanye Safari Dakwah dihapus.');
    }

    /**
     * Riwayat Update satu kampanye, terbaru di atas. JSON (dimuat saat panel
     * Riwayat dibuka, bukan ikut prop halaman -- supaya /safari-pipeline tidak
     * bertambah berat).
     *
     * Hak baca = hak lihat halaman pipeline: seesAllBranches() ATAU cabang
     * kampanye dalam jangkauan user. Viewer boleh membaca.
     */
    public function revisions(Request $request, SafdakEvent $event)
    {
        $user = $request->user();

        abort_unless($user->seesAllBranches() || $user->canAccessBranch($event->branch), 403);

        // branch_id disimpan sebagai uuid -> tampilkan kode cabang
        $branchCodes = Branch::pluck('code', 'id');

        $rows = $event->revisions()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (SafdakEventRevision $r) use ($branchCodes) {
                $changes = collect($r->changes ?? [])
                    ->map(function ($pair, $field) use ($branchCodes) {
                        [$old, $new] = array_pad((array) $pair, 2, null);

                        if ($field === 'branch_id') {
                            $old = $old ? ($branchCodes[$old] ?? $old) : null;
                            $new = $new ? ($branchCodes[$new] ?? $new) : null;
                        }

                        return ['field' => $field, 'old' => $old, 'new' => $new];
                    })
                    ->values();

                return [
                    'id'         => $r->id,
                    'action'     => $r->action,
                    'user'       => $r->user?->name,
                    // ISO ber-offset -> frontend format ke Asia/Makassar
                    'created_at' => $r->created_at?->toIso8601String(),
                    // Baris hasil backfill migration: tidak punya isi perubahan
                    'backfill'   => $r->action === 'created' && $r->changes === null,
                    'changes'    => $changes,
                ];
            });

        return response()->json(['revisions' => $rows]);
    }

    // -- Helpers ------------------------------------------------

    /**
     * Pasangan [lama, baru] untuk kolom TRACKED yang benar-benar berubah.
     * Dipanggil setelah fill(), sebelum save(). getDirty() memakai perbandingan
     * sadar-cast Eloquent: 1500000 vs "1500000.00" (decimal) dan "25" vs 25
     * (integer) TIDAK dianggap berubah.
     */
    private function diff(SafdakEvent $event): array
    {
        $changes = [];

        foreach (array_keys($event->getDirty()) as $field) {
            if (! in_array($field, SafdakEvent::TRACKED, true)) {
                continue;
            }

            $changes[$field] = [
                $this->normalize($event->getOriginal($field)),
                $this->normalize($event->getAttribute($field)),
            ];
        }

        return $changes;
    }

    /**
     * Isi kampanye untuk baris 'created' ([null, nilai]) atau 'deleted'
     * ([nilai, null]). Nilai kosong / false dilewati supaya riwayat tidak
     * penuh baris "— -> —".
     */
    private function snapshot(SafdakEvent $event, bool $asNew): array
    {
        $out = [];

        foreach (SafdakEvent::TRACKED as $field) {
            $value = $this->normalize($event->getAttribute($field));

            if ($value === null || $value === '' || $value === [] || $value === false) {
                continue;
            }

            $out[$field] = $asNew ? [null, $value] : [$value, null];
        }

        return $out;
    }

    /** Tanggal (Carbon dari cast date:Y-m-d) disimpan sebagai string Y-m-d */
    private function normalize($value)
    {
        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value;
    }

    private function logRevision(Request $request, string $eventId, string $action, ?array $changes): void
    {
        SafdakEventRevision::create([
            'event_id' => $eventId,
            'user_id'  => $request->user()?->id,
            'action'   => $action,
            'changes'  => $changes,
        ]);
    }

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