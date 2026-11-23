<?php
// Regression checks run only against the disposable fixture used by run.sh.
require '/www/vendor/autoload.php';
$app = require '/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('testing') || !str_contains(config('database.connections.sqlite.database'), 'admin-test')) {
    throw new RuntimeException('Refusing a non-test environment.');
}
function check(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$user = new App\Models\User();
$user->plan_id = 3;
$template = new App\Models\GiftCardTemplate();
$template->type = App\Models\GiftCardTemplate::TYPE_GENERAL;
$template->rewards = ['balance' => 100];
$template->conditions = ['allowed_plans' => [], 'disallowed_plans' => [3]];
check(!$template->checkUserConditions($user), 'Disallowed plan must block redemption');
$template->conditions = ['allowed_plans' => []];
check($template->checkUserConditions($user), 'Empty allowed plans must not impose a restriction');
$template->conditions = ['allowed_plans' => [2]];
check(!$template->checkUserConditions($user), 'Allowed plan filter must apply');
$user->plan_id = null;
check(!$template->checkUserConditions($user), 'User without a plan must not bypass allowlist');
$template->rewards = ['balance' => 100, 'plan_id' => 3, 'plan_validity_days' => 30, 'invite_reward_rate' => 0.2];
$template->special_config = ['start_time' => time() - 60, 'end_time' => time() + 60, 'festival_bonus' => 2];
$reward = $template->calculateActualRewards($user);
check($reward['plan_id'] === 3 && $reward['invite_reward_rate'] === 0.2, 'Multiplier must not change IDs or ratios');
check($reward['balance'] === 200 && $reward['plan_validity_days'] === 60, 'Multiplier must apply to reward quantities');
$template->rewards = ['balance' => 100];
$template->limits = ['invite_reward_rate' => 0.2];
check($template->calculateActualRewards($user)['invite_reward_rate'] === 0.2, 'Legacy limits ratio must be supported');
$template->rewards = ['balance' => 100, 'invite_reward_rate' => 0];
check($template->calculateActualRewards($user)['invite_reward_rate'] === 0, 'Explicit zero must override legacy ratio');
$template->rewards = ['balance' => 100];
$template->limits = [];
check(!isset($template->calculateActualRewards($user)['invite_reward_rate']), 'Absent ratio must remain absent');
$controller = new App\Http\Controllers\V2\Admin\Server\ManageController();
$data = $controller->generateRealityKey()->getData(true)['data'];
$decode = static fn (string $key): string => base64_decode(strtr($key, '-_', '+/'));
check(sodium_crypto_scalarmult_base($decode($data['private_key'])) === $decode($data['public_key']), 'Reality public key must match private key');
fwrite(STDOUT, "PASS gift conditions/multiplier/inviter ratio and Reality key-pair regressions\n");
