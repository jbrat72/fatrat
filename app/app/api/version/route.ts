import { APP_VERSION } from '@/lib/version';

// Each deployment ships its own APP_VERSION baked into the bundle. The UI
// polls this endpoint to detect when a newer deployment has gone live.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return Response.json(
    { version: APP_VERSION },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );
}
