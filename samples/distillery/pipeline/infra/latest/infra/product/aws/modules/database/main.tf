resource "aws_db_subnet_group" "this" {
  name       = var.name_prefix
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db"
  description = "RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group]
  }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-pg16"
  family = "postgres16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }
}

resource "aws_db_instance" "this" {
  identifier     = var.name_prefix
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.multi_az

  # RPO 4h を PITR で満たす（REQ-DB-002）
  backup_retention_period = 14
  # UTC 表記。JST 04:30-05:30 に相当し、日次バッチ（JST 02:00）と競合しない
  backup_window = "19:30-20:30"
  # UTC 表記。JST 日曜 02:00-03:00（計画停止枠内）
  maintenance_window         = "sun:17:00-sun:18:00"
  copy_tags_to_snapshot      = true
  deletion_protection        = true
  auto_minor_version_upgrade = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  parameter_group_name = aws_db_parameter_group.this.name

  manage_master_user_password   = true
  master_user_secret_kms_key_id = var.kms_key_arn
  username                      = "libms_admin"

  # TODO: 初期スキーマは マイグレーションツールで適用する
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-final"
}
