/**
 * library-hooks.ts — 貸出業務の UC BDD のシナリオ後片付け (シナリオごとに起動した pglite を閉じる)。
 */
import { After } from '@cucumber/cucumber';
import { closeLibraryOf } from './library-scenario';
import type { D2World } from './world';

After(async function (this: D2World) {
  await closeLibraryOf(this);
});
