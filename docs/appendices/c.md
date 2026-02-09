---
title: "付録C: 設定ファイルサンプル"
layout: book
order: 103
---

# 付録C: 設定ファイルサンプル

典型的なシステム設定ファイルのサンプルと設定のベストプラクティスを示します。

## ネットワーク設定サンプル

### RHEL系（RHEL/RockyLinux/AlmaLinux等）ネットワーク設定

RHEL 8 以降では NetworkManager が標準となっており、設定は `nmcli` 等で管理する運用が一般的です。一方で、従来の `ifcfg-*` 形式は互換目的で残っている場合もあります（環境・方針により異なるため要確認）。

#### NetworkManager 設定例（nmcli）
```bash
# 例: eth0 に静的IPを設定（環境に合わせて調整）
nmcli connection modify eth0 \
  ipv4.method manual \
  ipv4.addresses "192.168.1.100/24" \
  ipv4.gateway "192.168.1.1" \
  ipv4.dns "8.8.8.8 8.8.4.4"

nmcli connection up eth0
```

#### /etc/sysconfig/network-scripts/ifcfg-eth0
```bash
# 静的IP設定例
TYPE=Ethernet
PROXY_METHOD=none
BROWSER_ONLY=no
BOOTPROTO=static
DEFROUTE=yes
IPV4_FAILURE_FATAL=no
IPV6INIT=yes
IPV6_AUTOCONF=yes
IPV6_DEFROUTE=yes
IPV6_FAILURE_FATAL=no
NAME=eth0
UUID=12345678-1234-1234-1234-123456789abc
DEVICE=eth0
ONBOOT=yes
IPADDR=192.168.1.100
NETMASK=255.255.255.0
GATEWAY=192.168.1.1
DNS1=8.8.8.8
DNS2=8.8.4.4
```

#### /etc/sysconfig/network
```bash
# システム全体のネットワーク設定
NETWORKING=yes
HOSTNAME=server01.example.com
GATEWAY=192.168.1.1
```

### Ubuntu/Debian ネットワーク設定

#### /etc/netplan/*.yaml の例 (Ubuntu / netplan)

