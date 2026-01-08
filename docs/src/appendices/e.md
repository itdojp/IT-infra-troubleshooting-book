---
title: "付録E: 実践ケーススタディ"
layout: book
order: 105
---

# 付録E: 実践ケーススタディ

実際の障害事例と対応プロセスを通じて、理論を実践に活用する方法を示します。

## 大規模システム障害事例

### ケース1: Eコマースサイト全面停止

#### 事例概要
**発生日時**: 2023年11月15日 14:30〜16:45 (JST)  
**影響範囲**: 全サービス停止、推定損失 500万円/時間  
**原因**: データベース負荷急増によるカスケード障害  

#### システム構成
```
[Load Balancer] → [Web Server × 4] → [App Server × 6] → [DB Cluster × 3]
                                   → [Cache Server × 2]
                                   → [Search Engine × 2]
```

#### 障害発生タイムライン

**14:30** - 監視アラート発生
- Database connection timeout errors
- Application response time > 10 seconds
- HTTP 503 errors increasing

**14:32** - 初期対応開始
- インシデント管理チーム招集
- 緊急対応体制確立
- 影響範囲の確認

**14:35** - 詳細調査
```bash
# データベース接続確認
mysql -h db-master -u monitor -p
ERROR 2003 (HY000): Can't connect to MySQL server

# システム負荷確認
top
load average: 25.43, 18.20, 12.15

# プロセス状況確認
ps aux | grep mysql
mysql    1234  99.8  85.2 8192000 7654321 ?  R  14:30   5:30 mysqld
```

**14:40** - 根本原因特定
- 特定の商品ページへの大量アクセス
- 非効率なSQLクエリによるデータベース負荷
- Connection poolの枯渇

#### 問題のSQLクエリ
```sql
-- 問題のあるクエリ（インデックス未使用）
SELECT * FROM products p 
JOIN reviews r ON p.id = r.product_id 
JOIN users u ON r.user_id = u.id 
WHERE p.category LIKE '%electronics%' 
AND r.rating >= 4 
ORDER BY r.created_at DESC;

-- 実行計画での問題
EXPLAIN SELECT ...;
+----+-------------+-------+------+------+------+--------+-------+
| id | select_type | table | type | key  | rows | Extra  |
+----+-------------+-------+------+------+------+--------+-------+
|  1 | SIMPLE      | p     | ALL  | NULL | 50K  | filesort |
|  1 | SIMPLE      | r     | ALL  | NULL | 200K | Using where |
|  1 | SIMPLE      | u     | ALL  | NULL | 100K | Using where |
+----+-------------+-------+------+------+------+--------+-------+
```

#### 緊急復旧対応

**14:45** - 即座の対応策
```bash
# 1. 問題クエリの無効化
UPDATE application_config 
SET feature_enabled = 0 
WHERE feature_name = 'product_reviews_enhanced';

# 2. データベース接続の強制クリア
mysqladmin processlist | grep "Sleep" | cut -d'|' -f2 | xargs -I {} mysqladmin kill {}

# 3. Connection poolのリセット
systemctl restart application-server
```

**15:00** - 負荷軽減策
```bash
# アプリケーションサーバーの一時的な設定変更
# connection pool設定
max_connections=50 → 25
timeout=30 → 10

# キャッシュ戦略の変更
# Redis cache TTL延長
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**15:15** - サービス部分復旧
- 基本機能のみでサービス再開
- 問題の機能は無効化
- ユーザー向け告知を実施

#### 根本対策

**15:30〜16:45** - 恒久対策実施
```sql
-- 適切なインデックス追加
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_reviews_product_rating ON reviews(product_id, rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at);

-- クエリの最適化
SELECT p.id, p.name, r.rating, r.comment, u.username
FROM products p 
JOIN reviews r ON p.id = r.product_id 
JOIN users u ON r.user_id = u.id 
WHERE p.category = 'electronics'  -- LIKE を = に変更
AND r.rating >= 4 
ORDER BY r.created_at DESC 
LIMIT 50;  -- LIMIT追加
```

**アプリケーション改善**
```python
# Connection pool設定改善
DATABASE_CONFIG = {
    'MAX_CONNECTIONS': 20,
    'OVERFLOW': 0,
    'POOL_TIMEOUT': 10,
    'POOL_RECYCLE': 3600,
    'ECHO': False
}

