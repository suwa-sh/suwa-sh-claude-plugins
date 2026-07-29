
# StatsResponse

統計レスポンス

## Properties

Name | Type
------------ | -------------
`period` | string
`total_loans` | number
`popular_books` | [Array&lt;StatsResponsePopularBooksInner&gt;](StatsResponsePopularBooksInner.md)
`monthly_trend` | [Array&lt;StatsResponseMonthlyTrendInner&gt;](StatsResponseMonthlyTrendInner.md)
`by_genre` | [Array&lt;StatsResponseByGenreInner&gt;](StatsResponseByGenreInner.md)

## Example

```typescript
import type { StatsResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "period": null,
  "total_loans": null,
  "popular_books": null,
  "monthly_trend": null,
  "by_genre": null,
} satisfies StatsResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as StatsResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


