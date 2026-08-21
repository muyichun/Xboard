(function () {
  'use strict'

  const AUTH_ROUTES = new Set(['/login', '/register', '/forgetpassword'])
  const copy = window.authPageV1 || {}
  let scheduled = false

  const routeCopy = {
    'zh-CN': {
      login: ['欢迎回来', '登录以管理您的订阅和设备'],
      register: ['创建账户', '注册后即可开始使用我们的网络服务'],
      forgetpassword: ['重置密码', '验证您的邮箱并设置一个新密码']
    },
    'zh-TW': {
      login: ['歡迎回來', '登入以管理您的訂閱和裝置'],
      register: ['建立帳戶', '註冊後即可開始使用我們的網路服務'],
      forgetpassword: ['重設密碼', '驗證您的電子郵件並設定新密碼']
    },
    'en-US': {
      login: ['Welcome back', 'Sign in to manage your subscription and devices'],
      register: ['Create an account', 'Register to get started with our network service'],
      forgetpassword: ['Reset your password', 'Verify your email and choose a new password']
    },
    'ja-JP': {
      login: ['おかえりなさい', 'ログインしてサブスクリプションとデバイスを管理します'],
      register: ['アカウントを作成', '登録してネットワークサービスを始めましょう'],
      forgetpassword: ['パスワードを再設定', 'メールを確認して新しいパスワードを設定します']
    },
    'ko-KR': {
      login: ['다시 오신 것을 환영합니다', '로그인하여 구독과 기기를 관리하세요'],
      register: ['계정 만들기', '등록하고 네트워크 서비스를 시작하세요'],
      forgetpassword: ['비밀번호 재설정', '이메일을 확인하고 새 비밀번호를 설정하세요']
    },
    'vi-VN': {
      login: ['Chào mừng trở lại', 'Đăng nhập để quản lý gói đăng ký và thiết bị'],
      register: ['Tạo tài khoản', 'Đăng ký để bắt đầu sử dụng dịch vụ mạng'],
      forgetpassword: ['Đặt lại mật khẩu', 'Xác minh email và chọn mật khẩu mới']
    },
    'ru-RU': {
      login: ['С возвращением', 'Войдите, чтобы управлять подпиской и устройствами'],
      register: ['Создать аккаунт', 'Зарегистрируйтесь, чтобы начать пользоваться сервисом'],
      forgetpassword: ['Сбросить пароль', 'Подтвердите почту и задайте новый пароль']
    },
    'fa-IR': {
      login: ['خوش آمدید', 'برای مدیریت اشتراک و دستگاه‌های خود وارد شوید'],
      register: ['ایجاد حساب', 'برای شروع استفاده از سرویس شبکه ثبت‌نام کنید'],
      forgetpassword: ['بازنشانی رمز عبور', 'ایمیل خود را تأیید و رمز جدیدی انتخاب کنید']
    }
  }

  function currentRoute () {
    const hashPath = window.location.hash.replace(/^#/, '').split('?')[0]
    const path = hashPath.startsWith('/') ? hashPath : window.location.pathname
    return AUTH_ROUTES.has(path) ? path : ''
  }

  function currentLocale () {
    try {
      const stored = JSON.parse(window.localStorage.getItem('VUE_NAIVE_LOCALE'))
      return routeCopy[stored && stored.value] ? stored.value : 'zh-CN'
    } catch (_) {
      return 'zh-CN'
    }
  }

  function createElement (tag, className, text) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (typeof text === 'string') element.textContent = text
    return element
  }

  function iconMarkup (index) {
    const icons = [
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM19 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.3 14.5l9.4-5M12 17.5h6.5"/></svg>',
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="10" rx="1.5"/><path d="M7 19h5m-2.5-4v4M18.5 10h2.5v9h-6v-2"/></svg>'
    ]
    return icons[index] || icons[0]
  }

  function buildPromo () {
    const promo = createElement('aside', 'xb-auth-promo')
    promo.setAttribute('aria-label', 'Brand introduction')

    const backgroundUrl = window.settings && window.settings.background_url
    if (backgroundUrl) {
      const safeUrl = String(backgroundUrl).replace(/["\\\n\r]/g, '')
      promo.style.setProperty('--xb-auth-promo-image', 'url("' + safeUrl + '")')
    }

    const brand = createElement('div', 'xb-auth-brand')
    const logo = window.settings && window.settings.logo
    if (logo) {
      const image = document.createElement('img')
      image.src = logo
      image.alt = ''
      brand.appendChild(image)
    } else {
      const title = (window.settings && window.settings.title) || 'Xboard'
      brand.appendChild(createElement('span', 'xb-auth-brand__mark', title.slice(0, 1).toUpperCase()))
    }
    brand.appendChild(createElement('span', 'xb-auth-brand__name', (window.settings && window.settings.title) || 'Xboard'))
    promo.appendChild(brand)

    const content = createElement('div', 'xb-auth-promo__content')
    content.appendChild(createElement('div', 'xb-auth-badge', copy.promoBadge || '全球智能网络'))
    content.appendChild(createElement('h1', '', copy.promoTitle || '稳定连接，从这里出发'))
    content.appendChild(createElement('p', '', copy.promoDescription || '覆盖全球的高速网络，让工作、学习和娱乐始终保持流畅。'))

    const features = createElement('ul', 'xb-auth-features')
    const featureItems = Array.isArray(copy.features) ? copy.features : []
    featureItems.filter(Boolean).slice(0, 3).forEach(function (feature, index) {
      const item = createElement('li', 'xb-auth-feature')
      const icon = createElement('span', 'xb-auth-feature__icon')
      icon.innerHTML = iconMarkup(index)
      item.appendChild(icon)
      item.appendChild(createElement('span', '', String(feature)))
      features.appendChild(item)
    })
    content.appendChild(features)
    promo.appendChild(content)

    const footer = createElement('div', 'xb-auth-promo__footer')
    const signal = createElement('span', 'xb-auth-signal')
    signal.appendChild(createElement('i'))
    signal.appendChild(document.createTextNode('Encrypted connection'))
    footer.appendChild(signal)
    footer.appendChild(createElement('span', '', 'Secure · Fast · Reliable'))
    promo.appendChild(footer)

    const orbit = createElement('div', 'xb-auth-orbit')
    orbit.setAttribute('aria-hidden', 'true')
    for (let index = 0; index < 3; index += 1) {
      orbit.appendChild(createElement('span', 'xb-auth-orbit__ring xb-auth-orbit__ring--' + (index + 1)))
    }
    for (let index = 0; index < 6; index += 1) {
      orbit.appendChild(createElement('span', 'xb-auth-orbit__node xb-auth-orbit__node--' + (index + 1)))
    }
    promo.appendChild(orbit)
    return promo
  }

  function findAuthShell () {
    const candidates = document.querySelectorAll('#app .wh-full.flex.items-center.justify-center')
    for (const candidate of candidates) {
      if (candidate.querySelector(':scope > .n-card')) return candidate
    }
    return null
  }

  function updateIntro (intro, route) {
    const localeCopy = routeCopy[currentLocale()] || routeCopy['zh-CN']
    const routeName = route.slice(1)
    const text = localeCopy[routeName] || localeCopy.login
    intro.querySelector('h1').textContent = text[0]
    intro.querySelector('p').textContent = text[1]
  }

  function normalizeControls (form) {
    form.querySelectorAll('.n-input, .n-base-selection').forEach(function (control) {
      control.style.setProperty('--n-height', '48px', 'important')
      control.style.setProperty('height', '48px', 'important')
      control.style.setProperty('min-height', '48px', 'important')
    })
    form.querySelectorAll('button.n-button').forEach(function (button) {
      const height = button.classList.contains('n-button--primary-type') ? '48px' : '46px'
      button.style.setProperty('--n-height', height, 'important')
      button.style.setProperty('height', height, 'important')
      button.style.setProperty('min-height', height, 'important')
    })
  }

  function enhance () {
    scheduled = false
    const route = currentRoute()
    if (!route) {
      document.body.classList.remove('xb-auth-page')
      return
    }

    const shell = findAuthShell()
    if (!shell) return

    const panel = shell.querySelector(':scope > .n-card')
    if (!panel) return

    document.body.classList.add('xb-auth-page')
    shell.classList.add('xb-auth-shell')
    panel.classList.add('xb-auth-panel')

    if (!shell.querySelector(':scope > .xb-auth-promo')) {
      shell.insertBefore(buildPromo(), panel)
    }

    const cardContent = panel.querySelector(':scope > .n-card__content') || panel.querySelector('.n-card__content')
    if (!cardContent) return

    const main = Array.from(cardContent.children).find(function (child) {
      return child.classList.contains('p-6')
    })
    if (!main) return
    main.classList.add('xb-auth-main')

    const form = Array.from(main.children).find(function (child) {
      return child.classList.contains('mt-5') && child.classList.contains('w-full')
    })
    if (!form) return
    form.classList.add('xb-auth-form')
    normalizeControls(form)

    Array.from(main.children).slice(0, Array.from(main.children).indexOf(form)).forEach(function (child) {
      if (!child.classList.contains('xb-auth-intro')) child.classList.add('xb-auth-original-brand')
    })

    let intro = main.querySelector(':scope > .xb-auth-intro')
    if (!intro) {
      intro = createElement('div', 'xb-auth-intro')
      intro.appendChild(createElement('h1'))
      intro.appendChild(createElement('p'))
      main.insertBefore(intro, form)
    }
    updateIntro(intro, route)

    const footer = Array.from(cardContent.children).find(function (child) {
      return child !== main && child.classList.contains('justify-between')
    })
    if (footer) footer.classList.add('xb-auth-footer')
  }

  function scheduleEnhance () {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(enhance)
  }

  const observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true })
  window.addEventListener('hashchange', scheduleEnhance)
  window.addEventListener('popstate', scheduleEnhance)
  scheduleEnhance()
})()
