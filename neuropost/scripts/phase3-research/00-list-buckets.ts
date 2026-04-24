import { createClient } from '@supabase/supabase-js';
import { config }       from 'dotenv';
import { resolve }      from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await s.storage.listBuckets();
  if (error) return console.error(error);
  console.log(data.map((b: any) => `${b.name}  public=${b.public}`).join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
