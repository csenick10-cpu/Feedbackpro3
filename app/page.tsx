import { redirect } from "next/navigation"

export default function Home() {
  // The 0DTE agent dashboard is the primary surface of this app.
  redirect("/spy-agent")
}
