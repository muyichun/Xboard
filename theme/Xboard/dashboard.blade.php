<!doctype html>
<html lang="zh-CN">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" />
  <title>{{$title}}</title>
  <link rel="stylesheet" href="/theme/{{$theme}}/assets/auth-v1.css?v={{ urlencode($version) }}" />
  <script type="module" crossorigin src="/theme/{{$theme}}/assets/umi.js"></script>
</head>

<body>

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
      promoDescription: @json($theme_config['auth_promo_description'] ?? '覆盖全球的高速网络，让工作、学习和娱乐始终保持流畅。'),
      features: [
        @json($theme_config['auth_promo_feature_1'] ?? '全球网络覆盖'),
        @json($theme_config['auth_promo_feature_2'] ?? '智能线路选择'),
        @json($theme_config['auth_promo_feature_3'] ?? '多平台支持')
      ]
    }
  </script>
  <div id="app"></div>
  <script defer src="/theme/{{$theme}}/assets/auth-v1.js?v={{ urlencode($version) }}"></script>
  {!! $theme_config['custom_html'] !!}
</body>

</html>
