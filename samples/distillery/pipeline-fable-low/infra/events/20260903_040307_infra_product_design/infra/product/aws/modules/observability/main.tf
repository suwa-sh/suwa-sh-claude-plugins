resource "aws_sns_topic" "critical" {
  name = "${var.name_prefix}-alert-critical"
}

resource "aws_sns_topic" "warning" {
  name = "${var.name_prefix}-alert-warning"
}

resource "aws_sns_topic_subscription" "critical" {
  count     = length(var.critical_subscribers)
  topic_arn = aws_sns_topic.critical.arn
  protocol  = "email"
  endpoint  = var.critical_subscribers[count.index]
}

resource "aws_sns_topic_subscription" "warning" {
  count     = length(var.warning_subscribers)
  topic_arn = aws_sns_topic.warning.arn
  protocol  = "email"
  endpoint  = var.warning_subscribers[count.index]
}

# ALT-002: API 5xx 率上昇
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.name_prefix}-api-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5
  alarm_actions       = [aws_sns_topic.critical.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "e1"
    expression  = "100 * (m2 / m1)"
    label       = "5xx rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "m2"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = 300
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }
}

# ALT-003: API 応答時間劣化
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.name_prefix}-api-latency-p99"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0.5
  alarm_actions       = [aws_sns_topic.warning.arn]
  dimensions          = { LoadBalancer = var.alb_arn_suffix, TargetGroup = var.target_group_arn_suffix }
  treat_missing_data  = "notBreaching"
}

# ALT-004: 正常ターゲット消失
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.name_prefix}-unhealthy-hosts"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  alarm_actions       = [aws_sns_topic.critical.arn]
  dimensions          = { LoadBalancer = var.alb_arn_suffix, TargetGroup = var.target_group_arn_suffix }
  treat_missing_data  = "breaching"
}

# ALT-005: DLQ 滞留
resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${var.name_prefix}-dlq-depth"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  alarm_actions       = [aws_sns_topic.critical.arn]
  dimensions          = { QueueName = var.notification_dlq_name }
  treat_missing_data  = "notBreaching"
}

# ALT-006: 通知キュー滞留
resource "aws_cloudwatch_metric_alarm" "queue_age" {
  alarm_name          = "${var.name_prefix}-queue-age"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1800
  alarm_actions       = [aws_sns_topic.warning.arn]
  dimensions          = { QueueName = var.notification_queue_name }
  treat_missing_data  = "notBreaching"
}

# ALT-009: DB 空き容量逼迫
resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${var.name_prefix}-db-free-storage"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = 21474836480
  alarm_actions       = [aws_sns_topic.warning.arn]
  dimensions          = { DBInstanceIdentifier = var.db_instance_id }
}

# ALT-012: キャッシュヒット率低下
resource "aws_cloudwatch_metric_alarm" "cache_hit_rate" {
  alarm_name          = "${var.name_prefix}-cache-hit-rate"
  namespace           = "AWS/ElastiCache"
  metric_name         = "CacheHitRate"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 6
  comparison_operator = "LessThanThreshold"
  threshold           = 0.7
  alarm_actions       = [aws_sns_topic.warning.arn]
  dimensions          = { ReplicationGroupId = var.cache_cluster_id }
  treat_missing_data  = "notBreaching"
}

# TODO: Synthetics Canary（5 分間隔の外形監視）を追加する。
#       artifact 用の S3 プレフィックスと Canary スクリプトの配置が必要
