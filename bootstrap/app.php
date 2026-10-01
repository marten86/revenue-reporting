<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // v20261001-flash-abort: abort(403/422, 'pesan') dari aksi di aplikasi (request Inertia)
        // dikembalikan ke halaman sebelumnya + flash error, bukan halaman "Oops! An Error Occurred".
        // Validasi form (ValidationException) tidak terpengaruh: untuk Inertia statusnya 302, bukan 422.
        $exceptions->respond(function ($response, \Throwable $e, \Illuminate\Http\Request $request) {
            if (
                $request->header('X-Inertia')
                && $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                && in_array($e->getStatusCode(), [403, 422], true)
            ) {
                $message = $e->getMessage() !== '' ? $e->getMessage() : 'Aksi ini tidak diizinkan.';

                return back()->with('error', $message);
            }

            return $response;
        });
    })->create();