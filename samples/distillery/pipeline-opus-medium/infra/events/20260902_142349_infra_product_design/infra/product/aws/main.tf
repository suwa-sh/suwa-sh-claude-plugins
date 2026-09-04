###############################################################################
# 図書館蔵書管理システム — AWS プロダクトインフラ（スケルトン）
#
# 正本: docs/mcl/product/output/product-impl-aws.yaml
# このファイルは静的検証（terraform validate）に通る骨格であり、
# プレースホルダーには # TODO: を付けている。apply はユーザーが実行する。
###############################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # TODO: リモートステートのバックエンドを設定する
  # backend "s3" {
  #   bucket         = "libms-tfstate"
  #   key            = "product/aws/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   dynamodb_table = "libms-tfstate-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      system      = var.system_name
      environment = var.environment
      managed_by  = "terraform"
    }
  }
}

locals {
  name_prefix = "${var.system_name}-${var.environment}"

  # 非本番は冗長構成を落としてコストを下げる（product-cost-hints.yaml: non_production）
  is_production = var.environment == "prod"
}

module "network" {
  source = "./modules/network"

  name_prefix        = local.name_prefix
  cidr_block         = var.vpc_cidr
  availability_zones = var.availability_zones
  nat_gateway_count  = local.is_production ? 1 : 1
  log_retention_days = var.log_retention_days
}

module "kms" {
  source = "./modules/kms"

  name_prefix = local.name_prefix
}

module "storage" {
  source = "./modules/storage"

  name_prefix      = local.name_prefix
  data_kms_key_arn = module.kms.data_key_arn
  logs_kms_key_arn = module.kms.logs_key_arn
}

module "secrets" {
  source = "./modules/secrets"

  name_prefix = local.name_prefix
  kms_key_arn = module.kms.data_key_arn
}

module "identity" {
  source = "./modules/identity"

  name_prefix = local.name_prefix
}

module "queue" {
  source = "./modules/queue"

  name_prefix = local.name_prefix
  kms_key_arn = module.kms.data_key_arn
}

module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  subnet_ids         = module.network.data_private_subnet_ids
  vpc_id             = module.network.vpc_id
  app_security_group = module.network.app_security_group_id
  kms_key_arn        = module.kms.data_key_arn
  multi_az           = local.is_production
  instance_class     = var.db_instance_class
  master_secret_arn  = module.secrets.rds_secret_arn
}

module "cache" {
  source = "./modules/cache"

  name_prefix           = local.name_prefix
  subnet_ids            = module.network.data_private_subnet_ids
  vpc_id                = module.network.vpc_id
  app_security_group    = module.network.app_security_group_id
  kms_key_arn           = module.kms.data_key_arn
  num_cache_clusters    = local.is_production ? 2 : 1
  auth_token_secret_arn = module.secrets.cache_secret_arn
}

module "waf" {
  source = "./modules/waf"

  name_prefix = local.name_prefix
  # TODO: 館内ネットワークのグローバル IP を設定する（product-decision-004）
  staff_allowed_cidrs = var.staff_allowed_cidrs
}

module "alb" {
  source = "./modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  logs_bucket       = module.storage.logs_bucket_id
  web_acl_arn       = module.waf.web_acl_arn
  # TODO: ACM 証明書 ARN を設定する
  certificate_arn = var.certificate_arn
}

module "cdn" {
  source = "./modules/cdn"

  name_prefix          = local.name_prefix
  static_bucket_id     = module.storage.static_bucket_id
  static_bucket_arn    = module.storage.static_bucket_arn
  static_bucket_domain = module.storage.static_bucket_regional_domain_name
  logs_bucket_domain   = module.storage.logs_bucket_domain_name
}

module "email" {
  source = "./modules/email"

  name_prefix = local.name_prefix
  # TODO: 送信ドメインを設定し、DKIM / SPF / DMARC の DNS レコードを登録する
  sending_domain = var.sending_domain
}

module "observability" {
  source = "./modules/observability"

  name_prefix             = local.name_prefix
  log_retention_days      = var.log_retention_days
  alb_arn_suffix          = module.alb.arn_suffix
  target_group_arn_suffix = module.alb.target_group_arn_suffix
  db_instance_id          = module.database.instance_id
  cache_cluster_id        = module.cache.replication_group_id
  notification_queue_name = module.queue.notification_queue_name
  notification_dlq_name   = module.queue.notification_dlq_name
  # TODO: 通知先メールアドレスを設定する
  critical_subscribers = var.critical_subscribers
  warning_subscribers  = var.warning_subscribers
}

module "compute" {
  source = "./modules/compute"

  name_prefix            = local.name_prefix
  vpc_id                 = module.network.vpc_id
  app_subnet_ids         = module.network.app_private_subnet_ids
  app_security_group     = module.network.app_security_group_id
  target_group_arn       = module.alb.target_group_arn
  rds_secret_arn         = module.secrets.rds_secret_arn
  cache_secret_arn       = module.secrets.cache_secret_arn
  notification_queue_arn = module.queue.notification_queue_arn
  report_queue_arn       = module.queue.report_queue_arn
  kms_key_arn            = module.kms.data_key_arn
  log_retention_days     = var.log_retention_days
  # TODO: コンテナイメージの URI を設定する
  api_image         = var.api_image
  worker_image      = var.worker_image
  batch_image       = var.batch_image
  api_desired_count = local.is_production ? 2 : 1
  enable_spot       = true
}

module "backup" {
  source = "./modules/backup"

  name_prefix     = local.name_prefix
  kms_key_arn     = module.kms.data_key_arn
  db_instance_arn = module.database.instance_arn
}
