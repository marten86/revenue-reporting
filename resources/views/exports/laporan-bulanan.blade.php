<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 15px; color: #1f2937; }

  /* == Header == */
  .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #166534; padding-bottom: 10px; }
  .header h1 { font-size: 15px; color: #166534; margin-bottom: 2px; }
  .header h2 { font-size: 12px; margin-bottom: 3px; }
  .header p  { color: #6b7280; font-size: 9px; }

  /* == Summary cards == */
  .cards { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
  .cards td { width: 25%; border: 1px solid #d1d5db; border-radius: 4px; padding: 7px 10px; }
  .card-label { color: #6b7280; font-size: 9px; margin-bottom: 3px; }
  .card-value { font-size: 13px; font-weight: bold; color: #166534; }
  .card-value.warn { color: #d97706; }
  .card-value.danger { color: #dc2626; }

  /* == Section == */
  .section { margin-bottom: 18px; }
  .section-title { font-size: 11px; font-weight: bold; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 3px; margin-bottom: 8px; }
  .section-note { font-size: 8px; color: #9ca3af; font-weight: normal; font-style: italic; }

  /* == Tables == */
  table.data { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.data th { background: #166534; color: #fff; padding: 4px 5px; text-align: left; white-space: nowrap; }
  table.data th.legacy { background: #6b7280; }
  table.data td { padding: 3px 5px; border-bottom: 1px solid #f3f4f6; }
  table.data td.legacy { color: #9ca3af; }
  table.data tr:nth-child(even) td { background: #f9fafb; }
  table.data tr.subtotal td { font-weight: bold; font-style: italic; background: #f3f4f6; }
  table.data tr.grand-total td { font-weight: bold; background: #dcfce7; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }

  /* == Footer == */
  .footer { margin-top: 20px; text-align: right; color: #9ca3af; font-size: 8px; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style>
</head>
<body>

@php
  /*
   | Kolom kanal digenerate dari konstanta model -- BUKAN hardcode.
   | Kanal legacy (kotak_qris) hanya ikut bila laporan ini benar-benar punya
   | data lama, meniru flag hasLegacyData di Reports/Show.jsx.
   |
   | CATATAN UTANG TEKNIS: peta label di bawah terduplikasi di
   | app/Exports/MonthlyReportExport.php::CHANNEL_LABELS.
   | Rumah yang benar = MonthlyReport::CHANNEL_LABELS (backlog konsolidasi).
   */
  $channelLabels = [
    'presentasi' => 'Presentasi',
    'wgts'       => 'WGTS',
    'gerai'      => 'Gerai',
    'dfi'        => 'DFI',
    'dfe'        => 'DFE',
    'kotak'      => 'Kotak Infak',
    'qris'       => 'QRIS',
    'kantor'     => 'Kantor',
    'kotak_qris' => 'Kotak/QRIS (Lama)',
  ];

  $labelOf = function ($key) use ($channelLabels) {
      if ($key === null || $key === '') {
          return '';
      }
      return $channelLabels[$key] ?? ucwords(str_replace('_', ' ', $key));
  };

  $legacyKeys   = \App\Models\MonthlyReport::CHANNELS_LEGACY;
  $activeKeys   = \App\Models\MonthlyReport::CHANNELS;
  $channelKeys  = $activeKeys;

  foreach ($legacyKeys as $legacy) {
      $hasLegacyData = $dailies->contains(function ($d) use ($legacy) {
          return (int) ($d->{$legacy} ?? 0) > 0;
      });
      if ($hasLegacyData) {
          $channelKeys[] = $legacy;
      }
  }

  $channelKeys = array_values($channelKeys);

  // Akumulator grand total per kanal
  $t = array_fill_keys($channelKeys, 0);
@endphp

{{-- == Header == --}}
<div class="header">
  <h1>SIM BWA Indotim</h1>
  <h2>Laporan Revenue Bulanan &mdash; {{ $report->branch->name }}</h2>
  <p>
    Periode: {{ \Carbon\Carbon::parse($report->period_month)->translatedFormat('F Y') }}
    &nbsp;|&nbsp;
    Status: {{ ucfirst($report->status) }}
    &nbsp;|&nbsp;
    Dicetak: {{ now()->translatedFormat('d F Y, H:i') }}
  </p>
</div>

{{-- == Summary Cards == --}}
@php
  $pct = $report->target_amount > 0
    ? $report->total_revenue / $report->target_amount * 100
    : 0;
  $pctClass = $pct >= 100 ? '' : ($pct >= 75 ? 'warn' : 'danger');
@endphp
<table class="cards">
  <tr>
    <td>
      <div class="card-label">Total Revenue</div>
      <div class="card-value">Rp {{ number_format($report->total_revenue, 0, ',', '.') }}</div>
    </td>
    <td>
      <div class="card-label">Target</div>
      <div class="card-value">Rp {{ number_format($report->target_amount, 0, ',', '.') }}</div>
    </td>
    <td>
      <div class="card-label">Capaian</div>
      <div class="card-value {{ $pctClass }}">{{ number_format($pct, 1) }}%</div>
    </td>
    <td>
      <div class="card-label">Gap</div>
      <div class="card-value {{ $report->total_revenue >= $report->target_amount ? '' : 'danger' }}">
        Rp {{ number_format($report->target_amount - $report->total_revenue, 0, ',', '.') }}
      </div>
    </td>
  </tr>
</table>

{{-- == Rekap Per Kanal == --}}
<div class="section">
  <div class="section-title">
    Rekap Per Kanal (Harian)
    @if(count($channelKeys) > count($activeKeys))
      <span class="section-note">&mdash; memuat kolom kanal lama (data historis)</span>
    @endif
  </div>
  <table class="data">
    <thead>
      <tr>
        <th>Tgl</th>
        <th>Hari</th>
        @foreach($channelKeys as $key)
          <th class="text-right {{ in_array($key, $legacyKeys) ? 'legacy' : '' }}">{{ $labelOf($key) }}</th>
        @endforeach
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($dailies as $d)
        <tr>
          <td class="text-center">{{ \Carbon\Carbon::parse($d->date)->format('d') }}</td>
          <td>{{ $d->day_name ?? \Carbon\Carbon::parse($d->date)->translatedFormat('D') }}</td>
          @foreach($channelKeys as $key)
            @php
              $v = (int) ($d->{$key} ?? 0);
              $t[$key] += $v;
            @endphp
            <td class="text-right {{ in_array($key, $legacyKeys) ? 'legacy' : '' }}">
              {!! $v > 0 ? number_format($v, 0, ',', '.') : '&mdash;' !!}
            </td>
          @endforeach
          <td class="text-right"><strong>{{ number_format((int) ($d->total_daily ?? 0), 0, ',', '.') }}</strong></td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td colspan="2"><strong>GRAND TOTAL</strong></td>
        @foreach($channelKeys as $key)
          <td class="text-right">{{ number_format($t[$key], 0, ',', '.') }}</td>
        @endforeach
        <td class="text-right">{{ number_format((int) $report->total_revenue, 0, ',', '.') }}</td>
      </tr>
    </tbody>
  </table>
</div>

{{-- == Rekap Per Tim == --}}
<div class="section">
  <div class="section-title">Rekap Per Tim / Sumber</div>
  <table class="data">
    <thead>
      <tr>
        <th style="width:22%">Kanal</th>
        <th>Sumber / Tim</th>
        <th class="text-right" style="width:18%">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($byTeam as $row)
        <tr class="{{ ($row['is_subtotal'] ?? false) ? 'subtotal' : '' }}">
          <td>{{ $labelOf($row['channel'] ?? '') }}</td>
          <td>{{ $row['source'] }}</td>
          <td class="text-right">
            @if(($row['total'] ?? 0) > 0)
              {{ number_format($row['total'], 0, ',', '.') }}
            @else
              &mdash;
            @endif
          </td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td colspan="2"><strong>GRAND TOTAL</strong></td>
        <td class="text-right"><strong>{{ number_format((int) $report->total_revenue, 0, ',', '.') }}</strong></td>
      </tr>
    </tbody>
  </table>
</div>

{{-- == Safari Dakwah == --}}
@if($safaris->count() > 0)
<div class="section">
  <div class="section-title">Rev Safari Dakwah</div>
  <table class="data">
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Lokasi</th>
        <th>Narasumber</th>
        <th class="text-right">Target</th>
        <th class="text-right">Komitmen</th>
        <th class="text-right">Realisasi</th>
        <th class="text-right">Capaian %</th>
      </tr>
    </thead>
    <tbody>
      @php $st = $sc = $sr = 0; @endphp
      @foreach($safaris as $s)
        @php
          $target = (int) ($s->target ?? 0);
          $real   = (int) ($s->realization ?? 0);
          $pctS   = $target > 0 ? round($real / $target * 100, 1) : 0;
          $st += $target;
          $sc += (int) ($s->commitment ?? 0);
          $sr += $real;
        @endphp
        <tr>
          <td>{{ \Carbon\Carbon::parse($s->date)->format('d/m/Y') }}</td>
          <td>{{ $s->location ?? '-' }}</td>
          <td>{{ $s->speaker ?? '-' }}</td>
          <td class="text-right">{{ number_format($target, 0, ',', '.') }}</td>
          <td class="text-right">{{ number_format((int) ($s->commitment ?? 0), 0, ',', '.') }}</td>
          <td class="text-right">{{ number_format($real, 0, ',', '.') }}</td>
          <td class="text-right">{{ $pctS }}%</td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td colspan="3"><strong>TOTAL</strong></td>
        <td class="text-right">{{ number_format($st, 0, ',', '.') }}</td>
        <td class="text-right">{{ number_format($sc, 0, ',', '.') }}</td>
        <td class="text-right">{{ number_format($sr, 0, ',', '.') }}</td>
        <td class="text-right">{{ $st > 0 ? number_format($sr / $st * 100, 1) : '0' }}%</td>
      </tr>
    </tbody>
  </table>
</div>
@endif

<div class="footer">
  Digenerate oleh SIM BWA Indotim &mdash; onebwa.my.id &nbsp;|&nbsp; {{ now()->format('d/m/Y H:i') }}
</div>

</body>
</html>