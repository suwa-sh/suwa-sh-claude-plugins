
# PaginatedReservationListResponse

ページネーション付き予約一覧

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;ReservationResponse&gt;](ReservationResponse.md)
`total` | number
`page` | number
`per_page` | number

## Example

```typescript
import type { PaginatedReservationListResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "total": null,
  "page": null,
  "per_page": null,
} satisfies PaginatedReservationListResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PaginatedReservationListResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


