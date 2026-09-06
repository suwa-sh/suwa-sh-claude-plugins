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
variable "num_cache_clusters" {
  type    = number
  default = 2
}
variable "auth_token_secret_arn" {
  type = string
}
