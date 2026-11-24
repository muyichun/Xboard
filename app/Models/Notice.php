<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notice extends Model
{
    protected $table = 'v2_notice';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $appends = ['popup'];
    protected $casts = [
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
        'tags' => 'array',
        'show' => 'boolean',
    ];

    public function getPopupAttribute(): bool
    {
        return in_array('弹窗', (array) $this->tags, true);
    }

    public function setPopupAttribute(bool $enabled): void
    {
        $tags = array_values(array_filter((array) $this->tags, static fn ($tag) => $tag !== '弹窗'));
        if ($enabled) {
            $tags[] = '弹窗';
        }
        $this->tags = $tags;
    }
}
