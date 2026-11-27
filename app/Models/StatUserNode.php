<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StatUserNode extends Model
{
    protected $table = 'v2_stat_user_node';
    public $timestamps = false;
    protected $guarded = ['id'];
    protected $casts = [
        'record_at' => 'integer',
        'first_report_at' => 'integer',
        'last_report_at' => 'integer',
        'u' => 'integer',
        'd' => 'integer',
        'billed_u' => 'integer',
        'billed_d' => 'integer',
    ];
}
