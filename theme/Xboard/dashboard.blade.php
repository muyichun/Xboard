<!doctype html>
<html lang="zh-CN" class="xb-routing">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no" />
  <meta name="description" content="{{$description}}" />
  <title>{{$title}}</title>
  <link rel="preload" as="image" type="image/png" fetchpriority="high" href="/theme/{{$theme}}/assets/images/global-nodes.png?v=ui14" />
  <link rel="stylesheet" href="/theme/{{$theme}}/assets/auth-app.css?v={{ urlencode($version) }}-ui20" />
</head>

<body>
  @php
    $navigationUrl = trim($theme_config['navigation_url'] ?? '') ?: 'https://go.myjxcloud.com';
    if (!preg_match('/^https?:\/\//i', $navigationUrl)) {
      $navigationUrl = 'https://' . ltrim($navigationUrl, '/');
    }
    if (!filter_var($navigationUrl, FILTER_VALIDATE_URL)) {
      $navigationUrl = 'https://go.myjxcloud.com';
    }
    $navigationLabel = trim($theme_config['navigation_label'] ?? '') ?: '永久导航';
    $navigationHost = parse_url($navigationUrl, PHP_URL_HOST) ?: 'go.myjxcloud.com';
  @endphp
  <script>
    window.routerBase = "/";
    window.settings = {
      title: @json($title),
      assets_path: '/theme/{{$theme}}/assets',
      theme: {
        color: '{{ $theme_config['theme_color'] ?? "default" }}',
      },
      version: @json($version),
      background_url: @json($theme_config['background_url'] ?? ''),
      description: @json($description),
      i18n: [
        'zh-CN',
        'en-US',
        'ja-JP',
        'vi-VN',
        'ko-KR',
        'zh-TW',
        'fa-IR'
      ],
      logo: @json($logo)
    };
    window.__XB_AUTH_ASSET_BASE__ = '/theme/{{$theme}}/assets';
  </script>

  <div class="xb-auth-root" data-auth-root hidden>
    <header class="xb-auth-header">
      <a class="xb-auth-brand" href="#/login" aria-label="{{$title}}登录首页">
        <img
          class="xb-auth-brand__logo"
          src="{{ $logo ?: '/theme/' . $theme . '/assets/images/logo.jpg' }}"
          alt=""
        />
        <span class="xb-auth-brand__name">{{$title}}</span>
      </a>

      <nav class="xb-auth-nav" aria-label="用户入口导航">
        <button class="is-active" type="button" data-nav-key="home">首页</button>
        <button type="button" data-nav-key="nodes">全球节点</button>
      </nav>

      @if((string) ($theme_config['navigation_enable'] ?? '1') !== '0')
        <a
          class="xb-site-guide"
          href="{{ $navigationUrl }}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="{{ $navigationLabel }}（新窗口打开）"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M14.9 9.1 13 13l-3.9 1.9L11 11l3.9-1.9Z"></path>
          </svg>
          <span>{{ $navigationLabel }}</span>
          <small>{{ $navigationHost }}</small>
          <svg class="xb-site-guide__arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"></path>
          </svg>
        </a>
      @endif

      <div class="xb-language" data-language>
        <button
          class="xb-language__trigger"
          type="button"
          aria-label="切换界面语言"
          aria-haspopup="menu"
          aria-expanded="false"
          data-language-trigger
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.6"></circle>
            <path d="M3.4 12h17.2M12 3.4c2.3 2.5 3.5 5.4 3.5 8.6s-1.2 6.1-3.5 8.6c-2.3-2.5-3.5-5.4-3.5-8.6S9.7 5.9 12 3.4Z"></path>
          </svg>
          <span data-language-label>简体中文</span>
          <svg class="xb-language__chevron" viewBox="0 0 14 8" aria-hidden="true">
            <path d="m1 1 6 6 6-6"></path>
          </svg>
        </button>
        <div class="xb-language__menu" role="menu" data-language-menu hidden></div>
      </div>
    </header>

    <aside class="xb-auth-promo" aria-label="即享云全球网络宣传图">
      <img
        src="/theme/{{$theme}}/assets/images/auth-login-reference.png?v=ui14"
        alt=""
        aria-hidden="true"
        draggable="false"
        data-page-artwork
      />
    </aside>

    <main class="xb-mobile-nodes" aria-label="全球节点">
      <section class="xb-mobile-nodes__hero">
        <p>GLOBAL NETWORK</p>
        <h1>全球节点</h1>
        <span>高速访问 · 优质线路 · 稳定连接</span>
      </section>

      <section class="xb-mobile-nodes__section">
        <div class="xb-mobile-nodes__heading">
          <h2>热门节点</h2>
          <small>已上线</small>
        </div>
        <div class="xb-mobile-nodes__grid">
          <article><b>HK</b><span>香港</span><small>高速稳定</small></article>
          <article><b>KR</b><span>韩国</span><small>低延迟线路</small></article>
          <article><b>JP</b><span>日本</span><small>优质网络</small></article>
          <article><b>SG</b><span>新加坡</span><small>跨境直连</small></article>
          <article><b>US</b><span>美国</span><small>全球应用</small></article>
          <article><b>EU</b><span>欧洲</span><small>多地覆盖</small></article>
        </div>
      </section>

      <section class="xb-mobile-nodes__section">
        <div class="xb-mobile-nodes__heading"><h2>网络优势</h2></div>
        <div class="xb-mobile-nodes__advantages">
          <article><b>◎</b><div><span>智能线路调度</span><small>自动选择更稳定的连接路径</small></div></article>
          <article><b>⚡</b><div><span>低延迟传输</span><small>满足影音、办公与日常访问</small></div></article>
          <article><b>◇</b><div><span>安全可靠</span><small>全球优质运营商线路直连</small></div></article>
        </div>
      </section>
    </main>

    <main class="xb-auth-stage" data-auth-stage>
      <section class="xb-auth-card" data-auth-card aria-live="polite"></section>
    </main>

    <div class="xb-toast-region" data-toast-region aria-live="polite" aria-atomic="true"></div>

    <dialog class="xb-captcha-dialog" data-captcha-dialog>
      <button class="xb-captcha-dialog__close" type="button" aria-label="关闭" data-captcha-close>×</button>
      <strong data-captcha-title>请完成人机验证</strong>
      <div class="xb-captcha-dialog__widget" data-captcha-widget></div>
    </dialog>
  </div>

  <div id="app"></div>
  <div class="xb-route-loader" data-route-loader hidden aria-live="polite">
    <span aria-hidden="true"></span>
    <p data-route-loader-label>正在进入用户中心…</p>
  </div>
  <script src="/theme/{{$theme}}/assets/auth-app.js?v={{ urlencode($version) }}-ui15"></script>
  {!! $theme_config['custom_html'] ?? '' !!}
</body>

</html>
