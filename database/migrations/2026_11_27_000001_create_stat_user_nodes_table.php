<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('v2_stat_user_node', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->integer('server_id');
            $table->string('server_name');
            $table->string('server_type', 32);
            $table->decimal('server_rate', 10, 2);
            $table->integer('record_at');
            $table->bigInteger('u')->default(0);
            $table->bigInteger('d')->default(0);
            $table->bigInteger('billed_u')->default(0);
            $table->bigInteger('billed_d')->default(0);
            $table->integer('first_report_at');
            $table->integer('last_report_at');
            $table->unique(['user_id', 'record_at', 'server_id', 'server_type', 'server_rate'], 'stat_user_node_bucket');
            $table->index('record_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_stat_user_node');
    }
};
