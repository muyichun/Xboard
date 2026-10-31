<?php

// Run with: php tests/Regression/server_certificate_config.php
// Only an in-memory SQLite database is used; Laravel's application is not booted.
require getenv('XBOARD_TEST_AUTOLOAD') ?: __DIR__ . '/../../vendor/autoload.php';
require getenv('XBOARD_TEST_CONTROLLER') ?: __DIR__ . '/../../app/Http/Controllers/V2/Admin/Server/ManageController.php';

use App\Http\Controllers\V2\Admin\Server\ManageController;
use App\Http\Requests\Admin\ServerSave;
use App\Models\Server;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;
use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory;

$container = new Container();
Container::setInstance($container);
Facade::setFacadeApplication($container);
$container->instance('cache', new Repository(new ArrayStore()));
// JSON responses do not need the factory's view or redirect services.
$container->instance(
    Illuminate\Contracts\Routing\ResponseFactory::class,
    (new ReflectionClass(Illuminate\Routing\ResponseFactory::class))->newInstanceWithoutConstructor()
);
$database = new Manager($container);
$database->addConnection(['driver' => 'sqlite', 'database' => ':memory:']);
$database->setAsGlobal();
$database->bootEloquent();
$database->schema()->create('v2_server', function (Blueprint $table) {
    $table->increments('id');
    $table->string('type');
    $table->string('name')->nullable();
    $table->string('host')->nullable();
    $table->integer('port')->nullable();
    $table->integer('server_port')->nullable();
    $table->float('rate')->default(1);
    $table->integer('sort')->default(0);
    $table->integer('parent_id')->nullable();
    $table->json('group_ids')->nullable();
    $table->json('cert_config')->nullable();
    $table->json('protocol_settings')->nullable();
    $table->integer('created_at')->nullable();
    $table->integer('updated_at')->nullable();
});
$database->schema()->create('v2_server_group', function (Blueprint $table) {
    $table->increments('id');
    $table->string('name');
});

$controller = new ManageController();
$validation = new Factory(new Translator(new ArrayLoader(), 'en'));
$certificate = ['cert_mode' => 'self', 'domain' => 'hy2.test'];

$existingCertificate = [
    'cert_mode' => 'dns', 'domain' => 'existing.example.com',
    'dns_provider' => 'cloudflare', 'dns_env' => ['CF_DNS_API_TOKEN' => 'test-only-token'],
];
foreach ([null, '[]', '{}', json_encode($certificate), json_encode($existingCertificate)] as $stored) {
    $database->table('v2_server')->delete();
    $id = $database->table('v2_server')->insertGetId([
        'type' => 'hysteria', 'cert_config' => $stored, 'protocol_settings' => '{"version":2}',
    ]);
    $node = $controller->getNodes(new Request())->getData()->data[0];
    if (!$node->cert_config instanceof stdClass) {
        throw new RuntimeException('Certificate configuration must serialize as an object: ' . var_export($stored, true));
    }
    $original = json_decode($stored ?? '{}', true);
    if (json_decode(json_encode($node->cert_config), true) !== $original) {
        throw new RuntimeException('Reading the node changed existing certificate settings');
    }
    $node->cert_config->cert_mode = 'self';
    $node->cert_config->domain = 'hy2.test';
    $payload = json_decode(json_encode($node), true);
    $payload = array_replace($payload, [
        'name' => 'Hy2 test', 'host' => '127.0.0.1', 'port' => 443,
        'server_port' => 443, 'rate' => 1, 'protocol_settings' => ['version' => 2],
    ]);
    $request = ServerSave::create('/', 'POST', $payload);
    $request->setValidator($validation->make($payload, $request->rules()));
    $response = $controller->save($request);
    $expected = array_replace($original, $certificate);
    if ($response->getStatusCode() !== 200 || Server::findOrFail($id)->cert_config !== $expected) {
        throw new RuntimeException('Certificate configuration was lost during save');
    }
    $reopened = $controller->getNodes(new Request())->getData()->data[0];
    if (json_decode(json_encode($reopened->cert_config), true) !== $expected) {
        throw new RuntimeException('Certificate configuration was lost when reopening the editor');
    }
}

echo "PASS: null, [], {}, self-signed and DNS certificates survive list/edit/save/reopen.\n";
