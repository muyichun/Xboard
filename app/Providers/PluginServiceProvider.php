<?php

namespace App\Providers;

use App\Models\Plugin;
use App\Services\Plugin\HookManager;
use App\Services\Plugin\PluginManager;
use Composer\Autoload\ClassLoader;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Octane\Events\WorkerStarting;

class PluginServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // The development deployment mounts plugin source over the official
        // image while keeping the image-provided vendor directory. Register
        // both plugin roots at runtime so core plugin support classes remain
        // autoloadable even when the image's generated Composer metadata only
        // contains the user plugin directory.
        foreach (ClassLoader::getRegisteredLoaders() as $vendorDir => $loader) {
            if (rtrim($vendorDir, '/') !== rtrim(base_path('vendor'), '/')) {
                continue;
            }

            $loader->setPsr4('Plugin\\', [
                base_path('plugins-core'),
                base_path('plugins'),
            ]);
            break;
        }

        $this->app->scoped(PluginManager::class, function ($app) {
            return new PluginManager();
        });
    }

    public function boot(): void
    {
        foreach (['plugins', 'plugins-core'] as $dir) {
            $path = base_path($dir);
            if (!file_exists($path)) {
                mkdir($path, 0755, true);
            }
        }
    }
}
