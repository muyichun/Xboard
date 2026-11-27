<?php
// Runs only in the disposable SQLite fixture, before HTTP/browser acceptance.
require '/www/vendor/autoload.php';
$app = require '/www/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('testing') || !str_contains(config('database.connections.sqlite.database'), 'admin-test')) {
    throw new RuntimeException('Refusing a non-test environment.');
}
use App\Jobs\StatUserJob;
use App\Models\StatUser;
use App\Models\StatUserNode;
use Illuminate\Support\Facades\DB;

function trafficCheck(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
}
function report(int $node, float $rate, array $data, string $at, ?string $name = '香港 · 测试节点', string $protocol = 'shadowsocks'): void {
    $job = new StatUserJob(['id' => $node, 'name' => $name, 'rate' => $rate], $data, $protocol);
    (new ReflectionProperty($job, 'receivedAt'))->setValue($job, strtotime($at));
    $job->handle();
}
$migration = require '/www/database/migrations/2026_11_27_000001_create_stat_user_nodes_table.php';
$migration->down();
$migration->up();
trafficCheck(Illuminate\Support\Facades\Schema::hasTable('v2_stat_user'), 'Additive migration rollback preserves legacy tables');
DB::beginTransaction();
$oldJob = new StatUserJob(['id' => 9000, 'name' => '旧队列', 'rate' => 1], [3 => [100, 200]], 'shadowsocks');
(new ReflectionProperty($oldJob, 'receivedAt'))->setValue($oldJob, null);
$oldJob->handle();
trafficCheck(StatUserNode::count() === 0 && StatUser::where('user_id', 3)->sum('u') == 100, 'Old queued jobs must not invent receipt timestamps');
DB::rollBack();
$day = strtotime('2026-11-26');
report(9001, 1.5, [3 => [101, 203]], '2026-11-26 23:59:01');
report(9001, 1.5, [3 => [11, 13]], '2026-11-26 23:59:59');
// Different nodes with the same rate must not merge in the detailed ledger.
report(9002, 1.5, [3 => [1000, 2000]], '2026-11-26 12:34:56', '日本 · 测试节点');
report(9001, 0, [3 => [4096, 8192]], '2026-11-26 14:00:05');
report(9001, 3, [3 => [1024, 2048]], '2026-11-26 15:00:06');
report(9001, 1.5, [2 => [333, 444]], '2026-11-26 12:00:00');
report(9001, 1.5, [3 => [9, 10]], '2026-11-27 00:00:09');
$rows = StatUserNode::where('user_id', 3)->where('record_at', $day)->get();
trafficCheck($rows->count() === 4, 'Separate node/rate buckets');
$row = $rows->first(fn ($r) => $r->server_id === 9001 && (float) $r->server_rate === 1.5);
trafficCheck($row->u === 112 && $row->d === 216, 'Raw bytes must be retained');
trafficCheck($row->billed_u === 167 && $row->billed_d === 323, 'Sum each report after integer billing, not after aggregation');
trafficCheck($row->first_report_at === strtotime('2026-11-26 23:59:01') && $row->last_report_at === strtotime('2026-11-26 23:59:59'), 'Report receipt timestamps must survive queue delay');
$legacy = StatUser::where('user_id', 3)->where('record_at', $day)->where('server_rate', 1.5)->first();
trafficCheck((int) $legacy->u === 1667 && (int) $legacy->d === 3323, 'Legacy rate totals remain compatible');
$zero = $rows->first(fn ($r) => (float) $r->server_rate === 0.0);
trafficCheck($zero->u === 4096 && $zero->d === 8192 && $zero->billed_u === 0, 'Free traffic still has raw usage');
trafficCheck(StatUserNode::where('user_id', 3)->where('record_at', strtotime('2026-11-27'))->count() === 1, 'Midnight reports belong to receipt day');
// The combined view must merge a protocol change for the same day/node/rate.
report(9001, 1.5, [3 => [5, 7]], '2026-11-26 23:58:30', '香港 · 测试节点', 'trojan');
trafficCheck(StatUserNode::where('user_id', 3)->where('record_at', $day)->count() === 5, 'Raw protocol buckets remain separate for accounting');

// A detail failure must roll back the matching legacy increment too.
$before = StatUser::where('user_id', 3)->sum('u');
try {
    report(9003, 1.5, [3 => [99, 88]], '2026-11-26 16:00:00', null);
    throw new RuntimeException('Expected an insert failure');
} catch (Illuminate\Database\QueryException $e) {
    trafficCheck((int) StatUser::where('user_id', 3)->sum('u') === (int) $before, 'Both ledgers must roll back together');
}
// Out-of-order processing must retain the earliest and latest receipt times.
report(9004, 1, [3 => [10, 20]], '2026-11-25 12:30:02', '新加坡 · 测试节点');
report(9004, 1, [3 => [10, 20]], '2026-11-25 12:00:01', '新加坡 · 测试节点');
$outOfOrder = StatUserNode::where('server_id', 9004)->first();
trafficCheck($outOfOrder->first_report_at === strtotime('2026-11-25 12:00:01') && $outOfOrder->last_report_at === strtotime('2026-11-25 12:30:02'), 'Out-of-order reports retain time bounds');
report(9004, 1, [3 => [0, 0]], '2026-11-25 13:00:00');
trafficCheck($outOfOrder->fresh()->last_report_at === $outOfOrder->last_report_at, 'Zero usage does not extend active reports');
for ($i = 1; $i <= 22; $i++) {
    report(9001, 1, [3 => [1024 * $i, 2048 * $i]], sprintf('2026-11-%02d 09:15:30', $i));
}
// A legacy-only record proves that history is not silently relabeled as node data.
StatUser::create(['user_id' => 3, 'server_rate' => 2, 'record_at' => strtotime('2026-10-20'), 'record_type' => 'd', 'u' => 2048, 'd' => 4096]);
DB::beginTransaction();
$recent = $row->replicate();
$recent->server_id = 9900;
$recent->record_at = strtotime('today');
$recent->save();
$expired = $row->replicate();
$expired->server_id = 9900;
$expired->record_at = strtotime('-3 month');
$expired->save();
(new App\Console\Commands\ResetLog())->handle();
trafficCheck(!StatUserNode::find($expired->id) && StatUserNode::find($recent->id), 'Retention removes expired node rows and keeps recent rows');
DB::rollBack();
fwrite(STDOUT, "PASS traffic nodes, rates, raw/billed totals, midnight, isolation, ordering and rollback\n");
