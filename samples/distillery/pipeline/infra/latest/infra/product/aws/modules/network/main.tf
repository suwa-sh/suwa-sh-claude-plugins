# VPC: 2 AZ x 3 層（public / app-private / data-private）
# 正本: product-impl-aws.yaml components[id=network]

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = { Name = "${var.name_prefix}-public-${count.index}", tier = "public" }
}

resource "aws_subnet" "app_private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.name_prefix}-app-${count.index}", tier = "app-private" }
}

resource "aws_subnet" "data_private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index + 20)
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.name_prefix}-data-${count.index}", tier = "data-private" }
}

# NAT はコスト最適化のため 1 AZ に集約する（product-cost-hints.yaml: data_transfer）
resource "aws_eip" "nat" {
  count  = var.nat_gateway_count
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = var.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "app_private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[0].id
  }
}

resource "aws_route_table_association" "app_private" {
  count          = length(aws_subnet.app_private)
  subnet_id      = aws_subnet.app_private[count.index].id
  route_table_id = aws_route_table.app_private[count.index].id
}

# data-private は 0.0.0.0/0 の経路を持たない（REQ-NET-001）
resource "aws_route_table" "data_private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-data-rt" }
}

resource "aws_route_table_association" "data_private" {
  count          = length(aws_subnet.data_private)
  subnet_id      = aws_subnet.data_private[count.index].id
  route_table_id = aws_route_table.data_private.id
}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app"
  description = "ECS tasks"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.ap-northeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(aws_route_table.app_private[*].id, [aws_route_table.data_private.id])
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/vpc/${var.name_prefix}/flow-logs"
  retention_in_days = var.log_retention_days
}
