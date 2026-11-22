<?php

namespace Plugin\AlipayVibe;

use App\Contracts\PaymentInterface;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Services\Plugin\AbstractPlugin;
use Plugin\AlipayVibe\library\AlipayWeb;

class Plugin extends AbstractPlugin implements PaymentInterface
{
    public function boot(): void
    {
        $this->filter('available_payment_methods', function ($methods) {
            if ($this->getConfig('enabled', true)) {
                $methods['AlipayVibe'] = [
                    'name' => $this->getConfig('display_name', '支付宝网页收款'),
                    'icon' => $this->getConfig('icon', '💙'),
                    'plugin_code' => $this->getPluginCode(),
                    'type' => 'plugin'
                ];
            }
            return $methods;
        });
    }

    public function form(): array
    {
        return [
            'app_id' => [
                'label' => '支付宝 APPID',
                'type' => 'string',
                'required' => true,
                'description' => '已开通 AI 网页应用收款的应用 APPID'
            ],
            'seller_id' => [
                'label' => '收款支付宝 UID',
                'type' => 'string',
                'required' => true,
                'description' => '收款账号的 2088 开头 UID，用于校验收款方；沙箱填写沙箱商家 UID'
            ],
            'private_key' => [
                'label' => '应用私钥',
                'type' => 'text',
                'required' => true,
                'description' => 'RSA2 应用私钥，支持 PKCS#1 / PKCS#8 的 PEM 或纯 Base64 格式'
            ],
            'public_key' => [
                'label' => '支付宝公钥',
                'type' => 'text',
                'required' => true,
                'description' => '用于验签的支付宝公钥（不是应用公钥），当前使用公钥模式'
            ],
            'environment' => [
                'label' => '支付环境',
                'type' => 'string',
                'default' => 'sandbox',
                'description' => 'sandbox 为沙箱，production 为正式环境；切换时须同时更换 APPID、UID 和密钥'
            ],
            'product_name' => [
                'label' => '自定义商品名称',
                'type' => 'string',
                'description' => '显示在支付宝账单中，须与实际商品相符，不含 /、=、&'
            ]
        ];
    }

    public function pay($order): array
    {
        $gateway = $this->gateway();
        $localOrder = Order::where('trade_no', $order['trade_no'])
            ->where('payment_id', $this->getConfig('id'))
            ->where('status', Order::STATUS_PENDING)
            ->first();
        // 与 OrderHandleJob 的两小时自动取消时间保持一致，重复结算不延长有效期。
        $expiresAt = $localOrder ? (int) $localOrder->created_at + 7200 : 0;
        if ($expiresAt <= time() + 60) {
            throw new ApiException('订单不存在或即将过期，请重新下单');
        }
        $subject = trim((string) $this->getConfig('product_name', ''));
        if ($subject === '') {
            $subject = admin_setting('app_name', 'XBoard') . ' - 订阅';
        }
        if (mb_strlen($subject) > 256 || strpbrk($subject, '/=&') !== false) {
            throw new ApiException('支付宝商品名称不能超过 256 字符或包含 /、=、&');
        }

        return [
            'type' => 1,
            'data' => $gateway->pagePay([
                'out_trade_no' => $order['trade_no'],
                'total_amount' => AlipayWeb::formatAmount($order['total_amount']),
                'subject' => $subject,
                'product_code' => 'FAST_INSTANT_TRADE_PAY',
                'time_expire' => (new \DateTimeImmutable('@' . $expiresAt))
                    ->setTimezone(new \DateTimeZone('Asia/Shanghai'))->format('Y-m-d H:i:s')
            ], $order['notify_url'], $order['return_url'])
        ];
    }

    public function notify($params): array|bool
    {
        if (!is_array($params)) {
            return false;
        }
        try {
            if (!$this->gateway()->verifyNotification($params)
                || ($params['app_id'] ?? null) !== (string) $this->getConfig('app_id')
                || ($params['seller_id'] ?? null) !== (string) $this->getConfig('seller_id')) {
                return false;
            }
        } catch (ApiException $e) {
            return false;
        }

        return $this->verifiedPayment($params);
    }

    /**
     * 查询结果已由支付宝公钥验签；仅返回匹配本渠道、本订单的付款结果。
     */
    public function query(string $tradeNo): array|bool
    {
        $result = $this->gateway()->query($tradeNo);
        if (($result['out_trade_no'] ?? null) !== $tradeNo) {
            return false;
        }
        return $this->verifiedPayment($result);
    }

    private function verifiedPayment(array $params): array|bool
    {
        if (!in_array($params['trade_status'] ?? null, ['TRADE_SUCCESS', 'TRADE_FINISHED'], true)
            || !is_string($params['out_trade_no'] ?? null) || $params['out_trade_no'] === ''
            || !is_string($params['trade_no'] ?? null) || $params['trade_no'] === ''
            || !is_string($params['total_amount'] ?? null)
            || !$this->getConfig('id')) {
            return false;
        }

        $amount = AlipayWeb::parseAmount($params['total_amount']);
        if ($amount === null) {
            return false;
        }
        $order = Order::where('trade_no', $params['out_trade_no'])
            ->where('payment_id', $this->getConfig('id'))
            ->first();
        if (!$order || $amount !== (int) $order->total_amount + (int) $order->handling_amount) {
            return false;
        }

        return [
            'trade_no' => $params['out_trade_no'],
            'callback_no' => $params['trade_no']
        ];
    }

    private function gateway(): AlipayWeb
    {
        return new AlipayWeb($this->getConfig());
    }
}
