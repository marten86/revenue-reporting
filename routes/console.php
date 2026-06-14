<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reminder submit laporan — setiap tanggal 1, jam 08:00 WITA
Schedule::command('reminder:monthly-submit')
    ->monthlyOn(1, '08:00')
    ->timezone('Asia/Makassar')
    ->withoutOverlapping()
    ->runInBackground();

// Reminder isi laporan harian — setiap Senin, jam 08:00 WITA
Schedule::command('reminder:weekly-fill')
    ->weeklyOn(1, '08:00')
    ->timezone('Asia/Makassar')
    ->withoutOverlapping()
    ->runInBackground();