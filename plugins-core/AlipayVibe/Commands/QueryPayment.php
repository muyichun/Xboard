<?php

namespace Plugin\AlipayVibe\Commands;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Services\OrderService;
use App\Services\Plugin\HookManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Plugin\AlipayVibe\Plugin;

class QueryPayment extends Command
{
    protected $signature = 'alipay-vibe:query {trade_no : Xboard 订单号} {--sync : 验证付款后补记待支付订单}';
    protected $description = '查询支付宝网页收款订单，默认只读，--sync 可补偿遗漏的支付通知';

    public function handle(): int
    {
        $order = Order::where('trade_no', $this->argument('trade_no'))->first();
        $payment = $order?->payment;
        if (!$payment || $payment->payment !== 'AlipayVibe' || !$payment->enable) {
            $this->error('订单不存在或未使用已启用的 AlipayVibe 渠道');
            return self::FAILURE;
        }
        $plugin = new Plugin('alipay_vibe');
        $plugin->setConfig(array_merge($payment->config ?? [], ['id' => $payment->id]));

        try {
            $verified = $plugin->query($order->trade_no);
            if (!$verified) {
                $this->warn('未取得与本地订单匹配的成功付款结果，订单未修改');
                return self::FAILURE;
            }
            $this->info('支付宝付款已验证，交易号：' . $verified['callback_no']);
            if (!$this->option('sync')) {
                $this->info('只读查询完成；如需补记待支付订单，请使用 --sync');
                return self::SUCCESS;
            }

            $synced = DB::transaction(function () use ($order, $verified) {
                $current = Order::whereKey($order->id)->lockForUpdate()->first();
                if (!$current || (int) $current->status !== Order::STATUS_PENDING
                    || (int) $current->payment_id !== (int) $order->payment_id
                    || (int) $current->total_amount !== (int) $order->total_amount
                    || (int) $current->handling_amount !== (int) $order->handling_amount) {
                    return false;
                }
                if (!(new OrderService($current))->paid($verified['callback_no'])) {
                    throw new ApiException('订单入账失败，请检查订单任务日志');
                }
                return true;
            });
            if ($synced) {
                HookManager::call('payment.notify.success', $order->fresh());
                $this->info('订单已通过 Xboard 订单服务补记付款');
            } else {
                $this->warn('订单已处理、取消或发生变化，本次未修改');
            }
            return $synced ? self::SUCCESS : self::FAILURE;
        } catch (ApiException $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
