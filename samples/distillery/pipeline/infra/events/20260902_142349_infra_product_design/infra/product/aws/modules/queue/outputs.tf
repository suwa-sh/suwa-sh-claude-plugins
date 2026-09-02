output "notification_queue_arn" { value = aws_sqs_queue.notification.arn }
output "notification_queue_name" { value = aws_sqs_queue.notification.name }
output "notification_dlq_name" { value = aws_sqs_queue.notification_dlq.name }
output "report_queue_arn" { value = aws_sqs_queue.report.arn }
output "report_dlq_name" { value = aws_sqs_queue.report_dlq.name }
