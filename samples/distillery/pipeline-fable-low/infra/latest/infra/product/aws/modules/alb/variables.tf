variable "name_prefix" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "public_subnet_ids" {
  type = list(string)
}
variable "logs_bucket" {
  type = string
}
variable "web_acl_arn" {
  type = string
}
variable "certificate_arn" {
  type = string
}
