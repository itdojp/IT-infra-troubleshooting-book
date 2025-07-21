---
title: "付録D: 用語集・技術索引"
layout: book
order: 104
---

# 付録D: 用語集・技術索引

ITインフラトラブルシューティングで使用される専門用語の詳細な説明と索引です。

## A

**Apache HTTP Server**
- 世界で最も広く使用されているWebサーバーソフトウェア
- モジュール構造による柔軟な機能拡張が特徴
- Virtual Host機能により複数サイトの運用が可能

**API (Application Programming Interface)**
- アプリケーション間の通信インターフェース
- REST API、GraphQL APIなど複数の形式が存在
- レート制限やバージョン管理が重要な運用要素

**AWS (Amazon Web Services)**
- Amazon提供のクラウドコンピューティングサービス
- EC2、S3、RDSなど豊富なサービスラインナップ
- 従量課金制による柔軟なコスト管理

**Auto Scaling**
- 負荷に応じてリソースを自動的に増減する機能
- CPU使用率、メモリ使用率、ネットワーク負荷を監視
- スケールアウト（水平拡張）とスケールアップ（垂直拡張）

## B

**Backup**
- データ喪失に備えたデータの複製保存
- フル、差分、増分バックアップの種類がある
- RTO（Recovery Time Objective）とRPO（Recovery Point Objective）の設定が重要

**Bandwidth**
- ネットワークやシステムのデータ転送能力
- bps（bits per second）で測定される
- ボトルネック特定の重要な指標

**BGP (Border Gateway Protocol)**
- インターネットにおける経路制御プロトコル
- AS（Autonomous System）間でのルーティング情報交換
- 大規模障害の原因となることがある

**Blue-Green Deployment**
- 本番環境とステージング環境を切り替えるデプロイ手法
- ダウンタイムを最小化
- 問題発生時の高速ロールバックが可能

## C

**CDN (Content Delivery Network)**
- 地理的に分散したサーバーでコンテンツを配信
- レスポンス時間の改善とサーバー負荷軽減
- CloudFlare、AWS CloudFront、Azure CDNなど

**CI/CD (Continuous Integration/Continuous Deployment)**
- 継続的インテグレーション・継続的デプロイメント
- 自動化によるソフトウェア開発効率化
- Jenkins、GitLab CI、GitHub Actionsなどのツールを使用

**Cloud Computing**
- インターネット経由でIT リソースを提供するサービス
- IaaS、PaaS、SaaSの3つのサービスモデル
- 共有責任モデルによるセキュリティ管理

**Cluster**
- 複数のサーバーを連携させた分散システム
- 高可用性（HA）と負荷分散を実現
- Kubernetes、Docker Swarmなどのオーケストレーションツール

## D

**Database**
- 構造化されたデータの集合とその管理システム
- RDBMS（MySQL、PostgreSQL）とNoSQL（MongoDB、Redis）
- ACID特性（Atomicity、Consistency、Isolation、Durability）

**DNS (Domain Name System)**
- ドメイン名とIPアドレスの対応付けシステム
- 階層構造による分散管理
- TTL（Time To Live）によるキャッシュ制御

**Docker**
- コンテナ型仮想化プラットフォーム
- アプリケーションの移植性と効率性を向上
- イメージ、コンテナ、Dockerfileなどの概念

**DDoS (Distributed Denial of Service)**
- 分散型サービス拒否攻撃
- 複数の送信元から大量のトラフィックを送信
- WAF、CDN、スケーリングによる対策

## E

**Elasticsearch**
- 分散型検索・分析エンジン
- ログ分析とリアルタイム検索に特化
- Elastic Stack（ELK）の中核コンポーネント

**Encryption**
- データの暗号化技術
- 転送時暗号化（TLS/SSL）と保存時暗号化
- 対称暗号と非対称暗号の2つの方式

**ETL (Extract, Transform, Load)**
- データの抽出、変換、格納プロセス
- データウェアハウス構築の基本概念
- Apache Spark、Airflowなどのツールを使用

## F

