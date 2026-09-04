resource "aws_backup_vault" "this" {
  name        = var.name_prefix
  kms_key_arn = var.kms_key_arn
}

data "aws_iam_policy_document" "assume_backup" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${var.name_prefix}-backup"
  assume_role_policy = data.aws_iam_policy_document.assume_backup.json
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_backup_plan" "this" {
  name = var.name_prefix

  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.this.name
    # UTC 表記。JST 04:30。日次バッチ（JST 02:00 開始）と競合しない（REQ-BKP-003）
    schedule          = "cron(30 19 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = 35
    }
  }
}

resource "aws_backup_selection" "rds" {
  name         = "${var.name_prefix}-rds"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.this.id
  resources    = [var.db_instance_arn]
}

# 遠隔リージョンへのコピーは行わない（product-decision-005）
# 災害対策が必要になった場合は aws_backup_plan.rule.copy_action を追加する
