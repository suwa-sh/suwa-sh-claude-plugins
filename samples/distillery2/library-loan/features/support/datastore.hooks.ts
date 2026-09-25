/**
 * datastore.hooks.ts — シナリオごとに埋め込み DB を空にする (シナリオ間の隔離)。
 * 前提データは各シナリオの「前提」step が入れる (library-fixtures.ts)。
 */
import { Before } from '@cucumber/cucumber';
import { resetDatastore } from './datastore';

Before(async () => {
  await resetDatastore();
});
