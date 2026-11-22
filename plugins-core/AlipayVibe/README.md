# Alipay Vibe Pay 网页收款插件

适用于已申请支付宝 Vibe Pay「基础收款能力 → AI 网页应用收款」的 Xboard 实例。插件代码为 `alipay_vibe`，支付接口为 `AlipayVibe`。

参考 AlipayF2F 的插件注册与支付接口结构，使用 `alipay.trade.page.pay` / `FAST_INSTANT_TRADE_PAY` 生成签名后的支付宝收银台地址，返回 Xboard 已有的跳转支付类型 `type=1`。用户在官方收银台扫码付款。此接口不返回当面付的 `qr_code`，不调用 `alipay.trade.precreate`，也不需要增加前端页面。

## 接入方式

官网「通过 Agent 接入」与「通过页面引导接入」是同一产品的两种集成流程。已有 Xboard 订单与权益系统，可由 Agent 完成插件开发，按页面完成申请、签约及应用密钥配置。选择流程不会代替产品审批，也不会改变应用已开通的接口权限。

## 配置

1. 将插件随项目镜像发布，在管理后台安装并启用 **Alipay Vibe Pay**。
2. 在支付配置新增渠道，接口选择 **AlipayVibe**，填写以下配置。

| 配置 | 内容 |
| --- | --- |
| `app_id` | 对应环境的支付宝应用 APPID |
| `seller_id` | 收款支付宝账号 UID，沙箱使用沙箱商家 UID |
| `private_key` | RSA2 应用私钥，支持 PKCS#1 / PKCS#8 PEM 和纯 Base64 |
| `public_key` | 对应应用的支付宝公钥，不能填应用公钥 |
| `environment` | `sandbox`（默认）或 `production` |
| `product_name` | 可选的真实商品名称，默认站点名称加「订阅」 |

当前支持应用自营、公钥模式，不含证书模式、服务商代调用或自动退款。应用、收款账号和密钥应配套填写；正式环境须已完成产品签约且获得相应接口权限。密钥只填入后台支付渠道配置，不写入代码或 Git。

`PaymentService` 自动生成回调地址：`https://面板域名/api/v1/guest/payment/notify/AlipayVibe/渠道UUID`。支持现有的通知域名配置；回调必须可由支付宝访问且不发生重定向。同步跳转返回 Xboard 订单页，入账依赖验签成功的异步通知，不信任浏览器返回的支付结果。

回调校验 RSA2 签名、APPID、收款 UID、订单号、支付渠道和总金额（含支付手续费），仅接受 `TRADE_SUCCESS` / `TRADE_FINISHED`。有效结果交给现有 `PaymentController` / `OrderService`，沿用其重复通知处理机制。支付宝订单到期时间设置为 Xboard 订单创建后两小时，重复结算不延长有效期；最后一分钟不再生成付款链接。

## 漏通知查单

插件启用后会注册命令，默认只读。命令调用 `alipay.trade.query`，校验原始响应签名、订单号、金额及渠道：

```sh
php artisan alipay-vibe:query 订单号
php artisan alipay-vibe:query 订单号 --sync
```

容器部署可在前面加 `docker compose exec xboard`。`--sync` 只对仍处于待支付状态且未发生渠道/金额变化的订单调用 Xboard 订单服务；已处理或已取消订单不会重新开通。当前未启用定时查单；遇到用户已付款但仍待支付时，需运行此命令排查及补记。Xboard 会自动取消超过两小时的待支付订单，已取消但支付宝已付款的情况需人工核对处理。

## 验证与上线

无须读取 `.env` 或连接真实业务库的离线回归：

```sh
php tests/Standalone/alipay-vibe.php
```

测试使用内存 SQLite、运行时生成的临时 RSA 密钥及模拟 HTTP 响应，覆盖出站签名、密钥格式、环境切换、回调篡改、金额/商户/渠道校验与查单验签，不代表支付宝真实沙箱联调完成。

上线前使用沙箱 APPID、密钥及沙箱买家验证：发起付款 → 官方收银台 → 异步通知 → Xboard 开通；再验证重复通知、含手续费金额和漏通知查单。审批通过后切换正式环境及配套凭证，进行实际小额交易验收。代码开发不自动创建真实收款渠道或部署生产环境。

## 官方资料

- [Vibe Pay 产品入口](https://aipay.alipay.com/products/vibe-pay)
- [AI 网页应用收款接入指南](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/ai-web-app-payment-integration-guide.html)
- [网页支付接口](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/api-list/alipay-trade-page-pay.html)
- [异步通知与验签](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/api-list/async-notify-verify.html)
- [交易查询接口](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/api-list/alipay-trade-query.html)
