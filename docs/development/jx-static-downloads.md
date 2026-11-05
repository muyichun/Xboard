# 即享云开发下载目录

2026-11-04：仅北京开发环境，未部署生产。

Caddy 将 `/downloads/jx-cloud/*` 映射到 `/www/.docker/.data/jx-downloads`。目录在已有持久化挂载中，不新增数据库、PHP 接口或认证规则。不提供目录列表；缺失文件返回 404。

客户端仓库 `tool/jx/stage_updates.py` 生成版本目录（DMG、对应源码、校验值、下载页）及 `latest.json`。先上传完整版本目录、验证 SHA-256，最后原子替换清单。正式发布必须改用核实过的生产 HTTPS 官网地址，当前下载仅为开发测试，应用尚无 Developer ID 签名和公证。

首次配置已通过容器内 caddy validate，并执行 make backup → make release，容器健康，原 guest config 返回 200。无 PHP 或数据库结构变更。

配置回退：宿主机原文件保留 `/root/jx-caddy-before-v0111`；修改前镜像保留 `jxcloud-dev-before-downloads:20261104`。若需要回退运行容器，先将此镜像标记为当前 Compose 镜像，再按既有 no-build/no-pull 重建流程恢复。仅回退版本可原子恢复旧 latest.json，无需重建容器。
