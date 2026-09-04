variable "name_prefix" {
  type = string
}
variable "cidr_block" {
  type = string
}
variable "availability_zones" {
  type = list(string)
}
variable "nat_gateway_count" {
  type    = number
  default = 1
}
variable "log_retention_days" {
  type    = number
  default = 180
}
