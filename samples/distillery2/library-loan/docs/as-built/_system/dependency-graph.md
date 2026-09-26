# 依存グラフ (抽出)

## 実態 (dependency-cruiser)

コードの import から抽出した実際の依存。

```mermaid
graph LR
  n__repo["@repo"]
  n__storybook["@storybook"]
  n_apps_backend_api["apps/backend-api"]
  n_apps_frontend["apps/frontend"]
  n_apps_worker["apps/worker"]
  n_async_hooks["async_hooks"]
  n_crypto["crypto"]
  n_fs["fs"]
  n_http["http"]
  n_node_modules["node_modules"]
  n_packages_contracts["packages/contracts"]
  n_packages_test_support["packages/test-support"]
  n_packages_ui["packages/ui"]
  n_path["path"]
  n_url["url"]
  n_apps_backend_api --> n__repo
  n_apps_backend_api --> n_async_hooks
  n_apps_backend_api --> n_crypto
  n_apps_backend_api --> n_fs
  n_apps_backend_api --> n_http
  n_apps_backend_api --> n_node_modules
  n_apps_backend_api --> n_packages_contracts
  n_apps_backend_api --> n_path
  n_apps_backend_api --> n_url
  n_apps_frontend --> n_node_modules
  n_apps_frontend --> n_packages_contracts
  n_apps_frontend --> n_packages_ui
  n_apps_worker --> n_node_modules
  n_packages_test_support --> n_async_hooks
  n_packages_test_support --> n_crypto
  n_packages_test_support --> n_fs
  n_packages_test_support --> n_node_modules
  n_packages_test_support --> n_path
  n_packages_ui --> n__storybook
  n_packages_ui --> n_node_modules
```

## 違反

| from | to | rule | severity |
|---|---|---|---|
| apps/worker/src/index.ts | apps/worker/src/index.ts | no-orphans | warn |
| apps/worker/src/test-app.ts | apps/worker/src/test-app.ts | no-orphans | warn |
| packages/contracts/library-db/tables.ts | packages/contracts/library-db/tables.ts | no-orphans | warn |
