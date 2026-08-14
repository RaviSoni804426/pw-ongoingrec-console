'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';
import { useTranscriptSearch } from '@/lib/queries';

/**
 * Search across what was actually said.
 *
 * Transcripts are stored in the script they were spoken in — Devanagari stays
 * Devanagari — so matching is Unicode-normalised rather than the text being
 * rewritten. A search for "NEET" also finds the Devanagari renderings the
 * engine produces, because the same term comes back both ways inside a single
 * conversation and partial results that look complete are worse than none.
 */
export default function SearchPage() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  const results = useTranscriptSearch(query);

  return (
    <>
      <PageHeader
        title="Search recordings"
        description="Finds words in either script. Every search is recorded against your account."
      />

      <div className="space-y-4 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft);
          }}
          className="flex gap-2"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="A word or phrase — JEE, नीत, scholarship…"
            aria-label="Search transcripts"
            className="max-w-lg"
            data-testid="transcript-search-input"
          />
          <Button type="submit" data-testid="transcript-search-submit">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </form>

        {results.isPending && query ? <LoadingBlock label="Searching…" /> : null}
        {results.isError ? <ErrorBlock error={results.error} /> : null}

        {results.data && results.data.total === 0 ? (
          <EmptyBlock>
            Nothing matched “{results.data.query}”. Recordings are only searchable once they have
            been transcribed.
          </EmptyBlock>
        ) : null}

        {results.data && results.data.total > 0 ? (
          <>
            <p className="text-sm text-muted-foreground" data-testid="search-count">
              {results.data.total} recording{results.data.total === 1 ? '' : 's'} mention this.
            </p>

            <div className="space-y-3">
              {results.data.items.map((item) => (
                <Card key={item.conversationId} data-testid="search-result">
                  <CardContent className="space-y-2 p-4">
                    <Link
                      href={`/conversations/${item.conversationId}`}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                      data-testid="search-result-link"
                    >
                      Open this recording
                    </Link>

                    <ul className="space-y-1">
                      {item.hits.map((hit, i) => (
                        <li key={`${hit.startMs}-${i}`} className="text-sm">
                          <span className="tabular mr-2 text-xs text-muted-foreground">
                            {formatClock(hit.startMs / 1000)}
                          </span>
                          {hit.speakerRole ? (
                            <span className="mr-1 text-xs text-muted-foreground">
                              {hit.speakerRole}:
                            </span>
                          ) : null}
                          {/* Shown in the original script: this is the evidence,
                              and a normalised copy would not be. */}
                          {hit.text}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
