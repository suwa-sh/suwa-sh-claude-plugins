---
source_url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html"
fetched_at: "2026-04-12T07:26:49Z"
vendor: "aws"
layer: "product"
---

available versions, see [Available PostgreSQL database versions](./PostgreSQL.Concepts.General.DBVersions.html).

You can create DB instances and DB snapshots, point-in-time restores and backups. DB instances running PostgreSQL support Multi-AZ deployments, read replicas, Provisioned IOPS, and can be created inside a virtual private cloud (VPC). You can also use Secure Socket Layer (SSL) to connect to a DB instance running PostgreSQL.

Before creating a DB instance, make sure to complete the steps in [Setting up your Amazon RDS environment](./CHAP_SettingUp.html).

You can use any standard SQL client application to run commands for the instance from your client computer. Such applications include pgAdmin, a popular Open Source administration and development tool for PostgreSQL, or psql, a command line utility that is part of a PostgreSQL installation. To deliver a managed service experience, Amazon RDS doesn\'t provide host access to DB instances. Also, it restricts access to certain system procedures and tables that require advanced privileges. Amazon RDS supports access to databases on a DB instance using any standard SQL client application. Amazon RDS doesn\'t allow direct host access to a DB instance by using Telnet or Secure Shell (SSH).

Amazon RDS for PostgreSQL is compliant with many industry standards. For example, you can use Amazon RDS for PostgreSQL databases to build HIPAA-compliant applications and to store healthcare-related information. This includes storage for protected health information (PHI) under a completed Business Associate Agreement (BAA) with AWS. Amazon RDS for PostgreSQL also meets Federal Risk and Authorization Management Program (FedRAMP) security requirements. Amazon RDS for PostgreSQL has received a FedRAMP Joint Authorization Board (JAB) Provisional Authority to Operate (P-ATO) at the FedRAMP HIGH Baseline within the AWS GovCloud (US) Regions. For more information on supported compliance standards, see [AWS cloud compliance](https://aws.amazon.com/compliance/){rel="noopener noreferrer" target="_blank"}.

To import PostgreSQL data into a DB instance, follow the information in the [Importing data into PostgreSQL on Amazon RDS](./PostgreSQL.Procedural.Importing.html) section.

::::: {.awsdocs-note .awsdocs-important}
::: awsdocs-note-title
###### Important
:::

::: awsdocs-note-text
If you encounter an issue with your RDS for PostgreSQL DB instance, your AWS support agent might need more information about the health of your databases. The goal is to ensure that AWS Support gets the required information as soon as possible.

You can use PG Collector to help gather valuable database information in a consolidated HTML file. For more information on PG Collector, how to run it, and how to download the HTML report, see [PG Collector](https://github.com/awslabs/pg-collector){rel="noopener noreferrer" target="_blank"}.

Upon successful completion, and unless otherwise noted, the script returns output in a readable HTML format. The script is designed to exclude any data or security details from the HTML that might compromise your business. It also makes no modifications to your database or its environment. However, if you find any information in the HTML that you are uncomfortable sharing, feel free to remove the problematic information before uploading the HTML. When the HTML is acceptable, upload it using the attachments section in the case details of your support case.
:::
:::::

::: highlights
###### Topics

- [Common management tasks for Amazon RDS for PostgreSQL](./CHAP_PostgreSQL.CommonTasks.html)

- [Working with the Database Preview environment](./working-with-the-database-preview-environment.html)

- [Available PostgreSQL database versions](./PostgreSQL.Concepts.General.DBVersions.html)

- [Understanding the RDS for PostgreSQL incremental release process](./PostgreSQL.Concepts.General.ReleaseProcess.html)

- [Supported PostgreSQL extension versions](./PostgreSQL.Concepts.General.FeatureSupport.Extensions.html)

- [Working with PostgreSQL features supported by Amazon RDS for PostgreSQL](./PostgreSQL.Concepts.General.FeatureSupport.html)

- [Connecting to a DB instance running the PostgreSQL database engine](./USER_ConnectToPostgreSQLInstance.html)

- [Securing connections to RDS for PostgreSQL with SSL/TLS](./PostgreSQL.Concepts.General.Security.html)

- [Using Kerberos authentication with Amazon RDS for PostgreSQL](./postgresql-kerberos.html)

- [Using a custom DNS server for outbound network access](./Appendix.PostgreSQL.CommonDBATasks.CustomDNS.html)

- [Upgrades of the RDS for PostgreSQL DB engine](./USER_UpgradeDBInstance.PostgreSQL.html)

- [Upgrading a PostgreSQL DB snapshot engine version](./USER_UpgradeDBSnapshot.PostgreSQL.html)

- [Working with read replicas for Amazon RDS for PostgreSQL](./USER_PostgreSQL.Replication.ReadReplicas.html)

- [Improving query performance for RDS for PostgreSQL with Amazon RDS Optimized Reads](./USER_PostgreSQL.optimizedreads.html)

- [Importing data into PostgreSQL on Amazon RDS](./PostgreSQL.Procedural.Importing.html)

- [Exporting data from an RDS for PostgreSQL DB instance to Amazon S3](./postgresql-s3-export.html)

- [Invoking an AWS Lambda function from an RDS for PostgreSQL DB instance](./PostgreSQL-Lambda.html)

- [Common DBA tasks for Amazon RDS for PostgreSQL](./Appendix.PostgreSQL.CommonDBATasks.html)

- [Tuning with wait events for RDS for PostgreSQL](./PostgreSQL.Tuning.html)

- [Tuning RDS for PostgreSQL with Amazon DevOps Guru proactive insights](./PostgreSQL.Tuning_proactive_insights.html)

- [Using PostgreSQL extensions with Amazon RDS for PostgreSQL](./Appendix.PostgreSQL.CommonDBATasks.Extensions.html)

- [Working with the supported foreign data wrappers for Amazon RDS for PostgreSQL](./Appendix.PostgreSQL.CommonDBATasks.Extensions.foreign-data-wrappers.html)

- [Working with Trusted Language Extensions for PostgreSQL](./PostgreSQL_trusted_language_extension.html)
:::

:::::: {}
::::: {}
:::: {}
::: {#js_error_message}
![Warning](https://d1ge0kk1l5kms0.cloudfront.net/images/G/01/webservices/console/warning.png) **Javascript is disabled or is unavailable in your browser.**

To use the Amazon Web Services Documentation, Javascript must be enabled. Please refer to your browser\'s Help pages for instructions.
:::
::::
:::::
::::::

::::::: {#main-col-footer .awsui-util-font-size-0}
::: {#doc-conventions}
[Document Conventions](/general/latest/gr/docconventions.html){target="_top"}
:::

::::: prev-next
::: {#previous .prev-link accesskey="p" href="./USER_Oracle_Releases.html"}
Oracle Database engine releases
:::

::: {#next .next-link accesskey="n" href="./CHAP_PostgreSQL.CommonTasks.html"}
Common management tasks
:::
:::::
:::::::

::::: {#quick-feedback-yes style="display: none;"}
::: title
Did this page help you? - Yes
:::

::: content
Thanks for letting us know we\'re doing a good job!

If you\'ve got a moment, please tell us what we did right so we can do more of it.
:::
:::::

::::: {#quick-feedback-no style="display: none;"}
::: title
Did this page help you? - No
:::

::: content
Thanks for letting us know this page needs work. We\'re sorry we let you down.

If you\'ve got a moment, please tell us how we can make the documentation better.
:::
:::::

::: {#page-loading-indicator .page-loading-indicator}
:::

::: {#tools-panel dom-region="tools"}
:::