# クエリキャッシュ実装
@cache.cached(timeout=300)
def get_popular_products(category, min_rating=4):
    return db.session.execute(optimized_query).fetchall()
```

#### 学んだ教訓

1. **監視の重要性**
   - クエリ実行時間の監視不足
   - データベース負荷の予兆検知

2. **設計の改善点**
   - インデックス設計の見直し
   - クエリ性能テストの自動化

3. **運用プロセス**
   - 障害対応手順書の整備
   - エスカレーション基準の明確化

---

## クラウド環境障害事例

### ケース2: AWS multi-AZ障害

#### 事例概要
**発生日時**: 2023年8月22日 09:15〜11:30 (JST)  
**影響範囲**: 東京リージョン ap-northeast-1a AZ障害  
**サービス**: SaaS基盤、顧客数 1,200社、ユーザー数 50,000人  

#### システム構成
```yaml
AWS Infrastructure:
  Region: ap-northeast-1 (Tokyo)
  AZs: 
    - ap-northeast-1a (Primary)
    - ap-northeast-1c (Secondary)
    - ap-northeast-1d (DR)
  
  Components:
    - ELB: Cross-AZ load balancing
    - EC2: Auto Scaling Group (3 AZs)
    - RDS: Multi-AZ deployment
    - ElastiCache: Redis cluster mode
    - S3: Cross-region replication
```

#### 障害タイムライン

**09:15** - AWS公式障害通知
```
AWS Health Dashboard Alert:
Service: EC2
Region: ap-northeast-1
AZ: ap-northeast-1a
Status: Service Degradation
Impact: Elevated API error rates and instance launch failures
```

**09:18** - サービス影響確認
```bash
# EC2インスタンス状況確認
aws ec2 describe-instances \
  --filters "Name=availability-zone,Values=ap-northeast-1a" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name]'

# Auto Scaling状況確認
aws autoscaling describe-auto-scaling-groups \
  --query 'AutoScalingGroups[*].[AutoScalingGroupName,DesiredCapacity,Instances[].AvailabilityZone]'
```

**09:20** - 影響分析
- ap-northeast-1a の EC2インスタンス 12台が Stopping状態
- Auto Scaling が新しいインスタンス起動に失敗
- RDS Multi-AZ の自動フェイルオーバー未発生（正常）

#### 対応策の実施

**09:25** - 緊急対応
```bash
# 1. Auto Scaling Group の AZ設定更新
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name web-servers-asg \
  --availability-zones "ap-northeast-1c" "ap-northeast-1d"

# 2. 手動でのインスタンス起動
aws ec2 run-instances \
  --image-id ami-12345678 \
  --count 4 \
  --instance-type m5.large \
  --subnet-id subnet-in-1c \
  --security-group-ids sg-12345678
```

**09:35** - サービス状況監視
```bash
# ELB Target Health確認
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...

# CloudWatch メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/my-load-balancer/... \
  --start-time 2023-08-22T00:00:00Z \
  --end-time 2023-08-22T03:00:00Z \
  --period 300 \
  --statistics Average
```

**10:00** - 完全復旧確認
- 全サービスが正常動作
- レスポンス時間が基準値内
- エラー率 < 0.1%

#### 改善施策

**自動化スクリプトの実装**
```python
#!/usr/bin/env python3
import boto3
import json

def handle_az_failure(failed_az, region='ap-northeast-1'):
    """AZ障害時の自動対応"""
    
    ec2 = boto3.client('ec2', region_name=region)
    autoscaling = boto3.client('autoscaling', region_name=region)
    
    # 1. 健全なAZの特定
    healthy_azs = get_healthy_azs(failed_az, region)
    
    # 2. Auto Scaling Group更新
    for asg in get_auto_scaling_groups():
        autoscaling.update_auto_scaling_group(
            AutoScalingGroupName=asg['AutoScalingGroupName'],
            AvailabilityZones=healthy_azs
        )
    
    # 3. 監視・アラート
    send_notification({
        'status': 'AZ_FAILOVER_INITIATED',
        'failed_az': failed_az,
        'healthy_azs': healthy_azs,
        'timestamp': datetime.utcnow().isoformat()
    })

