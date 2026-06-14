<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RevenueDetailController;
use App\Http\Controllers\SafariDakwahController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\BranchTargetController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RevenueSourceController;
use App\Http\Controllers\BranchManagementController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\AreaManagementController;
use App\Http\Controllers\CostController;

// Auth
Route::get('/login', [AuthController::class, 'showLogin'])->name('login')->middleware('guest');
Route::post('/login', [AuthController::class, 'login'])->middleware('guest');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout')->middleware('auth');

// Protected
Route::middleware(['auth'])->group(function () {

    // Redirect root
    Route::get('/', function () {
        return auth()->user()->canManageAllBranches()
            ? redirect()->route('area.dashboard')
            : redirect()->route('branch.dashboard');
    })->name('home');

    // Dashboards
    Route::get('/dashboard/area', [DashboardController::class, 'area'])
        ->name('area.dashboard')
        ->middleware('role:super_admin,area_manager');

    Route::get('/dashboard/branch', [DashboardController::class, 'branch'])
        ->name('branch.dashboard');

    // Reports — statis dulu sebelum {report}
    Route::get('/reports/create', [ReportController::class, 'create'])->name('reports.create');
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::post('/reports', [ReportController::class, 'store'])->name('reports.store');
    Route::get('/reports/{report}', [ReportController::class, 'show'])->name('reports.show');
    Route::patch('/reports/{report}/submit', [ReportController::class, 'submit'])->name('reports.submit');
    Route::patch('/reports/{report}/approve', [ReportController::class, 'approve'])->name('reports.approve');
    Route::patch('/reports/{report}/revise', [ReportController::class, 'revise'])->name('reports.revise');
    Route::patch('/reports/{report}/evaluation', [ReportController::class, 'updateEvaluation'])->name('reports.evaluation');
    Route::get('/reports/{report}/export/excel', [ReportController::class, 'exportExcel'])->name('reports.export.excel');
    Route::get('/reports/{report}/export/pdf',   [ReportController::class, 'exportPdf'])->name('reports.export.pdf');

    // Analytics
    Route::get('/analytics', [App\Http\Controllers\AnalyticsController::class, 'index'])->name('analytics.index');
    
    // Revenue Detail (menggantikan Daily Revenue & Team Revenue)
    Route::post('/reports/{report}/details/bulk', [RevenueDetailController::class, 'bulkUpsert'])->name('details.bulk');
    Route::post('/reports/{report}/details', [RevenueDetailController::class, 'store'])->name('details.store');
    Route::put('/reports/{report}/details/{detail}', [RevenueDetailController::class, 'update'])->name('details.update');
    Route::delete('/reports/{report}/details/bulk', [RevenueDetailController::class, 'bulkDestroy'])
    ->name('details.bulkDestroy');
    Route::delete('/reports/{report}/details/{detail}', [RevenueDetailController::class, 'destroy'])
    ->name('details.destroy');

    // Revenue Sources (master data tim/karyawan per cabang)
    Route::post('/branches/{branch}/sources', [RevenueSourceController::class, 'store'])->name('sources.store');
    Route::put('/sources/{source}', [RevenueSourceController::class, 'update'])->name('sources.update');
    Route::patch('/sources/{source}/toggle', [RevenueSourceController::class, 'toggleActive'])->name('sources.toggle');
    Route::delete('/sources/{source}', [RevenueSourceController::class, 'destroy'])->name('sources.destroy');

    // Safari Dakwah
    Route::post('/reports/{report}/safari', [SafariDakwahController::class, 'store'])->name('safari.store');
    Route::put('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'update'])->name('safari.update');
    Route::delete('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'destroy'])->name('safari.destroy');

    // Target Cabang
    Route::get('/targets', [BranchTargetController::class, 'index'])
        ->name('targets.index')
        ->middleware('role:super_admin,area_manager');
    Route::post('/targets', [BranchTargetController::class, 'store'])
        ->name('targets.store')
        ->middleware('role:super_admin,area_manager');
        
    // Manajemen Cabang
    Route::get('/branches', [BranchManagementController::class, 'index'])->name('branches.index')->middleware('role:super_admin,area_manager');
    Route::post('/branches', [BranchManagementController::class, 'store'])->name('branches.store')->middleware('role:super_admin,area_manager');
    Route::put('/branches/{branch}', [BranchManagementController::class, 'update'])->name('branches.update')->middleware('role:super_admin,area_manager');
    Route::patch('/branches/{branch}/toggle', [BranchManagementController::class, 'toggleActive'])->name('branches.toggle')->middleware('role:super_admin,area_manager');
    Route::delete('/branches/{branch}', [BranchManagementController::class, 'destroy'])->name('branches.destroy')->middleware('role:super_admin,area_manager');

    // Manajemen User
    Route::get('/users', [UserManagementController::class, 'index'])->name('users.index')->middleware('role:super_admin,area_manager');
    Route::post('/users', [UserManagementController::class, 'store'])->name('users.store')->middleware('role:super_admin,area_manager');
    Route::put('/users/{user}', [UserManagementController::class, 'update'])->name('users.update')->middleware('role:super_admin,area_manager');
    Route::patch('/users/{user}/password', [UserManagementController::class, 'resetPassword'])->name('users.password')->middleware('role:super_admin,area_manager');
    Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])->name('users.destroy')->middleware('role:super_admin,area_manager');
    
    // Manajemen Revenue Sources (Tim/Karyawan/Relawan)
    Route::get('/revenue-sources', [RevenueSourceController::class, 'index'])
    ->name('sources.index')
    ->middleware('role:super_admin,area_manager');

    Route::prefix('areas')->name('areas.')->group(function () {
    Route::get('/',                            [AreaManagementController::class, 'index'])->name('index');
    Route::post('/',                           [AreaManagementController::class, 'store'])->name('store');
    Route::put('/{area}',                      [AreaManagementController::class, 'update'])->name('update');
    Route::patch('/{area}/toggle',             [AreaManagementController::class, 'toggle'])->name('toggle');
    Route::delete('/{area}',                   [AreaManagementController::class, 'destroy'])->name('destroy');
    Route::post('/{area}/branches',            [AreaManagementController::class, 'assignBranches'])->name('assignBranches');
    Route::delete('/{area}/branches/{branch}', [AreaManagementController::class, 'unassignBranch'])->name('unassignBranch');
    });

   // ── Laporan Biaya ────────────────────────────────────────────────────────────
    Route::get('/costs',                   [CostController::class, 'index'])->name('costs.index');
    Route::get('/costs/create',            [CostController::class, 'create'])->name('costs.create');
    Route::post('/costs',                  [CostController::class, 'store'])->name('costs.store');
    Route::get('/costs/{cost}',            [CostController::class, 'show'])->name('costs.show');
    Route::post('/costs/{cost}/grid',      [CostController::class, 'saveGrid'])->name('costs.grid');
    Route::patch('/costs/{cost}/submit',   [CostController::class, 'submit'])->name('costs.submit');
    Route::patch('/costs/{cost}/approve',  [CostController::class, 'approve'])->name('costs.approve');
    Route::patch('/costs/{cost}/revise',   [CostController::class, 'revise'])->name('costs.revise');

});