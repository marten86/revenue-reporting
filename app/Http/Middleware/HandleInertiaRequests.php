<?php
namespace App\Http\Middleware;
use Illuminate\Http\Request;
use Inertia\Middleware;
use App\Models\MonthlyReport;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        // Ambil nama area jika user adalah area_manager
        $areaName = null;
        if ($user && $user->area_id) {
            $areaName = \App\Models\Area::where('id', $user->area_id)->value('name');
        }

        // Hitung laporan pending approval (hanya untuk approver)
        $pendingApprovals = 0;
        if ($user && $user->canApproveReport()) {
            $branchIds = $user->accessibleBranches()->pluck('id');
            $pendingApprovals = MonthlyReport::whereIn('branch_id', $branchIds)
                ->where('status', MonthlyReport::STATUS_SUBMITTED)
                ->count();
        }

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user?->only([
                    'id', 'name', 'email', 'role', 'branch_id', 'area_id',
                ]) ? array_merge($user->only([
                    'id', 'name', 'email', 'role', 'branch_id', 'area_id',
                ]), ['area_name' => $areaName]) : null,
            ],
            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'warning' => fn() => $request->session()->get('warning'),
                'error'   => fn() => $request->session()->get('error'),
            ],
            'pendingApprovals' => $pendingApprovals,
        ]);
    }
}