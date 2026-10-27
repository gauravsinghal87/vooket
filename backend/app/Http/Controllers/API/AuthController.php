<?php

namespace App\Http\Controllers\API;

use App\Exceptions\GoogleTokenException;
use App\Exceptions\PasswordResetUnavailableException;
use App\Http\Requests\API\ForgotPasswordRequest;
use App\Http\Requests\API\ResetPasswordRequest;
use App\Services\AuthService;
use App\Services\Integration\IntegrationManager;
use App\Services\PasswordResetService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;

class AuthController extends BaseController
{
    public function __construct(
        private AuthService $authService,
        private IntegrationManager $manager,
        private PasswordResetService $passwordResetService,
    ) {}

    public function sendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|digits_between:7,15',
            'country_code' => 'sometimes|string|max:5',
            'purpose' => 'sometimes|in:login,verify,password_reset,transaction',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->authService->sendOtp(
                $request->phone,
                $request->country_code ?? '+91',
                $request->purpose ?? 'login'
            );

            return $this->success($result, 'OTP sent successfully');
        } catch (\Exception $e) {
            return $this->authFailure($e, 500);
        }
    }

    public function verifyOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|digits_between:7,15',
            'otp' => 'required|digits:6',
            'token' => 'required|string',
            'country_code' => 'sometimes|string|max:5',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->authService->verifyOtp(
                $request->phone,
                $request->otp,
                $request->token,
                $request->country_code ?? '+91'
            );

            return $this->success($result, 'Login successful');
        } catch (\Exception $e) {
            return $this->authFailure($e, 401);
        }
    }

    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'phone' => 'required|digits_between:7,15',
            'email' => 'sometimes|nullable|email|max:255',
            'password' => 'required|string|min:8|confirmed',
            'country_code' => 'sometimes|string|max:5',
            'referral_code' => 'sometimes|string|max:20',
            'device_token' => 'sometimes|string',
            'device_type' => 'sometimes|string|in:android,ios,web',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->authService->register($request->only([
                'name', 'phone', 'email', 'password', 'country_code', 'referral_code',
            ]));

            if ($request->device_token) {
                $this->authService->registerDevice($result['user'], $request->only([
                    'device_token', 'device_type', 'device_name', 'platform', 'app_version',
                ]));
            }

            return $this->success($result, 'Registration successful', 201);
        } catch (QueryException $e) {
            return $this->isUniqueViolation($e)
                ? $this->error(AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE, null, 422)
                : $this->authFailure($e, 400);
        } catch (\Exception $e) {
            return $this->authFailure($e, 400);
        }
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'phone' => 'required|digits_between:7,15',
            'password' => 'required|string|min:6',
            'country_code' => 'sometimes|string|max:5',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->authService->loginByPhone(
                $request->phone,
                $request->password,
                $request->country_code ?? '+91'
            );

            return $this->success($result, 'Login successful');
        } catch (\Exception $e) {
            return $this->authFailure($e, 401);
        }
    }

    public function loginWithEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->authService->loginWithEmail($request->email, $request->password);

            return $this->success($result, 'Login successful');
        } catch (\Exception $e) {
            return $this->authFailure($e, 401);
        }
    }

    /**
     * Authenticate a customer with a Google Identity Services ID token.
     *
     * The credential is verified server-side against the configured Google
     * Client ID; no profile data sent by the browser is trusted, and no
     * Google access token is requested or stored.
     */
    public function google(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'credential' => 'required|string|max:8192',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $claims = $this->manager->googleOAuth()->verifyIdToken($request->input('credential'));

            $result = $this->authService->loginWithGoogleClaims($claims);

            return $this->success($result, 'Login successful');
        } catch (GoogleTokenException $e) {
            return $this->error($e->getMessage(), null, 401);
        } catch (QueryException $e) {
            return $this->isUniqueViolation($e)
                ? $this->error(AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE, null, 422)
                : $this->authFailure($e, 400);
        } catch (\Exception $e) {
            return $this->authFailure($e, 500);
        }
    }

    public function logout(Request $request)
    {
        $this->authService->logout($request->user(), $request->device_token);

        return $this->success(null, 'Logged out successfully');
    }

    /**
     * Start a password reset.
     *
     * Always answers with the same generic message so the endpoint reveals
     * neither whether the address exists nor whether it uses password auth.
     */
    public function forgotPassword(ForgotPasswordRequest $request)
    {
        try {
            $this->passwordResetService->sendResetLink($request->string('email')->toString());
        } catch (PasswordResetUnavailableException $e) {
            return $this->error($e->getMessage(), null, 503);
        }

        return $this->success(null, PasswordResetService::GENERIC_MESSAGE);
    }

    /**
     * Complete a password reset using Laravel's broker token.
     */
    public function resetPassword(ResetPasswordRequest $request)
    {
        $result = $this->passwordResetService->reset(
            $request->string('email')->toString(),
            $request->string('token')->toString(),
            $request->string('password')->toString(),
        );

        if ($result['status'] === Password::PASSWORD_RESET) {
            return $this->success(null, 'Your password has been reset successfully.');
        }

        // A single message covers unknown email, wrong token, expired token and
        // reuse of a consumed token so none of those can be told apart.
        return $this->error('This password reset link is invalid or has expired.', null, 422);
    }

    public function registerDevice(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'device_token' => 'required|string',
            'device_type' => 'sometimes|string|in:android,ios,web',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $device = $this->authService->registerDevice($request->user(), $request->all());

            return $this->success($device, 'Device registered');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }
}
