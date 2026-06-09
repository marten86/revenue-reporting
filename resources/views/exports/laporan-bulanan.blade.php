<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 15px; color: #1f2937; }

  /* ── Header ── */
  .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #166534; padding-bottom: 10px; }
  .header h1 { font-size: 15px; color: #166534; margin-bottom: 2px; }
  .header h2 { font-size: 12px; margin-bottom: 3px; }
  .header p  { color: #6b7280; font-size: 9px; }

  /* ── Summary cards ── */
  .cards { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
  .cards td { width: 25%; border: 1px solid #d1d5db; border-radius: 4px; padding: 7px 10px; }
  .card-label { color: #6b7280; font-size: 9px; margin-bottom: 3px; }
  .card-value { font-size: 13px; font-weight: bold; color: #166534; }
  .card-value.warn { color: #d97706; }
  .card-value.danger { color: #dc2626; }

  /* ── Section ── */
  .section { margin-bottom: 18px; }
  .section-title { font-size: 11px; font-weight: bold; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 3px; margin-bottom: 8px; }

  /* ── Tables ── */
  table.data { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.data th { background: #166534; color: #fff; padding: 4px 6px; text-align: left; white-space: nowrap; }
  table.data td { padding: 3px 6px; border-bottom: 1px solid #f3f4f6; }
  table.data tr:nth-child(even) td { background: #f9fafb; }
  table.data tr.subtotal td { font-weight: bold; font-style: italic; background: #f3f4f6; }
  table.data tr.grand-total td { font-weight: bold; background: #dcfce7; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }

  /* ── Footer ── */
  .footer { margin-top: 20px; text-align: right; color: #9ca3af; font-size: 8px; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style>
</head>
<body>

{{-- ── Header ── --}}
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

{{-- ── Summary Cards ── --}}
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

{{-- ── Rekap Per Kanal ── --}}
<div class="section">
  <div class="section-title">Rekap Per Kanal (Harian)</div>
  <table class="data">
    <thead>
      <tr>
        <th>Tgl</th>
        <th>Hari</th>
        <th class="text-right">Presentasi</th>
        <th class="text-right">WGTS</th>
        <th class="text-right">Gerai</th>
        <th class="text-right">DFI</th>
        <th class="text-right">DFE</th>
        <th class="text-right">Kotak & QRIS</th>
        <th class="text-right">Kantor</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      @php
        $t = array_fill(0, 7, 0);
      @endphp
      @foreach($dailies as $d)
        @php
          $vals = [
            (int)($d->presentasi ?? 0),
            (int)($d->wgts       ?? 0),
            (int)($d->gerai      ?? 0),
            (int)($d->dfi        ?? 0),
            (int)($d->dfe        ?? 0),
            (int)($d->kotak_qris ?? 0),
            (int)($d->kantor     ?? 0),
          ];
          foreach ($vals as $i => $v) $t[$i] += $v;
        @endphp
        <tr>
          <td class="text-center">{{ \Carbon\Carbon::parse($d->date)->format('d') }}</td>
          <td>{{ $d->day_name ?? \Carbon\Carbon::parse($d->date)->translatedFormat('D') }}</td>
          @foreach($vals as $v)
            <td class="text-right">{{ $v > 0 ? number_format($v, 0, ',', '.') : '—' }}</td>
          @endforeach
          <td class="text-right"><strong>{{ number_format((int)($d->total_daily ?? 0), 0, ',', '.') }}</strong></td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td colspan="2"><strong>GRAND TOTAL</strong></td>
        @foreach($t as $v)
          <td class="text-right">{{ number_format($v, 0, ',', '.') }}</td>
        @endforeach
        <td class="text-right">{{ number_format((int)$report->total_revenue, 0, ',', '.') }}</td>
      </tr>
    </tbody>
  </table>
</div>

{{-- ── Rekap Per Tim ── --}}
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
          <td>{{ $row['channel'] }}</td>
          <td>{{ $row['source'] }}</td>
          <td class="text-right">
            @if(($row['total'] ?? 0) > 0)
              {{ number_format($row['total'], 0, ',', '.') }}
            @else
              —
            @endif
          </td>
        </tr>
      @endforeach
      <tr class="grand-total">
        <td colspan="2"><strong>GRAND TOTAL</strong></td>
        <td class="text-right"><strong>{{ number_format((int)$report->total_revenue, 0, ',', '.') }}</strong></td>
      </tr>
    </tbody>
  </table>
</div>

{{-- ── Safari Dakwah ── --}}
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
          $target = (int)($s->target ?? 0);
          $real   = (int)($s->realization ?? 0);
          $pctS   = $target > 0 ? round($real / $target * 100, 1) : 0;
          $st += $target;
          $sc += (int)($s->commitment ?? 0);
          $sr += $real;
        @endphp
        <tr>
          <td>{{ \Carbon\Carbon::parse($s->date)->format('d/m/Y') }}</td>
          <td>{{ $s->location ?? '—' }}</td>
          <td>{{ $s->speaker ?? '—' }}</td>
          <td class="text-right">{{ number_format($target, 0, ',', '.') }}</td>
          <td class="text-right">{{ number_format((int)($s->commitment ?? 0), 0, ',', '.') }}</td>
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