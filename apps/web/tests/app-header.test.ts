import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const appHeaderPath = join(process.cwd(), 'app/app/_components/app-header.tsx');

test('logged-in header uses a POST logout form for full-page cookie clearing without GET logout links', async () => {
  const source = await readFile(appHeaderPath, 'utf8');

  assert.match(source, /<form action="\/api\/auth\/logout" method="post">/i);
  assert.match(source, /<button type="submit" className="button-secondary button-link">\s*Log out\s*<\/button>/i);
  assert.doesNotMatch(source, /<a href="\/api\/auth\/logout"/i);
  assert.doesNotMatch(source, /<Link href="\/api\/auth\/logout"/i);
});

test('logged-in header shows the user name next to logout', async () => {
  const source = await readFile(appHeaderPath, 'utf8');

  assert.match(source, /userDisplayName/i);
  assert.match(source, /Log out/i);
});
