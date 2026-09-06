variable "name_prefix" {
  type = string
}
variable "vpc_id" {
  type = string
}
variable "app_subnet_ids" {
  type = list(string)
}
variable "app_security_group" {
  type = string
}
variable "target_group_arn" {
  type = string
}
variable "rds_secret_arn" {
  type = string
}
variable "cache_secret_arn" {
  type = string
}
variable "notification_queue_arn" {
  type = string
}
variable "report_queue_arn" {
  type = string
}
variable "kms_key_arn" {
  type = string
}
variable "log_retention_days" {
  type    = number
  default = 180
}
variable "api_image" {
  type = string
}
variable "worker_image" {
  type = string
}
variable "batch_image" {
  type = string
}
variable "api_desired_count" {
  type    = number
  default = 2
}
variable "enable_spot" {
  type    = bool
  default = true
}
