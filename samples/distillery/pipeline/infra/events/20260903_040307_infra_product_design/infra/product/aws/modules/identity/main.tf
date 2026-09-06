resource "aws_cognito_user_pool" "this" {
  name = var.name_prefix

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  # 総当たり検知とアカウントロック（REQ-IDP-002）
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  mfa_configuration = "OPTIONAL"

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_group" "patron" {
  name         = "patron"
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_group" "staff" {
  name         = "staff"
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true
  # TODO: コールバック URL を設定する
  callback_urls                = ["https://example.invalid/callback"]
  supported_identity_providers = ["COGNITO"]
}
