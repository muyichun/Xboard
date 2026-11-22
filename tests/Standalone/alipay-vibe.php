<?php

// No Laravel bootstrap, .env, real database, credentials or network required.
$loader = require dirname(__DIR__, 2) . '/vendor/autoload.php';
$loader->addPsr4('Plugin\\', dirname(__DIR__, 2) . '/plugins-core', true);

use App\Exceptions\ApiException;
use App\Jobs\OrderHandleJob;
use App\Models\Order;
use App\Services\PaymentService;
use App\Services\Plugin\HookManager;
use App\Services\Plugin\PluginManager;
use Illuminate\Bus\Dispatcher;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Http;
use Plugin\AlipayVibe\Commands\QueryPayment;
use Plugin\AlipayVibe\library\AlipayWeb;
use Plugin\AlipayVibe\Plugin;
use Symfony\Component\Console\Tester\CommandTester;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rejected(callable $call): void
{
    try {
        $call();
    } catch (ApiException $e) {
        return;
    }
    throw new RuntimeException('Expected payment rejection');
}

function canonical(array $params): string
{
    ksort($params, SORT_STRING);
    $pairs = [];
    foreach ($params as $key => $value) {
        if ($value !== '' && $value !== null) {
            $pairs[] = $key . '=' . $value;
        }
    }
    return implode('&', $pairs);
}

function signedNotification(array $params, OpenSSLAsymmetricKey $key): array
{
    unset($params['sign'], $params['sign_type']);
    openssl_sign(canonical($params), $signature, $key, OPENSSL_ALGO_SHA256);
    return $params + ['sign_type' => 'RSA2', 'sign' => base64_encode($signature)];
}

function signedResponse(array $result, OpenSSLAsymmetricKey $key): string
{
    $raw = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    openssl_sign($raw, $signature, $key, OPENSSL_ALGO_SHA256);
    return '{"alipay_trade_query_response":' . $raw . ',"sign":"' . base64_encode($signature) . '"}';
}

function fakeResponse(string $body, int $status = 200): void
{
    Http::swap(new Factory());
    Http::preventStrayRequests();
    Http::fake(['*' => Http::response($body, $status)]);
}

$container = new class extends Container {
    public function runningUnitTests(): bool { return true; }
};
Container::setInstance($container);
Facade::setFacadeApplication($container);
$container->instance('app', $container);
$container->instance('files', new Filesystem());
$container->instance('log', new Psr\Log\NullLogger());
$db = new Manager($container);
$db->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
$db->setAsGlobal();
$db->bootEloquent();
$container->instance('db', $db->getDatabaseManager());
$db->schema()->create('v2_order', function (Blueprint $table) {
    $table->increments('id');
    $table->string('trade_no')->unique();
    $table->integer('payment_id');
    $table->integer('total_amount');
    $table->integer('handling_amount')->nullable();
    $table->integer('status')->default(0);
    $table->string('callback_no')->nullable();
    $table->integer('paid_at')->nullable();
    $table->integer('created_at');
    $table->integer('updated_at');
});
$db->schema()->create('v2_payment', function (Blueprint $table) {
    $table->increments('id');
    $table->string('uuid');
    $table->string('payment');
    $table->text('config');
    $table->boolean('enable');
    $table->string('notify_domain')->nullable();
});

