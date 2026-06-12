<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FonnteService
{
    protected string $token;
    protected string $apiUrl = 'https://api.fonnte.com/send';

    public function __construct()
    {
        $this->token = config('services.fonnte.token', '');
    }

    /**
     * Kirim pesan WA ke satu nomor.
     *
     * @param  string  $phone  Format: 628xxxxxxxxxx
     * @param  string  $message
     * @return bool
     */
    public function send(string $phone, string $message): bool
    {
        if (empty($this->token)) {
            Log::warning('FonnteService: FONNTE_TOKEN belum diset di .env');
            return false;
        }

        if (empty($phone)) {
            Log::warning('FonnteService: Nomor WA kosong, pesan tidak dikirim.');
            return false;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => $this->token,
            ])->post($this->apiUrl, [
                'target'  => $phone,
                'message' => $message,
            ]);

            $body = $response->json();

            if ($response->successful() && ($body['status'] ?? false)) {
                Log::info("FonnteService: Pesan berhasil dikirim ke {$phone}");
                return true;
            }

            Log::warning("FonnteService: Gagal kirim ke {$phone}", $body ?? []);
            return false;

        } catch (\Exception $e) {
            Log::error("FonnteService: Exception saat kirim ke {$phone} — {$e->getMessage()}");
            return false;
        }
    }
}