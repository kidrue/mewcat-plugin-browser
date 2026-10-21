# 阿里云轻量应用服务器部署命令

适用：**Ubuntu 22.04 / 24.04 系统镜像**、单台服务器，Docker Compose + Nginx + HTTPS。其他系统（例如 Alibaba Cloud Linux）不能照抄 apt 命令。以下命令在服务器 SSH 终端运行，不是在本机 PowerShell 运行。建议至少 2 GB 内存用于本机构建；不需要在宿主机安装 Node.js。

GitHub 仓库：`kidrue/mewCat-servicer`。私有仓库建议使用只读 Deploy key 拉取。

## 1. 云端准备

1. 域名的 A 记录指向服务器公网 IPv4；未配置 IPv6 时不要留下错误的 AAAA 记录。
2. 轻量服务器控制台防火墙放行 TCP 80、443；SSH 22 建议仅允许管理 IP。不要对公网开放 3000。
3. 本地系统防火墙如果已启用，也放行 80/443，保留 SSH 规则。
4. 中国内地节点对外提供网站服务前按阿里云要求完成备案；参见[阿里云使用限制](https://help.aliyun.com/zh/simple-application-server/product-overview/usage-notes)和[轻量服务器防火墙](https://help.aliyun.com/zh/simple-application-server/user-guide/manage-the-firewall-of-a-server)。

进入 root shell 并确认系统：

```bash
sudo -i
cat /etc/os-release
```

下文以 root 执行，因此不反复加 sudo。已有网站的服务器先检查端口占用，不覆盖其站点配置。

## 2. 安装 Docker、Git、Nginx

已有 Docker Engine 和 Compose 插件时，只需确认 `docker compose version` 可运行；不必重新安装。全新 Ubuntu：

```bash
apt-get update
apt-get install -y ca-certificates curl git nginx nano
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
  "$(dpkg --print-architecture)" "$VERSION_CODENAME" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx
docker compose version
```

安装方式依据 [Docker Ubuntu 官方文档](https://docs.docker.com/engine/install/ubuntu/)。如果已有 docker.io、podman 或旧版 containerd，不直接覆盖安装；先按官方文档处理冲突。若阿里云节点无法连接 Docker Hub/GitHub，应使用自己的可信镜像源或在 CI 构建后上传阿里云镜像仓库；不要随意运行未知镜像加速脚本。

## 3. 拉取私有仓库

在服务器生成专用只读拉取密钥，已有文件不会重新生成：

```bash
install -m 0700 -d /root/.ssh
test -f /root/.ssh/mewcat_github || ssh-keygen -t ed25519 -N '' -C 'mewcat-server-readonly' -f /root/.ssh/mewcat_github
cat /root/.ssh/mewcat_github.pub
```

将输出的**公钥**添加到 GitHub 仓库 Settings → Deploy keys → Add deploy key，不勾选写权限。不要上传私钥。

```bash
export GIT_SSH_COMMAND='ssh -i /root/.ssh/mewcat_github -o IdentitiesOnly=yes'
git clone git@github.com:kidrue/mewCat-servicer.git /opt/mewCat-service
cd /opt/mewCat-service
```

首次连接按 GitHub 官方公布的 SSH 主机指纹核对确认，不禁用主机密钥检查。若目录已有代码，则进入已有目录，不重复 clone。

## 4. 配置服务器密钥与供应商

```bash
cd /opt/mewCat-service
test -f .env || cp .env.example .env
chmod 600 .env
nano .env
```

至少填写以下内容；供应商密钥只写入服务器 `.env`：

```dotenv
NODE_ENV=production
SILICONFLOW_API_KEY=填写真实密钥
SILICONFLOW_MODEL=填写控制台当前可用的模型ID
ALLOWED_ORIGINS=
MAX_CONCURRENT_REQUESTS=4
```

接口访问白名单统一维护在仓库的 `config/allowed-origins.json`，当前包含 Chrome Web Store 正式扩展、私钥构建扩展与本机 unpacked 开发扩展。构建会校验来源格式并将列表打包进产物和镜像；`ALLOWED_ORIGINS` 未设置或为空时使用这份列表，显式配置时以 `.env` 为准，多个来源使用逗号分隔。修改仓库列表后重新构建部署即可生效；若旧 `.env` 中已填写白名单，手动部署前将其清空以使用新版仓库配置。扩展 ID 与发布渠道、Chrome 配置及加载路径绑定，变更渠道、开发机或路径后应按 `chrome://extensions` 显示的新 ID 更新允许列表。

建议选择支持 JSON 输出及非思考模式的文本模型。其余限额按预算调整。先构建，再使用工具容器在服务器本地生成密钥，不需要把开发机私钥上传：

```bash
docker compose build
install -d -m 0700 -o 1000 -g 1000 secrets

docker compose run --rm --no-deps \
  -e KEYS_FILE=/app/secrets/server-keys.json \
  -v "$PWD/secrets:/app/secrets" \
  migrate node dist/scripts/admin.js keys

docker compose run --rm migrate
docker compose up -d api
docker compose ps
curl --fail http://127.0.0.1:3000/health
```

保存命令打印的服务器**签名公钥指纹**，可用于扩展固定服务器身份。重复执行 keys 会安全拒绝覆盖。Compose 固定容器内端口 3000，密钥只读挂载，数据库放在命名卷中。

## 5. 配置可信反向代理和域名

宿主机 Nginx 进入 Docker 时，来源通常表现为容器网络网关。仅信任这个实际网关和回环地址，避免所有客户端被记为同一个 IP，同时拒绝公网伪造的转发头：

```bash
cd /opt/mewCat-service
MEWCAT_GATEWAY=$(docker inspect "$(docker compose ps -q api)" --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}')
test -n "$MEWCAT_GATEWAY" || { echo '未找到运行中的容器网关'; exit 1; }
sed -i "s/^TRUST_PROXY=.*/TRUST_PROXY=127.0.0.1,::1,$MEWCAT_GATEWAY/" .env
docker compose up -d --no-deps api

# 替换成你的真实域名。
MEWCAT_DOMAIN='translate.example.com'
sed "s/translate.example.com/$MEWCAT_DOMAIN/g" deploy/nginx.conf \
  > /etc/nginx/conf.d/mewcat.conf
nginx -t && systemctl reload nginx
```

模板覆盖外部提供的 X-Forwarded-For，而不是盲目信任请求携带的来源链。若 Docker 网络被重建且网关改变，重新执行这一节的网关配置。依据 [Nginx 反向代理文档](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。

## 6. 启用 HTTPS

确认 DNS 已生效，80/443 可从公网访问。全新 Ubuntu 可通过系统包安装 Certbot：

```bash
apt-get install -y certbot python3-certbot-nginx
MEWCAT_DOMAIN='translate.example.com'
MEWCAT_EMAIL='你接收证书通知的邮箱'
certbot --nginx -d "$MEWCAT_DOMAIN" --redirect \
  --agree-tos --non-interactive -m "$MEWCAT_EMAIL"
systemctl enable --now certbot.timer
certbot renew --dry-run
curl --fail "https://$MEWCAT_DOMAIN/health"
```

Certbot 会申请证书并修改 Nginx 配置，参见 [Certbot Nginx 指南](https://certbot.eff.org/instructions?os=pip&ws=nginx)。服务器已有其他安装方式的 Certbot 时使用现有版本，不混用安装方式。浏览器扩展的远程服务地址必须使用 HTTPS。

## 7. 接入扩展并管理设备

```bash
cd /opt/mewCat-service
docker compose run --rm migrate node dist/scripts/admin.js clients
```

扩展配置服务地址 `https://你的域名` 后会按设备密钥自动注册；配置对应 host_permissions，并使用服务器签名公钥指纹。公网部署应保留注册 IP 日限额。接入代码见 [README](../README.md#chrome-扩展接入)。

撤销某个设备：

```bash
docker compose run --rm migrate node dist/scripts/admin.js revoke 实际clientId
```

## 8. 更新代码

需要每次推送 `main` 后自动部署镜像，请使用 [GitHub Actions 自动部署](github-actions-deploy.md)。启用后日常管理使用该文档中的发布配置，不再执行下面的源码构建更新命令。

先执行下一节备份，然后：

```bash
cd /opt/mewCat-service
export GIT_SSH_COMMAND='ssh -i /root/.ssh/mewcat_github -o IdentitiesOnly=yes'
git pull --ff-only
docker compose build
docker compose stop api
docker compose run --rm migrate
docker compose up -d --no-deps api
docker compose ps
curl --fail http://127.0.0.1:3000/health
```

迁移失败时不要继续启动新版本；保留备份并排查，不对数据库强制重置。停止服务迁移会产生短暂停机。不要运行 `docker compose down -v`，它会删除数据库卷。

## 9. 备份与排障

停止应用后复制完整 SQLite 数据目录，保证一致性；备份目录只允许 root 访问：

```bash
cd /opt/mewCat-service
MEWCAT_BACKUP="/var/backups/mewcat/$(date +%Y%m%d-%H%M%S)"
install -d -m 0700 "$MEWCAT_BACKUP"
docker compose stop api
docker compose cp api:/app/data "$MEWCAT_BACKUP/data"
cp -a secrets "$MEWCAT_BACKUP/secrets"
cp -a .env "$MEWCAT_BACKUP/.env"
docker compose start api
```

备份包含供应商密钥及服务身份，不能提交到 GitHub，也不要放进网站目录。恢复时须同时恢复数据库和原服务器密钥。

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 migrate
nginx -t
systemctl status nginx --no-pager
ss -lntp | grep -E ':80 |:443 |:3000 '
curl --fail http://127.0.0.1:3000/health
```

本机健康检查正常但公网失败：检查 DNS、防火墙、备案状态及 Nginx。所有用户合计触发同一 IP 额度：检查实际代理网关与 TRUST_PROXY。容器启动失败：检查 `.env` 中必填配置、密钥归属 uid 1000、迁移结果。真实翻译失败：检查模型支持的参数、供应商余额与额度；服务不会自动重试付费调用。

这些命令已按项目配置审阅；尚未登录你的阿里云服务器执行，不代表服务器已经部署完成。
