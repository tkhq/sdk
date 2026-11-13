import { DemoApp } from "../components/DemoApp";
import { getDemo } from "../runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const demo = await getDemo();
  return <DemoApp initialState={demo.state()} />;
}
