<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RevenueDetailController;
use App\Http\Controllers\SafariDakwahController;
use App\Http\Controllers\BranchTargetController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RevenueSourceController;
use App\Http\Controllers\SpeakerController;
use App\Http\Controllers\BranchManagementController;
use App\Http\Controllers\UserManagementController;
use App\Http\Controllers\AreaManagementController;
use App\Http\Controllers\CostController;

// Auth
Route::get('/login', [AuthController::class, 'showLogin'])->name('login')->middleware('guest');
Route::post('/login', [AuthController::class, 'login'])->middleware(['guest', 'throttle:6,1']);
Route::post('/logout', [AuthController::class, 'logout'])->name('logout')->middleware('auth');

// Protected
Route::middleware(['auth'])->group(function () {

    // Redirect root
    Route::get('/', function () {
        return auth()->user()->usesAreaDashboard()   // ⬅ CHANGED: was canManageAllBranches() — kini viewer & admin_nasional ikut ke dashboard nasional
            ? redirect()->route('area.dashboard')
            : redirect()->route('branch.dashboard');
    })->name('home');

    // Dashboards
    Route::get('/dashboard/area', [DashboardController::class, 'area'])
        ->name('area.dashboard')
        ->middleware('role:super_admin,area_manager,admin_nasional,viewer');   // ⬅ CHANGED: +admin_nasional,viewer

    Route::get('/dashboard/branch', [DashboardController::class, 'branch'])
        ->name('branch.dashboard');

    // Reports — statis dulu sebelum {report}
    Route::get('/reports/create', [ReportController::class, 'create'])->name('reports.create')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');     // read: semua termasuk viewer
    Route::post('/reports', [ReportController::class, 'store'])->name('reports.store')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::get('/reports/{report}', [ReportController::class, 'show'])->name('reports.show');   // read: semua termasuk viewer
    Route::patch('/reports/{report}/submit', [ReportController::class, 'submit'])->name('reports.submit')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ KOREKSI: semua kecuali viewer
    Route::patch('/reports/{report}/approve', [ReportController::class, 'approve'])->name('reports.approve')
        ->middleware('role:super_admin,area_manager');                                    // ⬅ NEW: approve hanya AM/super_admin
    Route::patch('/reports/{report}/revise', [ReportController::class, 'revise'])->name('reports.revise')
        ->middleware('role:super_admin,area_manager');                                    // ⬅ NEW: revise hanya AM/super_admin
    Route::patch('/reports/{report}/evaluation', [ReportController::class, 'updateEvaluation'])->name('reports.evaluation')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ KOREKSI: semua kecuali viewer
    Route::get('/reports/{report}/export/excel', [ReportController::class, 'exportExcel'])->name('reports.export.excel');   // read/export: semua termasuk viewer
    Route::get('/reports/{report}/export/pdf',   [ReportController::class, 'exportPdf'])->name('reports.export.pdf');       // read/export: semua termasuk viewer

    // Analytics
    Route::get('/analytics', [App\Http\Controllers\AnalyticsController::class, 'index'])->name('analytics.index');   // read: semua termasuk viewer (scope via accessibleBranches)

    // Revenue Detail (menggantikan Daily Revenue & Team Revenue)
    Route::post('/reports/{report}/details/bulk', [RevenueDetailController::class, 'bulkUpsert'])->name('details.bulk')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer (bulk UPSERT = simpan grid, admin_nasional boleh)
    Route::post('/reports/{report}/details', [RevenueDetailController::class, 'store'])->name('details.store')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::put('/reports/{report}/details/{detail}', [RevenueDetailController::class, 'update'])->name('details.update')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::delete('/reports/{report}/details/bulk', [RevenueDetailController::class, 'bulkDestroy'])
        ->name('details.bulkDestroy')
        ->middleware('role:super_admin,area_manager,branch_head,staff');                  // ⬅ NEW: blokir viewer DAN admin_nasional (bulk-delete destruktif)
    Route::delete('/reports/{report}/details/{detail}', [RevenueDetailController::class, 'destroy'])
        ->name('details.destroy')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer (hapus 1 baris = editing normal, admin_nasional boleh)

    // Revenue Sources (master data tim/karyawan per cabang) — TANPA perubahan; gating viewer/admin_nasional di controller (butuh RevenueSourceController)
    Route::post('/branches/{branch}/sources', [RevenueSourceController::class, 'store'])->name('sources.store');
    Route::put('/sources/{source}', [RevenueSourceController::class, 'update'])->name('sources.update');
    Route::patch('/sources/{source}/toggle', [RevenueSourceController::class, 'toggleActive'])->name('sources.toggle');
    Route::delete('/sources/{source}', [RevenueSourceController::class, 'destroy'])->name('sources.destroy');

    // Narasumber (Speaker) — master data Safari Dakwah, per cabang + opsi nasional (branch_id null).
    // Pola sama dgn Revenue Sources di atas: tanpa role-gate di route, gating halus via canInputData() di controller,
    // supaya quick-add dari form Safari Dakwah (branch_head/staff) tetap bisa jalan.
    Route::post('/speakers', [SpeakerController::class, 'store'])->name('speakers.store');                       // ⬅ NEW
    Route::put('/speakers/{speaker}', [SpeakerController::class, 'update'])->name('speakers.update');            // ⬅ NEW
    Route::patch('/speakers/{speaker}/toggle', [SpeakerController::class, 'toggleActive'])->name('speakers.toggle'); // ⬅ NEW
    Route::delete('/speakers/{speaker}', [SpeakerController::class, 'destroy'])->name('speakers.destroy');       // ⬅ NEW

    // Safari Dakwah — bagian data laporan → admin_nasional boleh, viewer tidak
    Route::post('/reports/{report}/safari', [SafariDakwahController::class, 'store'])->name('safari.store')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::put('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'update'])->name('safari.update')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer
    Route::delete('/reports/{report}/safari/{log}', [SafariDakwahController::class, 'destroy'])->name('safari.destroy')
        ->middleware('role:super_admin,area_manager,admin_nasional,branch_head,staff');   // ⬅ NEW: blokir viewer

    // Target Cabang
    Route::get('/targets', [BranchTargetController::class, 'index'])
        ->name('targets.index')
        ->middleware('role:super_admin,area_manager,admin_nasional');                     // ⬅ CHANGED: +admin_nasional
    Route::post('/targets', [BranchTargetController::class, 'store'])
        ->name('targets.store')
        ->middleware('role:super_admin,area_manager,admin_nasional');                     // ⬅ CHANGED: +admin_nasional

    // Manajemen Cabang — TANPA perubahan (admin_nasional & viewer sengaja DIKECUALIKAN)
    Route::get('/branches', [BranchManagementController::class, 'index'])->name('branches.index')->middleware('role:super_admin,area_manager');
    Route::post('/branches', [BranchManagementController::class, 'store'])->name('branches.store')->middleware('role:super_admin,area_manager');
    Route::put('/branches/{branch}', [BranchManagementController::class, 'update'])->name('branches.update')->middleware('role:super_admin,area_manager');
    Route::patch('/branches/{branch}/toggle', [BranchManagementController::class, 'toggleActive'])->name('branches.toggle')->middleware('role:super_admin,area_manager');
    Route::delete('/branches/{branch}', [BranchManagementController::class, 'destroy'])->name('branches.destroy')->middleware('role:super_admin,area_manager');

    // Manajemen User — TANPA perubahan (admin_nasional & viewer sengaja DIKECUALIKAN)
    Route::get('/users', [UserManagementController::class, 'index'])->name('users.index')->middleware('role:super_admin,area_manager');
    Route::post('/users', [UserManagementController::class, 'store'])->name('users.store')->middleware('role:super_admin,area_manager');
    Route::put('/users/{user}', [UserManagementController::class, 'update'])->name('users.update')->middleware('role:super_admin,area_manager');
    Route::patch('/users/{user}/password', [UserManagementController::class, 'resetPassword'])->name('users.password')->middleware('role:super_admin,area_manager');
    Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])->name('users.destroy')->middleware('role:super_admin,area_manager');

    // Manajemen Revenue Sources — TANPA perubahan (keputusan admin_nasional masih pending)
    Route::get('/revenue-sources', [RevenueSourceController::class, 'index'])
        ->name('sources.index')
        ->middleware('role:super_admin,area_manager');

    // Manajemen Narasumber — halaman master data (mirror pola /revenue-sources di atas)
    Route::get('/speakers', [SpeakerController::class, 'index'])
        ->name('speakers.index')
        ->middleware('role:super_admin,area_manager');   // ⬅ NEW — tambahkan 'admin_nasional' di sini kalau mau mereka bisa buka halaman kelola ini juga

    Route::prefix('areas')->name('areas.')->middleware('role:super_admin')->group(function () {   // TANPA perubahan
        Route::get('/',                            [AreaManagementController::class, 'index'])->name('index');
        Route::post('/',                           [AreaManagementController::class, 'store'])->name('store');
        Route::put('/{area}',                      [AreaManagementController::class, 'update'])->name('update');
        Route::patch('/{area}/toggle',             [AreaManagementController::class, 'toggle'])->name('toggle');
        Route::delete('/{area}',                   [AreaManagementController::class, 'destroy'])->name('destroy');
        Route::post('/{area}/branches',            [AreaManagementController::class, 'assignBranches'])->name('assignBranches');
        Route::delete('/{area}/branches/{branch}', [AreaManagementController::class, 'unassignBranch'])->name('unassignBranch');
    });

    // ── Laporan Biaya ────────────────────────────────────────────────────────
    // Static 'create' didaftarkan sebelum '{cost}' agar tak tertangkap sebagai {cost}='create'
    Route::get('/costs/create', [CostController::class, 'create'])
        ->name('costs.create')->middleware('role:super_admin,area_manager,admin_nasional');   // ⬅ input (viewer TIDAK)

    // Baca — viewer & admin_nasional ikut
    Route::middleware('role:super_admin,area_manager,admin_nasional,viewer')->group(function () {   // ⬅
        Route::get('/costs',        [CostController::class, 'index'])->name('costs.index');
        Route::get('/costs/{cost}', [CostController::class, 'show'])->name('costs.show');
    });

    // Input — admin_nasional ikut, viewer TIDAK
    Route::middleware('role:super_admin,area_manager,admin_nasional')->group(function () {   // ⬅
        Route::post('/costs',                [CostController::class, 'store'])->name('costs.store');
        Route::post('/costs/{cost}/grid',    [CostController::class, 'saveGrid'])->name('costs.grid');
        Route::patch('/costs/{cost}/submit', [CostController::class, 'submit'])->name('costs.submit');
    });

    // Approve/revise — tetap AM + super_admin (admin_nasional & viewer dikecualikan)
    Route::middleware('role:super_admin,area_manager')->group(function () {   // ⬅
        Route::patch('/costs/{cost}/approve', [CostController::class, 'approve'])->name('costs.approve');
        Route::patch('/costs/{cost}/revise',  [CostController::class, 'revise'])->name('costs.revise');
    });

});