<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class OrderUpdate extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'status' => 'in:0,1,2,3',
            'commission_status' => $this->boolean('review_pending') ? 'required|in:1,3' : 'in:0,1,3',
            'review_pending' => 'sometimes|boolean',
        ];
    }

    public function messages()
    {
        return [
            'status.in' => '销售状态格式不正确',
            'commission_status.in' => '佣金状态格式不正确'
        ];
    }
}
