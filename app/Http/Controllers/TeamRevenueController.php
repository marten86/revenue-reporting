<?php

namespace App\Http\Controllers;

use App\Models\MonthlyReport;
use App\Models\TeamRevenue;
use Illuminate\Http\Request;

class TeamRevenueController extends Controller
{
    public function store(Request $request, MonthlyReport $report)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $data = $request->validate([
            'team_name'      => 'required|string|max:100',
            'team_code'      => 'required|string|max:20',
            'personnel'      => 'nullable|string|max:500',
            'is_unit_cabang' => 'boolean',
            'reguler'        => 'nullable|integer|min:0',
            'safdak'         => 'nullable|integer|min:0',
            'df'             => 'nullable|integer|min:0',
            'sort_order'     => 'nullable|integer',
        ]);

        TeamRevenue::updateOrCreate(
            [
                'monthly_report_id' => $report->id,
                'team_code'         => strtoupper($data['team_code']),
            ],
            [
                'monthly_report_id' => $report->id,
                'team_name'         => $data['team_name'],
                'team_code'         => strtoupper($data['team_code']),
                'personnel'         => $data['personnel'] ?? null,
                'is_unit_cabang'    => $data['is_unit_cabang'] ?? false,
                'reguler'           => $data['reguler'] ?? 0,
                'safdak'            => $data['safdak'] ?? 0,
                'df'                => $data['df'] ?? 0,
                'sort_order'        => $data['sort_order'] ?? 0,
            ]
        );

        return back()->with('success', 'Data tim disimpan.');
    }

    public function update(Request $request, MonthlyReport $report, TeamRevenue $team)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);

        $data = $request->validate([
            'team_name'      => 'required|string|max:100',
            'personnel'      => 'nullable|string|max:500',
            'is_unit_cabang' => 'boolean',
            'reguler'        => 'nullable|integer|min:0',
            'safdak'         => 'nullable|integer|min:0',
            'df'             => 'nullable|integer|min:0',
        ]);

        $team->update($data);

        return back()->with('success', 'Data tim diperbarui.');
    }

    public function destroy(Request $request, MonthlyReport $report, TeamRevenue $team)
    {
        abort_unless($request->user()->canAccessBranch($report->branch), 403);
        $team->delete();
        return back()->with('success', 'Data tim dihapus.');
    }
}