**Failover**
- 障害発生時の自動切り替え機能
- プライマリ・セカンダリ構成での高可用性実現
- RTO（目標復旧時間）の短縮が目的

**Firewall**
- ネットワークセキュリティの防御機構
- パケットフィルタリング、ステートフル検査
- iptables、ufw、AWS Security Groupなど

**FTP (File Transfer Protocol)**
- ファイル転送プロトコル
- SFTP、FTPSによるセキュア通信
- 設定ミスによる情報漏洩リスクあり

## G

**Git**
- 分散型バージョン管理システム
- Infrastructure as Code（IaC）での設定管理
- GitHub、GitLab、Bitbucketなどのホスティングサービス

**GCP (Google Cloud Platform)**
- Google提供のクラウドコンピューティングサービス
- BigQuery、Kubernetes Engine、Cloud Functionsなど
- AI/ML サービスが充実

**Grafana**
- メトリクス可視化・ダッシュボードツール
- Prometheus、InfluxDBなどとの連携
- アラート機能による運用自動化

## H

**HAProxy**
- 高性能なロードバランサー・プロキシサーバー
- レイヤー4/7でのトラフィック分散
- ヘルスチェック機能による自動フェイルオーバー

**HTTPS**
- HTTP over SSL/TLS
- Web通信の暗号化プロトコル
- SSL証明書による身元確認

**Hypervisor**
- 仮想化技術の基盤ソフトウェア
- Type1（ベアメタル）とType2（ホスト型）
- VMware、Hyper-V、KVMなど

## I

**IaaS (Infrastructure as a Service)**
- インフラストラクチャのクラウドサービス
- 仮想マシン、ストレージ、ネットワークを提供
- AWS EC2、Azure VM、GCP Compute Engineなど

**Incident Management**
- 障害対応の体系的なプロセス
- ITIL フレームワークに基づく運用
- 検知、対応、復旧、改善のサイクル

**IP Address**
- ネットワーク上でのデバイス識別子
- IPv4（32bit）とIPv6（128bit）
- パブリックIPとプライベートIPの区別

## J

**JSON (JavaScript Object Notation)**
- 軽量なデータ交換フォーマット
- API通信、設定ファイルで広く使用
- 人間が読みやすい構造化データ

**JVM (Java Virtual Machine)**
- Javaバイトコードの実行環境
- ガベージコレクション、メモリ管理
- ヒープメモリ、GC調整がパフォーマンスに影響

## K

**Kubernetes**
- コンテナオーケストレーションプラットフォーム
- Pod、Service、Deploymentなどのリソース
- クラウドネイティブアプリケーションの標準

**KPI (Key Performance Indicator)**
- 重要業績評価指標
- SLA、可用性、応答時間などの運用指標
- ビジネス目標との整合性が重要

## L

**Load Balancer**
- 複数サーバーへのトラフィック分散装置
- ラウンドロビン、重み付け、最小接続数などのアルゴリズム
- L4（Transport層）とL7（Application層）

**Log**
- システムやアプリケーションの動作記録
- アクセスログ、エラーログ、監査ログ
- ログレベル（ERROR、WARN、INFO、DEBUG）

**LVM (Logical Volume Manager)**
- Linuxの論理ボリューム管理システム
- 物理ストレージの抽象化
- 動的リサイズ、スナップショット機能

## M

**Microservices**
- アプリケーションを小さなサービスに分割するアーキテクチャ
- 独立したデプロイ、技術スタック選択が可能
- サービス間通信、分散システムの複雑性が課題

**Monitoring**
- システム状態の継続的な監視
- メトリクス（CPU、メモリ、ディスク）収集
- Nagios、Zabbix、DataDog、New Relicなど

**MySQL**
- オープンソースのリレーショナルデータベース
- InnoDB、MyISAMなどのストレージエンジン
- レプリケーション、クラスタリング機能

## N

**Nginx**
- 高性能なWebサーバー・リバースプロキシ
- 非同期イベント駆動アーキテクチャ
- 静的コンテンツ配信、ロードバランシング