$merchantKey = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$alipayKey = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
openssl_pkey_export($merchantKey, $privatePem);
$merchantPublic = openssl_pkey_get_details($merchantKey)['key'];
$alipayPublic = openssl_pkey_get_details($alipayKey)['key'];
$config = [
    'id' => 1,
    'app_id' => '2026000000000001',
    'seller_id' => '2088000000000001',
    'private_key' => $privatePem,
    'public_key' => $alipayPublic,
    'product_name' => '测试订阅 + 额度',
    'environment' => 'sandbox'
];
$db->table('v2_payment')->insert([
    'id' => 1, 'uuid' => 'channel-one', 'payment' => 'AlipayVibe', 'enable' => true,
    'config' => json_encode($config),
]);
$db->table('v2_order')->insert([
    'trade_no' => 'test_order_001', 'payment_id' => 1, 'total_amount' => 1000, 'handling_amount' => 25,
    'created_at' => time(), 'updated_at' => time()
]);
$plugin = new Plugin('alipay_vibe');
$plugin->setConfig($config);
$plugin->boot();
check(isset(HookManager::filter('available_payment_methods', [])['AlipayVibe']), 'Payment hook registration failed');
$order = [
    'trade_no' => 'test_order_001', 'total_amount' => 1025,
    'notify_url' => 'https://panel.example/api/v1/guest/payment/notify/AlipayVibe/channel-one',
    'return_url' => 'https://panel.example/#/order/test_order_001'
];
$pay = $plugin->pay($order);
check($pay['type'] === 1 && parse_url($pay['data'], PHP_URL_HOST) === 'openapi-sandbox.dl.alipaydev.com', 'Wrong payment mode/gateway');
parse_str(parse_url($pay['data'], PHP_URL_QUERY), $params);
$signature = $params['sign'];
unset($params['sign']);
check(openssl_verify(canonical($params), base64_decode($signature), $merchantPublic, OPENSSL_ALGO_SHA256) === 1, 'Outbound signature invalid');
$business = json_decode($params['biz_content'], true);
check($params['method'] === 'alipay.trade.page.pay' && $business['product_code'] === 'FAST_INSTANT_TRADE_PAY', 'Wrong Alipay API');
check($business['total_amount'] === '10.25' && $business['subject'] === $config['product_name'], 'Wrong amount/subject');
check(strtotime($business['time_expire'] . ' Asia/Shanghai') === Order::first()->created_at + 7200, 'Payment expiry differs from Xboard order');
check($params['return_url'] === $order['return_url'] && $params['notify_url'] === $order['notify_url'], 'URLs corrupted');
check(abs(strtotime($params['timestamp'] . ' Asia/Shanghai') - time()) < 10, 'Wrong signing timezone');
check(!str_contains($pay['data'], 'PRIVATE KEY'), 'Private key leaked');

foreach ([1 => '0.01', 101 => '1.01', 9999999999 => '99999999.99', 10000000000 => '100000000.00'] as $cents => $amount) {
    check(AlipayWeb::formatAmount($cents) === $amount && AlipayWeb::parseAmount($amount) === $cents, 'Money conversion failed');
}
foreach ([0, -1, 0.5, 10000000001, '1e2', '1.00', true, []] as $bad) {
    rejected(fn() => AlipayWeb::formatAmount($bad));
}
foreach (['0', '-1', '1e2', '1.001', '01.00', ' 1', '1 ', '1.', '100000000.01'] as $bad) {
    check(AlipayWeb::parseAmount($bad) === null, 'Malformed amount accepted');
}
check(AlipayWeb::parseAmount('10') === 1000 && AlipayWeb::parseAmount('10.2') === 1020, 'Valid decimal amount rejected');

