<?php

namespace App\Http\Controllers\API;

use App\Exceptions\AccountAlreadyExistsException;
use App\Exceptions\OtpCooldownException;
use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;

abstract class BaseController extends Controller
{
    protected function success($data = null, string $message = '', int $status = 200, array $meta = []): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => $meta,
        ], $status);
    }

    protected function error(string $message, $errors = null, int $status = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status);
    }

    /**
     * Map auth/registration exceptions onto the matching HTTP status while
     * preserving the standard error envelope.
     */
    protected function authFailure(\Throwable $e, int $defaultStatus = 400): JsonResponse
    {
        if ($e instanceof AccountAlreadyExistsException) {
            return $this->error($e->getMessage(), null, 422);
        }

        if ($e instanceof OtpCooldownException) {
            return $this->error($e->getMessage(), null, 429);
        }

        return $this->error($e->getMessage(), null, $defaultStatus);
    }

    /**
     * Detect a unique-index race (e.g. two concurrent registrations trying to
     * create a user with the same phone/email). The loser is reported with a
     * safe 422 that never leaks which column collided.
     */
    protected function isUniqueViolation(\Throwable $e): bool
    {
        if (! $e instanceof QueryException) {
            return false;
        }

        $driverCode = (int) ($e->errorInfo[1] ?? 0);
        $message = strtolower($e->getMessage());

        return $driverCode === 1062
            || $e->getCode() == 19
            || str_contains($message, 'unique constraint failed');
    }
}
