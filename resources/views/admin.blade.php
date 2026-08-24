<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ $title }}</title>
  <script>
    window.settings = {
      base_url: "/",
      title: "{{ $title }}",
      version: "{{ $version }}",
      logo: "{{ $logo }}",
      secure_path: "{{ $secure_path }}",
    };

    // 除 localhost 外，浏览器不会在非 HTTPS 页面开放 Clipboard API。
    // 为通过 IP + HTTP 访问的开发服务器保留复制功能。
    if (!navigator.clipboard?.writeText) {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText(text) {
            return new Promise((resolve, reject) => {
              const textarea = document.createElement('textarea');
              textarea.value = String(text);
              textarea.setAttribute('readonly', '');
              textarea.style.position = 'fixed';
              textarea.style.opacity = '0';
              textarea.style.pointerEvents = 'none';
              document.body.appendChild(textarea);
              textarea.focus();
              textarea.select();
              textarea.setSelectionRange(0, textarea.value.length);

              let copyEventHandled = false;
              const handleCopy = (event) => {
                if (!event.clipboardData) {
                  return;
                }

                event.preventDefault();
                event.clipboardData.setData('text/plain', textarea.value);
                copyEventHandled = true;
              };
              document.addEventListener('copy', handleCopy, { once: true });

              try {
                if (!document.execCommand('copy') || !copyEventHandled) {
                  throw new Error('Copy command was rejected');
                }
                resolve();
              } catch (error) {
                reject(error);
              } finally {
                document.removeEventListener('copy', handleCopy);
                textarea.remove();
              }
            });
          },
        },
      });
    }
  </script>
  @php
    $manifestPath = public_path('assets/admin/manifest.json');
    $manifest = file_exists($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
    $entry = is_array($manifest) ? ($manifest['index.html'] ?? null) : null;
    $scripts = [];
    $styles = [];
    $locales = [];

    if (is_array($entry)) {
      $visited = [];
      $collectAssets = function ($chunkName) use (&$collectAssets, &$manifest, &$visited, &$scripts, &$styles) {
        if (isset($visited[$chunkName]) || !isset($manifest[$chunkName]) || !is_array($manifest[$chunkName])) {
          return;
        }

        $visited[$chunkName] = true;
        $chunk = $manifest[$chunkName];

        if (!empty($chunk['css']) && is_array($chunk['css'])) {
          foreach ($chunk['css'] as $cssFile) {
            $styles[$cssFile] = $cssFile;
          }
        }

        if (!empty($chunk['imports']) && is_array($chunk['imports'])) {
          foreach ($chunk['imports'] as $import) {
            $collectAssets($import);
          }
        }

        if (!empty($chunk['isEntry']) && !empty($chunk['file'])) {
          $scripts[$chunk['file']] = $chunk['file'];
        }
      };

      $collectAssets('index.html');
    }

    foreach (glob(public_path('assets/admin/locales/*.js')) ?: [] as $localeFile) {
      $locales[] = 'locales/' . basename($localeFile);
    }
    sort($locales);
  @endphp

  @if($entry && count($scripts) > 0)
    @foreach($styles as $css)
      <link rel="stylesheet" crossorigin href="/assets/admin/{{ $css }}" />
    @endforeach
    @foreach($locales as $locale)
      <script src="/assets/admin/{{ $locale }}"></script>
    @endforeach
    @foreach($scripts as $js)
      <script type="module" crossorigin src="/assets/admin/{{ $js }}"></script>
    @endforeach
  @else
    {{-- Fallback: hardcoded paths for backward compatibility --}}
    <script type="module" crossorigin src="/assets/admin/assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/admin/assets/index.css" />
    <link rel="stylesheet" crossorigin href="/assets/admin/assets/vendor.css">
    <script src="/assets/admin/locales/en-US.js"></script>
    <script src="/assets/admin/locales/zh-CN.js"></script>
    <script src="/assets/admin/locales/ko-KR.js"></script>
  @endif
</head>

<body>
  <div id="root"></div>
</body>

</html>
