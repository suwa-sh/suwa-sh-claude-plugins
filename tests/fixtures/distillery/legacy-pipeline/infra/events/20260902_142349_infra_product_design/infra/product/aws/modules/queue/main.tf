resource "aws_sqs_queue" "notification_dlq" {
  name                              = "${var.name_prefix}-notification-dlq"
  message_retention_seconds         = 1209600
  kms_master_key_id                 = var.kms_key_arn
  kms_data_key_reuse_period_seconds = 300
}

resource "aws_sqs_queue" "notification" {
  name                              = "${var.name_prefix}-notification"
  visibility_timeout_seconds        = 300
  message_retention_seconds         = 345600
  kms_master_key_id                 = var.kms_key_arn
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "report_dlq" {
  name                      = "${var.name_prefix}-report-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = var.kms_key_arn
}

resource "aws_sqs_queue" "report" {
  name                       = "${var.name_prefix}-report"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600
  kms_master_key_id          = var.kms_key_arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.report_dlq.arn
    maxReceiveCount     = 3
  })
}
