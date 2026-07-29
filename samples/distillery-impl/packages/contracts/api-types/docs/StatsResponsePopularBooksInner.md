
# StatsResponsePopularBooksInner


## Properties

Name | Type
------------ | -------------
`book_id` | string
`title` | string
`loan_count` | number

## Example

```typescript
import type { StatsResponsePopularBooksInner } from ''

// TODO: Update the object below with actual values
const example = {
  "book_id": null,
  "title": null,
  "loan_count": null,
} satisfies StatsResponsePopularBooksInner

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as StatsResponsePopularBooksInner
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


