
# LoanResponse

貸出レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`bookId` | string
`bookTitle` | string
`userId` | string
`loanDate` | Date
`dueDate` | Date
`returnDate` | Date
`isOverdue` | boolean

## Example

```typescript
import type { LoanResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookId": null,
  "bookTitle": null,
  "userId": null,
  "loanDate": null,
  "dueDate": null,
  "returnDate": null,
  "isOverdue": null,
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


