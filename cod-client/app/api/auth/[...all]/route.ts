import { initAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await initAuth();
  return auth.handler(req);
}

export async function POST(req: Request) {
  const auth = await initAuth();
  return auth.handler(req);
}