※ 実際のファイル名はインストール形態や環境により異なる場合があります（例: `00-installer-config.yaml` / `50-cloud-init.yaml`）。
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses: [192.168.1.100/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
        search: [example.com]
```

#### /etc/network/interfaces (Debian/Ubuntu classic)
```bash
# The primary network interface
auto eth0
iface eth0 inet static
    address 192.168.1.100
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 8.8.4.4
    dns-search example.com

# DHCP設定例
# auto eth0
# iface eth0 inet dhcp
```

### ルーティング設定

#### /etc/sysconfig/network-scripts/route-eth0 (RHEL/CentOS)
```bash
# 静的ルート設定
10.0.0.0/8 via 192.168.1.254 dev eth0
172.16.0.0/12 via 192.168.1.254 dev eth0
```

#### /etc/network/interfaces でのルート設定 (Debian/Ubuntu)
```bash
# eth0インターフェース設定内に追加
up route add -net 10.0.0.0/8 gw 192.168.1.254 dev eth0
up route add -net 172.16.0.0/12 gw 192.168.1.254 dev eth0
```

## Web サーバー設定例

### Apache HTTP Server

#### /etc/httpd/conf/httpd.conf (基本設定)
```apache
# 基本設定
ServerRoot "/etc/httpd"
Listen 80
Listen 443 ssl

# セキュリティ設定
ServerTokens Prod
ServerSignature Off

# MPM設定（preforkモジュール）
<IfModule mpm_prefork_module>
    StartServers         8
    MinSpareServers      5
    MaxSpareServers     20
    ServerLimit        256
    MaxRequestWorkers  256
    MaxConnectionsPerChild 4000
</IfModule>

# ログ設定
LogFormat "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\"" combined
CustomLog logs/access_log combined
ErrorLog logs/error_log
LogLevel warn

# バーチャルホスト設定
<VirtualHost *:80>
    ServerName example.com
    ServerAlias www.example.com
    DocumentRoot /var/www/html/example
    ErrorLog logs/example_error.log
    CustomLog logs/example_access.log combined
    
    # セキュリティヘッダー
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
</VirtualHost>

# SSL設定
<VirtualHost *:443>
    ServerName example.com
    DocumentRoot /var/www/html/example
    
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/example.crt
    SSLCertificateKeyFile /etc/ssl/private/example.key
    SSLCertificateChainFile /etc/ssl/certs/intermediate.crt
    
    # SSL設定の強化
    SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder on
</VirtualHost>
```

### Nginx

#### /etc/nginx/nginx.conf
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # ログ設定
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    
    # パフォーマンス設定
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # セキュリティ設定
    server_tokens off;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    include /etc/nginx/conf.d/*.conf;
}
```

#### /etc/nginx/conf.d/example.conf
```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;
    root /var/www/html/example;
    index index.html index.php;
    
    # SSL設定
    ssl_certificate /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    
    # アクセス制御
    location / {
        try_files $uri $uri/ =404;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php-fpm/www.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # 静的ファイルのキャッシュ
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## データベース設定例

### MySQL/MariaDB

#### /etc/my.cnf
```ini
[mysqld]
# 基本設定
port = 3306
socket = /var/lib/mysql/mysql.sock
datadir = /var/lib/mysql
pid-file = /var/run/mysqld/mysqld.pid

# 文字セット設定
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# メモリ設定
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_log_buffer_size = 16M
key_buffer_size = 256M
max_connections = 200
thread_cache_size = 8
query_cache_size = 64M
query_cache_limit = 2M

# ログ設定
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# セキュリティ設定
bind-address = 127.0.0.1
# ssl-ca = /etc/mysql/ssl/ca-cert.pem
# ssl-cert = /etc/mysql/ssl/server-cert.pem
# ssl-key = /etc/mysql/ssl/server-key.pem

# レプリケーション設定
server-id = 1
log-bin = mysql-bin
binlog-format = ROW
expire_logs_days = 7

[mysql]
default-character-set = utf8mb4

[client]
default-character-set = utf8mb4
```

### PostgreSQL

#### /var/lib/pgsql/data/postgresql.conf
```ini
# 接続設定
listen_addresses = 'localhost'
port = 5432
max_connections = 200

# メモリ設定
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# WAL設定
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.7

# ログ設定
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_min_duration_statement = 1000

# 統計情報
track_activities = on
track_counts = on
track_functions = all
```

#### /var/lib/pgsql/data/pg_hba.conf
```ini
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local接続
local   all             postgres                                peer
local   all             all                                     scram-sha-256

# IPv4ローカル接続
host    all             all             127.0.0.1/32            scram-sha-256

# IPv6ローカル接続
host    all             all             ::1/128                 scram-sha-256

# レプリケーション接続
host    replication     replicator      192.168.1.0/24          scram-sha-256
```

## 監視設定サンプル

### Nagios

#### /etc/nagios/nagios.cfg
```ini
# 主要設定ファイル
cfg_file=/etc/nagios/objects/commands.cfg
cfg_file=/etc/nagios/objects/contacts.cfg
cfg_file=/etc/nagios/objects/timeperiods.cfg
cfg_file=/etc/nagios/objects/templates.cfg
cfg_dir=/etc/nagios/servers

# ログ設定
log_file=/var/log/nagios/nagios.log
log_rotation_method=d
log_archive_path=/var/log/nagios/archives

# チェック設定
execute_service_checks=1
execute_host_checks=1
check_service_freshness=1
check_host_freshness=1
enable_notifications=1

# パフォーマンス設定
max_concurrent_checks=20
service_check_timeout=60
host_check_timeout=30
```

#### /etc/nagios/objects/templates.cfg
```ini
# ホストテンプレート
define host{
    name                    linux-server
    use                     generic-host
    check_period            24x7
    check_interval          5
    retry_interval          1
    max_check_attempts      10
    check_command           check-host-alive
    notification_period     workhours
    notification_interval   120
    notification_options    d,u,r
    contact_groups          admins
    register                0
}

# サービステンプレート
define service{
    name                    generic-service
    active_checks_enabled   1
    passive_checks_enabled  1
    parallelize_check       1
    obsess_over_service     1
    check_freshness         0
    notifications_enabled   1
    event_handler_enabled   1
    flap_detection_enabled  1
    failure_prediction_enabled 1
    process_perf_data       1
    retain_status_information 1
    retain_nonstatus_information 1
    is_volatile             0
    check_period            24x7
    max_check_attempts      3
    normal_check_interval   10
    retry_check_interval    2
    contact_groups          admins
    notification_options    w,u,c,r
    notification_interval   60
    notification_period     24x7
    register                0
}
```

### Zabbix

#### /etc/zabbix/zabbix_server.conf
```ini
# データベース設定
DBHost=localhost
DBName=zabbix
DBUser=zabbix
DBPassword=password

# ログ設定
LogFile=/var/log/zabbix/zabbix_server.log
LogFileSize=10
DebugLevel=3

# プロセス設定
StartPollers=5
StartIPMIPollers=0
StartPollersUnreachable=1
StartTrappers=5
StartPingers=1
StartDiscoverers=1
StartHTTPPollers=1

# タイムアウト設定
Timeout=4
TrapperTimeout=300
UnreachablePeriod=45
UnavailableDelay=60
UnreachableDelay=15

# ハウスキーピング
HousekeepingFrequency=1
MaxHousekeeperDelete=500
```

## セキュリティ設定例

### SSH設定 (/etc/ssh/sshd_config)
```bash
# ポート設定
Port 22
Protocol 2

# 認証設定
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# セキュリティ設定
PermitEmptyPasswords no
MaxAuthTries 3
MaxSessions 10
ClientAliveInterval 300
ClientAliveCountMax 2

# 暗号化設定
Ciphers aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha2-512

# ログ設定
SyslogFacility AUTH
LogLevel INFO

# アクセス制御
AllowUsers admin user1 user2
DenyUsers root
AllowGroups sshusers
```

### Firewall設定 (iptables)
```bash
#!/bin/bash
# /etc/iptables/rules.v4

# デフォルトポリシー
-P INPUT DROP
-P FORWARD DROP
-P OUTPUT ACCEPT

# ループバック許可
-A INPUT -i lo -j ACCEPT

# 確立済み接続許可
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH許可
-A INPUT -p tcp --dport 22 -j ACCEPT

# HTTP/HTTPS許可
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT

# DNS許可
-A INPUT -p udp --dport 53 -j ACCEPT
-A INPUT -p tcp --dport 53 -j ACCEPT

# ICMP許可（制限付き）
-A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# 特定ネットワークからの管理アクセス
-A INPUT -s 192.168.1.0/24 -p tcp --dport 3306 -j ACCEPT

COMMIT
```

### fail2ban設定 (/etc/fail2ban/jail.local)
```ini
[DEFAULT]
# 基本設定
bantime = 3600
findtime = 600
maxretry = 3
backend = auto

# 通知設定
destemail = admin@example.com
sender = fail2ban@example.com
action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[apache-auth]
enabled = true
port = http,https
filter = apache-auth
logpath = /var/log/apache2/error.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
```

## 設定管理のベストプラクティス

### 設定ファイルのバックアップ
```bash
#!/bin/bash
# 設定ファイル自動バックアップスクリプト

BACKUP_DIR="/backup/config"
DATE=$(date +%Y%m%d_%H%M%S)

# 重要な設定ファイルリスト
CONFIG_FILES=(
    "/etc/httpd/conf/httpd.conf"
    "/etc/nginx/nginx.conf"
    "/etc/my.cnf"
    "/etc/ssh/sshd_config"
    "/etc/iptables/rules.v4"
)

mkdir -p "$BACKUP_DIR/$DATE"

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/$DATE/"
        echo "Backed up: $file"
    fi
done

# 30日以上古いバックアップを削除
find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} \;
```

### 設定の検証
```bash
#!/bin/bash
# 設定ファイル検証スクリプト

echo "=== Configuration Validation ==="

# Apache設定検証
echo "Checking Apache configuration..."
httpd -t && echo "Apache: OK" || echo "Apache: ERROR"

# Nginx設定検証
echo "Checking Nginx configuration..."
nginx -t && echo "Nginx: OK" || echo "Nginx: ERROR"

# SSH設定検証
echo "Checking SSH configuration..."
sshd -t && echo "SSH: OK" || echo "SSH: ERROR"

# MySQL設定検証
echo "Checking MySQL configuration..."
mysqld --help --verbose > /dev/null 2>&1 && echo "MySQL: OK" || echo "MySQL: ERROR"

echo "=== Validation Complete ==="
```

---

これらの設定サンプルを参考に、環境に適した設定を構築してください。設定変更前には必ずバックアップを取り、段階的に適用することで安全な運用を心がけましょう。
