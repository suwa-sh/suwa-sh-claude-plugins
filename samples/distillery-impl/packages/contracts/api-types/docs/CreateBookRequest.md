
# CreateBookRequest

書籍登録リクエスト

## Properties

Name | Type
------------ | -------------
`title` | string
`author` | string
`isbn` | string
`publisher` | string
`genre` | string
`material_type` | string
`location` | string

## Example

```typescript
import type { CreateBookRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "title": null,
  "author": null,
  "isbn": null,
  "publisher": null,
  "genre": null,
  "material_type": null,
  "location": null,
} satisfies CreateBookRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateBookRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


