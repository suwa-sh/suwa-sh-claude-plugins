locals {
  buckets = {
    static = { kms = var.data_kms_key_arn, versioning = true }
    logs   = { kms = var.logs_kms_key_arn, versioning = false }
    backup = { kms = var.data_kms_key_arn, versioning = true }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets
  bucket   = "${var.name_prefix}-${each.key}"
}

# 全バケットで匿名公開アクセスを禁止する（REQ-OBJ-001 / foundation public_storage_forbidden）
resource "aws_s3_bucket_public_access_block" "this" {
  for_each                = aws_s3_bucket.this
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = local.buckets
  bucket   = aws_s3_bucket.this[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = each.value.kms
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = { for k, v in local.buckets : k => v if v.versioning }
  bucket   = aws_s3_bucket.this[each.key].id

  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.this["logs"].id

  rule {
    id     = "tiering"
    status = "Enabled"

    filter {}

    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }

    expiration { days = 365 }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.this["backup"].id

  rule {
    id     = "tiering"
    status = "Enabled"

    filter {}

    transition {
      days          = 35
      storage_class = "GLACIER_IR"
    }

    expiration { days = 400 }
  }
}
