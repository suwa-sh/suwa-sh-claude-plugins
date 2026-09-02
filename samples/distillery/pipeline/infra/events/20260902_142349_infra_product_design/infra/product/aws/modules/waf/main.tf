# 館内ネットワーク許可リスト（product-decision-004）
resource "aws_wafv2_ip_set" "staff" {
  name               = "${var.name_prefix}-staff-allowlist"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  # TODO: 図書館側の固定グローバル IP を設定する。空の間は職員面が全拒否になる
  addresses = var.staff_allowed_cidrs
}

resource "aws_wafv2_web_acl" "this" {
  name  = var.name_prefix
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "common-rule-set"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common-rule-set"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "known-bad-inputs"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # ベースライン 10rps x スパイク 3 倍に対する保護余裕（REQ-EDGE-002）
  rule {
    name     = "global-rate-limit"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 3000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "global-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name_prefix
    sampled_requests_enabled   = true
  }
}
