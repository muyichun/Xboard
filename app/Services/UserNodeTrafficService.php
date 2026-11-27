<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class UserNodeTrafficService
{
    /** Keep raw bytes and per-report billed bytes, including zero-rate nodes. */
    public function record(int $userId, array $server, string $protocol, array $traffic, int $receivedAt): void
    {
        $u = (int) $traffic[0];
        $d = (int) $traffic[1];
        if ($u === 0 && $d === 0) {
            return;
        }

        $table = 'v2_stat_user_node';
        $connection = DB::connection();
        $grammar = $connection->getQueryGrammar();
        $mysql = in_array($connection->getDriverName(), ['mysql', 'mariadb'], true);
        $current = fn (string $column) => $grammar->wrap($table . '.' . $column);
        $incoming = fn (string $column) => $mysql
            ? 'VALUES(' . $grammar->wrap($column) . ')'
            : $grammar->wrap('excluded.' . $column);
        $updates = [];
        foreach (['u', 'd', 'billed_u', 'billed_d'] as $column) {
            $updates[$column] = DB::raw($current($column) . ' + ' . $incoming($column));
        }
        foreach (['first_report_at' => '<', 'last_report_at' => '>'] as $column => $operator) {
            $updates[$column] = DB::raw('CASE WHEN ' . $incoming($column) . " $operator " . $current($column)
                . ' THEN ' . $incoming($column) . ' ELSE ' . $current($column) . ' END');
        }
        // Preserve the reported name even if the node is later deleted or renamed.
        DB::table($table)->upsert([[
            'user_id' => $userId,
            'server_id' => $server['id'],
            'server_name' => $server['name'],
            'server_type' => $protocol,
            'server_rate' => $server['rate'],
            'record_at' => strtotime(date('Y-m-d', $receivedAt)),
            'u' => $u,
            'd' => $d,
            'billed_u' => intval($u * $server['rate']),
            'billed_d' => intval($d * $server['rate']),
            'first_report_at' => $receivedAt,
            'last_report_at' => $receivedAt,
        ]], ['user_id', 'record_at', 'server_id', 'server_type', 'server_rate'], $updates);
    }
}
