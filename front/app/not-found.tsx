import Link from "next/link";
import { Button } from "@/components/ui";
import { LuFileQuestion } from "react-icons/lu";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-mint border border-teal-primary/20 flex items-center justify-center text-teal-dark mb-4">
        <LuFileQuestion className="w-7 h-7 stroke-[1.75]" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">
        Clinical Record or Page Not Found
      </h1>
      <p className="text-xs sm:text-sm text-slate-muted max-w-sm mt-2 mb-6 leading-relaxed">
        The page or medical resource you are searching for does not exist or may have been archived.
      </p>
      <Link href="/dashboard">
        <Button variant="primary" size="md">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