def get_healthy_azs(failed_az, region):
    """健全なAZリストを取得"""
    ec2 = boto3.client('ec2', region_name=region)
    
    azs = ec2.describe_availability_zones()['AvailabilityZones']
    healthy_azs = [
        az['ZoneName'] for az in azs 
        if az['ZoneName'] != failed_az and az['State'] == 'available'
    ]
    
    return healthy_azs
```

**監視強化**
```yaml
# CloudWatch Alarm設定
AZHealthCheck:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: EC2-AZ-Health-Check
    MetricName: StatusCheckFailed_Instance
    Namespace: AWS/EC2
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 3
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: AvailabilityZone
        Value: !Ref AvailabilityZone
    AlarmActions:
      - !Ref SNSTopicForAlert
```

---

## セキュリティインシデント事例

### ケース3: 不正アクセス検知と対応

#### 事例概要
**発生日時**: 2023年9月03日 02:15〜05:30 (JST)  
**インシデント種別**: 不正ログイン試行、データベース不正アクセス  
**影響**: 個人情報 約1,000件の閲覧可能性  

#### 検知タイムライン

**02:15** - 自動検知アラート
```bash
# fail2ban アラート
2023-09-03 02:15:23 NOTICE  [ssh] Ban 203.0.113.42
2023-09-03 02:15:45 NOTICE  [ssh] Ban 203.0.113.43
2023-09-03 02:15:58 NOTICE  [ssh] Ban 203.0.113.44

# Webアプリケーション異常ログ
[2023-09-03 02:16:12] WARN: Multiple login failures for user: admin
[2023-09-03 02:16:15] ERROR: SQL injection attempt detected
[2023-09-03 02:16:18] CRITICAL: Unauthorized database access attempt
```

**02:18** - セキュリティチーム対応開始
```bash
# 1. 緊急ネットワーク分析
ss -lntp | grep :22
ss -lntp | grep :3306

# 2. アクセスログ分析
tail -f /var/log/auth.log | grep "203.0.113"
grep -r "203.0.113" /var/log/apache2/
```

#### 攻撃パターン分析

**SSH ブルートフォース攻撃**
```bash
# 攻撃元IP分析
grep "Failed password" /var/log/auth.log | \
awk '{print $11}' | sort | uniq -c | sort -nr

# 攻撃対象ユーザー分析
grep "Failed password" /var/log/auth.log | \
awk '{print $9}' | sort | uniq -c | sort -nr

# 結果例:
#  145 203.0.113.42
#   89 203.0.113.43
#   67 203.0.113.44
#   
# ユーザー名:
#   89 admin
#   45 root
#   34 administrator
```

**Webアプリケーション攻撃**
```bash
# SQLインジェクション試行検知
grep -i "union\|select\|drop\|insert" /var/log/apache2/access.log | \
grep "203.0.113"

# 例: GET /search?q='; DROP TABLE users; --
# 例: POST /login with payload: admin' OR '1'='1
```

#### 即座の対応策

**02:25** - ネットワーク遮断
```bash
# 1. 攻撃元IPの即座遮断
iptables -I INPUT -s 203.0.113.42 -j DROP
iptables -I INPUT -s 203.0.113.43 -j DROP
iptables -I INPUT -s 203.0.113.44 -j DROP

# 2. fail2ban設定強化
cat >> /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
maxretry = 3
bantime = 86400
findtime = 3600

[apache-auth]
enabled = true
maxretry = 3
bantime = 86400
EOF

systemctl reload fail2ban
```

**02:30** - アプリケーション保護
```bash
# 1. 管理者アカウントの一時無効化
mysql -u root -p << EOF
UPDATE users SET status='disabled' WHERE username='admin';
UPDATE users SET failed_login_count=0 WHERE username='admin';
EOF

# 2. WAF ルール追加（nginx）
cat >> /etc/nginx/conf.d/security.conf << EOF
# SQLインジェクション対策
location ~* \.(php|asp|aspx|jsp)$ {
    if (\$args ~* "union.*select|drop.*table|insert.*into") {
        return 403;
    }
}

