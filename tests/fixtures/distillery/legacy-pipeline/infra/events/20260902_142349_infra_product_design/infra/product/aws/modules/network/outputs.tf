output "vpc_id" { value = aws_vpc.this.id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "app_private_subnet_ids" { value = aws_subnet.app_private[*].id }
output "data_private_subnet_ids" { value = aws_subnet.data_private[*].id }
output "app_security_group_id" { value = aws_security_group.app.id }
