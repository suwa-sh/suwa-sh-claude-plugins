output "arn" { value = aws_lb.this.arn }
output "arn_suffix" { value = aws_lb.this.arn_suffix }
output "dns_name" { value = aws_lb.this.dns_name }
output "target_group_arn" { value = aws_lb_target_group.api.arn }
output "target_group_arn_suffix" { value = aws_lb_target_group.api.arn_suffix }
output "security_group_id" { value = aws_security_group.alb.id }
