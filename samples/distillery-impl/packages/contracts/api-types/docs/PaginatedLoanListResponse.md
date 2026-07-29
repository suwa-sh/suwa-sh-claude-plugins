
# PaginatedLoanListResponse

ページネーション付き貸出一覧

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;LoanResponse&gt;](LoanResponse.md)
`total` | number
`page` | number
`per_page` | number

## Example

```typescript
import type { PaginatedLoanListResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "total": null,
  "page": null,
  "per_page": null,
} satisfies PaginatedLoanListResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PaginatedLoanListResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


