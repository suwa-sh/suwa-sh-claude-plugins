variable "name_prefix" {
  type = string
}
variable "subnet_ids" {
  type = list(string)
}
variable "vpc_id" {
  type = string
}
variable "app_security_group" {
  type = string
}
variable "kms_key_arn" {
  type = string
}
variable "multi_az" {
  type    = bool
  default = true
}
variable "instance_class" {
  type    = string
  default = "db.t4g.medium"
}
variable "master_secret_arn" {
  type = string
}
