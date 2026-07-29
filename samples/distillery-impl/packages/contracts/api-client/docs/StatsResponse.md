
# StatsResponse

統計レスポンス

## Properties

Name | Type
------------ | -------------
`period` | string
`totalLoans` | number
`popularBooks` | [Array&lt;StatsResponsePopularBooksInner&gt;](StatsResponsePopularBooksInner.md)
`monthlyTrend` | [Array&lt;StatsResponseMonthlyTrendInner&gt;](StatsResponseMonthlyTrendInner.md)
`byGenre` | [Array&lt;StatsResponseByGenreInner&gt;](StatsResponseByGenreInner.md)

## Example

```typescript
import type { StatsResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "period": null,
  "totalLoans": null,
  "popularBooks": null,
  "monthlyTrend": null,
  "byGenre": null,
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


