output "static_bucket_id" { value = aws_s3_bucket.this["static"].id }
output "static_bucket_arn" { value = aws_s3_bucket.this["static"].arn }
output "static_bucket_regional_domain_name" { value = aws_s3_bucket.this["static"].bucket_regional_domain_name }
output "logs_bucket_id" { value = aws_s3_bucket.this["logs"].id }
output "logs_bucket_domain_name" { value = aws_s3_bucket.this["logs"].bucket_domain_name }
output "backup_bucket_id" { value = aws_s3_bucket.this["backup"].id }