**Network**
- コンピューター間の通信基盤
- OSI参照モデル（7層）による階層化
- TCP/IP、HTTP/HTTPS、DNS、DHCPなど

**NFS (Network File System)**
- ネットワーク経由のファイル共有システム
- Unix/Linux環境での標準的なファイル共有
- パフォーマンス、セキュリティ設定が重要

## O

**OAuth**
- 認可フレームワーク
- 第三者アプリケーションへの安全なアクセス許可
- OAuth 2.0、OpenID Connectが主流

**ORM (Object-Relational Mapping)**
- オブジェクトとリレーショナルデータベースのマッピング
- SQLクエリの抽象化
- N+1問題などのパフォーマンス課題あり

**OSI Model**
- ネットワーク通信の7層参照モデル
- 物理層からアプリケーション層まで
- トラブルシューティングの体系的アプローチに活用

## P

**PaaS (Platform as a Service)**
- アプリケーション実行基盤のクラウドサービス
- 開発者はアプリケーションのみに集中
- Heroku、Google App Engine、AWS Elastic Beanstalkなど

**PostgreSQL**
- 高機能なオープンソースRDBMS
- ACID準拠、拡張可能性が特徴
- JSON サポート、GIS機能なども提供

**Prometheus**
- 時系列データベース・監視システム
- Pull型メトリクス収集
- PromQL によるクエリ、Grafanaとの連携

## Q

**QPS (Queries Per Second)**
- 1秒間のクエリ処理数
- データベース、Webサーバーの性能指標
- 負荷テスト、キャパシティプランニングで使用

**Queue**
- 非同期処理のためのメッセージキュー
- Redis、RabbitMQ、Apache Kafkaなど
- スケーラビリティ、信頼性向上に寄与

## R

**Redis**
- インメモリデータ構造ストア
- キャッシュ、セッション管理、メッセージブローカー
- クラスタリング、レプリケーション機能

**REST (Representational State Transfer)**
- Webサービスのアーキテクチャスタイル
- HTTP メソッド（GET、POST、PUT、DELETE）を使用
- ステートレス、統一インターフェース

**RPO (Recovery Point Objective)**
- 目標復旧時点
- データ損失の許容範囲を定義
- バックアップ戦略の基準

**RTO (Recovery Time Objective)**
- 目標復旧時間
- システム復旧までの許容時間
- 可用性要件の基準

## S

**SaaS (Software as a Service)**
- ソフトウェアのクラウドサービス
- ユーザーはソフトウェア機能のみを利用
- Salesforce、Office 365、Google Workspaceなど

**Scalability**
- システムの拡張性
- 水平拡張（スケールアウト）と垂直拡張（スケールアップ）
- 負荷増加に対する対応能力

**SSL/TLS**
- 暗号化通信プロトコル
- PKI（公開鍵基盤）による認証
- 証明書の管理、更新が運用ポイント

**SLA (Service Level Agreement)**
- サービスレベル合意書
- 可用性、性能、サポート要件を定義
- 99.9%、99.99%などの可用性目標

## T

**TCP/IP**
- インターネットの基盤通信プロトコル
- 信頼性のあるデータ転送
- 3-way handshake、フロー制御

**Terraform**
- Infrastructure as Code（IaC）ツール
- 宣言的な設定記述
- 複数クラウドプロバイダー対応

**TLS (Transport Layer Security)**
- トランスポート層セキュリティプロトコル
- SSLの後継プロトコル
- 現在はTLS 1.2、1.3が推奨

## U

**UDP (User Datagram Protocol)**
- コネクションレス型通信プロトコル
- 高速だが信頼性は低い
- DNS、ストリーミング、ゲームなどで使用

**URL (Uniform Resource Locator)**
- Web上のリソースの所在地
- プロトコル、ホスト名、パス、パラメーターで構成
- REST API設計の重要な要素

## V

**VPN (Virtual Private Network)**
- 仮想プライベートネットワーク
- 暗号化による安全な通信トンネル
- IPsec、OpenVPN、WireGuardなど

