
# InventoryResponse

在庫状況レスポンス

## Properties

Name | Type
------------ | -------------
`total_books` | number
`available_count` | number
`on_loan_count` | number
`overdue_count` | number
`by_genre` | [Array&lt;InventoryResponseByGenreInner&gt;](InventoryResponseByGenreInner.md)

## Example

```typescript
import type { InventoryResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "total_books": null,
  "available_count": null,
  "on_loan_count": null,
  "overdue_count": null,
  "by_genre": null,
} satisfies InventoryResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as InventoryResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


