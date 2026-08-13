'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ErrorBlock } from '@/components/ui/spinner';
import { useCentres, useCounsellors, useCreateCounsellor, useCreateEnrollToken } from '@/lib/queries';

export default function EnrollPage() {
  const centres = useCentres();
  const [centreId, setCentreId] = useState('');
  const counsellors = useCounsellors({ centreId: centreId || undefined });

  const createCounsellor = useCreateCounsellor();
  const createToken = useCreateEnrollToken();

  const [form, setForm] = useState({ name: '', email: '', employeeId: '' });
  const [selected, setSelected] = useState('');
  const [copied, setCopied] = useState(false);

  const canCreate =
    form.name.trim() && form.email.trim() && form.employeeId.trim() && centreId;

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader
        title="Enrollment"
        description="Create a counsellor and mint the one-time token their laptop needs to provision."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Add a counsellor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Centre">
              <select
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
                aria-label="Centre"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Select a centre…</option>
                {centres.data?.map((centre) => (
                  <option key={centre._id} value={centre._id}>
                    {centre.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-label="Counsellor name"
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-label="Counsellor email"
              />
            </Field>

            <Field label="Employee ID">
              <Input
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                aria-label="Employee ID"
              />
            </Field>

            <Button
              disabled={!canCreate || createCounsellor.isPending}
              onClick={() =>
                createCounsellor.mutate(
                  { ...form, centreId },
                  { onSuccess: () => setForm({ name: '', email: '', employeeId: '' }) },
                )
              }
            >
              Create counsellor
            </Button>

            {createCounsellor.isError ? <ErrorBlock error={createCounsellor.error} /> : null}
            {createCounsellor.isSuccess ? (
              <p className="text-sm text-rag-good">Counsellor created.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Generate a provisioning token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Counsellor">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Counsellor to enrol"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Select a counsellor…</option>
                {counsellors.data?.map((counsellor) => (
                  <option key={counsellor._id} value={counsellor._id}>
                    {counsellor.name} ({counsellor.employeeId ?? 'no id'})
                  </option>
                ))}
              </select>
            </Field>

            <Button
              disabled={!selected || createToken.isPending}
              onClick={() => createToken.mutate(selected)}
              data-testid="generate-token"
            >
              Generate token
            </Button>

            {createToken.isError ? <ErrorBlock error={createToken.error} /> : null}

            {createToken.data ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Single use. Shown once — it is stored only as a hash.
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 break-all rounded bg-background px-2 py-1 font-mono text-xs"
                    data-testid="enroll-token"
                  >
                    {createToken.data.enrollToken}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Copy token"
                    onClick={() => void copyToken(createToken.data.enrollToken)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(createToken.data.expiresAt).toLocaleString()}
                </p>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Silent install command</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono text-[11px]">
{`msiexec /i OngoingRec-Setup.msi /qn ^
  ENROLLMENT_TOKEN=${createToken.data.enrollToken} ^
  EMPLOYEE_ID=${createToken.data.employeeId ?? 'EMP000'} ^
  CENTRE_ID=${createToken.data.centreId}`}
                  </pre>
                </details>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">{label}</label>
    {children}
  </div>
);
