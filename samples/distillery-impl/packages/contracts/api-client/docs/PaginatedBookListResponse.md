
# PaginatedBookListResponse

ページネーション付き書籍一覧

## Properties

Name | Type
------------ | -------------
`items` | [Array&lt;BookResponse&gt;](BookResponse.md)
`total` | number
`page` | number
`perPage` | number

## Example

```typescript
import type { PaginatedBookListResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "items": null,
  "total": null,
  "page": null,
  "perPage": null,
} satisfies PaginatedBookListResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PaginatedBookListResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