**VM (Virtual Machine)**
- 仮想マシン
- 物理サーバー上で動作する仮想的なコンピューター
- リソース分離、効率的な利用が可能

**VLAN (Virtual LAN)**
- 仮想ローカルエリアネットワーク
- 物理ネットワークの論理分割
- セキュリティ、性能向上に寄与

## W

**WAF (Web Application Firewall)**
- Webアプリケーション向けファイアウォール
- SQLインジェクション、XSS攻撃の防御
- CloudFlare、AWS WAFなど

**WebSocket**
- リアルタイム双方向通信プロトコル
- HTTP接続をアップグレード
- チャット、ゲーム、リアルタイム更新に使用

## X

**XML (eXtensible Markup Language)**
- 拡張可能マークアップ言語
- 構造化データの記述
- SOAP、設定ファイルなどで使用

**XSS (Cross-Site Scripting)**
- クロスサイトスクリプティング攻撃
- Webアプリケーションの脆弱性
- CSP（Content Security Policy）による対策

## Y

**YAML**
- 人間が読みやすいデータシリアライゼーション形式
- 設定ファイル、Infrastructure as Codeで使用
- インデントによる階層構造

## Z

**Zabbix**
- オープンソース統合監視ソフトウェア
- ネットワーク、サーバー、アプリケーション監視
- 豊富なアラート機能、レポート機能

**Zero Downtime Deployment**
- ダウンタイムゼロでのアプリケーション更新
- Blue-Green、Rolling Update、Canary Deploymentなど
- ビジネス継続性の確保

## 技術分野別索引

### ネットワーク
- BGP、CDN、DNS、Firewall、HAProxy、IP Address、Load Balancer、Network、OSI Model、TCP/IP、UDP、VPN、VLAN

### サーバー・仮想化
- Apache HTTP Server、Docker、Hypervisor、Kubernetes、Nginx、VM

### データベース
- Database、MySQL、PostgreSQL、Redis、Backup、ETL

### クラウド
- AWS、Cloud Computing、GCP、IaaS、PaaS、SaaS、Auto Scaling

### セキュリティ
- DDoS、Encryption、Firewall、OAuth、SSL/TLS、WAF、XSS

### 運用・監視
- Grafana、Incident Management、Monitoring、Prometheus、SLA、Zabbix

### 開発・デプロイ
- CI/CD、Git、Microservices、REST、Terraform、Zero Downtime Deployment

## エラーメッセージ索引

### HTTP エラー
- **400 Bad Request**: 不正なリクエスト形式
- **401 Unauthorized**: 認証が必要
- **403 Forbidden**: アクセス権限なし
- **404 Not Found**: リソースが存在しない
- **500 Internal Server Error**: サーバー内部エラー
- **502 Bad Gateway**: 上位サーバーからの不正応答
- **503 Service Unavailable**: サービス利用不可
- **504 Gateway Timeout**: 上位サーバーの応答タイムアウト

### データベースエラー
- **Connection refused**: データベース接続拒否
- **Deadlock**: デッドロック発生
- **Lock timeout**: ロックタイムアウト
- **Table doesn't exist**: テーブルが存在しない
- **Too many connections**: 接続数上限

### システムエラー
- **Permission denied**: 権限不足
- **No space left on device**: ディスク容量不足
- **Memory allocation failed**: メモリ不足
- **Network unreachable**: ネットワーク到達不可
- **Segmentation fault**: セグメンテーション違反

## プロトコル・ポート番号一覧

### よく使用されるポート番号
- **20/21**: FTP（データ/制御）
- **22**: SSH
- **23**: Telnet
- **25**: SMTP
- **53**: DNS
- **80**: HTTP
- **110**: POP3
- **143**: IMAP
- **443**: HTTPS
- **993**: IMAPS
- **995**: POP3S
- **3306**: MySQL
- **5432**: PostgreSQL
- **6379**: Redis
- **8080**: HTTP代替
- **27017**: MongoDB

---

この用語集は継続的に更新され、新しい技術やトレンドに対応していきます。トラブルシューティング時の参考資料として活用してください。