<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\NoticeSave;
use App\Models\Notice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NoticeController extends Controller
{
    public function fetch(Request $request)
    {
        return $this->success(
            Notice::orderBy('sort', 'ASC')
                ->orderBy('id', 'DESC')
                ->get()
        );
    }

    public function save(NoticeSave $request)
    {
        $notice = $request->filled('id') ? Notice::find($request->input('id')) : new Notice();
        if (!$notice) {
            return $this->fail([400202, '公告不存在']);
        }

        $notice->fill($request->safe()->except(['id', 'popup']));
        if ($request->has('popup')) {
            $notice->popup = $request->boolean('popup');
        }
        return $notice->save() ? $this->success(true) : $this->fail([500, '保存失败']);
    }

    public function show(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer',
            'show' => 'sometimes|boolean',
            'popup' => 'sometimes|boolean',
        ]);

        return DB::transaction(function () use ($params, $request) {
            $notice = Notice::lockForUpdate()->find($params['id']);
            if (!$notice) {
                return $this->fail([400202, '公告不存在']);
            }
            if ($request->has('popup')) {
                $notice->popup = $request->boolean('popup');
            }
            if ($request->has('show')) {
                $notice->show = $request->boolean('show');
            } elseif (!$request->has('popup')) {
                $notice->show = !$notice->show;
            }
            return $notice->save() ? $this->success(true) : $this->fail([500, '保存失败']);
        });
    }

    public function drop(Request $request)
    {
        if (empty($request->input('id'))) {
            return $this->fail([422, '公告ID不能为空']);
        }
        $notice = Notice::find($request->input('id'));
        if (!$notice) {
            return $this->fail([400202, '公告不存在']);
        }
        if (!$notice->delete()) {
            return $this->fail([500, '删除失败']);
        }
        return $this->success(true);
    }

    public function sort(Request $request)
    {
        $params = $request->validate([
            'ids' => 'required|array'
        ]);

        try {
            DB::beginTransaction();
            foreach ($params['ids'] as $k => $v) {
                $notice = Notice::findOrFail($v);
                $notice->update(['sort' => $k + 1]);
            }
            DB::commit();
            return $this->success(true);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error($e);
            return $this->fail([500, '排序保存失败']);
        }
    }
}