# 不正IP遮断
location / {
    deny 203.0.113.0/24;
}
EOF

nginx -t && systemctl reload nginx
```

#### フォレンジック調査

**02:45** - ログ分析
```bash
# 1. データベースアクセスログ分析
mysql -u root -p << EOF
SELECT 
    event_time,
    user_host,
    sql_text,
    rows_affected
FROM mysql.general_log 
WHERE event_time >= '2023-09-03 02:00:00'
AND user_host LIKE '%203.0.113%'
ORDER BY event_time;
EOF

# 2. Webアクセス詳細分析
awk '
/203\.0\.113/ {
    print $1, $4, $6, $7, $9, $10
}' /var/log/apache2/access.log | \
sort -k2
```

**実際の侵入成功確認**
```sql
-- 不正アクセスされたクエリ（ログより）
SELECT * FROM users WHERE username='admin' OR '1'='1';
SELECT email, phone FROM customers LIMIT 1000;

-- 影響範囲特定
SELECT COUNT(*) FROM customers 
WHERE created_at <= '2023-09-03 02:20:00';
-- 結果: 1,247件（うち個人情報含む: 1,000件）
```

#### 復旧と強化対策

**03:00** - 即座の復旧作業
```bash
# 1. データベース権限見直し
mysql -u root -p << EOF
-- アプリケーション用ユーザーの権限制限
REVOKE ALL ON *.* FROM 'webapp'@'localhost';
GRANT SELECT, INSERT, UPDATE ON app_db.* TO 'webapp'@'localhost';
GRANT DELETE ON app_db.sessions TO 'webapp'@'localhost';

-- 管理者パスワード強制変更
ALTER USER 'admin'@'localhost' PASSWORD EXPIRE;
EOF

# 2. アプリケーション設定強化
# prepared statement の強制
sed -i 's/mysql_query/mysql_prepare/g' /var/www/html/includes/database.php

# 3. ログ監視強化
cat >> /etc/rsyslog.conf << EOF
# セキュリティログ専用
auth.* /var/log/security.log
local0.* /var/log/application-security.log
EOF
```

**監視システム強化**
```python
#!/usr/bin/env python3
# セキュリティ監視スクリプト
import re
import smtplib
from datetime import datetime

def monitor_suspicious_activity():
    """不審なアクティビティの監視"""
    
    # 1. ログパターン定義
    attack_patterns = [
        r'union.*select.*from',
        r'drop.*table',
        r"'.*or.*'1'='1'",
        r'Failed password.*from.*invalid user'
    ]
    
    # 2. リアルタイム監視
    with open('/var/log/apache2/access.log', 'r') as f:
        for line in f:
            for pattern in attack_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    send_security_alert({
                        'timestamp': datetime.now(),
                        'pattern': pattern,
                        'log_entry': line.strip(),
                        'severity': 'HIGH'
                    })

def send_security_alert(alert_data):
    """セキュリティアラート送信"""
    # Slack, email, SMS通知の実装
    pass
```

#### 学んだ教訓と改善

1. **予防策の強化**
   - WAF の事前設定
   - prepared statement の徹底
   - 権限の最小化原則

2. **検知の迅速化**
   - リアルタイム監視の自動化
   - 異常パターンの機械学習検知

3. **対応プロセス**
   - インシデント対応手順書の詳細化
   - 外部機関との連携体制構築

---

## パフォーマンス問題事例

### ケース4: レスポンス時間劣化

#### 事例概要
**期間**: 2023年10月15日〜10月20日  
**症状**: Webサイトのレスポンス時間が段階的に悪化  
**影響**: 平均レスポンス 200ms → 3,000ms  

#### 問題の症状

```bash
# 監視データの推移
Date        Avg Response(ms)  Error Rate(%)  Concurrent Users
2023-10-15  200              0.1            1,200
2023-10-16  450              0.3            1,250
2023-10-17  800              0.8            1,180
2023-10-18  1,500            2.1            1,100
2023-10-19  2,200            4.2            980
2023-10-20  3,000            8.5            850
```

#### 段階的調査アプローチ

**Stage 1: インフラレベル調査**
```bash
# 1. サーバーリソース確認
sar -u 1 10  # CPU使用率
sar -r 1 10  # メモリ使用率
sar -d 1 10  # ディスクI/O

