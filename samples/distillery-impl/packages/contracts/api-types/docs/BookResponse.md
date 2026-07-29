
# BookResponse

書籍レスポンス

## Properties

Name | Type
------------ | -------------
`id` | string
`title` | string
`author` | string
`isbn` | string
`publisher` | string
`genre` | string
`material_type` | string
`location` | string
`status` | string
`created_at` | Date
`updated_at` | Date

## Example

```typescript
import type { BookResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "title": null,
  "author": null,
  "isbn": null,
  "publisher": null,
  "genre": null,
  "material_type": null,
  "location": null,
  "status": null,
  "created_at": null,
  "updated_at": null,
} satisfies BookResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BookResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


