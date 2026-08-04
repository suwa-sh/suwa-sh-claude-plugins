"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export interface SearchQuery {
  keyword: string;
  genres: string[];
  materialTypes: string[];
}

export interface BookSearchFilterProps {
  onSearch: (query: SearchQuery) => void;
  genres: string[];
  materialTypes: string[];
}

const toggleStyle = (selected: boolean) => ({
  background: selected ? "var(--primary)" : "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-full)",
  color: selected ? "var(--primary-foreground)" : "var(--foreground)",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
  padding: "var(--spacing-2) var(--spacing-3)",
});

/** キーワード、ジャンル、資料種別を組み合わせる蔵書検索フィルター。 */
export function BookSearchFilter({ onSearch, genres, materialTypes }: BookSearchFilterProps) {
  const [keyword, setKeyword] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch({ keyword, genres: selectedGenres, materialTypes: selectedTypes });
  };

  return (
    <form
      onSubmit={submit}
      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "var(--card-radius)", display: "grid", gap: "var(--spacing-4)", padding: "var(--card-padding)" }}
    >
      <div style={{ alignItems: "end", display: "grid", gap: "var(--spacing-3)", gridTemplateColumns: "minmax(0, 1fr) auto" }}>
        <label style={{ display: "grid", gap: "var(--spacing-2)", minWidth: 0 }}>
          <span style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>キーワード</span>
          <input
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="書名・著者名・ISBNで検索"
            style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--input-radius)", color: "var(--foreground)", height: "var(--input-height)", minWidth: 0, padding: "0 var(--input-padding-x)" }}
            value={keyword}
          />
        </label>
        <Button type="submit"><Icon name="search" size={16} aria-hidden />検索</Button>
      </div>

      <fieldset style={{ border: 0, display: "grid", gap: "var(--spacing-2)", margin: 0, padding: 0 }}>
        <legend style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", marginBottom: "var(--spacing-2)" }}>ジャンル</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
          {genres.map((genre) => <button aria-pressed={selectedGenres.includes(genre)} key={genre} onClick={() => toggle(genre, selectedGenres, setSelectedGenres)} style={toggleStyle(selectedGenres.includes(genre))} type="button">{genre}</button>)}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, display: "grid", gap: "var(--spacing-2)", margin: 0, padding: 0 }}>
        <legend style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", marginBottom: "var(--spacing-2)" }}>資料種別</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-2)" }}>
          {materialTypes.map((type) => <button aria-pressed={selectedTypes.includes(type)} key={type} onClick={() => toggle(type, selectedTypes, setSelectedTypes)} style={toggleStyle(selectedTypes.includes(type))} type="button">{type}</button>)}
        </div>
      </fieldset>
    </form>
  );
}
