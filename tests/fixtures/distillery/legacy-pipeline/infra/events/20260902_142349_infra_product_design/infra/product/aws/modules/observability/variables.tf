variable "name_prefix" {
  type = string
}
variable "log_retention_days" {
  type    = number
  default = 180
}
variable "alb_arn_suffix" {
  type = string
}
variable "target_group_arn_suffix" {
  type = string
}
variable "db_instance_id" {
  type = string
}
variable "cache_cluster_id" {
  type = string
}
variable "notification_queue_name" {
  type = string
}
variable "notification_dlq_name" {
  type = string
}
variable "critical_subscribers" {
  type    = list(string)
  default = []
}
variable "warning_subscribers" {
  type    = list(string)
  default = []
}
