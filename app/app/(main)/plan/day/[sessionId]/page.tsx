'use client';
import { useParams, useRouter } from 'next/navigation';
import { SessionDetailModal } from '@/components/workout';

// Thin route wrapper — the session detail + edit lives in one shared modal.
export default function DayDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  return <SessionDetailModal sessionId={sessionId} onClose={() => router.back()} />;
}
