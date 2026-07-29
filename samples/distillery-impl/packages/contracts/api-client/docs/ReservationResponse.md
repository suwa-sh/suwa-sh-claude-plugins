
# ReservationResponse

予約レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`bookId` | string
`bookTitle` | string
`userId` | string
`reservedAt` | Date
`queuePosition` | number
`status` | string

## Example

```typescript
import type { ReservationResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "bookId": null,
  "bookTitle": null,
  "userId": null,
  "reservedAt": null,
  "queuePosition": null,
  "status": null,
} satisfies ReservationResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReservationResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


