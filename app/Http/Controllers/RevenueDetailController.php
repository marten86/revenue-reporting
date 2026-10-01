<?php

namespace App\Http\Controllers;

use App\Models\MonthlyReport;
use App\Models\RevenueDetail;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RevenueDetailController extends Controller
{
    // ── Validasi yang dipakai di store & update ─────────────

    // v20261001-batas-bulan: tanggal entri wajib di dalam bulan laporan.
    // Entri di luar bulan tidak masuk total (recalculate hanya tgl 1..akhir bulan)
    // tetapi tetap muncul di grafik per kanal & rekap tim -> angka tidak konsisten.
    private function dateRule(MonthlyReport $report): array
    {
        $start = $report->period_month->copy()->startOfMonth()->toDateString();
        $end   = $report->period_month->copy()->endOfMonth()->toDateString();

        return ['required', 'date', "after_or_equal:{$start}", "before_or_equal:{$end}"];
    }

    private function dateMessages(string $field): array
    {
        $msg = 'Tanggal harus berada di dalam bulan laporan ini.';

        return ["{$field}.after_or_equal" => $msg, "{$field}.before_or_equal" => $msg];
    }

    private function rules(MonthlyReport $report): array
    {
        return [
            'date'          => $this->dateRule($report),
            'channel'       => ['required', Rule::in(MonthlyReport::CHANNELS)],
            'source_label'  => 'nullable|string|max:100',
            'sub_channel'   => ['nullable', Rule::in(MonthlyReport::SUB_CHANNELS)],
            'amount'        => 'required|integer|min:0',
            'sort_order'    => 'integer|min:0',
            'notes'         => 'nullable|string|max:500',
        ];
    }

    // ── Simpan satu detail ──────────────────────────────────

    public function store(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer (admin_nasional lolos)
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $data = $request->validate($this->rules($report), $this->dateMessages('date'));

        RevenueDetail::create([
            'monthly_report_id' => $report->id,
            ...$data,
        ]);

        // Hook di RevenueDetail::saved otomatis memanggil recalculate().

        return back()->with('success', 'Data penghimpunan berhasil disimpan.');
    }

    // ── Update satu detail ──────────────────────────────────

    public function update(Request $request, MonthlyReport $report, RevenueDetail $detail)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($detail->monthly_report_id === $report->id, 404);

        $data = $request->validate($this->rules($report), $this->dateMessages('date'));
        $detail->update($data);

        return back()->with('success', 'Data penghimpunan berhasil diperbarui.');
    }

    // ── Hapus satu detail ───────────────────────────────────

    public function destroy(Request $request, MonthlyReport $report, RevenueDetail $detail)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer (hapus 1 baris = editing normal, admin_nasional boleh)
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($detail->monthly_report_id === $report->id, 404);

        $detail->delete();

        return back()->with('success', 'Data penghimpunan berhasil dihapus.');
    }

    // ── Bulk delete (hapus beberapa entri sekaligus) ────────

    public function bulkDestroy(Request $request, MonthlyReport $report)
    {
        // ⬅ NEW: aksi DESTRUKTIF — blokir viewer DAN admin_nasional (sesuai keputusan: admin_nasional tak boleh bulk-delete).
        abort_if($request->user()->isViewer() || $request->user()->isAdminNasional(), 403);
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $validated = $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'string|exists:revenue_details,id',  // ← string, bukan integer (UUID)
        ]);

        $deleted = RevenueDetail::whereIn('id', $validated['ids'])
            ->where('monthly_report_id', $report->id)
            ->delete();

        $report->recalculate();

        return back()->with('success', "{$deleted} entri berhasil dihapus.");
    }

    // ── Bulk upsert (isi sepekan sekaligus) ─────────────────
    //
    // Dipakai saat user mengisi beberapa hari sekaligus.
    // Mematikan event model agar recalculate() hanya dipanggil
    // SEKALI di akhir, bukan per-baris.

    public function bulkUpsert(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canInputData(), 403); // ⬅ NEW: blokir viewer (UPSERT = simpan grid, admin_nasional boleh)
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $data = $request->validate([
            'entries'                => 'required|array|min:1|max:217',
            'entries.*.date'         => $this->dateRule($report),
            'entries.*.channel'      => ['required', Rule::in(MonthlyReport::CHANNELS)],
            'entries.*.source_label' => 'nullable|string|max:100',
            'entries.*.sub_channel'  => ['nullable', Rule::in(MonthlyReport::SUB_CHANNELS)],
            'entries.*.amount'       => 'required|integer|min:0',
            'entries.*.sort_order'   => 'integer|min:0',
            'entries.*.notes'        => 'nullable|string|max:500',
        ], $this->dateMessages('entries.*.date'));

        // Matikan event → tidak ada recalculate per baris
        RevenueDetail::withoutEvents(function () use ($report, $data) {
            foreach ($data['entries'] as $entry) {
                RevenueDetail::updateOrCreate(
                    [
                        'monthly_report_id' => $report->id,
                        'date'              => $entry['date'],
                        'channel'           => $entry['channel'],
                        'source_label'      => $entry['source_label'] ?? null,
                        'sub_channel'       => $entry['sub_channel'] ?? null,
                    ],
                    [
                        'amount'     => $entry['amount'],
                        'sort_order' => $entry['sort_order'] ?? 0,
                        'notes'      => $entry['notes'] ?? null,
                    ]
                );
            }
        });

        // Recalculate SEKALI setelah semua baris masuk
        $report->recalculate();

        return back()->with('success', count($data['entries']) . ' data penghimpunan berhasil disimpan.');
    }
}