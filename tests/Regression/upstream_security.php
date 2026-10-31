<?php

// php tests/Regression/upstream_security.php
// No application bootstrap, network calls, production credentials, or disk database.
require __DIR__ . '/../../vendor/autoload.php';

use App\Exceptions\ApiException;
use App\Http\Middleware\Client;
use App\Models\User;
use App\Protocols\QuantumultX;
use App\Services\PaymentService;
use App\Services\Plugin\PluginManager;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function rejected(callable $call, string $message): void
{
    try {
        $call();
    } catch (ApiException $e) {
        check($e->getMessage() === $message, 'Unexpected rejection: ' . $e->getMessage());
        return;
    }
    throw new RuntimeException('Expected rejection: ' . $message);
}

$container = new Container();
Container::setInstance($container);
Facade::setFacadeApplication($container);
$container->instance('app', $container);
$container->instance('files', new Filesystem());
$container->instance('validator', new Factory(new Translator(new ArrayLoader(), 'en')));
$auth = new class {
    public ?User $user = null;
    public function setUser(User $user): void { $this->user = $user; }
};
$container->instance('auth', $auth);
$db = new Manager($container);
$db->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
$db->setAsGlobal();
$db->bootEloquent();
$db->schema()->create('v2_user', function (Blueprint $table) {
    $table->increments('id');
    $table->string('token');
});
$token = str_repeat('a', 32);
$otherToken = str_repeat('b', 32);
$db->table('v2_user')->insert([['token' => $token], ['token' => $otherToken]]);
$middleware = new Client();
$next = fn() => 'accepted';
check($middleware->handle(Request::create('/subscribe', 'GET', ['token' => $token]), $next) === 'accepted', 'Query subscription rejected');
check($auth->user->token === $token, 'Wrong query user');
$request = Request::create('/s/' . $token . '?token=' . $otherToken);
$route = (new Route('GET', 's/{token}', fn() => null))->bind($request);
$request->setRouteResolver(fn() => $route);
$middleware->handle($request, $next);
check($auth->user->token === $token, 'Query token overrode route token');
foreach ([true, 123, [$token], ['nested' => $token], 'bad', str_repeat('g', 32), $token . "\n"] as $invalid) {
    rejected(fn() => $middleware->handle(Request::create('/subscribe', 'GET', ['token' => $invalid]), $next), 'token is error');
}
rejected(fn() => $middleware->handle(Request::create('/subscribe', 'GET'), $next), 'token is null');
rejected(fn() => $middleware->handle(Request::create('/subscribe', 'POST', ['token' => $token]), $next), 'token is null');
rejected(fn() => $middleware->handle(Request::create('/subscribe', 'GET', ['token' => str_repeat('c', 32)]), $next), 'token is error');
echo "PASS: subscription formats, route precedence, body rejection, malformed and unknown tokens\n";

$plugins = new class extends PluginManager {
    public function __construct()
    {
        $this->corePluginPath = __DIR__ . '/../../plugins-core';
        $this->pluginPath = '/nonexistent-test-plugins';
    }
    public function loadForTest(string $code) { return $this->loadPlugin($code); }
    public function getEnabledPaymentPlugins(): array { return array_values($this->loadedPlugins); }
};
$container->instance(PluginManager::class, $plugins);
// An installed copy must not win through Composer/autoload before core resolution.
$trap = function ($class) {
    if ($class === 'Plugin\\Epay\\Plugin') {
        throw new RuntimeException('Plugin manager invoked autoload before resolving the core plugin');
    }
};
spl_autoload_register($trap, true, true);
try { $epay = $plugins->loadForTest('Epay'); } finally { spl_autoload_unregister($trap); }
$mgate = $plugins->loadForTest('Mgate');
$alipay = $plugins->loadForTest('AlipayF2f');
foreach ([$epay, $mgate, $alipay] as $plugin) { $plugin->boot(); }
echo "PASS: core plugin resolution precedes autoload\n";

