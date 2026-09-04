resource "aws_elasticache_subnet_group" "this" {
  name       = var.name_prefix
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "cache" {
  name        = "${var.name_prefix}-cache"
  description = "ElastiCache"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group]
  }
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name_prefix}-valkey8"
  family = "valkey8"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name_prefix
  description          = "${var.name_prefix} key-value cache"

  engine         = "valkey"
  engine_version = "8.0"
  node_type      = "cache.t4g.micro"
  port           = 6379

  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.cache.id]
  parameter_group_name = aws_elasticache_parameter_group.this.name

  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_arn

  # TODO: AUTH トークンを Secrets Manager の値から設定する
  # auth_token = data.aws_secretsmanager_secret_version.cache.secret_string
}
