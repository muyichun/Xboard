<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>{{ $title }} · 管理控制台</title>
  <script>
    window.settings = {{ Illuminate\Support\Js::from(['base_url' => '/', 'title' => $title, 'version' => $version, 'logo' => $logo, 'secure_path' => $secure_path]) }};
  </script>
  @php
    $manifestPath = public_path('assets/admin-next/manifest.json');
    $manifest = is_file($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
    $entry = $manifest['index.html'] ?? null;
    abort_unless(is_array($entry) && !empty($entry['file']), 503, '新版管理端资源尚未构建');
    $styles = [];
    $visited = [];
    $collectStyles = function ($name) use (&$collectStyles, &$manifest, &$styles, &$visited) {
      if (isset($visited[$name]) || !isset($manifest[$name])) {
        return;
      }
      $visited[$name] = true;
      foreach ($manifest[$name]['imports'] ?? [] as $import) {
        $collectStyles($import);
      }
      foreach ($manifest[$name]['css'] ?? [] as $css) {
        $styles[$css] = $css;
      }
    };
    $collectStyles('index.html');
  @endphp
  @foreach($styles as $css)
    <link rel="stylesheet" crossorigin href="/assets/admin-next/{{ $css }}" />
  @endforeach
  <script type="module" crossorigin src="/assets/admin-next/{{ $entry['file'] }}"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
