
# LoanResponse

貸出レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`book_id` | string
`book_title` | string
`user_id` | string
`loan_date` | Date
`due_date` | Date
`return_date` | Date
`is_overdue` | boolean

## Example

```typescript
import type { LoanResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "book_id": null,
  "book_title": null,
  "user_id": null,
  "loan_date": null,
  "due_date": null,
  "return_date": null,
  "is_overdue": null,
} satisfies LoanResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as LoanResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


