# DefaultApi

All URIs are relative to *https://api.librashelf.example.com*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cancelReservation**](DefaultApi.md#cancelreservation) | **DELETE** /api/v1/reservations/{id} | 予約キャンセル |
| [**createBook**](DefaultApi.md#createbookoperation) | **POST** /api/v1/books | 書籍登録 |
| [**createLoan**](DefaultApi.md#createloanoperation) | **POST** /api/v1/loans | 書籍貸出 |
| [**createReservation**](DefaultApi.md#createreservationoperation) | **POST** /api/v1/reservations | 書籍予約 |
| [**createUser**](DefaultApi.md#createuseroperation) | **POST** /api/v1/users | 利用者登録 |
| [**deleteBook**](DefaultApi.md#deletebook) | **DELETE** /api/v1/books/{id} | 書籍削除 |
| [**detectOverdue**](DefaultApi.md#detectoverdue) | **POST** /api/v1/loans/detect-overdue | 延滞検出バッチトリガー |
| [**getBook**](DefaultApi.md#getbook) | **GET** /api/v1/books/{id} | 書籍詳細取得 |
| [**getInventory**](DefaultApi.md#getinventory) | **GET** /api/v1/inventory | 在庫状況取得 |
| [**getMyLoans**](DefaultApi.md#getmyloans) | **GET** /api/v1/users/me/loans | 自分の貸出履歴取得 |
| [**getMyReservations**](DefaultApi.md#getmyreservations) | **GET** /api/v1/users/me/reservations | 自分の予約状況取得 |
| [**getStats**](DefaultApi.md#getstats) | **GET** /api/v1/stats | 統計レポート取得 |
| [**getUser**](DefaultApi.md#getuser) | **GET** /api/v1/users/{id} | 利用者情報取得 |
| [**listLoans**](DefaultApi.md#listloans) | **GET** /api/v1/loans | 貸出一覧取得（司書用） |
| [**listMyReservations**](DefaultApi.md#listmyreservations) | **GET** /api/v1/reservations | 自分の予約一覧取得 |
| [**listOverdueLoans**](DefaultApi.md#listoverdueloans) | **GET** /api/v1/loans/overdue | 延滞一覧取得 |
| [**returnLoan**](DefaultApi.md#returnloan) | **PUT** /api/v1/loans/{id}/return | 書籍返却 |
| [**searchBooks**](DefaultApi.md#searchbooks) | **GET** /api/v1/books | 書籍検索 |
| [**sendOverdueNotification**](DefaultApi.md#sendoverduenotificationoperation) | **POST** /api/v1/notifications/overdue | 督促通知送信トリガー |
| [**updateBook**](DefaultApi.md#updatebookoperation) | **PUT** /api/v1/books/{id} | 書籍情報更新 |
| [**updateUser**](DefaultApi.md#updateuseroperation) | **PUT** /api/v1/users/{id} | 利用者情報更新 |



## cancelReservation

> cancelReservation(id, xIdempotencyKey)

予約キャンセル

予約受付中の予約をキャンセルする。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CancelReservationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    xIdempotencyKey: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies CancelReservationRequest;

  try {
    const data = await api.cancelReservation(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **xIdempotencyKey** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | キャンセル成功 |  -  |
| **404** | 予約が見つからない |  -  |
| **409** | キャンセル不可（予約確保済等） |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createBook

> BookResponse createBook(createBookRequest)

書籍登録

新規書籍を蔵書として登録する。登録時の初期状態は「在庫あり」。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateBookOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // CreateBookRequest
    createBookRequest: ...,
  } satisfies CreateBookOperationRequest;

  try {
    const data = await api.createBook(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createBookRequest** | [CreateBookRequest](CreateBookRequest.md) |  | |

### Return type

[**BookResponse**](BookResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | 登録成功 |  -  |
| **400** | バリデーションエラー |  -  |
| **409** | ISBN重複 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createLoan

> LoanResponse createLoan(xIdempotencyKey, createLoanRequest)

書籍貸出

書籍の貸出手続きを行う。貸出可否判定ルール・貸出期限ルールを適用。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateLoanOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | 冪等キー
    xIdempotencyKey: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateLoanRequest
    createLoanRequest: ...,
  } satisfies CreateLoanOperationRequest;

  try {
    const data = await api.createLoan(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **xIdempotencyKey** | `string` | 冪等キー | [Defaults to `undefined`] |
| **createLoanRequest** | [CreateLoanRequest](CreateLoanRequest.md) |  | |

### Return type

[**LoanResponse**](LoanResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | 貸出成功 |  -  |
| **409** | 貸出不可（在庫なし/予約あり/冪等キー重複） |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createReservation

> ReservationResponse createReservation(xIdempotencyKey, createReservationRequest)

書籍予約

貸出中の書籍に予約を申請する。予約優先ルールに基づき予約順を決定。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateReservationOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    xIdempotencyKey: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateReservationRequest
    createReservationRequest: ...,
  } satisfies CreateReservationOperationRequest;

  try {
    const data = await api.createReservation(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **xIdempotencyKey** | `string` |  | [Defaults to `undefined`] |
| **createReservationRequest** | [CreateReservationRequest](CreateReservationRequest.md) |  | |

### Return type

[**ReservationResponse**](ReservationResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | 予約成功 |  -  |
| **409** | 予約不可 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createUser

> UserResponse createUser(createUserRequest)

利用者登録

新規利用者を登録する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateUserOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // CreateUserRequest
    createUserRequest: ...,
  } satisfies CreateUserOperationRequest;

  try {
    const data = await api.createUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **createUserRequest** | [CreateUserRequest](CreateUserRequest.md) |  | |

### Return type

[**UserResponse**](UserResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | 登録成功 |  -  |
| **400** | バリデーションエラー |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteBook

> deleteBook(id)

書籍削除

在庫あり状態の書籍を削除する。貸出中・延滞中の書籍は削除不可。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DeleteBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteBookRequest;

  try {
    const data = await api.deleteBook(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | 削除成功 |  -  |
| **404** | 書籍が見つからない |  -  |
| **409** | 貸出中/延滞中のため削除不可 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## detectOverdue

> DetectOverdue200Response detectOverdue()

延滞検出バッチトリガー

返却期限超過の貸出を検出し延滞フラグを設定する。日次バッチのトリガー。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DetectOverdueRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  try {
    const data = await api.detectOverdue();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**DetectOverdue200Response**](DetectOverdue200Response.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 検出結果 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getBook

> BookResponse getBook(id)

書籍詳細取得

指定IDの書籍情報を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetBookRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | 書籍ID
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetBookRequest;

  try {
    const data = await api.getBook(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | 書籍ID | [Defaults to `undefined`] |

### Return type

[**BookResponse**](BookResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 書籍情報 |  -  |
| **404** | 書籍が見つからない |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getInventory

> InventoryResponse getInventory()

在庫状況取得

全書籍の在庫状態サマリーとジャンル別蔵書数を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetInventoryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  try {
    const data = await api.getInventory();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**InventoryResponse**](InventoryResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 在庫状況 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getMyLoans

> PaginatedLoanListResponse getMyLoans(page, perPage)

自分の貸出履歴取得

ログインユーザーの貸出履歴（過去・現在）を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetMyLoansRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    perPage: 56,
  } satisfies GetMyLoansRequest;

  try {
    const data = await api.getMyLoans(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **perPage** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedLoanListResponse**](PaginatedLoanListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 貸出履歴 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getMyReservations

> PaginatedReservationListResponse getMyReservations(page, perPage)

自分の予約状況取得

ログインユーザーの予約一覧を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetMyReservationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    perPage: 56,
  } satisfies GetMyReservationsRequest;

  try {
    const data = await api.getMyReservations(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **perPage** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedReservationListResponse**](PaginatedReservationListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 予約状況 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getStats

> StatsResponse getStats(period)

統計レポート取得

貸出回数ランキング、期間別統計を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // '1m' | '3m' | '6m' | '12m' | 'all' | 集計期間 (optional)
    period: period_example,
  } satisfies GetStatsRequest;

  try {
    const data = await api.getStats(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **period** | `1m`, `3m`, `6m`, `12m`, `all` | 集計期間 | [Optional] [Defaults to `&#39;12m&#39;`] [Enum: 1m, 3m, 6m, 12m, all] |

### Return type

[**StatsResponse**](StatsResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 統計データ |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getUser

> UserResponse getUser(id)

利用者情報取得

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetUserRequest;

  try {
    const data = await api.getUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**UserResponse**](UserResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 利用者情報 |  -  |
| **404** | 利用者が見つからない |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listLoans

> PaginatedLoanListResponse listLoans(status, page, perPage)

貸出一覧取得（司書用）

全利用者の貸出一覧を取得する。ページネーション・ステータスフィルター対応。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ListLoansRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // 'active' | 'overdue' | 'all' | 貸出ステータスフィルター (optional)
    status: status_example,
    // number (optional)
    page: 56,
    // number (optional)
    perPage: 56,
  } satisfies ListLoansRequest;

  try {
    const data = await api.listLoans(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **status** | `active`, `overdue`, `all` | 貸出ステータスフィルター | [Optional] [Defaults to `&#39;active&#39;`] [Enum: active, overdue, all] |
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **perPage** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedLoanListResponse**](PaginatedLoanListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 貸出一覧 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listMyReservations

> PaginatedReservationListResponse listMyReservations(page, perPage)

自分の予約一覧取得

ログインユーザーの予約一覧を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ListMyReservationsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    perPage: 56,
  } satisfies ListMyReservationsRequest;

  try {
    const data = await api.listMyReservations(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **perPage** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedReservationListResponse**](PaginatedReservationListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 予約一覧 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listOverdueLoans

> PaginatedLoanListResponse listOverdueLoans(page, perPage)

延滞一覧取得

延滞中の貸出一覧を取得する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ListOverdueLoansRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    perPage: 56,
  } satisfies ListOverdueLoansRequest;

  try {
    const data = await api.listOverdueLoans(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **perPage** | `number` |  | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedLoanListResponse**](PaginatedLoanListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 延滞一覧 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## returnLoan

> ReturnLoanResponse returnLoan(id, xIdempotencyKey)

書籍返却

書籍の返却手続きを行う。予約がある場合は予約通知をトリガー。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ReturnLoanRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    xIdempotencyKey: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ReturnLoanRequest;

  try {
    const data = await api.returnLoan(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **xIdempotencyKey** | `string` |  | [Defaults to `undefined`] |

### Return type

[**ReturnLoanResponse**](ReturnLoanResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 返却成功 |  -  |
| **404** | 貸出が見つからない |  -  |
| **409** | 既に返却済み |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## searchBooks

> PaginatedBookListResponse searchBooks(keyword, genre, materialType, page, perPage)

書籍検索

キーワード、ジャンル、資料種別で書籍を検索する。ページネーション対応。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SearchBooksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | 検索キーワード（タイトル、著者、ISBNで部分一致検索） (optional)
    keyword: keyword_example,
    // '文学' | '理工' | '児童書' | '社会科学' | '自然科学' | '芸術' | 'その他' | 書籍ジャンルフィルター (optional)
    genre: genre_example,
    // '紙書籍' | '電子書籍' | 資料種別フィルター (optional)
    materialType: materialType_example,
    // number | ページ番号 (optional)
    page: 56,
    // number | 1ページあたり件数 (optional)
    perPage: 56,
  } satisfies SearchBooksRequest;

  try {
    const data = await api.searchBooks(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **keyword** | `string` | 検索キーワード（タイトル、著者、ISBNで部分一致検索） | [Optional] [Defaults to `undefined`] |
| **genre** | `文学`, `理工`, `児童書`, `社会科学`, `自然科学`, `芸術`, `その他` | 書籍ジャンルフィルター | [Optional] [Defaults to `undefined`] [Enum: 文学, 理工, 児童書, 社会科学, 自然科学, 芸術, その他] |
| **materialType** | `紙書籍`, `電子書籍` | 資料種別フィルター | [Optional] [Defaults to `undefined`] [Enum: 紙書籍, 電子書籍] |
| **page** | `number` | ページ番号 | [Optional] [Defaults to `1`] |
| **perPage** | `number` | 1ページあたり件数 | [Optional] [Defaults to `20`] |

### Return type

[**PaginatedBookListResponse**](PaginatedBookListResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 検索結果 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## sendOverdueNotification

> sendOverdueNotification(sendOverdueNotificationRequest)

督促通知送信トリガー

延滞者への督促メール送信をトリガーする。MQ経由で非同期処理。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SendOverdueNotificationOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // SendOverdueNotificationRequest
    sendOverdueNotificationRequest: ...,
  } satisfies SendOverdueNotificationOperationRequest;

  try {
    const data = await api.sendOverdueNotification(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **sendOverdueNotificationRequest** | [SendOverdueNotificationRequest](SendOverdueNotificationRequest.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** | 通知送信受付完了 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateBook

> BookResponse updateBook(id, updateBookRequest)

書籍情報更新

既存書籍の情報を更新する。

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { UpdateBookOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateBookRequest
    updateBookRequest: ...,
  } satisfies UpdateBookOperationRequest;

  try {
    const data = await api.updateBook(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **updateBookRequest** | [UpdateBookRequest](UpdateBookRequest.md) |  | |

### Return type

[**BookResponse**](BookResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 更新成功 |  -  |
| **400** | バリデーションエラー |  -  |
| **404** | 書籍が見つからない |  -  |
| **409** | ISBN重複 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateUser

> UserResponse updateUser(id, updateUserRequest)

利用者情報更新

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { UpdateUserOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // To configure OAuth2 access token for authorization: oauth2 accessCode
    accessToken: "YOUR ACCESS TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateUserRequest
    updateUserRequest: ...,
  } satisfies UpdateUserOperationRequest;

  try {
    const data = await api.updateUser(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |
| **updateUserRequest** | [UpdateUserRequest](UpdateUserRequest.md) |  | |

### Return type

[**UserResponse**](UserResponse.md)

### Authorization

[oauth2 accessCode](../README.md#oauth2-accessCode)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | 更新成功 |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

