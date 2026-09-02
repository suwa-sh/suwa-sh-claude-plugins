variable "name_prefix" {
  type = string
}
variable "staff_allowed_cidrs" {
  type    = list(string)
  default = []
}
