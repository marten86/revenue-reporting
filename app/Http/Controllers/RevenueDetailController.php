<?php

namespace App\Http\Controllers;

use App\Models\MonthlyReport;
use App\Models\RevenueDetail;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RevenueDetailController extends Controller
{
    // ── Validasi yang dipakai di store & update ─────────────

    private function rules(): array
    {
        return [
            'date'          => 'required|date',
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
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $data = $request->validate($this->rules());

        RevenueDetail::create([
            'monthly_report_id' => $report->id,
            ...$data,
        ]);

        // Hook di RevenueDetail::saved otomatis memanggil recalculate().

        return back()->with('success', 'Data revenue berhasil disimpan.');
    }

    // ── Update satu detail ──────────────────────────────────

    public function update(Request $request, MonthlyReport $report, RevenueDetail $detail)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($detail->monthly_report_id === $report->id, 404);

        $data = $request->validate($this->rules());
        $detail->update($data);

        return back()->with('success', 'Data revenue berhasil diperbarui.');
    }

    // ── Hapus satu detail ───────────────────────────────────

    public function destroy(Request $request, MonthlyReport $report, RevenueDetail $detail)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');
        abort_unless($detail->monthly_report_id === $report->id, 404);

        $detail->delete();

        return back()->with('success', 'Data revenue berhasil dihapus.');
    }

    // ── Bulk upsert (isi sepekan sekaligus) ─────────────────
    //
    // Dipakai saat user mengisi beberapa hari sekaligus.
    // Mematikan event model agar recalculate() hanya dipanggil
    // SEKALI di akhir, bukan per-baris.

    public function bulkUpsert(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        abort_unless($report->isDraft(), 422, 'Laporan sudah disubmit, tidak bisa diedit.');

        $data = $request->validate([
            'entries'                => 'required|array|min:1|max:217',
            'entries.*.date'         => 'required|date',
            'entries.*.channel'      => ['required', Rule::in(MonthlyReport::CHANNELS)],
            'entries.*.source_label' => 'nullable|string|max:100',
            'entries.*.sub_channel'  => ['nullable', Rule::in(MonthlyReport::SUB_CHANNELS)],
            'entries.*.amount'       => 'required|integer|min:0',
            'entries.*.sort_order'   => 'integer|min:0',
            'entries.*.notes'        => 'nullable|string|max:500',
        ]);

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

        return back()->with('success', count($data['entries']) . ' data revenue berhasil disimpan.');
    }
}