$db->schema()->create('v2_payment', function (Blueprint $table) {
    $table->increments('id');
    $table->string('uuid');
    $table->string('payment');
    $table->json('config');
    $table->boolean('enable')->default(true);
});
function paymentId(string $method, array $config): int
{
    return Manager::table('v2_payment')->insertGetId([
        'uuid' => uniqid('test-', true), 'payment' => $method, 'config' => json_encode($config),
    ]);
}
function epayCallback(string $secret, array $overrides = []): array
{
    $params = array_replace(['pid' => '100', 'out_trade_no' => 'test-order', 'trade_no' => 'test-callback', 'trade_status' => 'TRADE_SUCCESS'], $overrides);
    ksort($params);
    $params['sign'] = md5(stripslashes(urldecode(http_build_query($params))) . $secret);
    $params['sign_type'] = 'MD5';
    return $params;
}
$firstId = paymentId('EPay', ['pid' => '100', 'key' => 'first-test-secret']);
$secondId = paymentId('EPay', ['pid' => '100', 'key' => 'second-test-secret']);
$first = new PaymentService('EPay', $firstId);
$second = new PaymentService('EPay', $secondId);
check(is_array($first->notify(epayCallback('first-test-secret'))), 'First payment config was overwritten');
check(is_array($second->notify(epayCallback('second-test-secret'))), 'Second payment callback rejected');
check($first->notify(epayCallback('second-test-secret')) === false, 'Wrong account signature accepted');
check($epay->getConfig('key') === null, 'Shared plugin configuration mutated');
rejected(fn() => (new PaymentService('MGate', $firstId))->notify([]), 'payment method mismatch');
rejected(fn() => new PaymentService('Unavailable', $firstId), 'payment method is unavailable');
$badConfigId = $db->table('v2_payment')->insertGetId(['uuid' => 'bad-config', 'payment' => 'EPay', 'config' => '"not-an-object"']);
rejected(fn() => new PaymentService('EPay', $badConfigId), 'invalid payment config');
$db->table('v2_payment')->where('id', $secondId)->update(['enable' => false]);
rejected(fn() => (new PaymentService('EPay', $secondId))->notify(epayCallback('second-test-secret')), 'gate is not enable');
foreach ([['pid' => '999'], ['trade_status' => 'WAIT_BUYER_PAY'], ['out_trade_no' => ''], ['trade_no' => '']] as $bad) {
    check($first->notify(epayCallback('first-test-secret', $bad)) === false, 'Invalid Epay fields accepted');
}
foreach ([['sign' => []], ['money' => []], ['sign_type' => 'RSA']] as $bad) {
    check($first->notify(array_replace(epayCallback('first-test-secret'), $bad)) === false, 'Malformed Epay callback accepted');
}
$empty = new PaymentService('EPay', paymentId('EPay', ['pid' => '100', 'key' => '']));
check($empty->notify(epayCallback('')) === false, 'Empty Epay secret accepted');
$mgateId = paymentId('MGate', ['mgate_app_secret' => 'mgate-test-secret']);
$mgateService = new PaymentService('MGate', $mgateId);
$mgateParams = ['out_trade_no' => 'test-order', 'trade_no' => 'test-callback'];
ksort($mgateParams);
$mgateParams['sign'] = md5(http_build_query($mgateParams) . 'mgate-test-secret');
check(is_array($mgateService->notify($mgateParams)), 'Valid Mgate callback rejected');
foreach ([['sign' => 'bad'], ['sign' => []], ['trade_no' => ''], ['nested' => []]] as $bad) {
    check($mgateService->notify(array_replace($mgateParams, $bad)) === false, 'Malformed Mgate callback accepted');
}
$emptyMgate = new PaymentService('MGate', paymentId('MGate', ['mgate_app_secret' => '']));
check($emptyMgate->notify($mgateParams) === false, 'Empty Mgate secret accepted');
echo "PASS: payment method binding, config isolation, Epay/Mgate verification and invalid inputs\n";

// Exercise the production payment type with throwaway RSA keys; never call Alipay.
$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
check($key !== false, 'Cannot generate test RSA key');
$publicKey = openssl_pkey_get_details($key)['key'];
$publicKey = preg_replace('/-----[^-]+-----|\s/', '', $publicKey);
$alipayService = new PaymentService('AlipayF2F', paymentId('AlipayF2F', ['app_id' => 'test-app', 'public_key' => $publicKey]));
$params = ['app_id' => 'test-app', 'out_trade_no' => 'test-order', 'trade_no' => 'test-callback', 'trade_status' => 'TRADE_SUCCESS'];
ksort($params);
openssl_sign(urldecode(http_build_query($params)), $signature, $key, OPENSSL_ALGO_SHA256);
$params['sign'] = base64_encode($signature);
$params['sign_type'] = 'RSA2';
check(is_array($alipayService->notify($params)), 'Valid AlipayF2F signature rejected');
$params['out_trade_no'] = 'tampered-order';
check($alipayService->notify($params) === false, 'Tampered AlipayF2F signature accepted');
echo "PASS: AlipayF2F valid RSA2 and tampered callbacks\n";

$server = ['host' => '127.0.0.1', 'port' => 443, 'type' => 'vmess', 'name' => 'test', 'protocol_settings' => []];
check(str_contains(QuantumultX::buildVmess('test-uuid', $server), 'method=chacha20-poly1305,'), 'Unsupported default VMess cipher');
$server['protocol_settings']['cipher'] = 'aes-128-gcm';
check(str_contains(QuantumultX::buildVmess('test-uuid', $server), 'method=aes-128-gcm,'), 'Explicit VMess cipher changed');
echo "PASS: Quantumult X default and explicit VMess cipher\n";
