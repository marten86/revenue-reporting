<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DailyRevenueController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\TeamRevenueController;
use App\Http\Controllers\SafariDakwahController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\BranchTargetController;
use Illuminate\Support\Facades\Route;

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
    Route::patch('/reports/{report}/evaluation', [ReportController::class, 'updateEvaluation'])->name('reports.evaluation');

    // Daily Revenue
    Route::post('/reports/{report}/daily', [DailyRevenueController::class, 'store'])->name('daily.store');
    Route::put('/reports/{report}/daily/{daily}', [DailyRevenueController::class, 'update'])->name('daily.update');
    Route::delete('/reports/{report}/daily/{daily}', [DailyRevenueController::class, 'destroy'])->name('daily.destroy');
    Route::post('/reports/{report}/daily/bulk', [DailyRevenueController::class, 'bulkUpsert'])->name('daily.bulk');

    // Team Revenue
    Route::post('/reports/{report}/teams', [TeamRevenueController::class, 'store'])->name('teams.store');
    Route::put('/reports/{report}/teams/{team}', [TeamRevenueController::class, 'update'])->name('teams.update');
    Route::delete('/reports/{report}/teams/{team}', [TeamRevenueController::class, 'destroy'])->name('teams.destroy');

    // Safari Dakwah
    Route::post('/reports/{report}/safari', [SafariDakwahController::class, 'store'])->name('safari.store');
    Route::put('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'update'])->name('safari.update');
    Route::delete('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'destroy'])->name('safari.destroy');

    // Export
    Route::get('/reports/{report}/export/excel', [ExportController::class, 'excel'])->name('export.excel');
    Route::get('/reports/{report}/export/pdf', [ExportController::class, 'pdf'])->name('export.pdf');

    // Target Cabang
        Route::get('/targets', [BranchTargetController::class, 'index'])
    ->name('targets.index')
    ->middleware('role:super_admin,area_manager');
    Route::post('/targets', [BranchTargetController::class, 'store'])
    ->name('targets.store')
    ->middleware('role:super_admin,area_manager');

});