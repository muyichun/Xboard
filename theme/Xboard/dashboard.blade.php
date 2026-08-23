<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" />
  <title>{{$title}}</title>
  <link rel="stylesheet" href="/theme/{{$theme}}/assets/auth-v1.css?v={{ urlencode($version) }}" />
  <script>
    // The auth pages are restyled after the bundle mounts, so pre-paint the
    // dark ground on those routes to avoid a flash of the stock white card.
    // auth-v1.js clears this once it has run; the timeout clears it anyway if
    // the bundle ever stops matching its selectors, so the page can't be left
    // invisible.
    (function () {
      var path = window.location.hash.replace(/^#/, '').split('?')[0] || window.location.pathname
      if (/^\/(login|register|forgetpassword)$/.test(path)) {
        document.documentElement.classList.add('xb-auth-boot')
        window.setTimeout(function () {
          document.documentElement.classList.remove('xb-auth-boot')
        }, 2500)
      }
    })()
  </script>
  <script type="module" crossorigin src="/theme/{{$theme}}/assets/umi.js"></script>
</head>

<body>

  @php
    $authPromoTags = array_values(array_filter(array_map(
      'trim',
      explode(',', $theme_config['auth_promo_tags'] ?? '学术研究,影音娱乐,跨境电商')
    )));
  @endphp

  <script>
    window.routerBase = "/";
    window.settings = {
      title: '{{$title}}',
      assets_path: '/theme/{{$theme}}/assets',
      theme: {
        color: '{{ $theme_config['theme_color'] ?? "default" }}',
      },
      version: '{{$version}}',
      background_url: '{{$theme_config['background_url']}}',
      description: '{{$description}}',
      i18n: [
        'zh-CN',
        'en-US',
        'ja-JP',
        'vi-VN',
        'ko-KR',
        'zh-TW',
        'fa-IR'
      ],
      logo: '{{$logo}}'
    }

    window.authPageV1 = {
      promoBadge: @json($theme_config['auth_promo_badge'] ?? '全球智能网络'),
      promoTitle: @json($theme_config['auth_promo_title'] ?? '稳定连接，从这里出发'),
      promoDescription: @json($theme_config['auth_promo_description'] ?? '助力学术研究、娱乐与跨境电商。全球多地节点服务器均采用先进 TCP 加速技术部署，国内访问加速、跨境专线直连，多重负载均衡，致力确保服务稳定运行。'),
      tags: @json($authPromoTags),
      features: [
        @json($theme_config['auth_promo_feature_1'] ?? '全球多地节点'),
        @json($theme_config['auth_promo_feature_2'] ?? 'TCP 加速技术'),
        @json($theme_config['auth_promo_feature_3'] ?? '跨境专线直连'),
        @json($theme_config['auth_promo_feature_4'] ?? '多重负载均衡')
      ],
      copyright: @json($theme_config['auth_copyright'] ?? '© 2026–2030 即享云 Network · Accelerating the Intelligent Future.')
    }
  </script>
  <div id="app"></div>
  <script defer src="/theme/{{$theme}}/assets/auth-v1.js?v={{ urlencode($version) }}"></script>
  {!! $theme_config['custom_html'] !!}
</body>

</html>
