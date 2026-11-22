<?php

namespace Plugin\AlipayVibe\library;

use App\Exceptions\ApiException;
use Illuminate\Support\Facades\Http;

class AlipayWeb
{
    private string $gateway;
    private string $appId;
    private \OpenSSLAsymmetricKey $privateKey;
    private \OpenSSLAsymmetricKey $publicKey;

    public function __construct(array $config)
    {
        foreach (['app_id', 'seller_id', 'private_key', 'public_key'] as $field) {
            if (!is_string($config[$field] ?? null) || trim($config[$field]) === '') {
                throw new ApiException('支付宝配置缺失：' . $field);
            }
        }
        $gateways = [
            'sandbox' => 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
            'production' => 'https://openapi.alipay.com/gateway.do'
        ];
        $environment = $config['environment'] ?? 'sandbox';
        if (!is_string($environment) || !isset($gateways[$environment])) {
            throw new ApiException('支付宝支付环境必须为 sandbox 或 production');
        }
        $this->gateway = $gateways[$environment];
        $this->appId = $config['app_id'];
        $this->privateKey = $this->readKey($config['private_key'], true);
        $this->publicKey = $this->readKey($config['public_key'], false);
    }

    public function pagePay(array $business, string $notifyUrl, string $returnUrl): string
    {
        $params = $this->parameters('alipay.trade.page.pay', $business, [
            'notify_url' => $notifyUrl,
            'return_url' => $returnUrl
        ]);
        return $this->gateway . '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    public function verifyNotification(array $params): bool
    {
        foreach ($params as $value) {
            if (!is_string($value) && $value !== null) {
                return false;
            }
        }
        if (($params['sign_type'] ?? null) !== 'RSA2' || empty($params['sign'])) {
            return false;
        }
        $signature = $params['sign'];
        unset($params['sign'], $params['sign_type']);
        // Laravel 已对表单参数进行 URLDecode，不能再次解码。
        return $this->verify($this->canonical($params), $signature);
    }

    public function query(string $tradeNo): array
    {
        try {
            $response = Http::asForm()->connectTimeout(5)->timeout(15)->withOptions([
                'allow_redirects' => false
            ])->post($this->gateway, $this->parameters('alipay.trade.query', [
                'out_trade_no' => $tradeNo
            ]));
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new ApiException('支付宝查单连接失败，请稍后重试');
        }
        if (!$response->successful()) {
            throw new ApiException('支付宝查单请求失败');
        }

        // 对原始响应对象验签，不能重新 JSON 编码（会改变空白、转义及数字格式）。
        $body = $response->body();
        $data = json_decode($body, true);
        $raw = $this->queryResponseBody($body);
        if (!is_array($data) || !is_string($data['sign'] ?? null)
            || $raw === null || !$this->verify($raw, $data['sign'])) {
            throw new ApiException('支付宝查单响应验签失败');
        }
        $result = json_decode($raw, true);
        if (($result['code'] ?? null) !== '10000') {
            throw new ApiException('支付宝查单未成功，请核对订单号和应用配置');
        }
        return $result;
    }

    public static function formatAmount($cents): string
    {
        if ((!is_int($cents) && !(is_string($cents) && ctype_digit($cents)))
            || $cents < 1 || $cents > 10000000000) {
            throw new ApiException('支付宝订单金额无效');
        }
        return intdiv((int) $cents, 100) . '.' . str_pad((string) ((int) $cents % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function parseAmount(string $amount): ?int
    {
        if (!preg_match('/\A(0|[1-9][0-9]{0,8})(?:\.([0-9]{1,2}))?\z/', $amount, $matches)) {
            return null;
        }
        $cents = (int) $matches[1] * 100 + (int) str_pad($matches[2] ?? '', 2, '0');
        return $cents > 0 && $cents <= 10000000000 ? $cents : null;
    }

    private function parameters(string $method, array $business, array $extra = []): array
    {
        $params = array_merge([
            'app_id' => $this->appId,
            'method' => $method,
            'format' => 'JSON',
            'charset' => 'utf-8',
            'sign_type' => 'RSA2',
            'timestamp' => (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Shanghai')))->format('Y-m-d H:i:s'),
            'version' => '1.0',
            'biz_content' => json_encode($business, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)
        ], $extra);
        if (!openssl_sign($this->canonical($params), $signature, $this->privateKey, OPENSSL_ALGO_SHA256)) {
            throw new ApiException('支付宝请求签名失败');
        }
        $params['sign'] = base64_encode($signature);
        return $params;
    }

    private function canonical(array $params): string
    {
        ksort($params, SORT_STRING);
        $pairs = [];
        foreach ($params as $key => $value) {
            if ($value !== '' && $value !== null) {
                $pairs[] = $key . '=' . $value;
            }
        }
        return implode('&', $pairs);
    }

    private function verify(string $content, string $signature): bool
    {
        $decoded = base64_decode($signature, true);
        return $decoded !== false && openssl_verify($content, $decoded, $this->publicKey, OPENSSL_ALGO_SHA256) === 1;
    }

    private function readKey(string $value, bool $private): \OpenSSLAsymmetricKey
    {
        $value = trim($value);
        $candidates = [$value];
        if (!str_contains($value, '-----BEGIN')) {
            $body = chunk_split(preg_replace('/\s+/', '', $value), 64, "\n");
            $labels = $private ? ['PRIVATE KEY', 'RSA PRIVATE KEY'] : ['PUBLIC KEY'];
            $candidates = array_map(fn($label) => "-----BEGIN {$label}-----\n{$body}-----END {$label}-----", $labels);
        }
        foreach ($candidates as $candidate) {
            // OpenSSL 的格式错误不应把密钥或底层错误暴露给接口调用方。
            $key = $private ? @openssl_pkey_get_private($candidate) : @openssl_pkey_get_public($candidate);
            if ($key !== false) {
                $details = openssl_pkey_get_details($key);
                if ($details['type'] === OPENSSL_KEYTYPE_RSA && $details['bits'] >= 2048) {
                    return $key;
                }
            }
        }
        throw new ApiException($private ? '应用私钥无效，请填写 RSA2 私钥' : '支付宝公钥无效，请填写 RSA2 公钥');
    }

    private function queryResponseBody(string $body): ?string
    {
        // 支付宝将响应对象放在首字段；只接受明确的响应信封，避免匹配嵌套的伪响应。
        if (!preg_match('/\A\s*\{\s*"alipay_trade_query_response"\s*:\s*(\{)/', $body, $matches, PREG_OFFSET_CAPTURE)) {
            return null;
        }
        $start = $matches[1][1];
        $depth = 0;
        $quoted = false;
        $escaped = false;
        for ($i = $start, $length = strlen($body); $i < $length; $i++) {
            $char = $body[$i];
            if ($quoted) {
                if ($escaped) {
                    $escaped = false;
                } elseif ($char === '\\') {
                    $escaped = true;
                } elseif ($char === '"') {
                    $quoted = false;
                }
            } elseif ($char === '"') {
                $quoted = true;
            } elseif ($char === '{') {
                $depth++;
            } elseif ($char === '}' && --$depth === 0) {
                // 剩余信封只允许签名，拒绝重复响应键、尾随或未签名的业务字段。
                if (!preg_match('/\A\s*,\s*"sign"\s*:\s*"[A-Za-z0-9+\/=]+"\s*\}\s*\z/', substr($body, $i + 1))) {
                    return null;
                }
                return substr($body, $start, $i - $start + 1);
            }
        }
        return null;
    }
}
