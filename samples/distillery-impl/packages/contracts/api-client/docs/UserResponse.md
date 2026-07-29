
# UserResponse

利用者レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`userNumber` | string
`name` | string
`contact` | string
`email` | string
`userType` | string
`registeredAt` | Date

## Example

```typescript
import type { UserResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "userNumber": null,
  "name": null,
  "contact": null,
  "email": null,
  "userType": null,
  "registeredAt": null,
} satisfies UserResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as UserResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


