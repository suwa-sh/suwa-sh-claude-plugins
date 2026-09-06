resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = var.name_prefix

  reputation_options {
    reputation_metrics_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_sesv2_email_identity" "domain" {
  count          = var.sending_domain == "" ? 0 : 1
  email_identity = var.sending_domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# TODO: DNS に DKIM CNAME / SPF TXT / DMARC TXT（p=quarantine）を登録する
# TODO: 本番稼働前に SES サンドボックス解除を申請する（リードタイム 24〜48 時間）

resource "aws_sesv2_configuration_set_event_destination" "events" {
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  event_destination_name = "delivery-events"

  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"]

    event_bridge_destination {
      event_bus_arn = "arn:aws:events:ap-northeast-1:${data.aws_caller_identity.current.account_id}:event-bus/default"
    }
  }
}

data "aws_caller_identity" "current" {}