$stripPem = fn($pem) => preg_replace('/-----[^\r\n]+-----|\s+/', '', $pem);
// Use OpenSSL CLI to export a PKCS#1 fixture in memory; no key files are written.
$process = proc_open(['openssl', 'rsa', '-traditional'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes);
fwrite($pipes[0], $privatePem);
fclose($pipes[0]);
$pkcs1 = stream_get_contents($pipes[1]);
fclose($pipes[1]);
stream_get_contents($pipes[2]);
fclose($pipes[2]);
check(proc_close($process) === 0 && str_contains($pkcs1, 'RSA PRIVATE KEY'), 'PKCS#1 fixture failed');
foreach ([$privatePem, $stripPem($privatePem), $pkcs1, $stripPem($pkcs1)] as $key) {
    $variant = clone $plugin;
    $variant->setConfig(array_merge($config, ['private_key' => $key, 'public_key' => $stripPem($alipayPublic), 'environment' => 'production']));
    $result = $variant->pay($order);
    check(parse_url($result['data'], PHP_URL_HOST) === 'openapi.alipay.com', 'Production gateway/key format failed');
    parse_str(parse_url($result['data'], PHP_URL_QUERY), $signed);
    $sig = $signed['sign'];
    unset($signed['sign']);
    check(openssl_verify(canonical($signed), base64_decode($sig), $merchantPublic, OPENSSL_ALGO_SHA256) === 1, 'Key format produced invalid signature');
}
foreach (['private_key' => 'invalid', 'public_key' => 'invalid', 'app_id' => '', 'seller_id' => '', 'environment' => 'prod'] as $field => $value) {
    rejected(fn() => new AlipayWeb(array_merge($config, [$field => $value])));
}
$db->table('v2_order')->update(['created_at' => time() - 7200]);
rejected(fn() => $plugin->pay($order));
$db->table('v2_order')->update(['created_at' => time()]);
$invalidProduct = clone $plugin;
$invalidProduct->setConfig(array_merge($config, ['product_name' => 'A&B']));
rejected(fn() => $invalidProduct->pay($order));
echo "PASS: plugin registration, page payment, RSA2, PEM/Base64 PKCS#1/PKCS#8, environments, money\n";

$notification = [
    'app_id' => $config['app_id'], 'seller_id' => $config['seller_id'],
    'out_trade_no' => $order['trade_no'], 'trade_no' => '20261122000000001',
    'trade_status' => 'TRADE_SUCCESS', 'total_amount' => '10.25',
    'subject' => '中文 + %2B & =', 'optional_empty' => null
];
$signed = signedNotification($notification, $alipayKey);
$expected = ['trade_no' => $order['trade_no'], 'callback_no' => $notification['trade_no']];
check($plugin->notify($signed) === $expected && $plugin->notify($signed) === $expected, 'Valid/repeated notification rejected');
check($plugin->notify(signedNotification(array_merge($notification, ['trade_status' => 'TRADE_FINISHED']), $alipayKey)) === $expected, 'TRADE_FINISHED rejected');
foreach ([
    ['app_id' => 'other'], ['seller_id' => 'other'], ['out_trade_no' => 'unknown'],
    ['total_amount' => '10.24'], ['total_amount' => '10.00'], ['total_amount' => '1.025e1'],
    ['trade_status' => 'WAIT_BUYER_PAY'], ['trade_status' => 'TRADE_CLOSED'], ['trade_no' => '']
] as $changes) {
    check($plugin->notify(signedNotification(array_merge($notification, $changes), $alipayKey)) === false, 'Mismatched signed notification accepted');
}
foreach ([null, '', [], array_merge($signed, ['total_amount' => '10.26']), array_merge($signed, ['sign_type' => 'RSA']),
    array_merge($signed, ['sign' => '%%%']), array_merge($signed, ['nested' => []]), signedNotification($notification, $merchantKey)] as $bad) {
    check($plugin->notify($bad) === false, 'Untrusted notification accepted');
}
$other = clone $plugin;
$other->setConfig(array_merge($config, ['id' => 2]));
check($other->notify($signed) === false, 'Cross-channel callback accepted');
check($plugin->notify($signed) === $expected, 'Plugin clone leaked config');
check(Order::first()->status === 0, 'Verifier mutated order');
echo "PASS: notifications, tampering, merchant/app/channel/amount checks, duplicate verification, isolation\n";

$queryResult = [
    'code' => '10000', 'msg' => 'Success', 'out_trade_no' => $order['trade_no'],
    'trade_no' => $notification['trade_no'], 'trade_status' => 'TRADE_SUCCESS', 'total_amount' => '10.25',
    'nested' => [['name' => '中文 } { " \\ /', 'amount' => 10.25]]
];
$body = signedResponse($queryResult, $alipayKey);
fakeResponse($body);
check($plugin->query($order['trade_no']) === $expected, 'Signed query failed');
check(Http::recorded(function ($request) use ($merchantPublic, $order) {
    $params = $request->data();
    $sig = $params['sign'];
    unset($params['sign']);
    return $request->method() === 'POST' && $params['method'] === 'alipay.trade.query'
        && json_decode($params['biz_content'], true)['out_trade_no'] === $order['trade_no']
        && openssl_verify(canonical($params), base64_decode($sig), $merchantPublic, OPENSSL_ALGO_SHA256) === 1;
})->count() === 1, 'Query request signature invalid');
foreach ([['out_trade_no' => 'other'], ['total_amount' => '10.24'], ['trade_status' => 'WAIT_BUYER_PAY']] as $change) {
    fakeResponse(signedResponse(array_merge($queryResult, $change), $alipayKey));
    check($plugin->query($order['trade_no']) === false, 'Query mismatch accepted');
}
foreach ([str_replace('10.25', '10.26', $body), '{}', 'not JSON', signedResponse($queryResult, $merchantKey),
    signedResponse(['code' => '40004', 'sub_code' => 'ACQ.TRADE_NOT_EXIST'], $alipayKey),
    substr($body, 0, -1) . ',"alipay_trade_query_response":{}}'] as $bad) {
    fakeResponse($bad);
    rejected(fn() => $plugin->query($order['trade_no']));
}
fakeResponse($body, 500);
rejected(fn() => $plugin->query($order['trade_no']));
Http::swap(new Factory());
Http::preventStrayRequests();
Http::fake(fn() => throw new Illuminate\Http\Client\ConnectionException('simulated failure'));
rejected(fn() => $plugin->query($order['trade_no']));
echo "PASS: signed query, raw JSON verification, request signature, failures and forged responses\n";

// Exercise the real PaymentService clone/config path with an isolated plugin manager.
$plugins = new class($plugin) extends PluginManager {
    public function __construct(private Plugin $testPlugin) {}
    public function getEnabledPaymentPlugins(): array { return [$this->testPlugin]; }
};
$container->instance(PluginManager::class, $plugins);
check((new PaymentService('AlipayVibe', null, 'channel-one'))->notify($signed) === $expected, 'PaymentService integration failed');
$form = (new PaymentService('AlipayVibe', 1))->form();
check($form['environment']['value'] === 'sandbox' && isset($form['seller_id']), 'Admin form failed');

// Real OrderService::paid with an in-memory bus handler, never real subscription jobs.
$handler = new class {
    public int $calls = 0;
    public function handle(OrderHandleJob $job): void { $this->calls++; }
};
$container->instance('test.order.handler', $handler);
$bus = new Dispatcher($container);
$bus->map([OrderHandleJob::class => 'test.order.handler']);
$container->instance(Illuminate\Contracts\Bus\Dispatcher::class, $bus);
$runCommand = function (bool $sync = false) use ($container): CommandTester {
    $command = new QueryPayment();
    $command->setLaravel($container);
    $tester = new CommandTester($command);
    $tester->execute(['trade_no' => 'test_order_001'] + ($sync ? ['--sync' => true] : []));
    return $tester;
};
fakeResponse($body);
check($runCommand()->getStatusCode() === 0 && Order::first()->status === 0 && $handler->calls === 0, 'Read-only query changed order');
check($runCommand(true)->getStatusCode() === 0 && Order::first()->status === 1 && $handler->calls === 1, 'Sync failed');
check(Order::first()->callback_no === $notification['trade_no'], 'Wrong callback number saved');
$runCommand(true);
check($handler->calls === 1, 'Repeated sync dispatched duplicate fulfillment');
$db->table('v2_order')->update(['status' => 2]);
$runCommand(true);
check(Order::first()->status === 2 && $handler->calls === 1, 'Sync reopened cancelled order');
echo "PASS: PaymentService/admin integration, read-only query, sync, duplicate sync and cancelled orders\n";

$db->table('v2_order')->update(['status' => 0, 'callback_no' => null, 'paid_at' => null]);
$handler->calls = 0;
$controller = new App\Http\Controllers\V1\Guest\PaymentController();
$request = Illuminate\Http\Request::create($order['notify_url'], 'POST', $signed);
check($controller->notify('AlipayVibe', 'channel-one', $request) === 'success', 'Callback did not acknowledge success');
check(Order::first()->status === 1 && $handler->calls === 1, 'Callback did not dispatch fulfillment');
check($controller->notify('AlipayVibe', 'channel-one', $request) === 'success' && $handler->calls === 1, 'Duplicate callback dispatched fulfillment again');
echo "PASS: existing callback controller acknowledgment and idempotent fulfillment dispatch\n";
