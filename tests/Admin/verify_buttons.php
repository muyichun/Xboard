<?php

use App\Models\MailLog;
use App\Models\User;
use Illuminate\Support\Str;

require '/www/vendor/autoload.php';
$app = require '/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('testing') || !str_contains(config('database.connections.sqlite.database'), 'admin-test')) {
    throw new RuntimeException('Expected the disposable acceptance database.');
}

if (!User::exists() || User::where('banned', false)->exists()) {
    throw new RuntimeException('The all-users ban did not reach every fixture account.');
}

$logs = MailLog::where('subject', 'like', 'buttons-%')->get();
$scopes = $logs->groupBy(fn ($mail) => Str::afterLast($mail->subject, '-'));
$selected = $scopes->get('selected', collect())->pluck('email');
$filtered = $scopes->get('filtered', collect())->pluck('email');
$all = $scopes->get('all', collect())->pluck('email')->sort()->values();
$domain = Str::between($scopes->get('filtered', collect())->first()?->subject ?? '', 'buttons-', '-filtered');
// The UI deletes one of the two filtered users after sending.
$expected = User::pluck('email')->merge($filtered)->unique()->sort()->values();
if ($logs->contains(fn ($mail) => filled($mail->error))
    || $selected->count() !== 1 || !$filtered->contains($selected->first())
    || $filtered->count() !== 2 || $filtered->unique()->count() !== 2
    || !$filtered->every(fn ($email) => Str::endsWith($email, '@' . $domain))
    || $all->all() !== $expected->all()) {
    throw new RuntimeException('Bulk email recipient or local mail transport verification failed.');
}
fwrite(STDOUT, "PASS bulk email recipient scopes and all-users ban in disposable database\n");