# 結果: 特に異常なし（CPU 20%, Memory 45%, Disk I/O 正常）

# 2. ネットワーク確認
ss -i  # 接続状況
iftop  # ネットワーク使用量

# 結果: ネットワーク負荷も正常範囲
```

**Stage 2: アプリケーションレベル調査**
```bash
# 1. Webサーバーログ分析
tail -f /var/log/apache2/access.log | \
awk '{print $1, $7, $10, $11}' | \
grep -v "200"

# 2. アプリケーションログ確認
grep "SLOW\|ERROR\|TIMEOUT" /var/log/application/app.log | \
tail -100
```

**Stage 3: データベース調査で問題発見**
```sql
-- 遅いクエリの確認
SELECT 
    query_time,
    lock_time,
    rows_examined,
    sql_text
FROM mysql.slow_log 
WHERE start_time >= '2023-10-15'
ORDER BY query_time DESC
LIMIT 20;

-- 結果: 特定のテーブルスキャンが急増
/*
query_time: 15.2s
sql_text: SELECT * FROM user_activities 
          WHERE activity_date >= '2023-10-01' 
          ORDER BY created_at DESC;
*/
```

#### 根本原因の特定

**データ増加による性能劣化**
```sql
-- テーブルサイズの推移確認
SELECT 
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size(MB)'
FROM information_schema.tables 
WHERE table_schema = 'app_database'
ORDER BY table_rows DESC;

/*
結果:
user_activities: 15,000,000 rows (2.1GB)
user_sessions:    8,500,000 rows (1.2GB)
access_logs:      45,000,000 rows (5.8GB)
*/

-- インデックス使用状況確認
SHOW INDEX FROM user_activities;
/*
問題: activity_date にインデックスが存在しない
created_at にのみインデックス存在
*/
```

**問題のあるクエリ分析**
```sql
-- 問題クエリの実行計画
EXPLAIN FORMAT=JSON 
SELECT * FROM user_activities 
WHERE activity_date >= '2023-10-01' 
ORDER BY created_at DESC;

/*
結果:
{
  "query_block": {
    "select_id": 1,
    "cost_info": {
      "query_cost": "3050234.80"
    },
    "table": {
      "table_name": "user_activities",
      "access_type": "ALL",  -- フルテーブルスキャン
      "rows_examined_per_scan": 15000000,
      "filtered": "33.33",
      "cost_info": {
        "read_cost": "2500234.80",
        "eval_cost": "550000.00"
      }
    }
  }
}
*/
```

#### パフォーマンス改善施策

**即座の対応（緊急）**
```sql
-- 1. 適切なインデックス追加
CREATE INDEX idx_activity_date ON user_activities(activity_date);
CREATE INDEX idx_activity_date_created ON user_activities(activity_date, created_at);

-- 2. クエリ最適化
-- Before:
SELECT * FROM user_activities 
WHERE activity_date >= '2023-10-01' 
ORDER BY created_at DESC;

