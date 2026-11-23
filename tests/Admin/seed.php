<?php

// Only run inside the disposable, network-isolated admin test container.
require '/www/vendor/autoload.php';
$app = require '/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('testing') || !str_contains(config('database.connections.sqlite.database'), 'admin-test')) {
    throw new RuntimeException('Refusing to seed a non-test database.');
}
Illuminate\Database\Eloquent\Model::unguard();
admin_setting([
    'secure_path' => 'admin-test', 'app_name' => 'Xboard 隔离验收',
    'app_url' => 'http://127.0.0.1:7091', 'currency' => 'CNY',
    'server_ws_enable' => false, 'telegram_bot_enable' => false,
    'email_host' => '127.0.0.1', 'email_port' => 1025,
]);
$group = App\Models\ServerGroup::create(['name' => '测试权限组']);
$plan = App\Models\Plan::create([
    'name' => '测试套餐', 'group_id' => $group->id, 'transfer_enable' => 100,
    'prices' => ['monthly' => 9.9], 'show' => true, 'sell' => true, 'renew' => true,
]);
foreach (['admin', 'inviter', 'member'] as $index => $name) {
    $user = new App\Models\User();
    $user->email = $name . '@admin-test.invalid';
    $user->password = password_hash('Isolated-test-only-2026!', PASSWORD_DEFAULT);
    $user->is_admin = $index === 0;
    $user->uuid = Illuminate\Support\Str::uuid()->toString();
    $user->token = Illuminate\Support\Str::random(32);
    $user->plan_id = $plan->id;
    $user->group_id = $group->id;
    $user->transfer_enable = 100 * 1024 * 1024 * 1024;
    $user->expired_at = time() + 86400 * 30;
    $user->balance = 12345;
    if ($index === 2) {
        $user->invite_user_id = 2;
    }
    $user->save();
}
App\Models\ServerMachine::create([
    'name' => '隔离负载机器', 'token' => App\Models\ServerMachine::generateToken(),
    'is_active' => true, 'load_status' => ['cpu' => 30, 'mem' => ['used' => 90, 'total' => 100], 'disk' => ['used' => 20, 'total' => 100]],
]);
$ticket = App\Models\Ticket::create(['user_id' => 3, 'subject' => '测试网络连接', 'level' => 1, 'status' => 0]);
App\Models\TicketMessage::create(['ticket_id' => $ticket->id, 'user_id' => 3, 'message' => '这是一条隔离测试工单。']);
App\Models\Notice::create(['title' => '测试公告', 'content' => '<p>测试内容</p>', 'show' => true]);
fwrite(STDOUT, "Isolated fixtures ready.\n");
