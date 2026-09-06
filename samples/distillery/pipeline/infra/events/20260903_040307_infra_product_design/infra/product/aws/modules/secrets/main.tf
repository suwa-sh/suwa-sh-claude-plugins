resource "aws_secretsmanager_secret" "rds" {
  name       = "${var.name_prefix}/rds/app"
  kms_key_id = var.kms_key_arn
}

resource "aws_secretsmanager_secret" "cache" {
  name       = "${var.name_prefix}/cache/auth-token"
  kms_key_id = var.kms_key_arn
}

resource "aws_secretsmanager_secret" "ses" {
  name       = "${var.name_prefix}/ses/config"
  kms_key_id = var.kms_key_arn
}

# TODO: RDS のマネージドローテーション（30 日）を有効化する
