<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; }

  .header { background: #166534; color: white; padding: 16px 20px; margin-bottom: 16px; }
  .header h1 { font-size: 16px; font-weight: bold; }
  .header p { font-size: 11px; opacity: .8; margin-top: 2px; }

  .section { margin: 0 20px 16px; }
  .section-title { font-size: 12px; font-weight: bold; color: #166534; border-bottom: 2px solid #166534; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }

  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 20px 16px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .summary-card .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
  .summary-card .value { font-size: 14px; font-weight: bold; margin-top: 2px; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #166534; color: white; padding: 5px 6px; text-align: left; font-weight: bold; }
  th.num, td.num { text-align: right; }
  td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
  tr:nth-child(even) td { background: #f9fafb; }
  .total-row td { background: #dcfce7 !important; font-weight: bold; }

  .footer { margin: 16px 20px 0; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style>
</head>
<body>

<div class="header">
  <h1>Laporan Revenue — {{ $report->branch->name }}</h1>
  <p>
    {{ \Carbon\Carbon::parse($report->period_month)->translatedFormat('F Y') }}
    &nbsp;·&nbsp; Area {{ $report->branch->area->name }}
    &nbsp;·&nbsp; Status: {{ ucfirst($report->status) }}
  </p>
</div>

{{-- Summary --}}
<div class="summary-grid">
  <div class="summary-card">
    <div class="label">Total Realisasi</div>
    <div class="value">{{ 'Rp ' . number_format($report->total_revenue, 0, ',', '.') }}</div>
  </div>
  <div class="summary-card">
    <div class="label">Target</div>
    <div class="value">{{ 'Rp ' . number_format($report->target_amount, 0, ',', '.') }}</div>
  </div>
  <div class="summary-card">
    <div class="label">Capaian</div>
    <div class="value" style="color: {{ $report->achievement_pct * 100 >= 85 ? '#166534' : ($report->achievement_pct * 100 >= 60 ? '#d97706' : '#dc2626') }}">
      {{ number_format($report->achievement_pct * 100, 1) }}%
    </div>
  </div>
  <div class="summary-card">
    <div class="label">Selisih</div>
    <div class="value" style="color: {{ $report->gap_amount >= 0 ? '#166534' : '#dc2626' }}">
      {{ ($report->gap_amount >= 0 ? '+' : '') . 'Rp ' . number_format($report->gap_amount, 0, ',', '.') }}
    </div>
  </div>
</div>

{{-- Rekap Per Kanal --}}
<div class="section">
  <div class="section-title">Rekap Per Kanal</div>
  <table>
    <thead>
      <tr>
        <th>Tgl</th><th>Hari</th>
        <th class="num">Presentasi</th><th class="num">Gerai</th>
        <th class="num">WGTS</th><th class="num">DFI</th>
        <th class="num">DFE</th><th class="num">Kotak/QRIS</th>
        <th class="num">Kantor</th><th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($report->dailyRevenues as $day)
      <tr>
        <td>{{ \Carbon\Carbon::parse($day->date)->format('d') }}</td>
        <td>{{ $day->day_name }}</td>
        <td class="num">{{ $day->presentasi ? number_format($day->presentasi, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->gerai ? number_format($day->gerai, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->wgts ? number_format($day->wgts, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->dfi ? number_format($day->dfi, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->dfe ? number_format($day->dfe, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->kotak_qris ? number_format($day->kotak_qris, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $day->kantor ? number_format($day->kantor, 0, ',', '.') : '-' }}</td>
        <td class="num"><strong>{{ $day->total_daily ? number_format($day->total_daily, 0, ',', '.') : '-' }}</strong></td>
      </tr>
      @endforeach
      <tr class="total-row">
        <td colspan="2">GRAND TOTAL</td>
        <td class="num">{{ number_format($report->total_presentasi, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_gerai, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_wgts, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_dfi, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_dfe, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_kotak_qris, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->total_kantor, 0, ',', '.') }}</td>
        <td class="num"><strong>{{ number_format($report->total_revenue, 0, ',', '.') }}</strong></td>
      </tr>
    </tbody>
  </table>
</div>

{{-- Rincian Tim --}}
@if($report->teamRevenues->count() > 0)
<div class="section">
  <div class="section-title">Rincian Revenue per Tim</div>
  <table>
    <thead>
      <tr>
        <th>Tim / Unit</th><th>Personil</th>
        <th class="num">Reguler</th><th class="num">Safdak</th>
        <th class="num">DF</th><th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      @foreach($report->teamRevenues as $team)
      <tr>
        <td>{{ $team->team_name }}</td>
        <td>{{ $team->personnel ?? '-' }}</td>
        <td class="num">{{ $team->reguler ? number_format($team->reguler, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $team->safdak ? number_format($team->safdak, 0, ',', '.') : '-' }}</td>
        <td class="num">{{ $team->df ? number_format($team->df, 0, ',', '.') : '-' }}</td>
        <td class="num"><strong>{{ number_format($team->total, 0, ',', '.') }}</strong></td>
      </tr>
      @endforeach
      <tr class="total-row">
        <td colspan="5">GRAND TOTAL</td>
        <td class="num"><strong>{{ number_format($report->teamRevenues->sum('total'), 0, ',', '.') }}</strong></td>
      </tr>
    </tbody>
  </table>
</div>
@endif

{{-- Safari Dakwah --}}
@if($report->safariDakwahLogs->count() > 0)
<div class="section">
  <div class="section-title">Revenue Safari Dakwah</div>
  <table>
    <thead>
      <tr>
        <th>Tanggal</th><th>Hari</th><th>Lokasi</th><th>Narasumber</th>
        <th class="num">Target</th><th class="num">Komitmen</th>
        <th class="num">Realisasi</th><th class="num">Capaian</th>
      </tr>
    </thead>
    <tbody>
      @foreach($report->safariDakwahLogs as $log)
      <tr>
        <td>{{ \Carbon\Carbon::parse($log->date)->format('d/m/Y') }}</td>
        <td>{{ $log->day_name }}</td>
        <td>{{ $log->location ?? '-' }}</td>
        <td>{{ $log->speaker ?? '-' }}</td>
        <td class="num">{{ number_format($log->target, 0, ',', '.') }}</td>
        <td class="num">{{ number_format($log->commitment, 0, ',', '.') }}</td>
        <td class="num"><strong>{{ number_format($log->realization, 0, ',', '.') }}</strong></td>
        <td class="num">{{ $log->target > 0 ? number_format($log->realization / $log->target * 100, 1) . '%' : '-' }}</td>
      </tr>
      @endforeach
      <tr class="total-row">
        <td colspan="4">TOTAL</td>
        <td class="num">{{ number_format($report->safariDakwahLogs->sum('target'), 0, ',', '.') }}</td>
        <td class="num">{{ number_format($report->safariDakwahLogs->sum('commitment'), 0, ',', '.') }}</td>
        <td class="num"><strong>{{ number_format($report->safariDakwahLogs->sum('realization'), 0, ',', '.') }}</strong></td>
        <td class="num">
          @php $t = $report->safariDakwahLogs->sum('target'); $r = $report->safariDakwahLogs->sum('realization'); @endphp
          {{ $t > 0 ? number_format($r / $t * 100, 1) . '%' : '-' }}
        </td>
      </tr>
    </tbody>
  </table>
</div>
@endif

{{-- Evaluasi --}}
@if($report->evaluation)
<div class="section">
  <div class="section-title">Evaluasi</div>
  <p style="font-size: 11px; line-height: 1.6; padding: 8px; background: #f9fafb; border-radius: 4px;">{{ $report->evaluation }}</p>
</div>
@endif

<div class="footer">
  Dicetak: {{ now()->format('d/m/Y H:i') }}
  &nbsp;·&nbsp; Revenue BWA — INDOTIM
  @if($report->approved_by)
    &nbsp;·&nbsp; Disetujui oleh {{ $report->approvedBy->name }}
  @endif
</div>

</body>
</html>