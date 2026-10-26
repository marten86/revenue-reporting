<!DOCTYPE html>
{{-- penanda versi: pipeline-grade-export-20261026 --}}
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: Arial, sans-serif; font-size: 9px; margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 15px; color: #1f2937; }

  .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #166534; padding-bottom: 8px; }
  .header h1 { font-size: 15px; color: #166534; margin-bottom: 3px; }
  .header p  { color: #6b7280; font-size: 9px; }

  .cards { width: 100%; margin-bottom: 12px; border-collapse: collapse; }
  .cards td { width: 25%; border: 1px solid #d1d5db; padding: 6px 9px; vertical-align: top; }
  .card-label { color: #6b7280; font-size: 8px; margin-bottom: 2px; }
  .card-value { font-size: 12px; font-weight: bold; color: #166534; }
  .card-sub { color: #6b7280; font-size: 8px; margin-top: 2px; }

  .section { margin-bottom: 14px; }
  .section-title { font-size: 11px; font-weight: bold; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 3px; margin-bottom: 6px; }
  .section-note { font-size: 8px; color: #9ca3af; font-weight: normal; font-style: italic; }

  table.data { width: 100%; border-collapse: collapse; font-size: 8px; }
  table.data th { background: #166534; color: #fff; padding: 4px 4px; text-align: left; }
  table.data td { padding: 3px 4px; border-bottom: 1px solid #f3f4f6; }
  table.data tr:nth-child(even) td { background: #f9fafb; }
  table.data tr.active td { background: #fef3c7; font-weight: bold; }
  table.data tr.grand-total td { font-weight: bold; background: #dcfce7; }
  .r, table.data th.r { text-align: right; }
  .c, table.data th.c { text-align: center; }
  .muted { color: #9ca3af; }

  .notes { font-size: 8px; color: #6b7280; margin-top: 6px; }
  .notes li { margin-left: 12px; margin-bottom: 1px; }
  .footer { margin-top: 14px; text-align: right; color: #9ca3af; font-size: 8px; border-top: 1px solid #e5e7eb; padding-top: 5px; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

@php
  $X = \App\Exports\SafdakPipelineExport::class;
  $dash = $X::DASH;
  $pctTxt = fn ($v) => $v === null ? $dash : $v . '%';

  $capaian = $X::pctCapaian($summary['revenue_komitmen'], $summary['revenue_realisasi']);
  $rasio   = $X::rasioCost($summary['total_cost'], $summary['revenue_realisasi']);
  $ps      = $summary['per_status'] ?? [];
  $active  = (string) ($ctx['dai_raw'] ?? '');
@endphp

<div class="header">
  <h1>Pipeline Safari Dakwah</h1>
  <p>{{ $X::contextLine($ctx) }}</p>
</div>

{{-- == Ringkasan (ikut semua filter kecuali status) == --}}
<table class="cards">
  <tr>
    <td>
      <div class="card-label">Kampanye</div>
      <div class="card-value">{{ $summary['total'] }}</div>
      <div class="card-sub">
        Rencana {{ $ps['rencana'] ?? 0 }} &middot; Berjalan {{ $ps['berjalan'] ?? 0 }} &middot;
        Selesai {{ $ps['selesai'] ?? 0 }} &middot; Batal {{ $ps['batal'] ?? 0 }}
      </div>
    </td>
    <td>
      <div class="card-label">Titik Eksekusi / Deal</div>
      <div class="card-value">{{ $summary['titik_eksekusi'] }} / {{ $summary['titik_deal'] }}</div>
      <div class="card-sub">Target min {{ $summary['target_min'] }} &middot; ideal {{ $summary['target_ideal'] }}</div>
    </td>
    <td>
      <div class="card-label">Realisasi / Komitmen</div>
      <div class="card-value">{{ $X::rp($summary['revenue_realisasi']) }}</div>
      <div class="card-sub">dari {{ $X::rp($summary['revenue_komitmen']) }} &middot; capaian {{ $pctTxt($capaian) }}</div>
    </td>
    <td>
      <div class="card-label">Cost &middot; Rasio Cost</div>
      <div class="card-value">{{ $X::rp($summary['total_cost']) }}</div>
      <div class="card-sub">rasio {{ $pctTxt($rasio) }} &middot; per titik {{ $X::rp($X::perTitik($summary['revenue_realisasi'], $summary['titik_eksekusi'])) }}</div>
    </td>
  </tr>
</table>

{{-- == Peringkat (tidak ikut filter da'i & status) == --}}
<div class="section">
  <div class="section-title">
    Peringkat Da'i
    <span class="section-note">&mdash; per da'i per cabang, urut realisasi; ikut periode, cabang &amp; grade, tidak ikut filter da'i &amp; status</span>
  </div>
  @if (count($ranking) === 0)
    <p class="muted">Belum ada data peringkat pada filter ini.</p>
  @else
  <table class="data">
    <thead>
      <tr>
        <th class="c">#</th>
        <th>Da'i</th>
        <th>Cabang</th>
        <th class="r">Kampanye</th>
        <th class="r">Eksekusi / Deal</th>
        <th class="r">Cost</th>
        <th class="r">Komitmen</th>
        <th class="r">Realisasi</th>
        <th class="r">Capaian</th>
        <th class="r">Rata-rata Capaian</th>
        <th class="r">Rasio Cost</th>
        <th class="r">Rp/Titik</th>
      </tr>
    </thead>
    <tbody>
      @foreach (collect($ranking)->values() as $i => $r)
        @php
          $isActive = $active !== '' && (
            ($active === '__none__' && empty($r['speaker'])) || $active === ($r['speaker'] ?? null)
          );
        @endphp
        <tr class="{{ $isActive ? 'active' : '' }}">
          <td class="c">{{ $i + 1 }}</td>
          <td>{{ $r['speaker'] ?? '(Belum ditentukan)' }}</td>
          <td>{{ $r['branch_code'] }}</td>
          <td class="r">{{ $r['kampanye'] }}</td>
          <td class="r">{{ $r['titik_eksekusi'] }} / {{ $r['titik_deal'] }}</td>
          <td class="r">{{ $X::rp($r['total_cost']) }}</td>
          <td class="r">{{ $X::rp($r['revenue_komitmen']) }}</td>
          <td class="r">{{ $X::rp($r['revenue_realisasi']) }}</td>
          <td class="r">{{ $pctTxt($X::pctCapaian($r['revenue_komitmen'], $r['revenue_realisasi'])) }}</td>
          <td class="r">{{ $pctTxt($r['avg_capaian_pct']) }}@if($r['avg_capaian_pct'] !== null) <span class="muted">(n={{ $r['avg_capaian_n'] }})</span>@endif</td>
          <td class="r">{{ $pctTxt($X::rasioCost($r['total_cost'], $r['revenue_realisasi'])) }}</td>
          <td class="r">{{ $X::rp($X::perTitik($r['revenue_realisasi'], $r['titik_eksekusi'])) }}</td>
        </tr>
      @endforeach
    </tbody>
  </table>
  @endif
</div>

{{-- == Daftar kampanye (ikut SEMUA filter, termasuk status) == --}}
<div class="section page-break">
  <div class="section-title">
    Daftar Kampanye
    <span class="section-note">&mdash; ikut semua filter termasuk status ({{ $ctx['status'] }})</span>
  </div>
  @if (count($events) === 0)
    <p class="muted">Tidak ada kampanye pada filter ini.</p>
  @else
  @php
    $t = ['deal' => 0, 'eks' => 0, 'cost' => 0, 'kom' => 0, 'real' => 0];
  @endphp
  <table class="data">
    <thead>
      <tr>
        <th class="c">#</th>
        @if ($ctx['showBranch'])<th>Cabang</th>@endif
        <th>Kampanye</th>
        <th>Tanggal</th>
        <th class="r">Hari</th>
        <th>Da'i</th>
        <th class="c">Grade</th>
        <th>Status</th>
        <th class="r">Eks / Deal</th>
        <th class="r">Cost</th>
        <th class="r">Komitmen</th>
        <th class="r">Realisasi</th>
        <th class="r">Capaian</th>
        <th class="r">Rasio</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($events as $i => $e)
        @php
          $t['deal'] += (int) $e->titik_deal;
          $t['eks']  += (int) $e->titik_eksekusi;
          $t['cost'] += (float) $e->total_cost;
          $t['kom']  += (float) $e->revenue_komitmen;
          $t['real'] += (float) $e->revenue_realisasi;
          $speaker = trim((string) $e->speaker);
          $grade   = trim((string) $e->grade);
        @endphp
        <tr>
          <td class="c">{{ $i + 1 }}</td>
          @if ($ctx['showBranch'])<td>{{ $e->branch->code ?? '-' }}</td>@endif
          <td>{{ $e->title }}</td>
          <td>{{ $e->start_date?->format('d/m') }}&ndash;{{ $e->end_date?->format('d/m/Y') }}</td>
          <td class="r">{{ $e->total_days }}</td>
          <td>{{ $speaker !== '' ? $speaker : $dash }}</td>
          <td class="c">{{ $grade !== '' ? mb_strtoupper($grade) : $dash }}</td>
          <td>{{ ucfirst((string) $e->status) }}</td>
          <td class="r">{{ (int) $e->titik_eksekusi }} / {{ (int) $e->titik_deal }}</td>
          <td class="r">{{ $X::rp($e->total_cost) }}</td>
          <td class="r">{{ $X::rp($e->revenue_komitmen) }}</td>
          <td class="r">{{ $X::rp($e->revenue_realisasi) }}</td>
          <td class="r">{{ $pctTxt($X::pctCapaian($e->revenue_komitmen, $e->revenue_realisasi)) }}</td>
          <td class="r">{{ $pctTxt($X::rasioCost($e->total_cost, $e->revenue_realisasi)) }}</td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td></td>
        @if ($ctx['showBranch'])<td></td>@endif
        <td>TOTAL ({{ count($events) }} kampanye)</td>
        <td colspan="5"></td>
        <td class="r">{{ $t['eks'] }} / {{ $t['deal'] }}</td>
        <td class="r">{{ $X::rp($t['cost']) }}</td>
        <td class="r">{{ $X::rp($t['kom']) }}</td>
        <td class="r">{{ $X::rp($t['real']) }}</td>
        <td class="r">{{ $pctTxt($X::pctCapaian($t['kom'], $t['real'])) }}</td>
        <td class="r">{{ $pctTxt($X::rasioCost($t['cost'], $t['real'])) }}</td>
      </tr>
    </tbody>
  </table>
  @endif

  <ul class="notes">
    <li>Angka pipeline bersifat manajerial &mdash; tidak dijumlahkan ke rekap penghimpunan resmi.</li>
    <li>Kampanye yang melintasi batas periode dihitung penuh di setiap periode; angka antar-periode jangan dijumlahkan.</li>
    <li>Grade dicatat per kampanye. Saat filter grade aktif, baris da'i di peringkat hanya berisi kampanye dengan grade tersebut.</li>
  </ul>
</div>

<div class="footer">
  Dicetak {{ $ctx['dicetak'] }} oleh {{ $ctx['oleh'] }} &middot; SIM BWA Indotim
</div>

</body>
</html>
