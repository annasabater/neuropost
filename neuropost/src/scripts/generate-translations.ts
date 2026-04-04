/**
 * Generates translation JSON files for all locales using the Claude API.
 * Run with: npx ts-node src/scripts/generate-translations.ts
 *
 * Requires ANTHROPIC_API_KEY in environment.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic();

const sourceFile = JSON.parse(
  fs.readFileSync('./src/i18n/locales/es.json', 'utf-8'),
);

const targetLanguages: Record<string, string> = {
  en: 'English',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ca: 'Catalan',
};

async function generateTranslation(lang: string, langName: string) {
  console.log(`Generating ${langName} translation...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `Translate this JSON from Spanish to ${langName}.

Rules:
- Keep ALL keys exactly the same (do not translate keys)
- Only translate the string values
- Keep {variables} exactly as they are: {name}, {count}, {used}, {limit}, etc.
- Keep emojis exactly as they are
- Keep → arrows exactly as they are
- Return ONLY valid JSON, no explanation, no markdown code fences
- Keep a professional but friendly tone appropriate for a SaaS app

JSON to translate:
${JSON.stringify(sourceFile, null, 2)}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  const outputPath = `./src/i18n/locales/${lang}.json`;
  fs.writeFileSync(outputPath, text.trim());
  console.log(`✓ ${lang}.json written`);
}

async function main() {
  for (const [lang, langName] of Object.entries(targetLanguages)) {
    await generateTranslation(lang, langName);
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('✅ All translations generated');
}

main().catch(console.error);
