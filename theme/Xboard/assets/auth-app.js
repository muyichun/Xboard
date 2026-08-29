(function () {
  'use strict'

  var AUTH_FORM_ROUTES = ['/login', '/register', '/forgetpassword']
  var AUTH_ROUTES = AUTH_FORM_ROUTES.concat(['/global-nodes'])
  var STORAGE_PREFIX = 'VUE_NAIVE_'
  var REMEMBER_EMAIL_KEY = 'XB_AUTH_REMEMBERED_EMAIL'
  var REMEMBER_ENABLED_KEY = 'XB_AUTH_REMEMBER_EMAIL_ENABLED'
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  var mode = ''
  var config = null
  var configReady = false
  var configPromise = null
  var countdownTimer = null
  var countdown = 0
  var tokenLoginKey = ''
  var captchaState = null
  var legacyLoadPromise = null
  var legacyPreloadPromise = null
  var legacyLoaded = false
  var legacyViewTicket = 0
  var legacyWarmupScheduled = false
  var historySyncInstalled = false
  var lastRouteSignature = ''
  var nativeHistoryPushState = window.history.pushState
  var nativeHistoryReplaceState = window.history.replaceState

  var localeNames = {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'en-US': 'English',
    'ja-JP': '日本語',
    'vi-VN': 'Tiếng Việt',
    'ko-KR': '한국어',
    'fa-IR': 'فارسی',
    'ru-RU': 'Русский'
  }

  var zhCN = {
    nav: ['首页', '全球节点'],
    loginTitle: '即享云登录',
    loginSubtitle: '欢迎登录即享云，畅享全球应用',
    registerTitle: '创建账户',
    registerSubtitle: '注册即享云，开启全球网络体验',
    forgotTitle: '找回密码',
    forgotSubtitle: '验证邮箱后即可设置新的登录密码',
    email: '邮箱',
    emailAccount: '邮箱账号',
    password: '密码',
    confirmPassword: '再次输入密码',
    emailCode: '邮箱验证码',
    inviteCode: '邀请码（选填）',
    inviteCodeRequired: '邀请码（必填）',
    remember: '记住我',
    forgot: '忘记密码？',
    login: '登录',
    register: '注册',
    registerNow: '立即注册',
    resetPassword: '重置密码',
    send: '发送',
    sending: '发送中…',
    resendIn: '{second} 秒',
    otherLogin: '其他登录方式',
    noAccount: '还没有账号？',
    hasAccount: '已有账号？',
    backLogin: '返回登录',
    agree: '我已阅读并同意',
    terms: '服务条款',
    captchaTitle: '请完成人机验证',
    loading: '正在加载…',
    signingIn: '正在登录…',
    registering: '正在注册…',
    resetting: '正在重置…',
    emptyEmail: '请输入邮箱地址',
    invalidEmail: '邮箱格式不正确',
    emptyPassword: '请输入密码',
    shortPassword: '密码至少需要 8 位',
    mismatch: '两次输入的密码不一致',
    emptyCode: '请输入 6 位邮箱验证码',
    emptyInvite: '请输入邀请码',
    agreeRequired: '请先同意服务条款',
    configFailed: '认证配置加载失败，请刷新后重试',
    loginSuccess: '登录成功',
    registerSuccess: '注册成功',
    resetSuccess: '密码已重置，正在返回登录',
    sendSuccess: '验证码已发送',
    requestFailed: '请求失败，请稍后重试',
    captchaCancelled: '已取消人机验证',
    comingSoon: '该入口正在建设中'
  }

  var messages = {
    'zh-CN': zhCN,
    'zh-TW': Object.assign({}, zhCN, {
      nav: ['首頁', '全球節點'],
      loginTitle: '即享雲登入', loginSubtitle: '歡迎登入即享雲，暢享全球應用',
      registerTitle: '建立帳戶', registerSubtitle: '註冊即享雲，開啟全球網路體驗',
      forgotTitle: '找回密碼', forgotSubtitle: '驗證信箱後即可設定新的登入密碼',
      email: '信箱', emailAccount: '信箱帳號', password: '密碼', confirmPassword: '再次輸入密碼',
      emailCode: '信箱驗證碼', inviteCode: '邀請碼（選填）', inviteCodeRequired: '邀請碼（必填）',
      remember: '記住我', forgot: '忘記密碼？', login: '登入', register: '註冊', registerNow: '立即註冊',
      resetPassword: '重設密碼', send: '傳送', sending: '傳送中…', resendIn: '{second} 秒',
      otherLogin: '其他登入方式', noAccount: '還沒有帳戶？', hasAccount: '已有帳戶？', backLogin: '返回登入',
      agree: '我已閱讀並同意', terms: '服務條款', captchaTitle: '請完成人機驗證', loading: '正在載入…',
      signingIn: '正在登入…', registering: '正在註冊…', resetting: '正在重設…',
      emptyEmail: '請輸入信箱地址', invalidEmail: '信箱格式不正確', emptyPassword: '請輸入密碼',
      shortPassword: '密碼至少需要 8 位', mismatch: '兩次輸入的密碼不一致', emptyCode: '請輸入 6 位信箱驗證碼',
      emptyInvite: '請輸入邀請碼', agreeRequired: '請先同意服務條款', configFailed: '認證設定載入失敗，請重新整理後再試',
      loginSuccess: '登入成功', registerSuccess: '註冊成功', resetSuccess: '密碼已重設，正在返回登入',
      sendSuccess: '驗證碼已傳送', requestFailed: '請求失敗，請稍後再試', captchaCancelled: '已取消人機驗證', comingSoon: '此入口正在建置中'
    }),
    'en-US': Object.assign({}, zhCN, {
      nav: ['Home', 'Global Network'],
      loginTitle: 'JXCloud Login', loginSubtitle: 'Welcome back — enjoy your global apps',
      registerTitle: 'Create account', registerSubtitle: 'Join JXCloud and unlock the global network',
      forgotTitle: 'Reset password', forgotSubtitle: 'Verify your email to set a new password',
      email: 'Email', emailAccount: 'Email account', password: 'Password', confirmPassword: 'Confirm password',
      emailCode: 'Email verification code', inviteCode: 'Invitation code (optional)', inviteCodeRequired: 'Invitation code (required)',
      remember: 'Remember me', forgot: 'Forgot password?', login: 'Sign in', register: 'Register', registerNow: 'Create account',
      resetPassword: 'Reset password', send: 'Send', sending: 'Sending…', resendIn: '{second}s',
      otherLogin: 'Other sign-in methods', noAccount: 'New to JXCloud?', hasAccount: 'Already have an account?', backLogin: 'Back to login',
      agree: 'I have read and agree to the', terms: 'Terms of Service', captchaTitle: 'Complete the security check', loading: 'Loading…',
      signingIn: 'Signing in…', registering: 'Creating account…', resetting: 'Resetting…',
      emptyEmail: 'Enter your email address', invalidEmail: 'Enter a valid email address', emptyPassword: 'Enter your password',
      shortPassword: 'Password must be at least 8 characters', mismatch: 'Passwords do not match', emptyCode: 'Enter the 6-digit email code',
      emptyInvite: 'Enter an invitation code', agreeRequired: 'Please accept the Terms of Service', configFailed: 'Could not load authentication settings. Refresh and try again.',
      loginSuccess: 'Signed in successfully', registerSuccess: 'Account created', resetSuccess: 'Password reset. Returning to login…',
      sendSuccess: 'Verification code sent', requestFailed: 'Request failed. Please try again.', captchaCancelled: 'Security check cancelled', comingSoon: 'This section is coming soon'
    }),
    'ja-JP': Object.assign({}, zhCN, {
      nav: ['ホーム', 'グローバルノード'],
      loginTitle: '即享雲ログイン', loginSubtitle: 'ログインして、世界中のアプリを快適に',
      registerTitle: 'アカウント作成', registerSubtitle: '即享雲に登録してグローバルネットワークを開始',
      forgotTitle: 'パスワード再設定', forgotSubtitle: 'メール認証後、新しいパスワードを設定できます',
      email: 'メールアドレス', emailAccount: 'メールアカウント', password: 'パスワード', confirmPassword: 'パスワードを再入力',
      emailCode: 'メール認証コード', inviteCode: '招待コード（任意）', inviteCodeRequired: '招待コード（必須）',
      remember: 'ログイン情報を保存', forgot: 'パスワードを忘れた場合', login: 'ログイン', register: '登録', registerNow: '今すぐ登録',
      resetPassword: 'パスワードを再設定', send: '送信', sending: '送信中…', resendIn: '{second}秒',
      otherLogin: 'その他のログイン方法', noAccount: 'アカウントをお持ちでないですか？', hasAccount: 'すでにアカウントをお持ちですか？', backLogin: 'ログインへ戻る',
      agree: '以下を読み、同意します：', terms: '利用規約', captchaTitle: 'セキュリティ確認を完了してください', loading: '読み込み中…',
      signingIn: 'ログイン中…', registering: '登録中…', resetting: '再設定中…',
      emptyEmail: 'メールアドレスを入力してください', invalidEmail: '正しいメールアドレスを入力してください', emptyPassword: 'パスワードを入力してください',
      shortPassword: 'パスワードは8文字以上必要です', mismatch: 'パスワードが一致しません', emptyCode: '6桁の認証コードを入力してください',
      emptyInvite: '招待コードを入力してください', agreeRequired: '利用規約に同意してください', configFailed: '認証設定を読み込めません。更新して再試行してください。',
      loginSuccess: 'ログインしました', registerSuccess: '登録しました', resetSuccess: 'パスワードを再設定しました。ログインへ戻ります',
      sendSuccess: '認証コードを送信しました', requestFailed: 'リクエストに失敗しました', captchaCancelled: 'セキュリティ確認をキャンセルしました', comingSoon: 'このページは準備中です'
    }),
    'vi-VN': Object.assign({}, zhCN, {
      nav: ['Trang chủ', 'Mạng toàn cầu'],
      loginTitle: 'Đăng nhập JXCloud', loginSubtitle: 'Đăng nhập để tận hưởng các ứng dụng toàn cầu',
      registerTitle: 'Tạo tài khoản', registerSubtitle: 'Đăng ký JXCloud và kết nối mạng toàn cầu',
      forgotTitle: 'Đặt lại mật khẩu', forgotSubtitle: 'Xác minh email để đặt mật khẩu mới',
      email: 'Email', emailAccount: 'Tài khoản email', password: 'Mật khẩu', confirmPassword: 'Nhập lại mật khẩu',
      emailCode: 'Mã xác minh email', inviteCode: 'Mã mời (tùy chọn)', inviteCodeRequired: 'Mã mời (bắt buộc)',
      remember: 'Ghi nhớ tôi', forgot: 'Quên mật khẩu?', login: 'Đăng nhập', register: 'Đăng ký', registerNow: 'Đăng ký ngay',
      resetPassword: 'Đặt lại mật khẩu', send: 'Gửi', sending: 'Đang gửi…', resendIn: '{second} giây',
      otherLogin: 'Phương thức đăng nhập khác', noAccount: 'Chưa có tài khoản?', hasAccount: 'Đã có tài khoản?', backLogin: 'Quay lại đăng nhập',
      agree: 'Tôi đã đọc và đồng ý với', terms: 'Điều khoản dịch vụ', captchaTitle: 'Hoàn tất xác minh bảo mật', loading: 'Đang tải…',
      signingIn: 'Đang đăng nhập…', registering: 'Đang đăng ký…', resetting: 'Đang đặt lại…',
      emptyEmail: 'Vui lòng nhập email', invalidEmail: 'Email không hợp lệ', emptyPassword: 'Vui lòng nhập mật khẩu',
      shortPassword: 'Mật khẩu phải có ít nhất 8 ký tự', mismatch: 'Mật khẩu không khớp', emptyCode: 'Nhập mã xác minh email 6 số',
      emptyInvite: 'Vui lòng nhập mã mời', agreeRequired: 'Vui lòng đồng ý Điều khoản dịch vụ', configFailed: 'Không thể tải cấu hình xác thực. Vui lòng làm mới.',
      loginSuccess: 'Đăng nhập thành công', registerSuccess: 'Đăng ký thành công', resetSuccess: 'Đã đặt lại mật khẩu, đang trở về trang đăng nhập',
      sendSuccess: 'Đã gửi mã xác minh', requestFailed: 'Yêu cầu thất bại, vui lòng thử lại', captchaCancelled: 'Đã hủy xác minh', comingSoon: 'Mục này đang được xây dựng'
    }),
    'ko-KR': Object.assign({}, zhCN, {
      nav: ['홈', '글로벌 노드'],
      loginTitle: 'JXCloud 로그인', loginSubtitle: '로그인하고 전 세계 앱을 자유롭게 이용하세요',
      registerTitle: '계정 만들기', registerSubtitle: 'JXCloud에 가입하고 글로벌 네트워크를 시작하세요',
      forgotTitle: '비밀번호 재설정', forgotSubtitle: '이메일 인증 후 새 비밀번호를 설정하세요',
      email: '이메일', emailAccount: '이메일 계정', password: '비밀번호', confirmPassword: '비밀번호 확인',
      emailCode: '이메일 인증 코드', inviteCode: '초대 코드 (선택)', inviteCodeRequired: '초대 코드 (필수)',
      remember: '로그인 정보 기억', forgot: '비밀번호를 잊으셨나요?', login: '로그인', register: '가입', registerNow: '지금 가입',
      resetPassword: '비밀번호 재설정', send: '보내기', sending: '보내는 중…', resendIn: '{second}초',
      otherLogin: '다른 로그인 방법', noAccount: '계정이 없으신가요?', hasAccount: '이미 계정이 있으신가요?', backLogin: '로그인으로 돌아가기',
      agree: '다음을 읽고 동의합니다:', terms: '서비스 약관', captchaTitle: '보안 확인을 완료하세요', loading: '불러오는 중…',
      signingIn: '로그인 중…', registering: '가입 중…', resetting: '재설정 중…',
      emptyEmail: '이메일을 입력하세요', invalidEmail: '올바른 이메일을 입력하세요', emptyPassword: '비밀번호를 입력하세요',
      shortPassword: '비밀번호는 8자 이상이어야 합니다', mismatch: '비밀번호가 일치하지 않습니다', emptyCode: '6자리 이메일 인증 코드를 입력하세요',
      emptyInvite: '초대 코드를 입력하세요', agreeRequired: '서비스 약관에 동의하세요', configFailed: '인증 설정을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.',
      loginSuccess: '로그인되었습니다', registerSuccess: '가입되었습니다', resetSuccess: '비밀번호가 재설정되었습니다. 로그인으로 돌아갑니다',
      sendSuccess: '인증 코드를 보냈습니다', requestFailed: '요청에 실패했습니다. 다시 시도하세요.', captchaCancelled: '보안 확인이 취소되었습니다', comingSoon: '준비 중인 메뉴입니다'
    }),
    'fa-IR': Object.assign({}, zhCN, {
      nav: ['خانه', 'شبکه جهانی'],
      loginTitle: 'ورود به JXCloud', loginSubtitle: 'وارد شوید و از برنامه‌های جهانی لذت ببرید',
      registerTitle: 'ساخت حساب', registerSubtitle: 'در JXCloud ثبت‌نام کنید و به شبکه جهانی متصل شوید',
      forgotTitle: 'بازیابی رمز عبور', forgotSubtitle: 'ایمیل را تأیید و رمز عبور جدید تنظیم کنید',
      email: 'ایمیل', emailAccount: 'حساب ایمیل', password: 'رمز عبور', confirmPassword: 'تکرار رمز عبور',
      emailCode: 'کد تأیید ایمیل', inviteCode: 'کد دعوت (اختیاری)', inviteCodeRequired: 'کد دعوت (الزامی)',
      remember: 'مرا به خاطر بسپار', forgot: 'رمز عبور را فراموش کرده‌اید؟', login: 'ورود', register: 'ثبت‌نام', registerNow: 'ثبت‌نام کنید',
      resetPassword: 'بازیابی رمز عبور', send: 'ارسال', sending: 'در حال ارسال…', resendIn: '{second} ثانیه',
      otherLogin: 'روش‌های دیگر ورود', noAccount: 'حساب ندارید؟', hasAccount: 'حساب دارید؟', backLogin: 'بازگشت به ورود',
      agree: 'خوانده‌ام و موافقم با', terms: 'شرایط استفاده', captchaTitle: 'تأیید امنیتی را کامل کنید', loading: 'در حال بارگذاری…',
      signingIn: 'در حال ورود…', registering: 'در حال ثبت‌نام…', resetting: 'در حال بازیابی…',
      emptyEmail: 'ایمیل را وارد کنید', invalidEmail: 'ایمیل معتبر وارد کنید', emptyPassword: 'رمز عبور را وارد کنید',
      shortPassword: 'رمز عبور باید حداقل ۸ نویسه باشد', mismatch: 'رمزهای عبور یکسان نیستند', emptyCode: 'کد ۶ رقمی ایمیل را وارد کنید',
      emptyInvite: 'کد دعوت را وارد کنید', agreeRequired: 'با شرایط استفاده موافقت کنید', configFailed: 'تنظیمات ورود بارگذاری نشد. صفحه را تازه کنید.',
      loginSuccess: 'با موفقیت وارد شدید', registerSuccess: 'حساب ساخته شد', resetSuccess: 'رمز عبور تغییر کرد؛ بازگشت به ورود',
      sendSuccess: 'کد تأیید ارسال شد', requestFailed: 'درخواست ناموفق بود. دوباره تلاش کنید.', captchaCancelled: 'تأیید امنیتی لغو شد', comingSoon: 'این بخش به‌زودی آماده می‌شود'
    })
  }

  function storageKey (name) {
    return (STORAGE_PREFIX + name).toUpperCase()
  }

  function readStorage (name, fallback) {
    try {
      var raw = window.localStorage.getItem(storageKey(name))
      if (!raw) return fallback
      var stored = JSON.parse(raw)
      if (stored.expire != null && stored.expire <= Date.now()) {
        window.localStorage.removeItem(storageKey(name))
        return fallback
      }
      return stored.value == null ? fallback : stored.value
    } catch (_) {
      return fallback
    }
  }

  function writeStorage (name, value, expiresInSeconds) {
    var now = Date.now()
    var payload = {
      value: value,
      time: now,
      expire: expiresInSeconds == null ? null : now + expiresInSeconds * 1000
    }
    window.localStorage.setItem(storageKey(name), JSON.stringify(payload))
  }

  function currentLocale () {
    var allowed = (window.settings && window.settings.i18n) || ['zh-CN']
    var stored = readStorage('locale', 'zh-CN')
    return allowed.indexOf(stored) >= 0 ? stored : (allowed[0] || 'zh-CN')
  }

  function copy () {
    return messages[currentLocale()] || zhCN
  }

  function routeInfo () {
    var raw = window.location.hash.replace(/^#/, '')
    var separator = raw.indexOf('?')
    var path = separator >= 0 ? raw.slice(0, separator) : raw
    var query = separator >= 0 ? raw.slice(separator + 1) : ''
    return {
      path: path || window.location.pathname || '/',
      params: new URLSearchParams(query)
    }
  }

  function isAuthRoute (path) {
    return AUTH_ROUTES.indexOf(path) >= 0
  }

  function isAuthFormRoute (path) {
    return AUTH_FORM_ROUTES.indexOf(path) >= 0
  }

  function escapeHtml (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function icon (name) {
    if (name === 'account') {
      return '<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="8.2" r="5.2"></circle><path d="M4.6 24.2v-2.4c0-5 3.8-8 9.4-8s9.4 3 9.4 8v2.4"></path></svg>'
    }
    if (name === 'code') {
      return '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="4" y="6" width="20" height="16" rx="3"></rect><path d="m8 11 6 4 6-4"></path></svg>'
    }
    return '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="5.2" y="11.2" width="17.6" height="13" rx="2.1"></rect><path d="M9 11.2V8.4a5 5 0 0 1 10 0v2.8M14 16.2v3.2"></path></svg>'
  }

  function eyeIcon () {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5.2 9.5-5.2 9.5 5.2 9.5 5.2-3.5 5.2-9.5 5.2S2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.4"></circle></svg>'
  }

  function googleIcon () {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"></path><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z"></path><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.56l3.35-2.63Z"></path><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z"></path></svg>'
  }

  function appleIcon () {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M22.5 16.9c0-3.7 3-5.5 3.2-5.6-1.8-2.6-4.5-2.9-5.4-2.9-2.3-.2-4.5 1.4-5.7 1.4-1.2 0-3-1.4-5-1.3-2.5 0-4.9 1.5-6.2 3.7-2.7 4.6-.7 11.4 1.9 15.1 1.3 1.8 2.8 3.8 4.8 3.7 1.9-.1 2.7-1.2 5-1.2s3 1.2 5 1.2c2.1 0 3.4-1.8 4.6-3.7 1.5-2.1 2.1-4.2 2.1-4.3-.1 0-4.3-1.7-4.3-6.1ZM18.8 6c1-1.2 1.7-2.9 1.5-4.6-1.5.1-3.3 1-4.4 2.2-1 1.1-1.8 2.8-1.6 4.4 1.7.1 3.4-.8 4.5-2Z"></path></svg>'
  }

  function telegramIcon () {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M27.6 5.1 3.8 14.3c-1.6.7-1.6 1.6-.3 2l6.1 1.9 2.3 7.2c.3.9.2 1.3 1.1 1.3.7 0 1-.3 1.4-.7l3-2.9 6.3 4.6c1.2.6 2 .3 2.3-1.1l4.1-19.5c.5-1.8-.6-2.7-2.2-2Zm-3 4.5L13.8 19.4l-.4 4.1-1.5-5 11.7-7.4c.5-.3 1-.7 1-.3Z"></path></svg>'
  }

  function headingHtml (title, subtitle) {
    return '<div class="xb-card-heading"><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(subtitle) + '</p><span aria-hidden="true"></span></div>'
  }

  function fieldHtml (options) {
    var type = options.type || 'text'
    var passwordToggle = type === 'password'
      ? '<button class="xb-field__toggle" type="button" aria-label="' + escapeHtml(options.placeholder) + '" data-password-toggle>' + eyeIcon() + '</button>'
      : ''
    return '<label class="xb-field' + (options.className ? ' ' + options.className : '') + '">' +
      '<span class="xb-field__icon">' + icon(options.icon || 'account') + '</span>' +
      '<input type="' + type + '" name="' + escapeHtml(options.name) + '" placeholder="' + escapeHtml(options.placeholder) + '"' +
      (options.autocomplete ? ' autocomplete="' + escapeHtml(options.autocomplete) + '"' : '') +
      (options.maxlength ? ' maxlength="' + options.maxlength + '"' : '') +
      (options.value ? ' value="' + escapeHtml(options.value) + '"' : '') +
      (options.readonly ? ' readonly' : '') + ' />' + passwordToggle + '</label>'
  }

  function emailHtml (route) {
    var c = copy()
    var suffixes = config && Array.isArray(config.email_whitelist_suffix) ? config.email_whitelist_suffix : []
    if (route !== '/login' && suffixes.length) {
      return '<div class="xb-email-combo">' +
        '<label class="xb-field"><span class="xb-field__icon">' + icon('account') + '</span>' +
        '<input type="text" name="email_local" placeholder="' + escapeHtml(c.emailAccount) + '" autocomplete="email" maxlength="40" /></label>' +
        '<select name="email_suffix" aria-label="' + escapeHtml(c.email) + '">' + suffixes.map(function (suffix) {
          return '<option value="@' + escapeHtml(suffix) + '">@' + escapeHtml(suffix) + '</option>'
        }).join('') + '</select></div>'
    }
    return fieldHtml({ name: 'email', type: 'email', placeholder: c.email, autocomplete: 'email', maxlength: 80, icon: 'account' })
  }

  function loginHtml () {
    var c = copy()
    var remembered = ''
    var rememberEnabled = false
    try {
      remembered = window.localStorage.getItem(REMEMBER_EMAIL_KEY) || ''
      rememberEnabled = window.localStorage.getItem(REMEMBER_ENABLED_KEY) === 'true'
    } catch (_) {}
    return headingHtml(c.loginTitle, c.loginSubtitle) +
      '<form class="xb-auth-form xb-login-form" data-auth-form="login" novalidate>' +
      fieldHtml({ name: 'email', type: 'email', placeholder: c.email, autocomplete: 'username', maxlength: 80, icon: 'account', value: rememberEnabled ? remembered : '' }) +
      fieldHtml({ name: 'password', type: 'password', placeholder: c.password, autocomplete: 'current-password', maxlength: 40, icon: 'password' }) +
      '<div class="xb-form-actions"><label class="xb-check"><input type="checkbox" name="remember"' + (rememberEnabled ? ' checked' : '') + ' /><span></span><b>' + escapeHtml(c.remember) + '</b></label>' +
      '<a href="#/forgetpassword">' + escapeHtml(c.forgot) + '</a></div>' +
      '<button class="xb-submit" type="submit" data-submit><span>' + escapeHtml(c.login) + '</span></button>' +
      '</form>' +
      '<section class="xb-social"><div class="xb-divider"><span></span><p>' + escapeHtml(c.otherLogin) + '</p><span></span></div>' +
      '<div class="xb-social__buttons"><button type="button" disabled aria-label="Google">' + googleIcon() + '</button>' +
      '<button type="button" disabled aria-label="Apple">' + appleIcon() + '</button>' +
      '<button type="button" disabled aria-label="Telegram">' + telegramIcon() + '</button></div></section>' +
      '<p class="xb-card-footer">' + escapeHtml(c.noAccount) + ' <a href="#/register">' + escapeHtml(c.registerNow) + '</a></p>'
  }

  function verificationHtml () {
    var c = copy()
    return '<div class="xb-code-row">' +
      fieldHtml({ name: 'email_code', type: 'text', placeholder: c.emailCode, autocomplete: 'one-time-code', maxlength: 6, icon: 'code' }) +
      '<button type="button" data-send-code' + (countdown > 0 ? ' disabled' : '') + '>' +
      escapeHtml(countdown > 0 ? c.resendIn.replace('{second}', countdown) : c.send) + '</button></div>'
  }

  function registerHtml () {
    var c = copy()
    if (!configReady) return headingHtml(c.registerTitle, c.registerSubtitle) + '<div class="xb-card-loading"><span></span>' + escapeHtml(c.loading) + '</div>'
    var params = routeInfo().params
    var invite = params.get('code') || ''
    var needsCode = config && Number(config.is_email_verify) === 1
    var inviteRequired = config && Number(config.is_invite_force) === 1
    var terms = config && config.tos_url
    return headingHtml(c.registerTitle, c.registerSubtitle) +
      '<form class="xb-auth-form xb-register-form" data-auth-form="register" novalidate>' +
      emailHtml('/register') +
      (needsCode ? verificationHtml() : '') +
      fieldHtml({ name: 'password', type: 'password', placeholder: c.password, autocomplete: 'new-password', maxlength: 40, icon: 'password' }) +
      fieldHtml({ name: 'confirm_password', type: 'password', placeholder: c.confirmPassword, autocomplete: 'new-password', maxlength: 40, icon: 'password' }) +
      fieldHtml({ name: 'invite_code', type: 'text', placeholder: inviteRequired ? c.inviteCodeRequired : c.inviteCode, autocomplete: 'off', maxlength: 32, icon: 'code', value: invite, readonly: Boolean(invite) }) +
      (terms ? '<label class="xb-check xb-terms"><input type="checkbox" name="terms" /><span></span><b>' + escapeHtml(c.agree) + ' <a href="' + escapeHtml(terms) + '" target="_blank" rel="noopener">' + escapeHtml(c.terms) + '</a></b></label>' : '') +
      '<button class="xb-submit" type="submit" data-submit><span>' + escapeHtml(c.register) + '</span></button>' +
      '</form><p class="xb-card-footer">' + escapeHtml(c.hasAccount) + ' <a href="#/login">' + escapeHtml(c.backLogin) + '</a></p>'
  }

  function forgotHtml () {
    var c = copy()
    if (!configReady) return headingHtml(c.forgotTitle, c.forgotSubtitle) + '<div class="xb-card-loading"><span></span>' + escapeHtml(c.loading) + '</div>'
    return headingHtml(c.forgotTitle, c.forgotSubtitle) +
      '<form class="xb-auth-form xb-forgot-form" data-auth-form="forgot" novalidate>' +
      emailHtml('/forgetpassword') + verificationHtml() +
      fieldHtml({ name: 'password', type: 'password', placeholder: c.password, autocomplete: 'new-password', maxlength: 40, icon: 'password' }) +
      fieldHtml({ name: 'confirm_password', type: 'password', placeholder: c.confirmPassword, autocomplete: 'new-password', maxlength: 40, icon: 'password' }) +
      '<button class="xb-submit" type="submit" data-submit><span>' + escapeHtml(c.resetPassword) + '</span></button>' +
      '</form><p class="xb-card-footer"><a href="#/login">' + escapeHtml(c.backLogin) + '</a></p>'
  }

  function renderAuth () {
    if (mode !== 'auth') return
    var info = routeInfo()
    var card = document.querySelector('[data-auth-card]')
    var stage = document.querySelector('[data-auth-stage]')
    var artwork = document.querySelector('[data-page-artwork]')
    var staticPage = info.path === '/global-nodes'
    var imageBase = (window.__XB_AUTH_ASSET_BASE__ || '/theme/Xboard/assets') + '/images/'
    document.body.classList.toggle('xb-static-page', staticPage)
    if (artwork) artwork.src = imageBase + (staticPage ? 'global-nodes.png' : 'auth-login-reference.png') + '?v=ui14'
    if (stage) stage.hidden = staticPage
    document.querySelectorAll('[data-nav-key]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-nav-key') === (staticPage ? 'nodes' : 'home'))
    })
    if (!card) return
    card.hidden = staticPage
    if (staticPage) {
      card.innerHTML = ''
      updateStaticLanguage()
      return
    }
    card.className = 'xb-auth-card ' + (info.path === '/register' ? 'xb-auth-card--register' : info.path === '/forgetpassword' ? 'xb-auth-card--forgot' : 'xb-auth-card--login')
    if (info.path === '/register') card.innerHTML = registerHtml()
    else if (info.path === '/forgetpassword') card.innerHTML = forgotHtml()
    else card.innerHTML = loginHtml()
    bindCard()
    updateStaticLanguage()
  }

  function bindCard () {
    document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = button.parentElement.querySelector('input')
        input.type = input.type === 'password' ? 'text' : 'password'
        button.classList.toggle('is-visible', input.type === 'text')
      })
    })
    var form = document.querySelector('[data-auth-form]')
    if (form) form.addEventListener('submit', submitForm)
    var send = document.querySelector('[data-send-code]')
    if (send) send.addEventListener('click', sendEmailCode)
  }

  function formEmail (form) {
    var full = form.elements.email
    if (full) return String(full.value || '').trim()
    var local = form.elements.email_local
    var suffix = form.elements.email_suffix
    return String((local && local.value) || '').trim() + String((suffix && suffix.value) || '')
  }

  function validateEmail (email) {
    var c = copy()
    if (!email) throw userError(c.emptyEmail)
    if (!EMAIL_PATTERN.test(email)) throw userError(c.invalidEmail)
  }

  function validatePassword (password) {
    var c = copy()
    if (!password) throw userError(c.emptyPassword)
    if (password.length < 8) throw userError(c.shortPassword)
  }

  function userError (message) {
    var error = new Error(message)
    error.isUserError = true
    return error
  }

  function setBusy (form, busy, text) {
    var button = form && form.querySelector('[data-submit]')
    if (!button) return
    if (!button.dataset.label) button.dataset.label = button.textContent.trim()
    button.disabled = busy
    button.classList.toggle('is-loading', busy)
    button.querySelector('span').textContent = busy ? text : button.dataset.label
  }

  async function submitForm (event) {
    event.preventDefault()
    var form = event.currentTarget
    var kind = form.getAttribute('data-auth-form')
    var c = copy()
    try {
      if (kind === 'login') await submitLogin(form)
      else if (kind === 'register') await submitRegister(form)
      else await submitForgot(form)
    } catch (error) {
      if (!error || !error.isCaptchaCancelled) toast(errorMessage(error, c.requestFailed), 'error')
    }
  }

  async function submitLogin (form) {
    var c = copy()
    var email = formEmail(form)
    var password = String(form.elements.password.value || '')
    validateEmail(email)
    validatePassword(password)
    setBusy(form, true, c.signingIn)
    try {
      var data = await api('/passport/auth/login', { method: 'POST', body: { email: email, password: password } })
      if (!data || !data.auth_data) throw new Error(c.requestFailed)
      var remember = Boolean(form.elements.remember && form.elements.remember.checked)
      try {
        window.localStorage.setItem(REMEMBER_ENABLED_KEY, remember ? 'true' : 'false')
        if (remember) window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
        else window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
      } catch (_) {}
      writeStorage('access_token', data.auth_data, 21600)
      toast(c.loginSuccess, 'success')
      await goToLegacy(safeRedirect(routeInfo().params.get('redirect')))
    } finally {
      setBusy(form, false, '')
    }
  }

  async function submitRegister (form) {
    var c = copy()
    var email = formEmail(form)
    var password = String(form.elements.password.value || '')
    var confirm = String(form.elements.confirm_password.value || '')
    var emailCode = form.elements.email_code ? String(form.elements.email_code.value || '').trim() : ''
    var inviteCode = String(form.elements.invite_code.value || '').trim()
    validateEmail(email)
    validatePassword(password)
    if (password !== confirm) throw userError(c.mismatch)
    if (config && Number(config.is_email_verify) === 1 && !/^\d{6}$/.test(emailCode)) throw userError(c.emptyCode)
    if (config && Number(config.is_invite_force) === 1 && !inviteCode) throw userError(c.emptyInvite)
    if (config && config.tos_url && !(form.elements.terms && form.elements.terms.checked)) throw userError(c.agreeRequired)
    setBusy(form, true, c.registering)
    try {
      var captcha = await requestCaptcha('register')
      var body = Object.assign({ email: email, password: password, email_code: emailCode, invite_code: inviteCode }, captcha)
      var data = await api('/passport/auth/register', { method: 'POST', body: body })
      if (!data || !data.auth_data) throw new Error(c.requestFailed)
      writeStorage('access_token', data.auth_data, 21600)
      toast(c.registerSuccess, 'success')
      await goToLegacy('/dashboard')
    } finally {
      setBusy(form, false, '')
    }
  }

  async function submitForgot (form) {
    var c = copy()
    var email = formEmail(form)
    var password = String(form.elements.password.value || '')
    var confirm = String(form.elements.confirm_password.value || '')
    var emailCode = String(form.elements.email_code.value || '').trim()
    validateEmail(email)
    validatePassword(password)
    if (password !== confirm) throw userError(c.mismatch)
    if (!/^\d{6}$/.test(emailCode)) throw userError(c.emptyCode)
    setBusy(form, true, c.resetting)
    try {
      await api('/passport/auth/forget', { method: 'POST', body: { email: email, password: password, email_code: emailCode } })
      toast(c.resetSuccess, 'success')
      window.setTimeout(function () { window.location.hash = '#/login' }, 650)
    } finally {
      setBusy(form, false, '')
    }
  }

  async function sendEmailCode () {
    var c = copy()
    var form = document.querySelector('[data-auth-form]')
    var button = document.querySelector('[data-send-code]')
    if (!form || !button || countdown > 0) return
    try {
      var email = formEmail(form)
      validateEmail(email)
      button.disabled = true
      button.textContent = c.sending
      var captcha = await requestCaptcha('sendEmailVerify')
      await api('/passport/comm/sendEmailVerify', { method: 'POST', body: Object.assign({ email: email }, captcha) })
      toast(c.sendSuccess, 'success')
      startCountdown()
    } catch (error) {
      if (!error || !error.isCaptchaCancelled) toast(errorMessage(error, c.requestFailed), 'error')
      if (button) {
        button.disabled = false
        button.textContent = c.send
      }
    }
  }

  function startCountdown () {
    window.clearInterval(countdownTimer)
    countdown = 60
    updateCountdownButton()
    countdownTimer = window.setInterval(function () {
      countdown -= 1
      updateCountdownButton()
      if (countdown <= 0) window.clearInterval(countdownTimer)
    }, 1000)
  }

  function updateCountdownButton () {
    var button = document.querySelector('[data-send-code]')
    if (!button) return
    var c = copy()
    button.disabled = countdown > 0
    button.textContent = countdown > 0 ? c.resendIn.replace('{second}', countdown) : c.send
  }

  function api (path, options) {
    options = options || {}
    var init = {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Language': currentLocale()
      }
    }
    if (options.body != null) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }
    return window.fetch('/api/v1' + path, init).then(async function (response) {
      var payload
      try { payload = await response.json() } catch (_) { payload = {} }
      if (!response.ok || payload.status === 'fail') {
        var message = payload.message
        if (payload.errors) {
          var firstKey = Object.keys(payload.errors)[0]
          if (firstKey && payload.errors[firstKey]) message = payload.errors[firstKey][0]
        }
        throw new Error(message || copy().requestFailed)
      }
      return payload.data
    })
  }

  function loadConfig () {
    if (configPromise) return configPromise
    configPromise = api('/guest/comm/config').then(function (data) {
      config = data || {}
      configReady = true
      renderAuth()
      return config
    }).catch(function (error) {
      config = {}
      configReady = true
      renderAuth()
      toast(errorMessage(error, copy().configFailed), 'error')
      return config
    })
    return configPromise
  }

  function loadScript (src, ready) {
    if (ready && ready()) return Promise.resolve()
    var existing = document.querySelector('script[data-xb-src="' + src + '"]')
    if (existing) {
      return new Promise(function (resolve, reject) {
        existing.addEventListener('load', resolve, { once: true })
        existing.addEventListener('error', reject, { once: true })
      })
    }
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      script.dataset.xbSrc = src
      script.onload = resolve
      script.onerror = function () { reject(new Error(copy().requestFailed)) }
      document.head.appendChild(script)
    })
  }

  async function requestCaptcha (action) {
    if (!config || Number(config.is_captcha) !== 1) return {}
    var type = config.captcha_type || 'recaptcha'
    if (type === 'recaptcha-v3') {
      if (!config.recaptcha_v3_site_key) return {}
      var key = config.recaptcha_v3_site_key
      await loadScript('https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(key), function () { return window.grecaptcha && window.grecaptcha.execute })
      await new Promise(function (resolve) { window.grecaptcha.ready(resolve) })
      var token = await window.grecaptcha.execute(key, { action: action })
      return { recaptcha_v3_token: token }
    }
    return openCaptchaDialog(type)
  }

  async function openCaptchaDialog (type) {
    var dialog = document.querySelector('[data-captcha-dialog]')
    var widget = document.querySelector('[data-captcha-widget]')
    var title = document.querySelector('[data-captcha-title]')
    if (!dialog || !widget) return {}
    title.textContent = copy().captchaTitle
    widget.innerHTML = ''
    dialog.showModal()
    return new Promise(async function (resolve, reject) {
      var settled = false
      function finish (payload) {
        if (settled) return
        settled = true
        closeCaptchaDialog()
        resolve(payload)
      }
      function fail (errorCode) {
        if (settled) return
        settled = true
        closeCaptchaDialog()
        var detail = errorCode == null ? '' : String(errorCode)
        reject(new Error(copy().requestFailed + (detail ? ' (Captcha ' + detail + ')' : '')))
      }
      captchaState = {
        cancel: function () {
          if (settled) return
          settled = true
          closeCaptchaDialog()
          var error = new Error(copy().captchaCancelled)
          error.isCaptchaCancelled = true
          reject(error)
        },
        type: type,
        widgetId: null
      }
      try {
        if (type === 'turnstile') {
          await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', function () { return window.turnstile && window.turnstile.render })
          captchaState.widgetId = window.turnstile.render(widget, {
            sitekey: config.turnstile_site_key,
            theme: 'dark',
            callback: function (token) { finish({ turnstile_token: token }) },
            'error-callback': function (errorCode) { fail(errorCode) },
            'expired-callback': fail
          })
        } else {
          await loadScript('https://www.google.com/recaptcha/api.js?render=explicit', function () { return window.grecaptcha && window.grecaptcha.render })
          captchaState.widgetId = window.grecaptcha.render(widget, {
            sitekey: config.recaptcha_site_key,
            theme: 'dark',
            callback: function (token) { finish({ recaptcha_data: token }) },
            'error-callback': fail,
            'expired-callback': fail
          })
        }
      } catch (error) {
        fail()
      }
    })
  }

  function closeCaptchaDialog () {
    var dialog = document.querySelector('[data-captcha-dialog]')
    var state = captchaState
    captchaState = null
    try {
      if (state && state.widgetId != null && state.type === 'turnstile' && window.turnstile) window.turnstile.remove(state.widgetId)
      else if (state && state.widgetId != null && window.grecaptcha) window.grecaptcha.reset(state.widgetId)
    } catch (_) {}
    if (dialog && dialog.open) dialog.close()
  }

  function safeRedirect (value) {
    if (!value || value.charAt(0) !== '/' || value.indexOf('//') === 0 || isAuthRoute(value)) return '/dashboard'
    return value
  }

  function goToLegacy (path) {
    var destination = safeRedirect(path)
    prepareLegacyTransition()
    if (routeInfo().path === destination) {
      return showLegacyRoute()
    }
    // Keep the authentication page in browser history. Replacing this entry
    // made Back leave Xboard (and often land on a stale /login 404 URL).
    window.location.hash = '#' + destination
    syncRoute()
    return Promise.resolve()
  }

  async function handleTokenLogin () {
    var info = routeInfo()
    var verify = info.params.get('verify')
    if (info.path !== '/login' || !verify || tokenLoginKey === verify) return
    tokenLoginKey = verify
    try {
      var redirect = safeRedirect(info.params.get('redirect'))
      var data = await api('/passport/auth/token2Login?verify=' + encodeURIComponent(verify) + '&redirect=' + encodeURIComponent(redirect))
      if (data && data.auth_data) {
        writeStorage('access_token', data.auth_data, 21600)
        toast(copy().loginSuccess, 'success')
        await goToLegacy(redirect)
      }
    } catch (error) {
      toast(errorMessage(error, copy().requestFailed), 'error')
    }
  }

  function errorMessage (error, fallback) {
    return error && error.message ? error.message : fallback
  }

  function toast (message, type) {
    var region = document.querySelector('[data-toast-region]')
    if (!region || !message) return
    var item = document.createElement('div')
    item.className = 'xb-toast xb-toast--' + (type || 'info')
    item.textContent = message
    region.appendChild(item)
    window.requestAnimationFrame(function () { item.classList.add('is-visible') })
    window.setTimeout(function () {
      item.classList.remove('is-visible')
      window.setTimeout(function () { item.remove() }, 220)
    }, 3200)
  }

  function updateStaticLanguage () {
    var locale = currentLocale()
    var c = copy()
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'fa-IR' ? 'rtl' : 'ltr'
    document.querySelectorAll('[data-nav-key]').forEach(function (button, index) {
      button.textContent = c.nav[index]
      button.setAttribute('aria-label', c.nav[index])
    })
    var label = document.querySelector('[data-language-label]')
    if (label) label.textContent = localeNames[locale] || locale
    var captchaTitle = document.querySelector('[data-captcha-title]')
    if (captchaTitle) captchaTitle.textContent = c.captchaTitle
  }

  function buildLanguageMenu () {
    var menu = document.querySelector('[data-language-menu]')
    if (!menu) return
    var locale = currentLocale()
    var allowed = (window.settings && window.settings.i18n) || ['zh-CN']
    menu.innerHTML = allowed.map(function (code) {
      return '<button type="button" role="menuitemradio" aria-checked="' + (code === locale ? 'true' : 'false') + '" data-locale="' + escapeHtml(code) + '"' + (code === locale ? ' class="is-active"' : '') + '>' +
        '<span>' + escapeHtml(localeNames[code] || code) + '</span><small>' + escapeHtml(code) + '</small></button>'
    }).join('')
    menu.querySelectorAll('[data-locale]').forEach(function (button) {
      button.addEventListener('click', function () {
        var next = button.getAttribute('data-locale')
        writeStorage('locale', next, null)
        window.location.reload()
      })
    })
  }

  function bindGlobal () {
    document.querySelectorAll('[data-nav-key="features"], [data-nav-key="help"], [data-nav-key="about"]').forEach(function (button) {
      button.remove()
    })
    var trigger = document.querySelector('[data-language-trigger]')
    var menu = document.querySelector('[data-language-menu]')
    if (trigger && menu) {
      trigger.addEventListener('click', function (event) {
        event.stopPropagation()
        var opening = menu.hidden
        menu.hidden = !opening
        trigger.setAttribute('aria-expanded', opening ? 'true' : 'false')
      })
      document.addEventListener('click', function (event) {
        if (!event.target.closest('[data-language]')) {
          menu.hidden = true
          trigger.setAttribute('aria-expanded', 'false')
        }
      })
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          menu.hidden = true
          trigger.setAttribute('aria-expanded', 'false')
          if (captchaState && captchaState.cancel) captchaState.cancel()
        }
      })
    }
    var close = document.querySelector('[data-captcha-close]')
    if (close) close.addEventListener('click', function () {
      if (captchaState && captchaState.cancel) captchaState.cancel()
    })
    document.querySelectorAll('[data-nav-key]').forEach(function (button) {
      button.addEventListener('click', function () {
        var destination = button.getAttribute('data-nav-key') === 'nodes' ? '/global-nodes' : '/login'
        if (routeInfo().path !== destination) window.location.hash = '#' + destination
        syncRoute()
      })
    })
  }

  function routeLoader (visible) {
    var loader = document.querySelector('[data-route-loader]')
    if (!loader) return
    var label = loader.querySelector('[data-route-loader-label]')
    if (label) label.textContent = copy().loading
    loader.hidden = !visible
  }

  function prepareLegacyTransition () {
    var root = document.querySelector('[data-auth-root]')
    var app = document.getElementById('app')
    if (root) root.hidden = true
    if (app) app.hidden = true
    routeLoader(true)
    document.body.classList.remove('xb-auth-page')
    document.body.classList.remove('xb-static-page')
    document.body.classList.add('xb-legacy-page')
    document.documentElement.classList.remove('xb-routing')
  }

  function legacyBundleUrl () {
    return (window.__XB_AUTH_ASSET_BASE__ || '/theme/Xboard/assets') + '/umi.js'
  }

  function preloadLegacyBundle () {
    if (legacyLoaded) return Promise.resolve()
    if (legacyPreloadPromise) return legacyPreloadPromise
    legacyPreloadPromise = new Promise(function (resolve) {
      var link = document.querySelector('link[data-xb-legacy-preload]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'modulepreload'
        link.crossOrigin = 'anonymous'
        link.href = legacyBundleUrl()
        link.setAttribute('data-xb-legacy-preload', '')
        document.head.appendChild(link)
      }
      if (link.sheet) {
        resolve()
        return
      }
      link.addEventListener('load', resolve, { once: true })
      link.addEventListener('error', function () {
        legacyPreloadPromise = null
        resolve()
      }, { once: true })
    })
    return legacyPreloadPromise
  }

  function ensureLegacyLoaded () {
    if (legacyLoadPromise) return legacyLoadPromise
    legacyLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script')
      script.type = 'module'
      script.crossOrigin = 'anonymous'
      script.src = legacyBundleUrl()
      script.setAttribute('data-xb-legacy-bundle', '')
      script.onload = function () {
        legacyLoaded = true
        resolve()
      }
      script.onerror = function () {
        legacyLoadPromise = null
        reject(new Error(copy().requestFailed))
      }
      document.head.appendChild(script)
    })
    return legacyLoadPromise
  }

  function scheduleLegacyWarmup () {
    if (legacyWarmupScheduled || legacyLoaded) return
    legacyWarmupScheduled = true
    var card = document.querySelector('[data-auth-card]')
    var warm = function () {
      if (legacyLoaded || !isAuthFormRoute(routeInfo().path)) return
      preloadLegacyBundle().catch(function () {})
    }
    if (card) {
      card.addEventListener('pointerdown', warm, { once: true, passive: true })
      card.addEventListener('focusin', warm, { once: true })
      card.addEventListener('keydown', warm, { once: true })
    }
    window.setTimeout(function () {
      if (legacyLoaded) return
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(warm, { timeout: 2500 })
      } else {
        warm()
      }
    }, 1400)
  }

  function legacyViewReady () {
    var app = document.getElementById('app')
    if (!app || !app.firstElementChild) return false
    return !app.querySelector('input[type="password"]')
  }

  function revealLegacyWhenReady (ticket) {
    var app = document.getElementById('app')
    return new Promise(function (resolve) {
      var settled = false
      var observer
      var timeout
      function finish () {
        if (settled) return
        settled = true
        if (observer) observer.disconnect()
        window.clearTimeout(timeout)
        resolve()
      }
      function check () {
        if (ticket !== legacyViewTicket || isAuthRoute(routeInfo().path)) {
          finish()
          return
        }
        if (legacyViewReady()) {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(finish)
          })
        }
      }
      observer = new MutationObserver(check)
      observer.observe(app, { childList: true, subtree: true })
      timeout = window.setTimeout(finish, 1600)
      check()
    })
  }

  function showAuthRoute () {
    legacyViewTicket += 1
    mode = 'auth'
    document.body.classList.remove('xb-legacy-page')
    document.body.classList.add('xb-auth-page')
    var root = document.querySelector('[data-auth-root]')
    var app = document.getElementById('app')
    if (root) root.hidden = false
    if (app) app.hidden = true
    routeLoader(false)
    buildLanguageMenu()
    renderAuth()
    if (isAuthFormRoute(routeInfo().path)) {
      loadConfig()
      handleTokenLogin()
      scheduleLegacyWarmup()
    }
    document.documentElement.classList.remove('xb-routing')
  }

  async function showLegacyRoute () {
    var ticket = ++legacyViewTicket
    mode = 'legacy'
    prepareLegacyTransition()
    try {
      await ensureLegacyLoaded()
      await revealLegacyWhenReady(ticket)
      if (ticket !== legacyViewTicket || isAuthRoute(routeInfo().path)) return
      var app = document.getElementById('app')
      if (app) app.hidden = false
      routeLoader(false)
    } catch (error) {
      routeLoader(false)
      toast(errorMessage(error, copy().requestFailed), 'error')
    }
  }

  function syncRoute () {
    var info = routeInfo()
    var signature = info.path + '?' + info.params.toString()
    var auth = isAuthRoute(info.path)
    if (signature === lastRouteSignature && ((auth && mode === 'auth') || (!auth && mode === 'legacy'))) return
    lastRouteSignature = signature
    if (auth) {
      window.clearInterval(countdownTimer)
      countdown = 0
      closeCaptchaDialog()
      showAuthRoute()
    } else if (mode !== 'legacy') {
      showLegacyRoute()
    }
  }

  function installHistorySync () {
    if (historySyncInstalled) return
    historySyncInstalled = true
    function wrap (nativeMethod) {
      return function () {
        var before = window.location.href
        var result = nativeMethod.apply(window.history, arguments)
        if (window.location.href !== before) Promise.resolve().then(syncRoute)
        return result
      }
    }
    window.history.pushState = wrap(nativeHistoryPushState)
    window.history.replaceState = wrap(nativeHistoryReplaceState)
  }

  function boot () {
    bindGlobal()
    updateStaticLanguage()
    var info = routeInfo()
    if (info.path === '/') {
      var hasToken = Boolean(readStorage('access_token', ''))
      nativeHistoryReplaceState.call(window.history, null, '', hasToken ? '/#/dashboard' : '/#/login')
      info = routeInfo()
    }
    installHistorySync()
    lastRouteSignature = info.path + '?' + info.params.toString()
    if (isAuthRoute(info.path)) showAuthRoute()
    else showLegacyRoute()
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
  }

  boot()
})()