-- After:
SELECT id, user_id, activity_type, activity_date, created_at 
FROM user_activities 
WHERE activity_date >= '2023-10-01' 
ORDER BY activity_date DESC, created_at DESC
LIMIT 1000;
```

**中期対応（アーキテクチャ改善）**
```sql
-- 1. パーティショニング実装
ALTER TABLE user_activities 
PARTITION BY RANGE (YEAR(activity_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- 2. アーカイブ戦略
-- 3ヶ月以上古いデータを別テーブルに移動
CREATE TABLE user_activities_archive LIKE user_activities;

INSERT INTO user_activities_archive
SELECT * FROM user_activities 
WHERE activity_date < DATE_SUB(CURDATE(), INTERVAL 3 MONTH);

DELETE FROM user_activities 
WHERE activity_date < DATE_SUB(CURDATE(), INTERVAL 3 MONTH);
```

**長期対応（アプリケーション改善）**
```python
# 1. クエリキャッシュの実装
from functools import lru_cache
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

@lru_cache(maxsize=128)
def get_user_activities(user_id, date_from, limit=100):
    cache_key = f"activities:{user_id}:{date_from}:{limit}"
    
    # キャッシュ確認
    cached_result = redis_client.get(cache_key)
    if cached_result:
        return json.loads(cached_result)
    
    # データベースクエリ
    query = """
    SELECT id, user_id, activity_type, activity_date, created_at 
    FROM user_activities 
    WHERE user_id = %s AND activity_date >= %s 
    ORDER BY activity_date DESC, created_at DESC 
    LIMIT %s
    """
    
    result = db.execute(query, (user_id, date_from, limit))
    
    # キャッシュに保存（TTL: 5分）
    redis_client.setex(cache_key, 300, json.dumps(result))
    
    return result

# 2. 非同期処理への変更
import asyncio
import asyncpg

async def get_activities_async(user_id, date_from):
    conn = await asyncpg.connect('postgresql://...')
    
    query = """
    SELECT * FROM user_activities 
    WHERE user_id = $1 AND activity_date >= $2 
    ORDER BY activity_date DESC 
    LIMIT 100
    """
    
    rows = await conn.fetch(query, user_id, date_from)
    await conn.close()
    
    return [dict(row) for row in rows]
```

#### 改善結果

```bash
# 改善後のパフォーマンス
Date        Avg Response(ms)  Error Rate(%)  Query Time(ms)
2023-10-21  180              0.1            45
2023-10-22  165              0.05           38
2023-10-23  150              0.02           32

# インデックス効果確認
EXPLAIN FORMAT=JSON SELECT ... ;
/*
{
  "cost_info": {
    "query_cost": "245.50"  -- 3,050,234.80 から大幅改善
  },
  "access_type": "range",   -- フルスキャンから範囲検索に改善
  "rows_examined_per_scan": 1250  -- 15,000,000 から大幅削減
}
*/
```

---

## 人的要因による障害事例

### ケース5: 設定変更による障害

#### 事例概要
**発生日時**: 2023年12月08日 16:45〜18:20 (JST)  
**原因**: 設定ファイル変更による本番環境への意図しない影響  
**作業者**: インフラエンジニア（経験2年）  

#### 事故の経緯

**16:30** - 定期メンテナンス作業開始
```bash
# 目的: Nginxの設定最適化
# 予定: ステージング環境での設定変更とテスト

# 作業予定手順:
# 1. ステージング環境での設定変更
# 2. 設定テスト
# 3. 本番環境での適用
```

**16:45** - 設定ファイル編集
```bash
# 作業者の操作（問題のある手順）
cd /etc/nginx/sites-available/

# 意図: ステージング設定編集
# 実際: 本番設定ファイルを編集
vim production-site.conf  # staging-site.conf のつもり

# 変更内容（問題のある設定）
upstream backend {
    # 変更前
    # server 192.168.1.10:8080;
    # server 192.168.1.11:8080;
    
    # 変更後（間違い）
    server 192.168.1.10:8080 weight=3;
    server 192.168.1.11:8080 weight=1;
    server 192.168.1.50:8080;  # 存在しないサーバー
}

# 設定検証を実行
nginx -t
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 設定適用
systemctl reload nginx
```

**16:48** - 障害発生
```bash
# 監視アラート発生
HTTP 502 Bad Gateway errors: 45%
Response time increased: 2000ms -> 8000ms
```

#### 問題の分析

**即座の状況確認**
```bash
# 1. Nginxエラーログ確認
tail -f /var/log/nginx/error.log
/*
2023-12-08 16:48:15 [error] connect() failed (111: Connection refused) 
while connecting to upstream, client: 203.0.113.25, 
server: example.com, request: "GET / HTTP/1.1", 
upstream: "http://192.168.1.50:8080/"
*/

# 2. バックエンドサーバー確認
for server in 192.168.1.10 192.168.1.11 192.168.1.50; do
    echo "Checking $server:"
    nc -zv $server 8080
done

/*
結果:
192.168.1.10: Connected
192.168.1.11: Connected  
192.168.1.50: Connection refused (存在しないサーバー)
*/
```

**根本原因の特定**
1. **環境の取り違え**: ステージングではなく本番環境を変更
2. **存在しないサーバー追加**: 192.168.1.50は未構築サーバー
3. **テスト不足**: 設定変更後の動作確認不足

#### 緊急復旧対応

**16:52** - 即座のロールバック
```bash
# 1. 設定ファイル復旧
cp /etc/nginx/sites-available/production-site.conf.backup \
   /etc/nginx/sites-available/production-site.conf

# または Git からの復旧
cd /etc/nginx/
git checkout HEAD -- sites-available/production-site.conf

# 2. 設定検証
nginx -t

# 3. 設定適用
systemctl reload nginx

# 4. 動作確認
curl -I http://example.com/
```

**17:00** - サービス復旧確認
```bash
# レスポンス時間確認
for i in {1..10}; do
    curl -w "Time: %{time_total}s\n" -o /dev/null -s http://example.com/
done

# 結果: 正常なレスポンス時間に回復
```

#### プロセス改善策

**技術的改善**
```bash
# 1. 設定ファイル管理の改善
# Git hooks による自動チェック
cat > /etc/nginx/.git/hooks/pre-commit << 'EOF'
#!/bin/bash
# 設定ファイル構文チェック
nginx -t -c /etc/nginx/nginx.conf

if [ $? -ne 0 ]; then
    echo "Error: Nginx configuration syntax error"
    exit 1
fi

# 本番設定の意図しない変更チェック
if git diff --cached --name-only | grep "production"; then
    echo "Warning: Production configuration is being modified"
    echo "Please confirm this is intentional (y/N):"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
EOF

chmod +x /etc/nginx/.git/hooks/pre-commit
```

**運用プロセス改善**
```yaml
# 変更管理プロセス（YAML形式）
change_management:
  pre_work:
    - environment_verification: "現在の作業環境確認"
    - backup_creation: "現在の設定バックアップ"
    - change_documentation: "変更内容の文書化"
  
  execution:
    - syntax_check: "nginx -t による構文チェック"
    - staging_test: "ステージング環境での動作確認"
    - monitoring_setup: "監視アラートの一時調整"
    - gradual_rollout: "段階的な変更適用"
  
  post_work:
    - functionality_test: "機能動作テスト"
    - performance_check: "性能影響確認"
    - monitoring_restore: "監視設定の復旧"
    - documentation_update: "手順書更新"

rollback_plan:
  triggers:
    - error_rate_threshold: "> 5%"
    - response_time_threshold: "> 3000ms"
    - manual_abort: "作業者判断"
  
  procedure:
    - immediate_config_restore: "設定ファイル即座復旧"
    - service_reload: "サービス再読み込み"
    - health_check: "ヘルスチェック実行"
```

**教育・トレーニング**
```bash
# 1. 環境識別の徹底
# プロンプト設定で環境を明確化
echo 'export PS1="[\u@\h:\w] (PROD) $ "' >> ~/.bashrc  # 本番環境
echo 'export PS1="[\u@\h:\w] (STAGE) $ "' >> ~/.bashrc # ステージング

# 2. 作業手順のチェックリスト化
cat > /home/engineer/work_checklist.md << 'EOF'
# インフラ変更作業チェックリスト

## 作業前確認
- [ ] 作業対象環境の確認（本番/ステージング）
- [ ] 現在設定のバックアップ作成
- [ ] 変更内容の文書化

## 作業中確認  
- [ ] 設定ファイル構文チェック
- [ ] 設定変更の段階的適用
- [ ] 各段階での動作確認

## 作業後確認
- [ ] サービス正常動作確認
- [ ] 性能指標確認
- [ ] エラーログ確認
- [ ] 作業完了報告
EOF
```

#### 学んだ教訋

1. **環境管理**
   - 明確な環境識別システム
   - 作業対象の二重確認

2. **変更管理**
   - 段階的な変更適用
   - 自動化されたテスト

3. **人的ミス防止**
   - チェックリストの活用
   - ペアワークの導入

---

これらの実践事例を通じて、理論的な知識を実際の障害対応に活用する方法を習得してください。各事例の対応プロセスと改善策は、組織の規模や環境に応じてカスタマイズして活用することが重要です。
