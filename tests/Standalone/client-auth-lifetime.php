<?php

require dirname(__DIR__, 2) . '/vendor/autoload.php';
require dirname(__DIR__, 2) . '/app/Services/AuthService.php';

use App\Exceptions\ApiException;
use App\Models\User;
use App\Services\AuthService;
use Laravel\Sanctum\NewAccessToken;
use Laravel\Sanctum\PersonalAccessToken;

$user = new class extends User {
    public array $issued = [];

    public function createToken(string $name, array $abilities = ['*'], ?DateTimeInterface $expiresAt = null)
    {
        $this->issued[] = compact('name', 'abilities', 'expiresAt');
        return new NewAccessToken(new PersonalAccessToken(), '123|test-only-secret');
    }

    public function getConnection()
    {
        throw new RuntimeException('This test must not access any database');
    }
};
$user->token = 'test-only-subscription';
$user->is_admin = false;
$user->is_staff = false;
$service = new AuthService($user);
$web = $service->generateAuthData();
$client = $service->generateAuthData(true);

if ($user->issued[0]['expiresAt'] === null ||
    abs($user->issued[0]['expiresAt']->getTimestamp() - now()->addYear()->getTimestamp()) > 2 ||
    $user->issued[1]['expiresAt'] !== null ||
    !str_starts_with($user->issued[1]['name'], 'JX Cloud ') ||
    $web !== $client || $client['auth_data'] !== 'Bearer test-only-secret' ||
    $client['token'] !== 'test-only-subscription') {
    throw new RuntimeException('Client/web token lifetime contract failed');
}

foreach ([[true, false], [false, true], [true, true]] as [$admin, $staff]) {
    $privileged = clone $user;
    $privileged->issued = [];
    $privileged->is_admin = $admin;
    $privileged->is_staff = $staff;
    $privilegedService = new AuthService($privileged);
    try {
        $privilegedService->generateAuthData(true);
        throw new RuntimeException('Privileged client login must be rejected');
    } catch (ApiException $exception) {
        if ($exception->getCode() !== 403 || $privileged->issued !== []) {
            throw new RuntimeException('Rejected client login must not issue a token');
        }
    }
    $privilegedService->generateAuthData();
    if (count($privileged->issued) !== 1 ||
        $privileged->issued[0]['expiresAt'] === null ||
        abs($privileged->issued[0]['expiresAt']->getTimestamp() - now()->addYear()->getTimestamp()) > 2) {
        throw new RuntimeException('Privileged web login must retain its one-year lifetime');
    }
}
echo "PASS: ordinary client lifetime; privileged client rejection; web lifetime; unchanged response/subscription; no database accessed\n";
