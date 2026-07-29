
# ReturnLoanResponse

返却レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`bookTitle` | string
`returnDate` | Date

## Example

```typescript
import type { ReturnLoanResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookTitle": null,
  "returnDate": null,
} satisfies ReturnLoanResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReturnLoanResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


