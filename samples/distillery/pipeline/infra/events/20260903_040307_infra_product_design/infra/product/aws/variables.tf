variable "system_name" {
  description = "システム識別子。全リソースのプレフィックスとタグに使う"
  type        = string
  default     = "libms"
}

variable "environment" {
  description = "環境名"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかにする。"
  }
}

variable "region" {
  description = "デプロイ先リージョン。foundation-context の allowed_regions.aws に従う"
  type        = string
  default     = "ap-northeast-1"

  validation {
    condition     = var.region == "ap-northeast-1"
    error_message = "データ所在地 japan と foundation ガードレールにより ap-northeast-1 のみ許可する。"
  }
}

variable "availability_zones" {
  description = "配置する AZ。冗長化要件により 2 つ以上"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "AZ 冗長のため 2 つ以上の AZ を指定する。"
  }
}

variable "vpc_cidr" {
  description = "VPC の CIDR"
  type        = string
  default     = "10.20.0.0/16"
}

variable "log_retention_days" {
  description = "ログ保管期間。NFR C.6.1.1（6 ヶ月）に対応"
  type        = number
  default     = 180

  validation {
    condition     = var.log_retention_days >= 180
    error_message = "ログ保管期間は 180 日以上にする（NFR C.6.1.1）。"
  }
}

variable "db_instance_class" {
  description = "RDS インスタンスクラス"
  type        = string
  default     = "db.t4g.medium"
}

variable "staff_allowed_cidrs" {
  description = "職員ポータルへのアクセスを許可する館内ネットワークの CIDR"
  type        = list(string)
  default     = []
  # TODO: 図書館側で固定グローバル IP を確認して設定する（product-decision-004）
}

variable "certificate_arn" {
  description = "ALB に紐付ける ACM 証明書の ARN"
  type        = string
  default     = ""
  # TODO: ACM で証明書を発行して設定する
}

variable "sending_domain" {
  description = "SES の送信ドメイン"
  type        = string
  default     = ""
  # TODO: 送信ドメインを設定する
}

variable "api_image" {
  description = "バックエンド API のコンテナイメージ URI"
  type        = string
  default     = ""
  # TODO: ECR のイメージ URI を設定する
}

variable "worker_image" {
  description = "ワーカーのコンテナイメージ URI"
  type        = string
  default     = ""
  # TODO: ECR のイメージ URI を設定する
}

variable "batch_image" {
  description = "日次バッチのコンテナイメージ URI"
  type        = string
  default     = ""
  # TODO: ECR のイメージ URI を設定する
}

variable "critical_subscribers" {
  description = "critical アラートの通知先メールアドレス"
  type        = list(string)
  default     = []
  # TODO: 運用担当と保守ベンダの連絡先を設定する
}

variable "warning_subscribers" {
  description = "warning アラートの通知先メールアドレス"
  type        = list(string)
  default     = []
  # TODO: 運用担当の連絡先を設定する
}
