output "rds_secret_arn" { value = aws_secretsmanager_secret.rds.arn }
output "cache_secret_arn" { value = aws_secretsmanager_secret.cache.arn }
output "ses_secret_arn" { value = aws_secretsmanager_secret.ses.arn }
