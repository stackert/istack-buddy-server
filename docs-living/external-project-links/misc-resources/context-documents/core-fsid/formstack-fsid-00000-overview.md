# Repo: https://github.com/formstack/sso-playground

## Overview FSID

sso-playground is the main fsid repo yeah https://github.com/formstack/sso-playground
We have a number of openapi specs/files in the repo (so you don't necessarilly need to set it up)

- https://github.com/formstack/sso-playground/blob/master/storage/api-docs/api.json `organization-wide-resources/context-documents/artifacts/context-documentation-fsid-00000-overview/api.json` fsid fe api (for user-facing fsid panel)

AI Generated Description:

> Based on the provided API specification, this is Formstack's Identity and Organization Management API that serves as the backbone for their platform's administrative interface. The API handles user identity, organization management, and billing functionality across Formstack's suite of products (including Formstack Classic, Webmerge, and InsureSign).

> Organizations and users interact with this API through Formstack's admin interface to manage various aspects of their account. Key functionalities include: managing user permissions and roles, configuring Single Sign-On (SSO) through SAML or OIDC, handling billing and subscriptions, managing organization settings (including security policies and feature toggles), and controlling access to different Formstack products. It's particularly notable that it supports hierarchical organization structures with parent/child relationships (subaccounts), making it suitable for enterprise customers and resellers who need to manage multiple organizations.

> The API appears to be primarily consumed by Formstack's own frontend applications rather than being a public API for third-party integrations, as evidenced by its comprehensive organization management features and tight integration with Formstack's product suite.

It's my understanding and to be clear this is API supports FSID's Front-End only.

- https://github.com/formstack/sso-playground/blob/master/storage/api-docs/api-docs.json `organization-wide-resources/context-documents/artifacts/context-documentation-fsid-00000-overview/api-docs.json`

AI Generated Description:

> Based on the OpenAPI specification provided, this is Formstack's internal API that facilitates communication between FSID (Formstack Identity) and other Formstack products (like Forms, Documents, etc.). It serves as a crucial backend service handling user authentication, organization management, and billing functionality across the Formstack ecosystem.

> The API provides endpoints for managing organizations, users, billing, sessions, and product settings. Some notable features include: organization migrations, user provisioning, billing management (including add-ons and trials), security features (2FA, password management), and inter-product communication. The API appears to support hierarchical organization structures and complex billing scenarios, including auto-upgrades and usage-based billing for products like Webmerge (now Formstack Documents).

> What's particularly interesting is that this is specifically an internal API (as opposed to the customer-facing API), used for service-to-service communication within Formstack's architecture. This is evidenced by the server configurations (pointing to internal environments like admin.formstack.com) and the comprehensive access to sensitive operations like user migrations and billing management. The API uses bearer token authentication and appears to be well-documented with detailed schemas for various operations and events.

- https://github.com/formstack/sso-playground/blob/master/storage/api-docs/api-partner-docs.json `organization-wide-resources/context-documents/artifacts/context-documentation-fsid-00000-overview/api-partner-docs.json`

- partner api (customer facing) / subaccounts api

AI Generated Description:

> This is Formstack's Partner API, which appears to be designed specifically for managing subaccounts and SSO configurations in a multi-tenant or reseller environment. It's a customer-facing API that allows partners (likely enterprise customers or resellers) to programmatically manage their subaccounts and their associated configurations.

> The API provides three main functionalities: listing subaccounts, retrieving app API keys for subaccounts, and managing SSO configurations. It includes detailed information about each subaccount, including usage metrics across different Formstack products (Forms, Documents, Sign), admin users for each product, and creation dates. The API also provides comprehensive SSO configuration capabilities, supporting both SAML and OIDC protocols, as well as social authentication methods like Google and Apple.

> What's particularly noteworthy is the API's focus on enterprise-level features and multi-tenant management. It appears designed for partners who need to programmatically manage multiple customer accounts (subaccounts) under their organization, with detailed usage tracking and SSO management capabilities. The API uses bearer token authentication and provides structured responses for usage metrics, making it suitable for integration into partner dashboards or management systems.
