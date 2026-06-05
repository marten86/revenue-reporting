<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchTarget;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BranchTargetController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $month   = $request->get('month', now()->format('Y-m-01'));
        $branches = Branch::with([
            'targets' => fn($q) => $q->where('period_month', $month),
        ])->get();

        return Inertia::render('Targets/Index', [
            'branches'     => $branches,
            'currentMonth' => $month,
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canManageAllBranches(), 403);

        $data = $request->validate([
            'branch_id'        => 'required|uuid|exists:branches,id',
            'period_month'     => 'required|date_format:Y-m-d',
            'target_total'     => 'required|integer|min:0',
            'target_presentasi' => 'nullable|integer|min:0',
            'target_gerai'     => 'nullable|integer|min:0',
            'target_wgts'      => 'nullable|integer|min:0',
            'target_dfi'       => 'nullable|integer|min:0',
            'target_dfe'       => 'nullable|integer|min:0',
            'target_kotak_qris' => 'nullable|integer|min:0',
            'target_kantor'    => 'nullable|integer|min:0',
            'notes'            => 'nullable|string|max:500',
        ]);

        BranchTarget::updateOrCreate(
            [
                'branch_id'    => $data['branch_id'],
                'period_month' => $data['period_month'],
            ],
            [...$data, 'created_by' => $request->user()->id]
        );

        // Update target_amount di monthly_report jika sudah ada
        $report = \App\Models\MonthlyReport::where('branch_id', $data['branch_id'])
            ->where('period_month', $data['period_month'])
            ->first();

        if ($report && $report->isDraft()) {
            $report->update(['target_amount' => $data['target_total']]);
        }

        return back()->with('success', 'Target berhasil disimpan.');
    }
}